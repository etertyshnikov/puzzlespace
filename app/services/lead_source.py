# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import LeadSource


def list_all(db: Session) -> list[LeadSource]:
    return db.query(LeadSource).order_by(LeadSource.id).all()


def get_by_id(db: Session, lead_source_id: int) -> LeadSource | None:
    return db.query(LeadSource).filter(LeadSource.id == lead_source_id).first()


def create(db: Session, **data) -> LeadSource:
    obj = LeadSource(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, lead_source_id: int, **data) -> LeadSource | None:
    row = db.query(LeadSource).filter(LeadSource.id == lead_source_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, lead_source_id: int) -> bool:
    row = db.query(LeadSource).filter(LeadSource.id == lead_source_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
