# -*- coding: utf-8 -*-
import hmac
import json
import re
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.portal import PortalChannel, PortalListing, PortalUser
from app.services.auth import create_access_token, hash_password, require_admin, verify_password
from app.services.portal_publish import KINDS, NETWORKS, PUBLISH_KINDS, listing_text, publish_to
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.config import get_settings

router = APIRouter()
portal_scheme = OAuth2PasswordBearer(tokenUrl="/api/portal/login", auto_error=False)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str = Field(min_length=2, max_length=200)
    phone: str = ""
    pd_consent: bool


class LoginIn(BaseModel):
    email: str
    password: str


class ListingIn(BaseModel):
    kind: str
    title: str = Field(min_length=2, max_length=300)
    body: dict[str, str]


class ChannelIn(BaseModel):
    kind: str
    network: str
    target: str = ""
    enabled: bool = True


class DecideIn(BaseModel):
    action: str
    networks: list[str] = []


class IngestIn(BaseModel):
    kind: str
    title: str = Field(min_length=2, max_length=300)
    body: dict[str, str] = {}
    author_name: str = ""
    phone: str = ""


KIND_LABELS = {
    "vacancy": "вакансий",
    "resume": "резюме",
    "sell": "продажи участков",
    "buy": "покупки участков",
}
BOT_EMAIL = "max-bot@puzzlespace.ru"


def _user_out(user: PortalUser) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "phone": user.phone or "",
    }


def _listing_out(row: PortalListing, author: str = "") -> dict:
    try:
        body = json.loads(row.body_json or "{}")
    except json.JSONDecodeError:
        body = {}
    body = {key: value for key, value in body.items() if not str(key).startswith("_")}
    return {
        "id": row.id,
        "kind": row.kind,
        "title": row.title,
        "body": body,
        "status": row.status,
        "publish_log": row.publish_log or "",
        "author": author,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def get_portal_user(
    token: str | None = Depends(portal_scheme),
    db: Session = Depends(get_db),
) -> PortalUser:
    if not token:
        raise HTTPException(status_code=401, detail="Нужна регистрация")
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Сессия недействительна") from None
    if payload.get("kind") != "portal":
        raise HTTPException(status_code=401, detail="Сессия недействительна")
    sub = str(payload.get("sub") or "")
    if not sub.startswith("p"):
        raise HTTPException(status_code=401, detail="Сессия недействительна")
    user = db.query(PortalUser).filter(PortalUser.id == int(sub[1:])).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


def _ensure_channels(db: Session) -> list[PortalChannel]:
    rows = db.query(PortalChannel).all()
    have = {(row.kind, row.network) for row in rows}
    changed = False
    for kind in PUBLISH_KINDS:
        for network in NETWORKS:
            if (kind, network) not in have:
                db.add(PortalChannel(kind=kind, network=network, target="", enabled=True))
                changed = True
    if changed:
        db.commit()
        rows = db.query(PortalChannel).all()
    return rows


@router.post("/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Укажите корректную электронную почту")
    if not data.pd_consent:
        raise HTTPException(status_code=400, detail="Нужно согласие на обработку персональных данных")
    if db.query(PortalUser).filter(PortalUser.email == email).first():
        raise HTTPException(status_code=400, detail="Такая почта уже зарегистрирована")
    user = PortalUser(
        email=email,
        password_hash=hash_password(data.password),
        name=data.name.strip(),
        phone=data.phone.strip(),
        pd_consent=True,
        pd_consent_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": f"p{user.id}", "kind": "portal"})
    return {"access_token": token, "user": _user_out(user)}


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(PortalUser).filter(PortalUser.email == email).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")
    token = create_access_token({"sub": f"p{user.id}", "kind": "portal"})
    return {"access_token": token, "user": _user_out(user)}


@router.get("/me")
def me(user: PortalUser = Depends(get_portal_user)):
    return _user_out(user)


@router.get("/listings")
def my_listings(user: PortalUser = Depends(get_portal_user), db: Session = Depends(get_db)):
    rows = (
        db.query(PortalListing)
        .filter(PortalListing.user_id == user.id)
        .order_by(PortalListing.id.desc())
        .all()
    )
    return [_listing_out(row, user.name) for row in rows]


@router.post("/listings")
def create_listing(data: ListingIn, user: PortalUser = Depends(get_portal_user), db: Session = Depends(get_db)):
    if data.kind not in KINDS:
        raise HTTPException(status_code=400, detail="Неизвестный тип объявления")
    body = {str(k)[:80]: str(v)[:2000] for k, v in data.body.items()}
    row = PortalListing(
        user_id=user.id,
        kind=data.kind,
        title=data.title.strip(),
        body_json=json.dumps(body, ensure_ascii=False),
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _listing_out(row, user.name)


@router.get("/moderation")
def moderation(_admin=Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(PortalListing).order_by(PortalListing.id.desc()).limit(200).all()
    authors = {
        user.id: user.name
        for user in db.query(PortalUser).filter(PortalUser.id.in_([row.user_id for row in rows] or [0])).all()
    }
    return [_listing_out(row, authors.get(row.user_id, "")) for row in rows]


@router.post("/moderation/{listing_id}")
def decide(listing_id: int, data: DecideIn, _admin=Depends(require_admin), db: Session = Depends(get_db)):
    row = db.query(PortalListing).filter(PortalListing.id == listing_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Объявление не найдено")
    if data.action == "reject":
        row.status = "rejected"
        row.decided_at = datetime.utcnow()
        row.publish_log = "Отклонено модератором"
        db.commit()
        return _listing_out(row)
    if data.action != "approve":
        raise HTTPException(status_code=400, detail="Укажите approve или reject")
    if row.kind not in PUBLISH_KINDS:
        row.status = "approved"
        row.decided_at = datetime.utcnow()
        row.publish_log = "Заявка принята, в каналы не отправляется"
        db.commit()
        return _listing_out(row)
    body = json.loads(row.body_json or "{}")
    text = listing_text(row.title, body)
    channels = {
        (ch.kind, ch.network): ch
        for ch in db.query(PortalChannel).filter(PortalChannel.kind == row.kind).all()
    }
    notes = []
    for network in data.networks:
        if network not in NETWORKS:
            continue
        channel = channels.get((row.kind, network))
        if channel is None or not channel.enabled:
            notes.append(f"{network}: канал выключен или не создан")
            continue
        notes.append(f"{network}: {publish_to(network, channel.target, text, body)}")
    log = "\n".join(notes) if notes else "Каналы не выбраны"
    sent = any(mark in log for mark in ("опубликовано", "отправлено"))
    row.status = "published" if sent else "pending"
    row.decided_at = datetime.utcnow()
    row.publish_log = log
    db.commit()
    return _listing_out(row)


@router.get("/channels")
def list_channels(_admin=Depends(require_admin), db: Session = Depends(get_db)):
    rows = _ensure_channels(db)
    return [
        {"id": row.id, "kind": row.kind, "network": row.network, "target": row.target, "enabled": row.enabled}
        for row in rows
    ]


def _assert_distinct_max(items: list[ChannelIn]) -> None:
    seen: dict[str, str] = {}
    for item in items:
        if item.network != "max":
            continue
        target = item.target.strip()
        if not target:
            continue
        previous = seen.get(target)
        if previous:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Группа Max уже указана для {KIND_LABELS.get(previous, previous)}. "
                    f"Для {KIND_LABELS.get(item.kind, item.kind)} нужна другая группа."
                ),
            )
        seen[target] = item.kind


@router.post("/ingest")
def ingest(
    data: IngestIn,
    db: Session = Depends(get_db),
    x_portal_secret: str = Header(default=""),
):
    """Объявление из бота Max попадает в ту же очередь модерации, без автопубликации."""
    settings = get_settings()
    expected = (settings.portal_ingest_secret or "").strip()
    if not expected or not hmac.compare_digest(x_portal_secret.strip(), expected):
        raise HTTPException(status_code=401, detail="Неверный ключ")
    if data.kind not in PUBLISH_KINDS:
        raise HTTPException(status_code=400, detail="Неизвестный тип объявления")
    user = db.query(PortalUser).filter(PortalUser.email == BOT_EMAIL).first()
    if user is None:
        user = PortalUser(
            email=BOT_EMAIL,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            name="Бот Max",
            phone="",
            pd_consent=True,
            pd_consent_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    body = {str(k)[:80]: str(v)[:2000] for k, v in data.body.items()}
    if data.author_name.strip():
        body.setdefault("Автор", data.author_name.strip()[:200])
    if data.phone.strip():
        body["phone"] = data.phone.strip()[:40]
    row = PortalListing(
        user_id=user.id,
        kind=data.kind,
        title=data.title.strip(),
        body_json=json.dumps(body, ensure_ascii=False),
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": row.status}


@router.put("/channels")
def save_channels(items: list[ChannelIn], _admin=Depends(require_admin), db: Session = Depends(get_db)):
    _assert_distinct_max(items)
    _ensure_channels(db)
    for item in items:
        if item.kind not in PUBLISH_KINDS or item.network not in NETWORKS:
            continue
        row = (
            db.query(PortalChannel)
            .filter(PortalChannel.kind == item.kind, PortalChannel.network == item.network)
            .first()
        )
        if row is None:
            continue
        row.target = item.target.strip()
        row.enabled = item.enabled
    db.commit()
    rows = db.query(PortalChannel).order_by(PortalChannel.kind, PortalChannel.network).all()
    return [
        {"id": row.id, "kind": row.kind, "network": row.network, "target": row.target, "enabled": row.enabled}
        for row in rows
    ]
