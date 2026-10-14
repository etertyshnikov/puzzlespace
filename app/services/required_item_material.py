# -*- coding: utf-8 -*-
from typing import Optional
from sqlalchemy.orm import Session
from app.models import RequiredItemMaterial


def list_by_template(db: Session, template_id: int) -> list[RequiredItemMaterial]:
    return db.query(RequiredItemMaterial).filter(
        RequiredItemMaterial.required_item_template_id == template_id
    ).all()


def list_all(db: Session, template_id: Optional[int] = None) -> list[RequiredItemMaterial]:
    q = db.query(RequiredItemMaterial)
    if template_id is not None:
        q = q.filter(RequiredItemMaterial.required_item_template_id == template_id)
    return q.order_by(RequiredItemMaterial.id).all()


def get_by_id(db: Session, material_id: int) -> RequiredItemMaterial | None:
    return db.query(RequiredItemMaterial).filter(RequiredItemMaterial.id == material_id).first()


def create(db: Session, **data) -> RequiredItemMaterial:
    obj = RequiredItemMaterial(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, material_id: int, **data) -> RequiredItemMaterial | None:
    row = get_by_id(db, material_id)
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, material_id: int) -> bool:
    row = db.query(RequiredItemMaterial).filter(RequiredItemMaterial.id == material_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
