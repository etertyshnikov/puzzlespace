# -*- coding: utf-8 -*-
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, UserInvite, UserRole
from app.schemas.dashboard_preferences import DashboardColumnsPreference
from app.services.auth import verify_password, create_access_token, get_current_user, hash_password
from app.services.auth_lookup import find_user_by_login_or_email
from app.services.nic_generator import generate_unique_nic
from app.services.user_hierarchy import HIERARCHY_LEVEL_MANAGER_L2
from app.services.dashboard_preferences import (
    parse_dashboard_columns,
    serialize_dashboard_columns,
)

router = APIRouter()


class LoginRequest(BaseModel):
    login: str | None = None
    nic: str | None = None
    password: str

    @model_validator(mode="after")
    def resolve_login(self):
        ident = (self.login or self.nic or "").strip()
        if not ident:
            raise ValueError("Укажите логин или email")
        self.login = ident
        return self


class UserOut(BaseModel):
    id: int
    nic: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role_id: int | None = None
    role_name: str | None = None
    branch_id: int | None = None
    parent_user_id: int | None = None
    hierarchy_level: int = 2
    can_invite: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _user_out(user: AuthUser, db: Session) -> UserOut:
    from app.services.user_hierarchy import can_invite_users

    role_name = None
    if user.role_id:
        role = db.query(UserRole).filter(UserRole.id == user.role_id).first()
        if role:
            role_name = role.name
    return UserOut(
        id=user.id,
        nic=user.nic,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role_id=user.role_id,
        role_name=role_name,
        branch_id=user.branch_id,
        parent_user_id=getattr(user, "parent_user_id", None),
        hierarchy_level=int(getattr(user, "hierarchy_level", 2) or 2),
        can_invite=can_invite_users(user, db),
    )


class SetupRequest(BaseModel):
    nic: str
    password: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None


@router.get("/has-users")
def has_users(db: Session = Depends(get_db)):
    """Проверяет, есть ли пользователи в системе (без авторизации)."""
    return {"has_users": db.query(AuthUser).count() > 0}


@router.post("/setup", response_model=LoginResponse)
def setup_first_user(payload: SetupRequest, db: Session = Depends(get_db)):
    """Создать первого пользователя (admin). Работает только если БД пуста."""
    if db.query(AuthUser).count() > 0:
        raise HTTPException(status_code=400, detail="Пользователи уже существуют. Используйте вход.")
    from app.services.auth import hash_password
    admin_role = db.query(UserRole).filter(UserRole.name == "admin").first()
    from app.services.user_hierarchy import (
        HIERARCHY_LEVEL_DIRECTOR,
        attach_hierarchy_paths,
    )

    user = AuthUser(
        nic=payload.nic,
        password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        role_id=admin_role.id if admin_role else None,
        parent_user_id=None,
        hierarchy_level=HIERARCHY_LEVEL_DIRECTOR,
    )
    db.add(user)
    db.flush()
    attach_hierarchy_paths(db, user.id, None)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    return LoginResponse(access_token=token, user=_user_out(user, db))


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = find_user_by_login_or_email(db, payload.login or "")
    if not user or not user.password or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин, email или пароль",
        )
    token = create_access_token({"sub": user.id})
    return LoginResponse(access_token=token, user=_user_out(user, db))


class RegisterInviteRequest(BaseModel):
    token: str
    nic: str | None = None
    password: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None


class RegisterByLinkRequest(BaseModel):
    ref: str
    nic: str | None = None
    password: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    challenge_id: str
    captcha_answer: int


@router.post("/register-invite", response_model=LoginResponse)
def register_by_invite(payload: RegisterInviteRequest, db: Session = Depends(get_db)):
    from app.services.auth import hash_password
    from app.services.user_hierarchy import (
        assert_invite_valid,
        create_user_with_hierarchy,
        get_invite_by_token,
    )

    invite = assert_invite_valid(get_invite_by_token(db, payload.token))
    first_name = payload.first_name or invite.first_name
    last_name = payload.last_name or invite.last_name
    email = (payload.email or invite.email or "").strip() or None
    nic = (payload.nic or invite.nic or "").strip() or None

    if not nic:
        if invite.target_hierarchy_level == HIERARCHY_LEVEL_MANAGER_L2:
            nic = generate_unique_nic(db, first_name=first_name, last_name=last_name, email=email)
        else:
            raise HTTPException(status_code=400, detail="Укажите логин")
    if db.query(AuthUser).filter(AuthUser.nic == nic).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    if email and db.query(AuthUser).filter(func.lower(AuthUser.email) == email.lower()).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    user = create_user_with_hierarchy(
        db,
        nic=nic,
        password_hash=hash_password(payload.password),
        parent_user_id=invite.parent_user_id,
        hierarchy_level=invite.target_hierarchy_level,
        role_id=invite.role_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        branch_id=None,
    )
    inv_row = db.query(UserInvite).filter(UserInvite.id == invite.id).first()
    if inv_row:
        inv_row.accepted_at = datetime.utcnow()
        inv_row.accepted_user_id = user.id
        db.commit()
    token = create_access_token({"sub": user.id})
    return LoginResponse(access_token=token, user=_user_out(user, db))


@router.post("/register-by-link", response_model=LoginResponse)
def register_by_link(
    payload: RegisterByLinkRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    from app.services.auth import hash_password
    from app.services.registration_captcha import (
        check_registration_rate_limit,
        verify_captcha,
    )
    from app.services.registration_link import get_manager_by_ref, register_agent_by_link

    check_registration_rate_limit(request)
    verify_captcha(payload.challenge_id, payload.captcha_answer)
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Пароль минимум 4 символа")

    first_name = (payload.first_name or "").strip() or None
    last_name = (payload.last_name or "").strip() or None
    email = (payload.email or "").strip() or None
    if email and db.query(AuthUser).filter(func.lower(AuthUser.email) == email.lower()).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    nic = (payload.nic or "").strip() or generate_unique_nic(
        db, first_name=first_name, last_name=last_name, email=email
    )
    manager = get_manager_by_ref(db, payload.ref)
    user = register_agent_by_link(
        db,
        manager=manager,
        nic=nic,
        password_hash=hash_password(payload.password),
        first_name=first_name,
        last_name=last_name,
        email=email,
    )
    token = create_access_token({"sub": user.id})
    return LoginResponse(access_token=token, user=_user_out(user, db))


class UpdateMyProfileRequest(BaseModel):
    email: str | None = None
    current_password: str | None = None
    new_password: str | None = None


@router.get("/me", response_model=UserOut)
def me(current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(current_user, db)


@router.patch("/me/profile", response_model=UserOut)
def update_my_profile(
    payload: UpdateMyProfileRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="Укажите текущий пароль")
        if not current_user.password or not verify_password(payload.current_password, current_user.password):
            raise HTTPException(status_code=400, detail="Неверный текущий пароль")
        if len(payload.new_password) < 4:
            raise HTTPException(status_code=400, detail="Новый пароль минимум 4 символа")
        current_user.password = hash_password(payload.new_password)

    if payload.email is not None:
        email = payload.email.strip() or None
        if email:
            existing = (
                db.query(AuthUser)
                .filter(func.lower(AuthUser.email) == email.lower(), AuthUser.id != current_user.id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
        current_user.email = email

    if payload.new_password is None and payload.email is None:
        raise HTTPException(status_code=400, detail="Нет данных для сохранения")

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _user_out(current_user, db)


@router.get("/me/dashboard-columns", response_model=DashboardColumnsPreference)
def get_my_dashboard_columns(
    current_user: AuthUser = Depends(get_current_user),
):
    data = parse_dashboard_columns(getattr(current_user, "dashboard_columns_json", None))
    return DashboardColumnsPreference(**data)


@router.put("/me/dashboard-columns", response_model=DashboardColumnsPreference)
def update_my_dashboard_columns(
    payload: DashboardColumnsPreference,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = serialize_dashboard_columns(payload.model_dump())
    current_user.dashboard_columns_json = data
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    parsed = parse_dashboard_columns(current_user.dashboard_columns_json)
    return DashboardColumnsPreference(**parsed)
