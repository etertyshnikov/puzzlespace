# -*- coding: utf-8 -*-
"""In-app уведомления для менеджера (агент создал клиента и т.д.)."""
from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crm import AuthUser, Customer, Notification, Project
from app.services import chat_service
from app.services.user_hierarchy import HIERARCHY_LEVEL_MANAGER_L2

EVENT_CUSTOMER_CREATED = "customer_created"


def _manager_for_agent(db: Session, actor: AuthUser) -> AuthUser | None:
    if int(getattr(actor, "hierarchy_level", 2) or 2) != HIERARCHY_LEVEL_MANAGER_L2:
        return None
    parent_id = getattr(actor, "parent_user_id", None)
    if not parent_id:
        return None
    return db.query(AuthUser).filter(AuthUser.id == parent_id).first()


def _customer_label(customer: Customer) -> str:
    return (customer.full_name or customer.name or f"Клиент #{customer.id}").strip()


def dispatch_customer_created(
    db: Session,
    *,
    actor_user_id: int,
    customer: Customer,
    project: Project | None = None,
) -> None:
    actor = db.query(AuthUser).filter(AuthUser.id == actor_user_id).first()
    if not actor:
        return
    manager = _manager_for_agent(db, actor)
    if not manager:
        return

    label = _customer_label(customer)
    number = (customer.number or "").strip()
    body = f"{label}" + (f" · {number}" if number else "")
    link_path = f"/customers/{customer.id}/edit"
    actor_name = chat_service.user_display_name(actor)

    thread = chat_service.get_or_create_direct_thread(db, manager.id, actor.id)
    meta = {
        "kind": "notification",
        "event_type": EVENT_CUSTOMER_CREATED,
        "entity_type": "customer",
        "entity_id": customer.id,
        "link_path": link_path,
    }
    if project:
        meta["project_id"] = project.id

    msg_text = f"Агент {actor_name} создал клиента {label}"
    if number:
        msg_text += f" ({number})"
    chat_msg = chat_service.post_system_message(db, thread.id, msg_text, meta)

    db.add(
        Notification(
            recipient_user_id=manager.id,
            actor_user_id=actor.id,
            event_type=EVENT_CUSTOMER_CREATED,
            title="Новый клиент",
            body=body,
            entity_type="customer",
            entity_id=customer.id,
            link_path=link_path,
            chat_message_id=chat_msg.id,
        )
    )


def unread_count(db: Session, user_id: int) -> int:
    return int(
        db.query(func.count(Notification.id))
        .filter(Notification.recipient_user_id == user_id, Notification.read_at.is_(None))
        .scalar()
        or 0
    )


def mark_read(db: Session, notification_id: int, user_id: int) -> Notification | None:
    row = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.recipient_user_id == user_id)
        .first()
    )
    if not row:
        return None
    if row.read_at is None:
        row.read_at = datetime.utcnow()
        db.add(row)
    return row


def mark_all_read(db: Session, user_id: int) -> int:
    rows = (
        db.query(Notification)
        .filter(Notification.recipient_user_id == user_id, Notification.read_at.is_(None))
        .all()
    )
    now = datetime.utcnow()
    for row in rows:
        row.read_at = now
        db.add(row)
    return len(rows)
