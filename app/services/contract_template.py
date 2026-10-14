# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import ContractTemplate


def list_all(db: Session, skip: int = 0, limit: int = 50) -> list[ContractTemplate]:
    return (
        db.query(ContractTemplate)
        .order_by(ContractTemplate.sort_order.asc(), ContractTemplate.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_by_id(db: Session, template_id: int) -> ContractTemplate | None:
    return db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()


def get_by_code(db: Session, code: str) -> ContractTemplate | None:
    return db.query(ContractTemplate).filter(ContractTemplate.code == code).first()


def _next_sort_order(db: Session) -> int:
    current = db.query(func.max(ContractTemplate.sort_order)).scalar()
    if current is None:
        return 0
    return int(current) + 1


def create(db: Session, **data) -> ContractTemplate:
    if data.get("sort_order") is None:
        data["sort_order"] = _next_sort_order(db)
    obj = ContractTemplate(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def reorder(db: Session, template_ids: list[int]) -> list[ContractTemplate]:
    """Сохраняет порядок шаблонов договоров (0, 1, 2, …)."""
    if not template_ids:
        return list_all(db)
    existing = {
        t.id: t for t in db.query(ContractTemplate).filter(ContractTemplate.id.in_(template_ids)).all()
    }
    for idx, template_id in enumerate(template_ids):
        row = existing.get(template_id)
        if row:
            row.sort_order = idx
            row.modified_on = datetime.utcnow()
    db.commit()
    return list_all(db)


def update(db: Session, template_id: int, **data) -> ContractTemplate | None:
    row = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    row.modified_on = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, template_id: int) -> bool:
    row = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
