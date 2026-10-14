# -*- coding: utf-8 -*-
from typing import Optional
from sqlalchemy.orm import Session
from app.models import SpecificationRequiredItem


def list_by_specification(db: Session, spec_id: int) -> list[SpecificationRequiredItem]:
    return db.query(SpecificationRequiredItem).filter(SpecificationRequiredItem.spec_id == spec_id).all()


def list_all(db: Session, spec_id: Optional[int] = None, skip: int = 0, limit: int = 500) -> list[SpecificationRequiredItem]:
    q = db.query(SpecificationRequiredItem)
    if spec_id is not None:
        q = q.filter(SpecificationRequiredItem.spec_id == spec_id)
    return q.order_by(SpecificationRequiredItem.id).offset(skip).limit(limit).all()


def get_by_id(db: Session, item_id: int) -> SpecificationRequiredItem | None:
    return db.query(SpecificationRequiredItem).filter(SpecificationRequiredItem.id == item_id).first()


def create(db: Session, **data) -> SpecificationRequiredItem:
    obj = SpecificationRequiredItem(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, item_id: int, **data) -> SpecificationRequiredItem | None:
    row = db.query(SpecificationRequiredItem).filter(SpecificationRequiredItem.id == item_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, item_id: int) -> bool:
    row = db.query(SpecificationRequiredItem).filter(SpecificationRequiredItem.id == item_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
