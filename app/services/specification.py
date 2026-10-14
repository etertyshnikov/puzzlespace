# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session

from app.models import Specification, Project, SpecificationItem, SpecificationPhoto
from app.services import user_activity as activity_service


def list_all(db: Session, skip: int = 0, limit: int = 10000) -> list[Specification]:
    return (
        db.query(Specification)
        .order_by(Specification.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def list_for_project_ids(
    db: Session,
    project_ids: set[int],
    *,
    skip: int = 0,
    limit: int = 10000,
) -> list[Specification]:
    if not project_ids:
        return []
    return (
        db.query(Specification)
        .filter(Specification.project_id.in_(project_ids))
        .order_by(Specification.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def list_by_project(db: Session, project_id: int) -> list[Specification]:
    return db.query(Specification).filter(Specification.project_id == project_id).order_by(Specification.id).all()


def get_by_id(db: Session, specification_id: int) -> Specification | None:
    return db.query(Specification).filter(Specification.id == specification_id).first()


def _next_specification_number(db: Session, project_id: int | None) -> str | None:
    """Номер спецификации A00001-P01-S01. Если нет project_id или у проекта нет project_number — None."""
    if not project_id:
        return None
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not getattr(project, "project_number", None):
        return None
    prefix = project.project_number  # A00001-P01
    specs = (
        db.query(Specification.number)
        .filter(Specification.project_id == project_id, Specification.number.isnot(None), Specification.number.like(f"{prefix}-S%"))
        .all()
    )
    max_s = 0
    for (num,) in specs:
        if num and len(num) >= len(prefix) + 4 and num.startswith(prefix + "-S") and num[len(prefix) + 2 :].isdigit():
            max_s = max(max_s, int(num[len(prefix) + 2 :]))
    return f"{prefix}-S{max_s + 1:02d}"


def create(db: Session, *, actor_user_id: int | None = None, **data) -> Specification:
    project_id = data.get("project_id")
    if data.get("length_m") is None:
        data["length_m"] = 5
    if data.get("width_m") is None:
        data["width_m"] = 6
    if data.get("floors") is None:
        data["floors"] = 1
    if data.get("room_count") is None:
        data["room_count"] = 1
    if data.get("wall_height_m") is None:
        data["wall_height_m"] = 2.8
    if not data.get("building_type"):
        data["building_type"] = "house"
    if data.get("number") is None and getattr(Specification, "number", None) is not None:
        data["number"] = _next_specification_number(db, project_id)
    obj = Specification(**data)
    db.add(obj)
    db.flush()
    if actor_user_id:
        activity_service.log_event(
            db,
            actor_user_id,
            activity_service.EVENT_SPECIFICATION_CREATED,
            entity_type="specification",
            entity_id=obj.id,
            project_id=obj.project_id,
        )
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, specification_id: int, **data) -> Specification | None:
    row = db.query(Specification).filter(Specification.id == specification_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, specification_id: int) -> bool:
    row = db.query(Specification).filter(Specification.id == specification_id).first()
    if not row:
        return False
    db.query(SpecificationItem).filter(SpecificationItem.specification_id == specification_id).delete()
    db.delete(row)
    db.commit()
    return True


def duplicate(db: Session, specification_id: int) -> Specification | None:
    """Создать копию спецификации с теми же данными и скопировать все позиции."""
    source = db.query(Specification).filter(Specification.id == specification_id).first()
    if not source:
        return None
    new_data = {
        "customer_id": source.customer_id,
        "project_id": source.project_id,
        "status_id": source.status_id,
        "number": None,
        "description": source.description,
        "kp_approved": False,
        "kp_internal_comment": getattr(source, "kp_internal_comment", None),
        "comment": getattr(source, "comment", None),
        "length_m": source.length_m if getattr(source, "length_m", None) is not None else 5,
        "width_m": source.width_m if getattr(source, "width_m", None) is not None else 6,
        "floors": source.floors if getattr(source, "floors", None) is not None else 1,
        "room_count": getattr(source, "room_count", None),
        "double_timber": bool(getattr(source, "double_timber", False)),
        "terrace_length_m": getattr(source, "terrace_length_m", None),
        "terrace_width_m": getattr(source, "terrace_width_m", None),
        "balcony_length_m": getattr(source, "balcony_length_m", None),
        "terrace_second_floor": bool(getattr(source, "terrace_second_floor", False)),
        "wall_height_m": getattr(source, "wall_height_m", None)
        if getattr(source, "wall_height_m", None) is not None
        else 2.8,
        "building_type": getattr(source, "building_type", None) or "house",
    }
    new_spec = create(db, **new_data)
    items = db.query(SpecificationItem).filter(SpecificationItem.specification_id == specification_id).order_by(SpecificationItem.id).all()
    for it in items:
        db.add(
            SpecificationItem(
                specification_id=new_spec.id,
                part_id=it.part_id,
                template_id=it.template_id,
                nomenclature_item_id=it.nomenclature_item_id,
                item_name=it.item_name,
                quantity=it.quantity,
                unit=it.unit or "шт",
                price=it.price,
                discount_percent=getattr(it, "discount_percent", 0),
                total=it.total,
                description=it.description,
                qty_basis=getattr(it, "qty_basis", None),
                qty_multiplier=getattr(it, "qty_multiplier", None),
                qty_use_floors=getattr(it, "qty_use_floors", None),
                quantity_auto=getattr(it, "quantity_auto", None),
                quantity_manual=getattr(it, "quantity_manual", None),
                template_line_no=getattr(it, "template_line_no", None),
                include_in_total=bool(getattr(it, "include_in_total", True)),
            )
        )
    source_photos = (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.specification_id == specification_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
        .all()
    )
    for photo in source_photos:
        db.add(
            SpecificationPhoto(
                specification_id=new_spec.id,
                house_specification_template_id=None,
                image_data=photo.image_data,
                content_type=photo.content_type,
                filename=photo.filename,
                sort_order=photo.sort_order,
            )
        )
    db.commit()
    from app.services import specification_item as item_service
    item_service._recalc_spec_total_amount(db, new_spec.id)
    db.refresh(new_spec)
    return new_spec
