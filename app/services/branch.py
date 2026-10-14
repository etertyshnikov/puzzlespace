# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import Branch


def list_all(db: Session) -> list[Branch]:
    return db.query(Branch).order_by(Branch.id).all()


def get_by_id(db: Session, branch_id: int) -> Branch | None:
    return db.query(Branch).filter(Branch.id == branch_id).first()


def create(db: Session, **data) -> Branch:
    obj = Branch(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, branch_id: int, **data) -> Branch | None:
    row = db.query(Branch).filter(Branch.id == branch_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, branch_id: int) -> bool:
    row = db.query(Branch).filter(Branch.id == branch_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
