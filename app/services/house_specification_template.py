# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import HouseSpecificationTemplate


def list_all(db: Session) -> list[HouseSpecificationTemplate]:
    return db.query(HouseSpecificationTemplate).order_by(HouseSpecificationTemplate.id).all()


def get_by_id(db: Session, item_id: int) -> HouseSpecificationTemplate | None:
    return db.query(HouseSpecificationTemplate).filter(HouseSpecificationTemplate.id == item_id).first()


def create(db: Session, **data) -> HouseSpecificationTemplate:
    obj = HouseSpecificationTemplate(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, item_id: int, **data) -> HouseSpecificationTemplate | None:
    row = db.query(HouseSpecificationTemplate).filter(HouseSpecificationTemplate.id == item_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, item_id: int) -> bool:
    row = db.query(HouseSpecificationTemplate).filter(HouseSpecificationTemplate.id == item_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
