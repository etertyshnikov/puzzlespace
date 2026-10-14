# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import SpecificationStatus


def list_all(db: Session) -> list[SpecificationStatus]:
    return db.query(SpecificationStatus).order_by(SpecificationStatus.id).all()


def get_by_id(db: Session, status_id: int) -> SpecificationStatus | None:
    return db.query(SpecificationStatus).filter(SpecificationStatus.id == status_id).first()


def create(db: Session, *, name: str, description: str | None = None, sort_order: int = 0, is_active: bool = True) -> SpecificationStatus:
    obj = SpecificationStatus(name=name, description=description, sort_order=sort_order, is_active=is_active)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, status_id: int, **data) -> SpecificationStatus:
    row = db.query(SpecificationStatus).filter(SpecificationStatus.id == status_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, status_id: int) -> bool:
    row = db.query(SpecificationStatus).filter(SpecificationStatus.id == status_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
