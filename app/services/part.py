# -*- coding: utf-8 -*-
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Part


def list_all(db: Session) -> list[Part]:
    return (
        db.query(Part)
        .order_by(Part.sort_order.asc(), Part.id.asc())
        .all()
    )


def get_by_id(db: Session, part_id: int) -> Part | None:
    return db.query(Part).filter(Part.id == part_id).first()


def _next_sort_order(db: Session) -> int:
    current = db.query(func.max(Part.sort_order)).scalar()
    if current is None:
        return 0
    return int(current) + 1


def create(db: Session, **data) -> Part:
    if data.get("sort_order") is None:
        data["sort_order"] = _next_sort_order(db)
    obj = Part(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, part_id: int, **data) -> Part | None:
    row = db.query(Part).filter(Part.id == part_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def reorder(db: Session, part_ids: list[int]) -> list[Part]:
    """Сохраняет порядок частей дома (0, 1, 2, …)."""
    if not part_ids:
        return list_all(db)
    existing = {p.id: p for p in db.query(Part).filter(Part.id.in_(part_ids)).all()}
    for idx, part_id in enumerate(part_ids):
        row = existing.get(part_id)
        if row:
            row.sort_order = idx
    db.commit()
    return list_all(db)


def delete(db: Session, part_id: int) -> bool:
    row = db.query(Part).filter(Part.id == part_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
