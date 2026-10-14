# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import HouseTemplate


def list_all(db: Session) -> list[HouseTemplate]:
    return db.query(HouseTemplate).order_by(HouseTemplate.id).all()


def list_by_specification_template(db: Session, house_specification_template_id: int) -> list[HouseTemplate]:
    return (
        db.query(HouseTemplate)
        .filter(HouseTemplate.house_specification_template_id == house_specification_template_id)
        .order_by(HouseTemplate.id)
        .all()
    )


def get_by_id(db: Session, item_id: int) -> HouseTemplate | None:
    return db.query(HouseTemplate).filter(HouseTemplate.id == item_id).first()


def create(db: Session, **data) -> HouseTemplate:
    obj = HouseTemplate(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, item_id: int, **data) -> HouseTemplate | None:
    row = db.query(HouseTemplate).filter(HouseTemplate.id == item_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, item_id: int) -> bool:
    row = db.query(HouseTemplate).filter(HouseTemplate.id == item_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
