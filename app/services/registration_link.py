# -*- coding: utf-8 -*-
"""Постоянная ссылка менеджера для саморегистрации агентов."""
from __future__ import annotations

import secrets

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.models.crm import AuthUser
from app.services.nic_generator import generate_unique_nic
from app.services.user_hierarchy import (
    HIERARCHY_LEVEL_MANAGER_L2,
    can_invite_users,
    create_user_with_hierarchy,
    is_director,
    is_manager,
    role_id_for_level,
)

REGISTRATION_REF_PARAM = "ref"


def can_have_registration_link(user: AuthUser, db: Session) -> bool:
    """Менеджер / админ-менеджер — не директор."""
    return is_manager(user, db) and not is_director(user, db)


def generate_registration_key() -> str:
    return secrets.token_urlsafe(24)


def ensure_registration_key(user: AuthUser, db: Session) -> str:
    if not can_have_registration_link(user, db):
        raise HTTPException(status_code=403, detail="Нет прав на ссылку саморегистрации")
    if not user.registration_key:
        user.registration_key = generate_registration_key()
        user.registration_link_enabled = True
        db.add(user)
        db.commit()
        db.refresh(user)
    return user.registration_key


def registration_url(request: Request, registration_key: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/register?{REGISTRATION_REF_PARAM}={registration_key}"


def get_manager_by_ref(db: Session, ref: str) -> AuthUser:
    ref = (ref or "").strip()
    if not ref:
        raise HTTPException(status_code=404, detail="Ссылка регистрации не найдена")
    manager = (
        db.query(AuthUser)
        .filter(AuthUser.registration_key == ref)
        .first()
    )
    if manager is None:
        raise HTTPException(status_code=404, detail="Ссылка регистрации не найдена")
    if not getattr(manager, "registration_link_enabled", True):
        raise HTTPException(status_code=403, detail="Ссылка регистрации отключена")
    if not can_have_registration_link(manager, db):
        raise HTTPException(status_code=403, detail="Ссылка регистрации недоступна")
    return manager


def manager_display_name(user: AuthUser) -> str:
    parts = [p for p in (user.first_name, user.last_name) if p]
    return " ".join(parts) if parts else user.nic


def register_agent_by_link(
    db: Session,
    *,
    manager: AuthUser,
    nic: str | None,
    password_hash: str,
    first_name: str | None,
    last_name: str | None,
    email: str | None,
) -> AuthUser:
    final_nic = (nic or "").strip() or generate_unique_nic(
        db, first_name=first_name, last_name=last_name, email=email
    )
    if db.query(AuthUser).filter(AuthUser.nic == final_nic).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    role_id = role_id_for_level(db, HIERARCHY_LEVEL_MANAGER_L2)
    if role_id is None:
        raise HTTPException(status_code=500, detail="Роль агента не настроена")
    user = create_user_with_hierarchy(
        db,
        nic=final_nic,
        password_hash=password_hash,
        parent_user_id=manager.id,
        hierarchy_level=HIERARCHY_LEVEL_MANAGER_L2,
        role_id=role_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        branch_id=manager.branch_id,
    )
    user.registration_id = f"link:{manager.id}"
    count = int(getattr(manager, "registration_link_registrations_count", 0) or 0)
    manager.registration_link_registrations_count = count + 1
    db.add(user)
    db.add(manager)
    db.commit()
    db.refresh(user)
    return user


def link_info_for_user(user: AuthUser, db: Session, request: Request) -> dict:
    if not can_have_registration_link(user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к ссылке саморегистрации")
    key = user.registration_key
    enabled = bool(getattr(user, "registration_link_enabled", True))
    count = int(getattr(user, "registration_link_registrations_count", 0) or 0)
    url = registration_url(request, key) if key and enabled else None
    return {
        "has_link": bool(key),
        "registration_key": key,
        "enabled": enabled,
        "registration_url": url,
        "registrations_count": count,
        "can_manage": can_invite_users(user, db),
    }
