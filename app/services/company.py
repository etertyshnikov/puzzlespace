# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session

from app.models import Company, Organization


def list_all(db: Session, skip: int = 0, limit: int = 500) -> list[Company]:
    return (
        db.query(Company)
        .order_by(Company.name.asc(), Company.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_by_id(db: Session, company_id: int) -> Company | None:
    return db.query(Company).filter(Company.id == company_id).first()


def create(db: Session, **data) -> Company:
    obj = Company(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, company_id: int, **data) -> Company | None:
    row = db.query(Company).filter(Company.id == company_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, company_id: int) -> bool:
    row = db.query(Company).filter(Company.id == company_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def list_organizations(db: Session, company_id: int) -> list[Organization]:
    return (
        db.query(Organization)
        .filter(Organization.company_id == company_id)
        .order_by(Organization.name.asc(), Organization.id.asc())
        .all()
    )


def organizations_count(db: Session, company_id: int) -> int:
    return (
        db.query(Organization)
        .filter(Organization.company_id == company_id)
        .count()
    )
