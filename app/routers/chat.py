# -*- coding: utf-8 -*-
import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, ChatMessage, ChatMessageAttachment, ChatThread
from app.services.auth import get_current_user
from app.services import chat_service
from app.services.chat_attachments import read_photo_files

router = APIRouter()


class AttachmentOut(BaseModel):
    id: int
    filename: str
    content_type: str


class DialogOut(BaseModel):
    thread_id: int
    peer_user_id: int
    peer_name: str
    peer_nic: str
    unread_count: int
    last_message_body: str | None = None
    last_message_at: str | None = None
    last_message_is_system: bool = False


class MessageOut(BaseModel):
    id: int
    thread_id: int
    sender_user_id: int | None = None
    sender_name: str | None = None
    body: str
    is_system: bool
    meta: dict | None = None
    link_path: str | None = None
    attachments: list[AttachmentOut] = []
    created_at: str


class MessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=8000)


class ReadThreadRequest(BaseModel):
    last_message_id: int


class UnreadCountOut(BaseModel):
    count: int


def _attachment_out(row: ChatMessageAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=row.id,
        filename=row.filename or "photo",
        content_type=row.content_type,
    )


def _message_out(
    msg: ChatMessage,
    db: Session,
    attachments_map: dict[int, list[ChatMessageAttachment]] | None = None,
) -> MessageOut:
    sender_name = None
    if msg.sender_user_id:
        u = db.query(AuthUser).filter(AuthUser.id == msg.sender_user_id).first()
        sender_name = chat_service.user_display_name(u)
    meta = None
    link_path = None
    if msg.meta_json:
        try:
            meta = json.loads(msg.meta_json)
            if isinstance(meta, dict):
                link_path = meta.get("link_path")
        except json.JSONDecodeError:
            meta = None
    if attachments_map is None:
        attachments_map = chat_service.attachments_for_messages(db, [msg.id])
    attachments = [_attachment_out(a) for a in attachments_map.get(msg.id, [])]
    return MessageOut(
        id=msg.id,
        thread_id=msg.thread_id,
        sender_user_id=msg.sender_user_id,
        sender_name=sender_name,
        body=msg.body,
        is_system=bool(msg.is_system),
        meta=meta,
        link_path=link_path,
        attachments=attachments,
        created_at=msg.created_at.isoformat() if msg.created_at else datetime.utcnow().isoformat(),
    )


def _peer_user(db: Session, user: AuthUser, thread: ChatThread) -> AuthUser:
    if user.id == thread.direct_manager_user_id:
        peer_id = thread.direct_agent_user_id
    else:
        peer_id = thread.direct_manager_user_id
    if not peer_id:
        raise HTTPException(status_code=500, detail="Некорректный диалог")
    peer = db.query(AuthUser).filter(AuthUser.id == peer_id).first()
    if not peer:
        raise HTTPException(status_code=404, detail="Собеседник не найден")
    return peer


@router.get("/unread-count", response_model=UnreadCountOut)
def get_unread_count(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    return UnreadCountOut(count=chat_service.total_unread_count(db, user.id))


@router.get("/dialogs", response_model=list[DialogOut])
def list_dialogs(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    pairs = chat_service.resolve_dialog_peers(db, user)
    result: list[DialogOut] = []
    for manager_id, agent_id in pairs:
        thread = chat_service.get_or_create_direct_thread(db, manager_id, agent_id)
        peer = _peer_user(db, user, thread)
        last = chat_service.last_message_for_thread(db, thread.id)
        result.append(
            DialogOut(
                thread_id=thread.id,
                peer_user_id=peer.id,
                peer_name=chat_service.user_display_name(peer),
                peer_nic=peer.nic,
                unread_count=chat_service.unread_count_for_thread(db, thread.id, user.id),
                last_message_body=last.body if last else None,
                last_message_at=last.created_at.isoformat() if last and last.created_at else None,
                last_message_is_system=bool(last.is_system) if last else False,
            )
        )
    db.commit()
    result.sort(key=lambda d: d.last_message_at or "", reverse=True)
    return result


@router.get("/threads/{thread_id}/messages", response_model=list[MessageOut])
def list_messages(
    thread_id: int,
    limit: int = Query(100, ge=1, le=200),
    before_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    chat_service.assert_thread_member(db, thread_id, user.id)
    q = db.query(ChatMessage).filter(ChatMessage.thread_id == thread_id)
    if before_id is not None:
        q = q.filter(ChatMessage.id < before_id)
    rows = q.order_by(ChatMessage.id.desc()).limit(limit).all()
    rows.reverse()
    attachments_map = chat_service.attachments_for_messages(db, [m.id for m in rows])
    return [_message_out(m, db, attachments_map) for m in rows]


@router.post("/threads/{thread_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    thread_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    chat_service.assert_thread_member(db, thread_id, user.id)
    msg = chat_service.post_user_message(db, thread_id, user.id, payload.body)
    db.commit()
    db.refresh(msg)
    return _message_out(msg, db)


@router.post("/threads/{thread_id}/messages/with-photos", response_model=MessageOut, status_code=201)
def send_message_with_photos(
    thread_id: int,
    files: list[UploadFile] = File(...),
    body: str = Form(""),
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    chat_service.assert_thread_member(db, thread_id, user.id)
    attachments = read_photo_files(files)
    msg = chat_service.post_user_message_with_attachments(
        db,
        thread_id,
        user.id,
        body,
        attachments,
    )
    db.commit()
    db.refresh(msg)
    return _message_out(msg, db)


@router.get("/attachments/{attachment_id}/image")
def get_attachment_image(
    attachment_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    row = db.query(ChatMessageAttachment).filter(ChatMessageAttachment.id == attachment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Фото не найдено")
    msg = db.query(ChatMessage).filter(ChatMessage.id == row.message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    chat_service.assert_thread_member(db, msg.thread_id, user.id)
    return Response(
        content=row.image_data,
        media_type=row.content_type,
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.post("/threads/{thread_id}/read", status_code=204)
def mark_thread_read(
    thread_id: int,
    payload: ReadThreadRequest,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    chat_service.assert_thread_member(db, thread_id, user.id)
    chat_service.mark_thread_read(db, thread_id, user.id, payload.last_message_id)
    db.commit()
    return None
