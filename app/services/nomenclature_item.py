# -*- coding: utf-8 -*-
import re
from sqlalchemy.orm import Session
from app.models import NomenclatureItem

ITEM_NUMBER_PREFIX = "POZ_N"
ITEM_NUMBER_PATTERN = re.compile(r"^POZ_N(\d+)$")


def _get_next_item_number(db: Session) -> str:
    """Следующий номер в формате POZ_N000000 (6 цифр)."""
    rows = (
        db.query(NomenclatureItem.item_number)
        .filter(NomenclatureItem.item_number.like(f"{ITEM_NUMBER_PREFIX}%"))
        .all()
    )
    max_n = 0
    for (item_number,) in rows:
        m = ITEM_NUMBER_PATTERN.match(item_number)
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f"{ITEM_NUMBER_PREFIX}{max_n + 1:06d}"


def list_all(db: Session, skip: int = 0, limit: int = 100, part_id: int | None = None) -> list[NomenclatureItem]:
    q = db.query(NomenclatureItem).order_by(NomenclatureItem.id)
    if part_id is not None:
        q = q.filter(NomenclatureItem.part_id == part_id)
    return q.offset(skip).limit(limit).all()


def get_by_id(db: Session, item_id: int) -> NomenclatureItem | None:
    return db.query(NomenclatureItem).filter(NomenclatureItem.id == item_id).first()


def create(db: Session, **data) -> NomenclatureItem:
    item_number = (data.get("item_number") or "").strip()
    if not item_number:
        data = {**data, "item_number": _get_next_item_number(db)}
    else:
        data = {**data, "item_number": item_number}
    obj = NomenclatureItem(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, item_id: int, **data) -> NomenclatureItem | None:
    row = db.query(NomenclatureItem).filter(NomenclatureItem.id == item_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, item_id: int) -> bool:
    row = db.query(NomenclatureItem).filter(NomenclatureItem.id == item_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
