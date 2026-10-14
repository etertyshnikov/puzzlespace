# -*- coding: utf-8 -*-
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, UserRole
from app.schemas.team_activity import ActivityDetailOut, TeamActivityOut
from app.services.auth import get_current_user
from app.services import user_activity as activity_service
from app.services.registration_link import (
    can_have_registration_link,
    ensure_registration_key,
    generate_registration_key,
    link_info_for_user,
)
from app.services.user_hierarchy import (
    count_direct_children,
    get_descendant_user_ids,
    is_director,
)

router = APIRouter()


class TeamMemberOut(BaseModel):
    id: int
    nic: str
    first_name: str | None = None
    last_name: str | None = None
    hierarchy_level: int
    role_name: str | None = None
    parent_user_id: int | None = None
    direct_children_count: int = 0


def _level_label(level: int) -> str:
    if level == 0:
        return "Директор"
    if level == 1:
        return "Менеджер"
    if level == 2:
        return "Агент"
    return str(level)


@router.get("/members", response_model=list[TeamMemberOut])
def list_team_members(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    if is_director(user, db):
        users = db.query(AuthUser).order_by(AuthUser.hierarchy_level, AuthUser.id).all()
    else:
        ids = get_descendant_user_ids(db, user.id)
        ids.discard(user.id)
        if not ids:
            users = []
        else:
            users = (
                db.query(AuthUser)
                .filter(AuthUser.id.in_(ids))
                .order_by(AuthUser.hierarchy_level, AuthUser.id)
                .all()
            )
    role_map: dict[int, str] = {}
    role_ids = {u.role_id for u in users if u.role_id}
    if role_ids:
        for r in db.query(UserRole).filter(UserRole.id.in_(role_ids)).all():
            role_map[r.id] = r.name
    return [
        TeamMemberOut(
            id=u.id,
            nic=u.nic,
            first_name=u.first_name,
            last_name=u.last_name,
            hierarchy_level=int(u.hierarchy_level or 0),
            role_name=role_map.get(u.role_id) if u.role_id else None,
            parent_user_id=u.parent_user_id,
            direct_children_count=count_direct_children(db, u.id),
        )
        for u in users
    ]


@router.get("/limits")
def team_limits(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    return {
        "direct_children_count": count_direct_children(db, user.id),
        "hierarchy_level": int(getattr(user, "hierarchy_level", 2) or 2),
    }


@router.get("/activity", response_model=TeamActivityOut)
def team_activity(
    day: date | None = Query(None, description="Дата отчёта (календарный день, Europe/Moscow)"),
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    day_value = day or date.today()
    return activity_service.aggregate_team_activity(db, user, day=day_value)


@router.get("/activity/details", response_model=list[ActivityDetailOut])
def team_activity_details(
    user_id: int = Query(..., description="ID агента"),
    event_type: str = Query(..., description="Тип события"),
    day: date | None = Query(None, description="Дата (Europe/Moscow)"),
    limit: int = Query(100, le=200),
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    day_value = day or date.today()
    return activity_service.list_activity_details(
        db,
        user,
        user_id=user_id,
        event_type=event_type,
        day=day_value,
        limit=limit,
    )


class RegistrationLinkOut(BaseModel):
    has_link: bool
    registration_key: str | None = None
    enabled: bool = False
    registration_url: str | None = None
    registrations_count: int = 0
    can_manage: bool = False


class RegistrationLinkToggle(BaseModel):
    enabled: bool


@router.get("/registration-link", response_model=RegistrationLinkOut)
def get_registration_link(
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    return RegistrationLinkOut(**link_info_for_user(user, db, request))


@router.post("/registration-link/generate", response_model=RegistrationLinkOut)
def generate_registration_link(
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    if not can_have_registration_link(user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к ссылке саморегистрации")
    user.registration_key = generate_registration_key()
    user.registration_link_enabled = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return RegistrationLinkOut(**link_info_for_user(user, db, request))


@router.post("/registration-link/ensure", response_model=RegistrationLinkOut)
def ensure_registration_link(
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    ensure_registration_key(user, db)
    db.refresh(user)
    return RegistrationLinkOut(**link_info_for_user(user, db, request))


@router.patch("/registration-link", response_model=RegistrationLinkOut)
def toggle_registration_link(
    payload: RegistrationLinkToggle,
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    if not can_have_registration_link(user, db):
        raise HTTPException(status_code=403, detail="Нет доступа к ссылке саморегистрации")
    if not user.registration_key:
        raise HTTPException(status_code=400, detail="Сначала создайте ссылку")
    user.registration_link_enabled = payload.enabled
    db.add(user)
    db.commit()
    db.refresh(user)
    return RegistrationLinkOut(**link_info_for_user(user, db, request))


@router.get("/registration-link/qr")
def registration_link_qr(
    request: Request,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    info = link_info_for_user(user, db, request)
    url = info.get("registration_url")
    if not url or not info.get("enabled"):
        raise HTTPException(status_code=404, detail="Ссылка регистрации недоступна")
    try:
        import qrcode
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="Пакет qrcode не установлен: pip install qrcode[pil]",
        ) from e
    img = qrcode.make(url, box_size=6, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")
