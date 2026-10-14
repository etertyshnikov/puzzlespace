# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import RequiredItemTemplate


def list_all(db: Session) -> list[RequiredItemTemplate]:
    return db.query(RequiredItemTemplate).order_by(RequiredItemTemplate.id).all()


def get_by_id(db: Session, template_id: int) -> RequiredItemTemplate | None:
    return db.query(RequiredItemTemplate).filter(RequiredItemTemplate.id == template_id).first()


def create(db: Session, **data) -> RequiredItemTemplate:
    obj = RequiredItemTemplate(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, template_id: int, **data) -> RequiredItemTemplate | None:
    row = db.query(RequiredItemTemplate).filter(RequiredItemTemplate.id == template_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, template_id: int) -> bool:
    row = db.query(RequiredItemTemplate).filter(RequiredItemTemplate.id == template_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
