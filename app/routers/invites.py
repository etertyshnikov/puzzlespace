# -*- coding: utf-8 -*-
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, UserInvite, UserRole
from app.services.auth import get_current_user
from app.services.user_hierarchy import (
    HIERARCHY_LEVEL_MANAGER_L1,
    HIERARCHY_LEVEL_MANAGER_L2,
    assert_invite_valid,
    can_invite_users,
    create_user_with_hierarchy,
    default_invite_expiry,
    get_invite_by_token,
    is_director,
    resolve_invite_parent,
    role_id_for_level,
)

router = APIRouter()


class InviteCreate(BaseModel):
    target_hierarchy_level: int = Field(..., ge=1, le=2)
    parent_user_id: int | None = None
    nic: str | None = None
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None


class InviteOut(BaseModel):
    id: int
    token: str
    invite_url: str
    target_hierarchy_level: int
    parent_user_id: int
    parent_name: str | None = None
    nic: str | None = None
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    expires_at: str
    accepted_at: str | None = None


class InvitePreviewOut(BaseModel):
    token: str
    target_hierarchy_level: int
    level_label: str
    inviter_name: str | None = None
    parent_name: str | None = None
    nic: str | None = None
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    expires_at: str


def _user_display(db: Session, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    u = db.query(AuthUser).filter(AuthUser.id == user_id).first()
    if not u:
        return None
    parts = [p for p in (u.first_name, u.last_name) if p]
    return " ".join(parts) if parts else u.nic


def _level_label(level: int) -> str:
    if level == HIERARCHY_LEVEL_MANAGER_L1:
        return "Менеджер"
    if level == HIERARCHY_LEVEL_MANAGER_L2:
        return "Агент"
    return f"Уровень {level}"


def _invite_url(request: Request, token: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/register?invite={token}"


def _to_invite_out(invite: UserInvite, request: Request, db: Session) -> InviteOut:
    return InviteOut(
        id=invite.id,
        token=invite.token,
        invite_url=_invite_url(request, invite.token),
        target_hierarchy_level=invite.target_hierarchy_level,
        parent_user_id=invite.parent_user_id,
        parent_name=_user_display(db, invite.parent_user_id),
        nic=invite.nic,
        email=invite.email,
        first_name=invite.first_name,
        last_name=invite.last_name,
        expires_at=invite.expires_at.isoformat(),
        accepted_at=invite.accepted_at.isoformat() if invite.accepted_at else None,
    )


@router.get("/preview", response_model=InvitePreviewOut)
def preview_invite(token: str, db: Session = Depends(get_db)):
    invite = assert_invite_valid(get_invite_by_token(db, token))
    return InvitePreviewOut(
        token=invite.token,
        target_hierarchy_level=invite.target_hierarchy_level,
        level_label=_level_label(invite.target_hierarchy_level),
        inviter_name=_user_display(db, invite.inviter_user_id),
        parent_name=_user_display(db, invite.parent_user_id),
        nic=invite.nic,
        email=invite.email,
        first_name=invite.first_name,
        last_name=invite.last_name,
        expires_at=invite.expires_at.isoformat(),
    )


@router.get("", response_model=list[InviteOut])
def list_my_invites(
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    if not can_invite_users(user, db) and not is_director(user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к приглашениям")
    q = db.query(UserInvite).order_by(UserInvite.id.desc())
    if not is_director(user, db):
        q = q.filter(UserInvite.inviter_user_id == user.id)
    invites = q.limit(200).all()
    return [_to_invite_out(i, request, db) for i in invites]


@router.post("", response_model=InviteOut, status_code=201)
def create_invite(
    payload: InviteCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    if not can_invite_users(user, db):
        raise HTTPException(status_code=403, detail="Нет прав приглашать в команду")
    parent_id = resolve_invite_parent(
        user,
        db,
        payload.target_hierarchy_level,
        payload.parent_user_id,
    )
    role_id = role_id_for_level(db, payload.target_hierarchy_level)
    if role_id is None:
        raise HTTPException(status_code=500, detail="Роль для уровня не настроена. Запустите миграцию.")
    token = secrets.token_urlsafe(32)
    invite = UserInvite(
        token=token,
        inviter_user_id=user.id,
        parent_user_id=parent_id,
        target_hierarchy_level=payload.target_hierarchy_level,
        role_id=role_id,
        nic=(payload.nic or "").strip() or None,
        email=(payload.email or "").strip() or None,
        first_name=(payload.first_name or "").strip() or None,
        last_name=(payload.last_name or "").strip() or None,
        expires_at=default_invite_expiry(),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return _to_invite_out(invite, request, db)


@router.delete("/{invite_id}", status_code=204)
def cancel_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    invite = db.query(UserInvite).filter(UserInvite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if invite.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Приглашение уже принято")
    if not is_director(user, db) and invite.inviter_user_id != user.id:
        raise HTTPException(status_code=403, detail="Нет прав отменить приглашение")
    db.delete(invite)
    db.commit()
    return None
