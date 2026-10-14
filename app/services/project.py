# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Customer, Project, ProjectStatusLog
from app.services.cascade_delete import delete_projects_bundle
from app.services import user_activity as activity_service


def list_all(db: Session, skip: int = 0, limit: int = 100) -> list[Project]:
    return db.query(Project).offset(skip).limit(limit).all()


def list_by_customer(db: Session, customer_id: int) -> list[Project]:
    return db.query(Project).filter(Project.customer_id == customer_id).order_by(Project.id).all()


def list_by_status(db: Session, status_id: int, skip: int = 0, limit: int = 500) -> list[Project]:
    return (
        db.query(Project)
        .filter(Project.status_id == status_id)
        .order_by(Project.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_by_id(db: Session, project_id: int) -> Project | None:
    return db.query(Project).filter(Project.id == project_id).first()


def next_project_number(db: Session, customer_id: int) -> str | None:
    """Номер проекта в виде A00001-P01 (клиент + P + 2 цифры). Если у клиента нет number — возвращает None."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer or not getattr(customer, "number", None):
        return None
    prefix = customer.number  # A00001
    projects = (
        db.query(Project.project_number)
        .filter(Project.customer_id == customer_id, Project.project_number.isnot(None), Project.project_number.like(f"{prefix}-P%"))
        .all()
    )
    max_p = 0
    for (pn,) in projects:
        if pn and len(pn) >= len(prefix) + 4 and pn.startswith(prefix + "-P") and pn[len(prefix) + 2 :].isdigit():
            max_p = max(max_p, int(pn[len(prefix) + 2 :]))
    return f"{prefix}-P{max_p + 1:02d}"


def create(db: Session, *, actor_user_id: int | None = None, **data) -> Project:
    customer_id = data.get("customer_id")
    if data.get("project_number") is None and customer_id is not None:
        data["project_number"] = next_project_number(db, customer_id)
    obj = Project(**data)
    db.add(obj)
    db.flush()
    if actor_user_id:
        activity_service.log_event(
            db,
            actor_user_id,
            activity_service.EVENT_PROJECT_CREATED,
            entity_type="project",
            entity_id=obj.id,
            project_id=obj.id,
        )
    db.commit()
    db.refresh(obj)
    return obj


def update(
    db: Session,
    project_id: int,
    *,
    changed_by_user_id: int | None = None,
    **data,
) -> Project | None:
    row = db.query(Project).filter(Project.id == project_id).first()
    if not row:
        return None
    old_status_id = getattr(row, "status_id", None)
    new_status_id = data.get("status_id")
    if "status_id" in data:
        data["status_started_at"] = datetime.utcnow()
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    if new_status_id is not None and (old_status_id != new_status_id):
        log = ProjectStatusLog(
            project_id=project_id,
            old_status_id=old_status_id,
            new_status_id=new_status_id,
            changed_by_user_id=changed_by_user_id,
            changed_at=datetime.utcnow(),
        )
        db.add(log)
        activity_service.log_status_change(
            db,
            changed_by_user_id,
            project_id,
            int(new_status_id),
            old_status_id=old_status_id,
        )
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, project_id: int) -> bool:
    """Удалить проект и связанные сущности (заказы, спецификации, КП, фото, данные договора и т.д.)."""
    if not db.query(Project.id).filter(Project.id == project_id).first():
        return False

    try:
        delete_projects_bundle(db, [project_id])
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return True
