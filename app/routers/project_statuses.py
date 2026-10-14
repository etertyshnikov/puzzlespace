# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.project_statuses import (
    ProjectStatusCreate,
    ProjectStatusUpdate,
    ProjectStatusOut,
)
from app.services import project_status as service

router = APIRouter()


@router.get("", response_model=list[ProjectStatusOut])
def list_project_statuses(db: Session = Depends(get_db)):
    rows = service.list_all(db)
    return [ProjectStatusOut.model_validate(r) for r in rows]


@router.get("/{status_id}", response_model=ProjectStatusOut)
def get_project_status(status_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, status_id)
    if not row:
        raise HTTPException(status_code=404, detail="Статус проекта не найден")
    return ProjectStatusOut.model_validate(row)


@router.post("", response_model=ProjectStatusOut, status_code=201)
def create_project_status(payload: ProjectStatusCreate, db: Session = Depends(get_db)):
    row = service.create(db, **payload.model_dump())
    return ProjectStatusOut.model_validate(row)


@router.patch("/{status_id}", response_model=ProjectStatusOut)
def update_project_status(
    status_id: int, payload: ProjectStatusCreate, db: Session = Depends(get_db)
):
    """Форма настроек шлёт полный объект (как при создании) — все поля, включая action и execution_days."""
    try:
        row = service.update(db, status_id, **payload.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Не удалось сохранить статус: {exc}",
        ) from exc
    if not row:
        raise HTTPException(status_code=404, detail="Статус проекта не найден")
    return ProjectStatusOut.model_validate(row)


@router.delete("/{status_id}", status_code=204)
def delete_project_status(status_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, status_id):
        raise HTTPException(status_code=404, detail="Статус проекта не найден")
    return None
