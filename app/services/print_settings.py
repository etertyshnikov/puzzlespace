# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import PrintSettings


def get_or_create(db: Session) -> PrintSettings:
    row = db.query(PrintSettings).first()
    if row:
        return row
    row = PrintSettings()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update(db: Session, **data) -> PrintSettings:
    row = get_or_create(db)
    for k, v in data.items():
        if v is not None and hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row
