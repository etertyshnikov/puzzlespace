# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, UserRole
from app.services.auth import get_current_user, require_admin, hash_password
from app.services.user_hierarchy import apply_role_hierarchy, attach_hierarchy_paths

router = APIRouter()


class UserOut(BaseModel):
    id: int
    nic: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role_id: int | None = None
    role_name: str | None = None
    branch_id: int | None = None


class UserCreate(BaseModel):
    nic: str
    password: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role_id: int | None = None
    branch_id: int | None = None


class UserUpdate(BaseModel):
    nic: str | None = None
    password: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role_id: int | None = None
    branch_id: int | None = None


class RoleOut(BaseModel):
    id: int
    name: str
    description: str | None = None


def _to_out(user: AuthUser, db: Session) -> UserOut:
    role_name = None
    if user.role_id:
        role = db.query(UserRole).filter(UserRole.id == user.role_id).first()
        if role:
            role_name = role.name
    return UserOut(
        id=user.id, nic=user.nic, first_name=user.first_name, last_name=user.last_name,
        email=user.email, role_id=user.role_id, role_name=role_name, branch_id=user.branch_id,
    )


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _admin: AuthUser = Depends(require_admin)):
    users = db.query(AuthUser).order_by(AuthUser.id).all()
    return [_to_out(u, db) for u in users]


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _admin: AuthUser = Depends(require_admin)):
    if db.query(AuthUser).filter(AuthUser.nic == payload.nic).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    user = AuthUser(
        nic=payload.nic,
        password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        role_id=payload.role_id,
        branch_id=payload.branch_id,
    )
    db.add(user)
    db.flush()
    apply_role_hierarchy(user, db)
    attach_hierarchy_paths(db, user.id, user.parent_user_id)
    db.commit()
    db.refresh(user)
    return _to_out(user, db)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), _admin: AuthUser = Depends(require_admin)):
    user = db.query(AuthUser).filter(AuthUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        data["password"] = hash_password(data["password"])
    elif "password" in data:
        del data["password"]
    for k, v in data.items():
        setattr(user, k, v)
    db.flush()
    apply_role_hierarchy(user, db)
    db.commit()
    db.refresh(user)
    return _to_out(user, db)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), admin: AuthUser = Depends(require_admin)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    user = db.query(AuthUser).filter(AuthUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
    return None


@router.get("/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _user: AuthUser = Depends(get_current_user)):
    return db.query(UserRole).order_by(UserRole.sort_order, UserRole.id).all()
