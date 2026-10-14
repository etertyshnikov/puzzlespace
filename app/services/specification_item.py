# -*- coding: utf-8 -*-
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import SpecificationItem, NomenclatureItem, Specification, HouseTemplate
from app.models.crm import SpecificationPhoto
from app.services import house_template as house_template_service
from app.services import qty_basis_rules as qbr
from app.spec_template_lines import default_include_in_total_for_template_line


def _discount_factor(discount_percent: Any) -> float:
    try:
        d = float(discount_percent) if discount_percent is not None else 0.0
    except (TypeError, ValueError):
        d = 0.0
    if d < 0:
        d = 0.0
    if d > 100:
        d = 100.0
    return (100.0 - d) / 100.0


def _round_to_step(value: float, step: float) -> float:
    if step <= 0:
        return value
    return round(value / step) * step


def _price_after_discount(price: Any, discount_percent: Any) -> float:
    p = float(price or 0)
    discounted = p * _discount_factor(discount_percent)
    # По требованию: цена после скидки округляется до 10
    return _round_to_step(discounted, 10.0)


def _row_total(quantity: Any, price: Any, discount_percent: Any) -> float:
    q = float(quantity or 0)
    # По требованию: итог после применения скидки округляется до 50
    return _round_to_step(q * _price_after_discount(price, discount_percent), 50.0)


def _recalc_spec_total_amount(db: Session, specification_id: int) -> None:
    """Пересчитать total_amount: сумма total позиций с include_in_total=True."""
    subq = (
        select(func.coalesce(func.sum(SpecificationItem.total), 0))
        .where(SpecificationItem.specification_id == specification_id)
        .where(SpecificationItem.include_in_total.is_(True))
    )
    total = db.execute(subq).scalar()
    if total is not None:
        spec = db.query(Specification).filter(Specification.id == specification_id).first()
        if spec:
            spec.total_amount = float(total) if not isinstance(total, (int, float)) else total
            db.commit()


def _backfill_part_id_from_nomenclature(db: Session, item: SpecificationItem) -> None:
    """Если у позиции нет part_id, но есть nomenclature_item_id — взять part_id из номенклатуры и сохранить."""
    if item.part_id is not None or not item.nomenclature_item_id:
        return
    nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == item.nomenclature_item_id).first()
    if nom and nom.part_id is not None:
        item.part_id = nom.part_id
        db.commit()
        db.refresh(item)


def list_by_specification(db: Session, specification_id: int) -> list[SpecificationItem]:
    items = (
        db.query(SpecificationItem)
        .filter(SpecificationItem.specification_id == specification_id)
        .order_by(SpecificationItem.part_id.nulls_last(), SpecificationItem.id)
        .all()
    )
    for item in items:
        _backfill_part_id_from_nomenclature(db, item)
    return items


_NOT_PROVIDED_LABEL = "не предусмотрено"


def _label_is_not_provided(label: str) -> bool:
    return _NOT_PROVIDED_LABEL in (label or "").strip().lower()


def is_kp_excluded_item(db: Session, item: SpecificationItem) -> bool:
    """Позиция с материалом «Не предусмотрено» — в КП не показываем, в приложении к договору остаётся."""
    nom_id = getattr(item, "nomenclature_item_id", None)
    if nom_id:
        nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == nom_id).first()
        if nom:
            label = (nom.name or nom.item_number or "").strip()
            if _label_is_not_provided(label):
                return True
    label = (getattr(item, "item_name", None) or "").strip()
    return _label_is_not_provided(label)


def list_for_kp(db: Session, specification_id: int) -> list[SpecificationItem]:
    return [it for it in list_by_specification(db, specification_id) if not is_kp_excluded_item(db, it)]


def list_all(db: Session, specification_id: Optional[int] = None, skip: int = 0, limit: int = 500) -> list[SpecificationItem]:
    q = db.query(SpecificationItem)
    if specification_id is not None:
        q = q.filter(SpecificationItem.specification_id == specification_id)
    return q.order_by(SpecificationItem.id).offset(skip).limit(limit).all()


def get_by_id(db: Session, item_id: int) -> SpecificationItem | None:
    return db.query(SpecificationItem).filter(SpecificationItem.id == item_id).first()


def _effective_row_quantity(row: SpecificationItem) -> float:
    return qbr.effective_quantity(
        row.quantity_manual,
        row.quantity_auto,
        fallback_quantity=float(row.quantity) if row.quantity is not None else None,
    )


def _infer_house_specification_template_id(db: Session, specification_id: int) -> int | None:
    """Шаблон дома для спецификации: из строки «Сборка» в house_templates или шаблон №1 по умолчанию."""
    linked_ht = (
        db.query(HouseTemplate)
        .filter(HouseTemplate.qty_basis == qbr.QTY_BASIS_LINKED_WALL_KIT)
        .order_by(HouseTemplate.id)
        .first()
    )
    if linked_ht and linked_ht.house_specification_template_id:
        return int(linked_ht.house_specification_template_id)
    return 1


def _spec_item_for_template_row(
    db: Session,
    specification_id: int,
    house_specification_template_id: int,
    row_index_1based: int,
) -> SpecificationItem | None:
    """Позиция спецификации, соответствующая N-й строке шаблона дома (порядок по id)."""
    ht_rows = house_template_service.list_by_specification_template(db, house_specification_template_id)
    if len(ht_rows) < row_index_1based:
        return None
    ht = ht_rows[row_index_1based - 1]
    q = db.query(SpecificationItem).filter(
        SpecificationItem.specification_id == specification_id,
        SpecificationItem.template_id == ht.required_item_template_id,
    )
    if ht.nomenclature_item_id:
        q = q.filter(SpecificationItem.nomenclature_item_id == ht.nomenclature_item_id)
    elif ht.part_id:
        q = q.filter(SpecificationItem.part_id == ht.part_id)
    return q.order_by(SpecificationItem.id).first()


def get_assembly_source_spec_item(db: Session, specification_id: int) -> SpecificationItem | None:
    """3-я позиция шаблона спецификации дома в текущей спецификации."""
    house_tpl_id = _infer_house_specification_template_id(db, specification_id)
    if house_tpl_id is not None:
        item = _spec_item_for_template_row(
            db,
            specification_id,
            house_tpl_id,
            qbr.LINKED_ASSEMBLY_SOURCE_TEMPLATE_ROW,
        )
        if item is not None:
            return item
    items = (
        db.query(SpecificationItem)
        .filter(SpecificationItem.specification_id == specification_id)
        .order_by(SpecificationItem.id)
        .all()
    )
    idx = qbr.LINKED_ASSEMBLY_SOURCE_TEMPLATE_ROW - 1
    if len(items) <= idx:
        return None
    return items[idx]


def _assembly_source_quantity(db: Session, specification_id: int) -> float:
    """Итоговое количество (поле quantity) 3-й позиции шаблона в спецификации."""
    src = get_assembly_source_spec_item(db, specification_id)
    if src is None:
        return 0.0
    return _effective_row_quantity(src)


def _is_linked_assembly_source_item(db: Session, specification_id: int, row: SpecificationItem) -> bool:
    src = get_assembly_source_spec_item(db, specification_id)
    return src is not None and src.id == row.id


def _sync_rule_row_quantities(
    row: SpecificationItem,
    spec: Specification | None,
    db: Session | None = None,
) -> None:
    """Для строки с qty_basis пересчитать quantity_auto и итоговое quantity (с учётом quantity_manual)."""
    if not qbr.has_qty_rule(row.qty_basis):
        return
    basis = qbr.normalize_basis(row.qty_basis)
    mult = float(row.qty_multiplier) if row.qty_multiplier is not None else 1.0
    use_f = True if row.qty_use_floors is None else bool(row.qty_use_floors)
    fixed_src = 1.0
    if basis == qbr.QTY_BASIS_FIXED:
        if row.quantity_auto is not None:
            fixed_src = float(row.quantity_auto)
        elif row.quantity is not None:
            fixed_src = float(row.quantity)
        else:
            fixed_src = 1.0
    if basis == qbr.QTY_BASIS_LINKED_WALL_KIT:
        src = _assembly_source_quantity(db, spec.id) if db is not None and spec is not None else 0.0
        qty = qbr.compute_linked_wall_kit_quantity(src)
        row.quantity_manual = None
        row.quantity_auto = qty
        row.quantity = qty
        row.total = _row_total(qty, row.price, row.discount_percent)
        return
    else:
        row.quantity_auto = qbr.compute_quantity_auto(
            basis,
            mult,
            use_f,
            getattr(spec, "length_m", None) if spec else None,
            getattr(spec, "width_m", None) if spec else None,
            getattr(spec, "floors", None) if spec else None,
            fixed_src,
            double_timber=bool(getattr(spec, "double_timber", False)) if spec else False,
            room_count=getattr(spec, "room_count", None) if spec else 1,
            terrace_length_m=getattr(spec, "terrace_length_m", None) if spec else None,
            terrace_width_m=getattr(spec, "terrace_width_m", None) if spec else None,
            terrace_second_floor=bool(getattr(spec, "terrace_second_floor", False)) if spec else False,
            wall_height_m=getattr(spec, "wall_height_m", None) if spec else None,
        )
    row.quantity = qbr.effective_quantity(
        row.quantity_manual,
        row.quantity_auto,
        fallback_quantity=float(row.quantity) if row.quantity is not None else None,
    )
    row.total = _row_total(row.quantity, row.price, row.discount_percent)
    if qbr.is_wall_insulation_sds_basis(row.qty_basis):
        row.include_in_total = bool(spec and getattr(spec, "double_timber", False))


def recalc_linked_wall_kit_items(db: Session, specification_id: int) -> None:
    """Пересчитать позиции «Сборка домокомплекта» после изменения стенового домокомплекта."""
    spec = db.query(Specification).filter(Specification.id == specification_id).first()
    if not spec:
        return
    items = db.query(SpecificationItem).filter(SpecificationItem.specification_id == specification_id).all()
    changed = False
    for row in items:
        if not qbr.is_linked_wall_kit_basis(row.qty_basis):
            continue
        _sync_rule_row_quantities(row, spec, db)
        changed = True
    if changed:
        db.commit()
        _recalc_spec_total_amount(db, specification_id)


def _maybe_recalc_linked_wall_kit_dependents(db: Session, specification_id: int, row: SpecificationItem) -> None:
    if qbr.is_linked_wall_kit_basis(row.qty_basis) or _is_linked_assembly_source_item(
        db, specification_id, row
    ):
        recalc_linked_wall_kit_items(db, specification_id)


def create(db: Session, **data: Any) -> SpecificationItem:
    obj = SpecificationItem(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    spec = db.query(Specification).filter(Specification.id == obj.specification_id).first()
    if qbr.has_qty_rule(obj.qty_basis):
        _sync_rule_row_quantities(obj, spec, db)
        _maybe_recalc_linked_wall_kit_dependents(db, obj.specification_id, obj)
        db.commit()
        db.refresh(obj)
    _recalc_spec_total_amount(db, obj.specification_id)
    db.refresh(obj)
    return obj


def update(db: Session, item_id: int, **data: Any) -> SpecificationItem | None:
    row = db.query(SpecificationItem).filter(SpecificationItem.id == item_id).first()
    if not row:
        return None
    spec_id = row.specification_id
    spec = db.query(Specification).filter(Specification.id == spec_id).first()
    d = dict(data)
    q_manual = d.pop("quantity_manual", "__unset__")
    q_qty = d.pop("quantity", "__unset__")
    price_sent = d.pop("price", "__unset__")
    discount_sent = d.pop("discount_percent", "__unset__")

    for k, v in d.items():
        if hasattr(row, k):
            setattr(row, k, v)

    if "nomenclature_item_id" in data and row.nomenclature_item_id is not None:
        nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == row.nomenclature_item_id).first()
        if nom:
            label = (nom.name or nom.item_number or "—").strip() or nom.item_number
            row.item_name = (label or "—")[:200]
            if price_sent == "__unset__":
                tc = nom.total_cost
                row.price = float(tc) if tc is not None else 0.0
            if nom.unit:
                row.unit = nom.unit
            if nom.part_id is not None:
                row.part_id = nom.part_id

    linked_assembly = qbr.is_linked_wall_kit_basis(row.qty_basis)
    wall_insulation = qbr.is_wall_insulation_sds_basis(row.qty_basis)
    double_timber_on = bool(spec and getattr(spec, "double_timber", False))
    qty_editable = not linked_assembly and not (wall_insulation and not double_timber_on)

    if q_manual != "__unset__" and qty_editable:
        row.quantity_manual = q_manual

    if q_qty != "__unset__" and q_manual == "__unset__" and qty_editable:
        if qbr.has_qty_rule(row.qty_basis):
            row.quantity_manual = q_qty
        else:
            row.quantity = q_qty
            row.quantity_manual = None
            row.quantity_auto = None

    if price_sent != "__unset__" and qty_editable:
        row.price = price_sent
    if discount_sent != "__unset__" and qty_editable:
        row.discount_percent = discount_sent

    if qbr.has_qty_rule(row.qty_basis):
        _sync_rule_row_quantities(row, spec, db)
    else:
        if q_qty != "__unset__" and q_manual == "__unset__":
            row.quantity = q_qty
        row.total = _row_total(row.quantity, row.price, row.discount_percent)

    db.commit()
    db.refresh(row)
    if qbr.has_qty_rule(row.qty_basis) or _is_linked_assembly_source_item(db, spec_id, row):
        _maybe_recalc_linked_wall_kit_dependents(db, spec_id, row)
        db.commit()
        db.refresh(row)
    _recalc_spec_total_amount(db, spec_id)
    db.refresh(row)
    return row


def delete(db: Session, item_id: int) -> bool:
    row = db.query(SpecificationItem).filter(SpecificationItem.id == item_id).first()
    if not row:
        return False
    spec_id = row.specification_id
    db.delete(row)
    db.commit()
    _recalc_spec_total_amount(db, spec_id)
    return True


def recalc_items_for_spec_dimensions(db: Session, specification_id: int) -> None:
    """После изменения габаритов / комнат / двойного бруса — пересчитать quantity_auto у зависимых строк."""
    spec = db.query(Specification).filter(Specification.id == specification_id).first()
    if not spec:
        return
    items = db.query(SpecificationItem).filter(SpecificationItem.specification_id == specification_id).all()
    changed = False
    for row in items:
        if not qbr.needs_recalc_on_spec_dimensions(row.qty_basis):
            continue
        _sync_rule_row_quantities(row, spec, db)
        changed = True
    if changed:
        db.commit()
        _recalc_spec_total_amount(db, specification_id)
    recalc_linked_wall_kit_items(db, specification_id)


def apply_house_template(db: Session, specification_id: int, house_specification_template_id: int) -> list[SpecificationItem]:
    """Скопировать позиции шаблона спецификации дома в позиции спецификации."""
    spec = db.query(Specification).filter(Specification.id == specification_id).first()
    rows = house_template_service.list_by_specification_template(db, house_specification_template_id)
    created = []
    for line_no, ht in enumerate(rows, start=1):
        include_in_total = default_include_in_total_for_template_line(line_no)
        item_name = "—"
        if ht.nomenclature_item_id:
            nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == ht.nomenclature_item_id).first()
            if nom:
                item_name = (nom.name or nom.item_number or "—").strip() or nom.item_number
        price = float(ht.price or 0)
        unit = ht.unit or "шт"

        if qbr.has_qty_rule(ht.qty_basis):
            basis = qbr.normalize_basis(ht.qty_basis)
            if qbr.is_wall_insulation_sds_basis(basis):
                include_in_total = bool(spec and getattr(spec, "double_timber", False))
            mult = float(ht.qty_multiplier) if ht.qty_multiplier is not None else 1.0
            use_f = True if ht.qty_use_floors is None else bool(ht.qty_use_floors)
            auto = qbr.compute_quantity_auto(
                basis,
                mult,
                use_f,
                getattr(spec, "length_m", None) if spec else None,
                getattr(spec, "width_m", None) if spec else None,
                getattr(spec, "floors", None) if spec else None,
                ht.quantity,
                double_timber=bool(getattr(spec, "double_timber", False)) if spec else False,
                room_count=getattr(spec, "room_count", None) if spec else 1,
                terrace_length_m=getattr(spec, "terrace_length_m", None) if spec else None,
                terrace_width_m=getattr(spec, "terrace_width_m", None) if spec else None,
                terrace_second_floor=bool(getattr(spec, "terrace_second_floor", False)) if spec else False,
                wall_height_m=getattr(spec, "wall_height_m", None) if spec else None,
            )
            eff = qbr.effective_quantity(None, auto)
            discount_percent = 0.0
            total = _row_total(eff, price, discount_percent)
            obj = create(
                db,
                specification_id=specification_id,
                part_id=ht.part_id,
                template_id=ht.required_item_template_id,
                nomenclature_item_id=ht.nomenclature_item_id,
                item_name=item_name,
                qty_basis=basis,
                qty_multiplier=mult,
                qty_use_floors=use_f,
                quantity_auto=auto,
                quantity_manual=None,
                quantity=eff,
                unit=unit,
                price=price,
                discount_percent=discount_percent,
                total=total,
                description=ht.comment,
                template_line_no=line_no,
                include_in_total=include_in_total,
            )
        else:
            qty = float(ht.quantity or 1)
            discount_percent = 0.0
            total = _row_total(qty, price, discount_percent)
            obj = create(
                db,
                specification_id=specification_id,
                part_id=ht.part_id,
                template_id=ht.required_item_template_id,
                nomenclature_item_id=ht.nomenclature_item_id,
                item_name=item_name,
                quantity=qty,
                unit=unit,
                price=price,
                discount_percent=discount_percent,
                total=total,
                description=ht.comment,
                qty_basis=None,
                qty_multiplier=None,
                qty_use_floors=None,
                quantity_auto=None,
                quantity_manual=None,
                template_line_no=line_no,
                include_in_total=include_in_total,
            )
        created.append(obj)
    recalc_items_for_spec_dimensions(db, specification_id)

    template_photos = (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.house_specification_template_id == house_specification_template_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
        .all()
    )
    for tp in template_photos:
        new_photo = SpecificationPhoto(
            specification_id=specification_id,
            house_specification_template_id=None,
            image_data=tp.image_data,
            content_type=tp.content_type,
            filename=tp.filename,
            sort_order=tp.sort_order,
        )
        db.add(new_photo)
    if template_photos:
        db.commit()

    return created
