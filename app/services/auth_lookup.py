# -*- coding: utf-8 -*-
"""Поиск пользователя для входа по логину или email."""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crm import AuthUser


def find_user_by_login_or_email(db: Session, identifier: str) -> AuthUser | None:
    ident = (identifier or "").strip()
    if not ident:
        return None

    user = db.query(AuthUser).filter(AuthUser.nic == ident).first()
    if user:
        return user

    if "@" not in ident:
        return None

    return (
        db.query(AuthUser)
        .filter(func.lower(AuthUser.email) == ident.lower())
        .order_by(AuthUser.id.asc())
        .first()
    )
