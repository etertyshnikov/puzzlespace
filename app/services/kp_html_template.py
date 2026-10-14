# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session

from app.models import KpHtmlTemplate


def list_all(db: Session, skip: int = 0, limit: int = 100) -> list[KpHtmlTemplate]:
    return (
        db.query(KpHtmlTemplate)
        .order_by(KpHtmlTemplate.modified_on.desc(), KpHtmlTemplate.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_by_id(db: Session, template_id: int) -> KpHtmlTemplate | None:
    return db.query(KpHtmlTemplate).filter(KpHtmlTemplate.id == template_id).first()


def get_by_title(db: Session, title: str) -> KpHtmlTemplate | None:
    t = (title or "").strip()
    if not t:
        return None
    return db.query(KpHtmlTemplate).filter(KpHtmlTemplate.title == t).first()


def create(db: Session, **data) -> KpHtmlTemplate:
    obj = KpHtmlTemplate(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, template_id: int, **data) -> KpHtmlTemplate | None:
    row = db.query(KpHtmlTemplate).filter(KpHtmlTemplate.id == template_id).first()
    if not row:
        return None
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, template_id: int) -> bool:
    row = db.query(KpHtmlTemplate).filter(KpHtmlTemplate.id == template_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
