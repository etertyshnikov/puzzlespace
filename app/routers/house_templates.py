# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, OperationalError

from app.database import get_db
from app.schemas.house_templates import HouseTemplateOut, HouseTemplateCreate, HouseTemplateUpdate
from app.services import house_template as service

router = APIRouter()


def _handle_db_migration_error(e: Exception):
    """Если в БД нет колонки house_specification_template_id — подсказка выполнить миграцию."""
    msg = str(e).lower()
    if "house_specification_template_id" in msg or ("column" in msg and ("does not exist" in msg or "не существует" in msg)):
        raise HTTPException(
            status_code=503,
            detail="В таблице house_templates отсутствует колонка house_specification_template_id. Выполните миграцию: python -m app.migrations.apply",
        ) from e
    raise e


@router.get("", response_model=list[HouseTemplateOut])
def list_house_templates(db: Session = Depends(get_db)):
    try:
        return service.list_all(db)
    except (ProgrammingError, OperationalError) as e:
        _handle_db_migration_error(e)


@router.get("/{item_id}", response_model=HouseTemplateOut)
def get_house_template(item_id: int, db: Session = Depends(get_db)):
    try:
        row = service.get_by_id(db, item_id)
    except (ProgrammingError, OperationalError) as e:
        _handle_db_migration_error(e)
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон дома не найден")
    return row


@router.post("", response_model=HouseTemplateOut, status_code=201)
def create_house_template(payload: HouseTemplateCreate, db: Session = Depends(get_db)):
    try:
        return service.create(db, **payload.model_dump())
    except (ProgrammingError, OperationalError) as e:
        _handle_db_migration_error(e)


@router.patch("/{item_id}", response_model=HouseTemplateOut)
def update_house_template(item_id: int, payload: HouseTemplateUpdate, db: Session = Depends(get_db)):
    row = service.update(db, item_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон дома не найден")
    return row


@router.delete("/{item_id}", status_code=204)
def delete_house_template(item_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, item_id):
        raise HTTPException(status_code=404, detail="Шаблон дома не найден")
    return None
