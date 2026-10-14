# -*- coding: utf-8 -*-
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, Notification
from app.services.auth import get_current_user
from app.services import notification_service

router = APIRouter()


class NotificationOut(BaseModel):
    id: int
    event_type: str
    title: str
    body: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    link_path: str | None = None
    actor_user_id: int | None = None
    actor_name: str | None = None
    read_at: str | None = None
    created_at: str


class UnreadCountOut(BaseModel):
    count: int


def _actor_name(db: Session, user_id: int | None) -> str | None:
    if not user_id:
        return None
    u = db.query(AuthUser).filter(AuthUser.id == user_id).first()
    if not u:
        return None
    parts = [p for p in (u.first_name, u.last_name) if p]
    return " ".join(parts) if parts else u.nic


def _to_out(row: Notification, db: Session) -> NotificationOut:
    return NotificationOut(
        id=row.id,
        event_type=row.event_type,
        title=row.title,
        body=row.body,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        link_path=row.link_path,
        actor_user_id=row.actor_user_id,
        actor_name=_actor_name(db, row.actor_user_id),
        read_at=row.read_at.isoformat() if row.read_at else None,
        created_at=row.created_at.isoformat() if row.created_at else datetime.utcnow().isoformat(),
    )


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.recipient_user_id == user.id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return [_to_out(r, db) for r in rows]


@router.get("/unread-count", response_model=UnreadCountOut)
def get_unread_count(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    return UnreadCountOut(count=notification_service.unread_count(db, user.id))


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    row = notification_service.mark_read(db, notification_id, user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    db.commit()
    db.refresh(row)
    return _to_out(row, db)


@router.post("/read-all", response_model=UnreadCountOut)
def read_all_notifications(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    notification_service.mark_all_read(db, user.id)
    db.commit()
    return UnreadCountOut(count=0)
