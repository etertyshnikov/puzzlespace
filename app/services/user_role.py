# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import UserRole


def list_all(db: Session) -> list[UserRole]:
    return db.query(UserRole).order_by(UserRole.sort_order, UserRole.name).all()


def get_by_id(db: Session, role_id: int) -> UserRole | None:
    return db.query(UserRole).filter(UserRole.id == role_id).first()


def create(db: Session, **data) -> UserRole:
    obj = UserRole(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, role_id: int, **data) -> UserRole | None:
    row = db.query(UserRole).filter(UserRole.id == role_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, role_id: int) -> bool:
    row = db.query(UserRole).filter(UserRole.id == role_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
