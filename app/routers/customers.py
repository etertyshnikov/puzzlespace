# -*- coding: utf-8 -*-
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, UserRole, ProjectStatus
from app.schemas.customers import CustomerCreate, CustomerUpdate, CustomerOut, build_customer_out
from app.services import customer as service
from app.services import project_status as project_status_service
from app.services.auth import get_current_user

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_PASSPORT_SCAN_SIZE = 10 * 1024 * 1024  # 10 MB


def _default_project_status_id(db: Session) -> int | None:
    """Первый статус по sort_order — для нового проекта при создании клиента."""
    row = (
        db.query(ProjectStatus.id)
        .order_by(ProjectStatus.sort_order.asc(), ProjectStatus.id.asc())
        .first()
    )
    return int(row[0]) if row else None


def _get_user_names(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    rows = db.query(AuthUser.id, AuthUser.first_name, AuthUser.nic).filter(AuthUser.id.in_(user_ids)).all()
    return {r.id: (r.first_name or r.nic) for r in rows}


@router.get("", response_model=list[CustomerOut])
def list_customers(
    skip: int = 0,
    limit: int = 50,
    deal_status: Annotated[list[str] | None, Query()] = None,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    from app.services.user_hierarchy import get_visible_user_ids

    visible_ids = get_visible_user_ids(db, user)
    if visible_ids is None:
        customers = service.list_all(db, skip=skip, limit=limit, deal_status=deal_status)
    else:
        customers = service.list_all(
            db,
            skip=skip,
            limit=limit,
            created_by_user_ids=sorted(visible_ids),
            deal_status=deal_status,
        )
    user_ids = {c.created_by_user_id for c in customers if c.created_by_user_id}
    names = _get_user_names(db, user_ids)
    result = []
    for c in customers:
        result.append(
            build_customer_out(
                c,
                created_by_name=names.get(c.created_by_user_id) if c.created_by_user_id else None,
            )
        )
    return result


@router.get("/check-phone")
def check_phone(phone: str = Query(..., description="Номер телефона"), db: Session = Depends(get_db)):
    """Проверка уникальности номера телефона (для формы добавления клиента)."""
    return {"exists": service.phone_exists(db, phone)}


@router.get("/{customer_id}/passport-scan", response_class=Response)
def get_customer_passport_scan(customer_id: int, db: Session = Depends(get_db)):
    """Получить скан паспорта (изображение) клиента."""
    result = service.get_passport_scan(db, customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Скан паспорта не найден")
    data, content_type = result
    return Response(content=data, media_type=content_type)


@router.post("/{customer_id}/passport-scan", status_code=204)
def upload_customer_passport_scan(
    customer_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Загрузить скан паспорта (изображение). Разрешены JPEG, PNG, GIF, WebP до 10 МБ."""
    if not service.get_by_id(db, customer_id):
        raise HTTPException(status_code=404, detail="Клиент не найден")
    content_type = (file.content_type or "").strip().lower()
    if content_type and content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый тип файла. Разрешены: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )
    data = file.file.read()
    if len(data) > MAX_PASSPORT_SCAN_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 10 МБ)")
    if not data:
        raise HTTPException(status_code=400, detail="Файл пустой")
    if not service.set_passport_scan(db, customer_id, data, content_type or "image/jpeg"):
        raise HTTPException(status_code=404, detail="Клиент не найден")
    return None


@router.delete("/{customer_id}/passport-scan", status_code=204)
def delete_customer_passport_scan(customer_id: int, db: Session = Depends(get_db)):
    """Удалить скан паспорта клиента."""
    if not service.clear_passport_scan(db, customer_id):
        raise HTTPException(status_code=404, detail="Клиент не найден")
    return None


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, customer_id)
    if not row:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    created_by_name = None
    if row.created_by_user_id:
        names = _get_user_names(db, {row.created_by_user_id})
        created_by_name = names.get(row.created_by_user_id)
    return build_customer_out(row, created_by_name=created_by_name)


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    data = payload.model_dump()
    data["created_by_user_id"] = user.id
    project_status_service.ensure_default_statuses_seeded(db)
    customer, _project = service.create_customer_and_project(
        db,
        actor_user_id=user.id,
        customer_data=data,
        project_status_id=_default_project_status_id(db),
    )
    return build_customer_out(customer, created_by_name=user.first_name or user.nic)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    row = service.update(db, customer_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    created_by_name = None
    if row.created_by_user_id:
        names = _get_user_names(db, {row.created_by_user_id})
        created_by_name = names.get(row.created_by_user_id)
    return build_customer_out(row, created_by_name=created_by_name)


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    try:
        if not service.delete(db, customer_id):
            raise HTTPException(status_code=404, detail="Клиент не найден")
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409,
            detail="Не удалось удалить клиента: остались связанные записи в базе.",
        ) from exc
    return None
