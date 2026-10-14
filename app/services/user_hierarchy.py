# -*- coding: utf-8 -*-
"""Иерархия продаж: уровни, ветки, приглашения."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crm import AuthUser, UserHierarchy, UserInvite, UserRole

HIERARCHY_LEVEL_DIRECTOR = 0
HIERARCHY_LEVEL_MANAGER_L1 = 1
HIERARCHY_LEVEL_MANAGER_L2 = 2
MAX_HIERARCHY_LEVEL = HIERARCHY_LEVEL_MANAGER_L2
INVITE_TTL_DAYS = 14

ROLE_BY_LEVEL = {
    HIERARCHY_LEVEL_MANAGER_L1: "manager",
    HIERARCHY_LEVEL_MANAGER_L2: "agent",
}

ADMIN_MANAGER_ROLE = "admin_manager"


def _role_name(user: AuthUser, db: Session) -> str | None:
    if user.role_id is None:
        return None
    role = db.query(UserRole).filter(UserRole.id == user.role_id).first()
    return role.name if role else None


def is_admin_manager(user: AuthUser, db: Session) -> bool:
    name = _role_name(user, db)
    return bool(name and name == ADMIN_MANAGER_ROLE)


def has_admin_access(user: AuthUser, db: Session) -> bool:
    """Полный доступ к настройкам и управлению пользователями."""
    return is_director(user, db) or is_admin_manager(user, db)


def is_director(user: AuthUser, db: Session) -> bool:
    if int(getattr(user, "hierarchy_level", 2) or 2) == HIERARCHY_LEVEL_DIRECTOR:
        return True
    if user.role_id is None:
        return False
    role = db.query(UserRole).filter(UserRole.id == user.role_id).first()
    return bool(role and role.name.lower() == "admin")


def is_manager(user: AuthUser, db: Session) -> bool:
    if is_director(user, db):
        return False
    if is_admin_manager(user, db):
        return True
    level = int(getattr(user, "hierarchy_level", MAX_HIERARCHY_LEVEL) or MAX_HIERARCHY_LEVEL)
    if level == HIERARCHY_LEVEL_MANAGER_L1:
        return True
    if user.role_id is None:
        return False
    role = db.query(UserRole).filter(UserRole.id == user.role_id).first()
    return bool(role and role.name == "manager")


def is_agent(user: AuthUser, db: Session) -> bool:
    level = int(getattr(user, "hierarchy_level", MAX_HIERARCHY_LEVEL) or MAX_HIERARCHY_LEVEL)
    if level == HIERARCHY_LEVEL_MANAGER_L2:
        return True
    if user.role_id is None:
        return False
    role = db.query(UserRole).filter(UserRole.id == user.role_id).first()
    return bool(role and role.name == "agent")


def can_invite_users(user: AuthUser, db: Session) -> bool:
    """Директор — менеджеров и агентов; менеджер — только агентов."""
    if is_director(user, db):
        return True
    return is_manager(user, db)


def target_level_for_inviter(inviter: AuthUser, db: Session) -> int:
    if is_director(inviter, db):
        raise HTTPException(
            status_code=400,
            detail="Укажите target_hierarchy_level (1 или 2) при приглашении директором",
        )
    level = int(getattr(inviter, "hierarchy_level", MAX_HIERARCHY_LEVEL) or MAX_HIERARCHY_LEVEL)
    if level >= MAX_HIERARCHY_LEVEL:
        raise HTTPException(status_code=403, detail="Нет прав приглашать в команду")
    return level + 1


def role_id_for_level(db: Session, hierarchy_level: int) -> int | None:
    if hierarchy_level == HIERARCHY_LEVEL_DIRECTOR:
        role = db.query(UserRole).filter(UserRole.name == "admin").first()
        return role.id if role else None
    role_name = ROLE_BY_LEVEL.get(hierarchy_level)
    if not role_name:
        return None
    role = db.query(UserRole).filter(UserRole.name == role_name).first()
    return role.id if role else None


def hierarchy_level_for_role_name(role_name: str | None) -> int | None:
    if not role_name:
        return None
    if role_name == "admin":
        return HIERARCHY_LEVEL_DIRECTOR
    if role_name in ("manager", ADMIN_MANAGER_ROLE):
        return HIERARCHY_LEVEL_MANAGER_L1
    if role_name == "agent":
        return HIERARCHY_LEVEL_MANAGER_L2
    return None


def apply_role_hierarchy(user: AuthUser, db: Session) -> None:
    """Синхронизирует hierarchy_level с ролью пользователя."""
    level = hierarchy_level_for_role_name(_role_name(user, db))
    if level is not None:
        user.hierarchy_level = level


def count_direct_children(db: Session, parent_user_id: int) -> int:
    return (
        db.query(func.count(AuthUser.id))
        .filter(AuthUser.parent_user_id == parent_user_id)
        .scalar()
        or 0
    )


def attach_hierarchy_paths(db: Session, user_id: int, parent_user_id: int | None) -> None:
    db.add(UserHierarchy(ancestor_id=user_id, descendant_id=user_id, depth=0))
    if parent_user_id is None:
        db.flush()
        return
    ancestors = (
        db.query(UserHierarchy.ancestor_id, UserHierarchy.depth)
        .filter(UserHierarchy.descendant_id == parent_user_id)
        .all()
    )
    for ancestor_id, depth in ancestors:
        db.add(
            UserHierarchy(
                ancestor_id=ancestor_id,
                descendant_id=user_id,
                depth=int(depth) + 1,
            )
        )
    db.flush()


def get_descendant_user_ids(db: Session, ancestor_user_id: int) -> set[int]:
    rows = (
        db.query(UserHierarchy.descendant_id)
        .filter(UserHierarchy.ancestor_id == ancestor_user_id)
        .all()
    )
    return {int(r[0]) for r in rows}


def get_visible_user_ids(db: Session, user: AuthUser) -> set[int] | None:
    """None — все (директор / админ-менеджер). Менеджер — себя и агентов. Агент — только себя."""
    if is_director(user, db) or is_admin_manager(user, db):
        return None
    if is_agent(user, db):
        return {user.id}
    if is_manager(user, db):
        return get_descendant_user_ids(db, user.id)
    return {user.id}


def project_related_user_ids(
    *,
    customer_creator_id: int | None,
    project_created_by_user_id: int | None,
) -> set[int]:
    ids: set[int] = set()
    if customer_creator_id is not None:
        ids.add(customer_creator_id)
    if project_created_by_user_id is not None:
        ids.add(project_created_by_user_id)
    return ids


def get_visible_project_ids(db: Session, user: AuthUser) -> set[int] | None:
    """None — все проекты (директор / админ-менеджер). Иначе id проектов, видимых пользователю."""
    if is_director(user, db) or is_admin_manager(user, db):
        return None
    from app.models.crm import Customer, Project

    projects = db.query(
        Project.id,
        Project.customer_id,
        Project.created_by_user_id,
    ).all()
    customer_ids = {p.customer_id for p in projects if p.customer_id}
    customer_creator_map: dict[int, int | None] = {}
    if customer_ids:
        rows = (
            db.query(Customer.id, Customer.created_by_user_id)
            .filter(Customer.id.in_(customer_ids))
            .all()
        )
        customer_creator_map = {r.id: r.created_by_user_id for r in rows}

    visible_ids = get_visible_user_ids(db, user)
    if visible_ids is None:
        return None

    visible: set[int] = set()
    for pid, customer_id, project_created_by in projects:
        related = project_related_user_ids(
            customer_creator_id=customer_creator_map.get(customer_id) if customer_id else None,
            project_created_by_user_id=project_created_by,
        )
        if related and (related & visible_ids):
            visible.add(int(pid))
    return visible


def is_project_visible_to_user(
    db: Session,
    user: AuthUser,
    *,
    customer_creator_id: int | None,
    project_created_by_user_id: int | None,
) -> bool:
    visible_ids = get_visible_user_ids(db, user)
    if visible_ids is None:
        return True
    related = project_related_user_ids(
        customer_creator_id=customer_creator_id,
        project_created_by_user_id=project_created_by_user_id,
    )
    if not related:
        return False
    return bool(related & visible_ids)


def resolve_invite_parent(
    inviter: AuthUser,
    db: Session,
    target_hierarchy_level: int,
    parent_user_id: int | None,
) -> int:
    if target_hierarchy_level not in (
        HIERARCHY_LEVEL_MANAGER_L1,
        HIERARCHY_LEVEL_MANAGER_L2,
    ):
        raise HTTPException(status_code=400, detail="target_hierarchy_level должен быть 1 или 2")
    if is_director(inviter, db):
        if target_hierarchy_level == HIERARCHY_LEVEL_MANAGER_L1:
            return inviter.id
        if parent_user_id is None:
            raise HTTPException(
                status_code=400,
                detail="Для агента укажите parent_user_id (менеджер)",
            )
        parent = db.query(AuthUser).filter(AuthUser.id == parent_user_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Наставник не найден")
        if int(parent.hierarchy_level or 0) != HIERARCHY_LEVEL_MANAGER_L1:
            raise HTTPException(status_code=400, detail="Наставник должен быть менеджером")
        return parent.id
    inviter_level = int(inviter.hierarchy_level or MAX_HIERARCHY_LEVEL)
    if inviter_level != HIERARCHY_LEVEL_MANAGER_L1:
        raise HTTPException(status_code=403, detail="Нет прав приглашать в команду")
    if target_hierarchy_level != HIERARCHY_LEVEL_MANAGER_L2:
        raise HTTPException(
            status_code=403,
            detail="Менеджер может приглашать только агентов",
        )
    return inviter.id


def create_user_with_hierarchy(
    db: Session,
    *,
    nic: str,
    password_hash: str,
    parent_user_id: int | None,
    hierarchy_level: int,
    role_id: int | None,
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
    branch_id: int | None = None,
) -> AuthUser:
    user = AuthUser(
        nic=nic,
        password=password_hash,
        first_name=first_name,
        last_name=last_name,
        email=email,
        role_id=role_id,
        branch_id=branch_id,
        parent_user_id=parent_user_id,
        hierarchy_level=hierarchy_level,
    )
    db.add(user)
    db.flush()
    attach_hierarchy_paths(db, user.id, parent_user_id)
    db.commit()
    db.refresh(user)
    return user


def get_invite_by_token(db: Session, token: str) -> UserInvite | None:
    return db.query(UserInvite).filter(UserInvite.token == token).first()


def assert_invite_valid(invite: UserInvite | None) -> UserInvite:
    if invite is None:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if invite.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Приглашение уже использовано")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Срок приглашения истёк")
    return invite


def default_invite_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=INVITE_TTL_DAYS)
