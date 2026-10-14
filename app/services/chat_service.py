# -*- coding: utf-8 -*-
"""Внутренний чат: direct менеджер–агент (каналы — позже)."""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crm import AuthUser, ChatMessage, ChatMessageAttachment, ChatThread, ChatThreadMember
from app.services.user_hierarchy import HIERARCHY_LEVEL_MANAGER_L2, is_agent, is_manager

THREAD_TYPE_DIRECT = "direct"
THREAD_TYPE_CHANNEL = "channel"


def user_display_name(user: AuthUser | None) -> str:
    if not user:
        return "—"
    parts = [p for p in (user.first_name, user.last_name) if p]
    return " ".join(parts) if parts else user.nic


def get_or_create_direct_thread(db: Session, manager_id: int, agent_id: int) -> ChatThread:
    thread = (
        db.query(ChatThread)
        .filter(
            ChatThread.thread_type == THREAD_TYPE_DIRECT,
            ChatThread.direct_manager_user_id == manager_id,
            ChatThread.direct_agent_user_id == agent_id,
        )
        .first()
    )
    if thread:
        return thread
    thread = ChatThread(
        thread_type=THREAD_TYPE_DIRECT,
        direct_manager_user_id=manager_id,
        direct_agent_user_id=agent_id,
        created_by_user_id=manager_id,
    )
    db.add(thread)
    db.flush()
    for uid in (manager_id, agent_id):
        db.add(ChatThreadMember(thread_id=thread.id, user_id=uid))
    db.flush()
    return thread


def post_system_message(
    db: Session,
    thread_id: int,
    body: str,
    meta: dict | None = None,
) -> ChatMessage:
    msg = ChatMessage(
        thread_id=thread_id,
        sender_user_id=None,
        body=body,
        is_system=True,
        meta_json=json.dumps(meta, ensure_ascii=False) if meta else None,
    )
    db.add(msg)
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if thread:
        thread.updated_at = datetime.utcnow()
    db.flush()
    return msg


def message_body_for_attachments(body: str | None, attachment_count: int) -> str:
    text = (body or "").strip()
    if text:
        return text
    if attachment_count <= 0:
        return ""
    if attachment_count == 1:
        return "📷 Фото"
    return f"📷 {attachment_count} фото"


def post_user_message(db: Session, thread_id: int, sender_id: int, body: str) -> ChatMessage:
    text = (body or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Пустое сообщение")
    return post_user_message_with_attachments(db, thread_id, sender_id, text, [])


def post_user_message_with_attachments(
    db: Session,
    thread_id: int,
    sender_id: int,
    body: str | None,
    attachments: list[tuple[bytes, str, str]],
) -> ChatMessage:
    text = message_body_for_attachments(body, len(attachments))
    if not text:
        raise HTTPException(status_code=400, detail="Пустое сообщение")
    msg = ChatMessage(
        thread_id=thread_id,
        sender_user_id=sender_id,
        body=text,
        is_system=False,
    )
    db.add(msg)
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if thread:
        thread.updated_at = datetime.utcnow()
    db.flush()
    for index, (data, content_type, filename) in enumerate(attachments):
        db.add(
            ChatMessageAttachment(
                message_id=msg.id,
                image_data=data,
                content_type=content_type,
                filename=filename,
                sort_order=index,
            )
        )
    db.flush()
    return msg


def attachments_for_messages(db: Session, message_ids: list[int]) -> dict[int, list[ChatMessageAttachment]]:
    if not message_ids:
        return {}
    rows = (
        db.query(ChatMessageAttachment)
        .filter(ChatMessageAttachment.message_id.in_(message_ids))
        .order_by(ChatMessageAttachment.sort_order, ChatMessageAttachment.id)
        .all()
    )
    grouped: dict[int, list[ChatMessageAttachment]] = {}
    for row in rows:
        grouped.setdefault(int(row.message_id), []).append(row)
    return grouped


def assert_thread_member(db: Session, thread_id: int, user_id: int) -> ChatThread:
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Диалог не найден")
    member = (
        db.query(ChatThreadMember)
        .filter(ChatThreadMember.thread_id == thread_id, ChatThreadMember.user_id == user_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Нет доступа к диалогу")
    return thread


def unread_count_for_thread(db: Session, thread_id: int, user_id: int) -> int:
    member = (
        db.query(ChatThreadMember)
        .filter(ChatThreadMember.thread_id == thread_id, ChatThreadMember.user_id == user_id)
        .first()
    )
    if not member:
        return 0
    q = db.query(func.count(ChatMessage.id)).filter(ChatMessage.thread_id == thread_id)
    if member.last_read_message_id:
        q = q.filter(ChatMessage.id > member.last_read_message_id)
    return int(q.scalar() or 0)


def mark_thread_read(db: Session, thread_id: int, user_id: int, up_to_message_id: int) -> None:
    member = (
        db.query(ChatThreadMember)
        .filter(ChatThreadMember.thread_id == thread_id, ChatThreadMember.user_id == user_id)
        .first()
    )
    if not member:
        return
    if member.last_read_message_id and member.last_read_message_id >= up_to_message_id:
        return
    member.last_read_message_id = up_to_message_id
    member.last_read_at = datetime.utcnow()
    db.add(member)


def list_agent_ids_for_manager(db: Session, manager_id: int) -> list[int]:
    rows = (
        db.query(AuthUser.id)
        .filter(
            AuthUser.parent_user_id == manager_id,
            AuthUser.hierarchy_level == HIERARCHY_LEVEL_MANAGER_L2,
        )
        .order_by(AuthUser.id)
        .all()
    )
    return [int(r[0]) for r in rows]


def resolve_dialog_peers(db: Session, user: AuthUser) -> list[tuple[int, int]]:
    """Список пар (manager_id, agent_id) для диалогов пользователя."""
    if is_manager(user, db):
        agent_ids = list_agent_ids_for_manager(db, user.id)
        return [(user.id, aid) for aid in agent_ids]
    if is_agent(user, db) and user.parent_user_id:
        return [(int(user.parent_user_id), user.id)]
    return []


def last_message_for_thread(db: Session, thread_id: int) -> ChatMessage | None:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.id.desc())
        .first()
    )


def total_unread_count(db: Session, user_id: int) -> int:
    """Сумма непрочитанных по всем диалогам пользователя."""
    thread_ids = [
        int(r[0])
        for r in db.query(ChatThreadMember.thread_id)
        .filter(ChatThreadMember.user_id == user_id)
        .all()
    ]
    return sum(unread_count_for_thread(db, tid, user_id) for tid in thread_ids)
