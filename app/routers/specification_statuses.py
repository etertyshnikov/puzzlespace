# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.specification_statuses import (
    SpecificationStatusCreate,
    SpecificationStatusUpdate,
    SpecificationStatusOut,
)
from app.services import specification_status as service

router = APIRouter()


@router.get("", response_model=list[SpecificationStatusOut])
def list_specification_statuses(db: Session = Depends(get_db)):
    return service.list_all(db)


@router.get("/{status_id}", response_model=SpecificationStatusOut)
def get_specification_status(status_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, status_id)
    if not row:
        raise HTTPException(status_code=404, detail="Статус спецификации не найден")
    return row


@router.post("", response_model=SpecificationStatusOut, status_code=201)
def create_specification_status(payload: SpecificationStatusCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        name=payload.name,
        description=payload.description,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )


@router.patch("/{status_id}", response_model=SpecificationStatusOut)
def update_specification_status(
    status_id: int, payload: SpecificationStatusUpdate, db: Session = Depends(get_db)
):
    row = service.update(db, status_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Статус спецификации не найден")
    return row


@router.delete("/{status_id}", status_code=204)
def delete_specification_status(status_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, status_id):
        raise HTTPException(status_code=404, detail="Статус спецификации не найден")
    return None
