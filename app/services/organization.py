# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session

from app.models import Organization, Company


def list_all(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    company_id: int | None = None,
) -> list[Organization]:
    q = db.query(Organization)
    if company_id is not None:
        q = q.filter(Organization.company_id == company_id)
    return q.order_by(Organization.id).offset(skip).limit(limit).all()


def get_by_id(db: Session, organization_id: int) -> Organization | None:
    return db.query(Organization).filter(Organization.id == organization_id).first()


def get_default(db: Session, company_id: int | None = None) -> Organization | None:
    """Организация по умолчанию. В рамках company_id, если указан."""
    q = db.query(Organization).filter(Organization.is_default == True)
    if company_id is not None:
        q = q.filter(Organization.company_id == company_id)
    row = q.first()
    if row:
        return row
    q2 = db.query(Organization)
    if company_id is not None:
        q2 = q2.filter(Organization.company_id == company_id)
    return q2.order_by(Organization.id).first()


def create(db: Session, **data) -> Organization:
    obj = Organization(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    if obj.is_default:
        _unset_other_defaults(db, obj.id, obj.company_id)
    return obj


def update(db: Session, organization_id: int, **data) -> Organization | None:
    row = db.query(Organization).filter(Organization.id == organization_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    company_id = data.get("company_id", row.company_id)
    if data.get("is_default") is True:
        _unset_other_defaults(db, organization_id, company_id)
    db.commit()
    db.refresh(row)
    return row


def _unset_other_defaults(db: Session, except_id: int, company_id: int | None) -> None:
    q = db.query(Organization).filter(
        Organization.id != except_id,
        Organization.is_default == True,
    )
    if company_id is not None:
        q = q.filter(Organization.company_id == company_id)
    q.update({"is_default": False})
    db.commit()


def delete(db: Session, organization_id: int) -> bool:
    row = db.query(Organization).filter(Organization.id == organization_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def list_by_company(db: Session, company_id: int) -> list[Organization]:
    return (
        db.query(Organization)
        .filter(Organization.company_id == company_id)
        .order_by(Organization.name.asc(), Organization.id.asc())
        .all()
    )


def company_names_by_ids(db: Session, company_ids: set[int]) -> dict[int, str]:
    if not company_ids:
        return {}
    rows = db.query(Company.id, Company.name).filter(Company.id.in_(company_ids)).all()
    return {int(r.id): r.name for r in rows}
