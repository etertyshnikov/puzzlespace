# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.required_item_templates import (
    RequiredItemTemplateOut,
    RequiredItemTemplateCreate,
    RequiredItemTemplateUpdate,
)
from app.services import required_item_template as service

router = APIRouter()


@router.get("", response_model=list[RequiredItemTemplateOut])
def list_required_item_templates(db: Session = Depends(get_db)):
    return service.list_all(db)


@router.get("/{template_id}", response_model=RequiredItemTemplateOut)
def get_required_item_template(template_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, template_id)
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон обязательной позиции не найден")
    return row


@router.post("", response_model=RequiredItemTemplateOut, status_code=201)
def create_required_item_template(payload: RequiredItemTemplateCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        part_id=payload.part_id,
        name=payload.name,
        required_qty=payload.required_qty,
        unit=payload.unit,
    )


@router.patch("/{template_id}", response_model=RequiredItemTemplateOut)
def update_required_item_template(
    template_id: int, payload: RequiredItemTemplateUpdate, db: Session = Depends(get_db)
):
    row = service.update(db, template_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон обязательной позиции не найден")
    return row


@router.delete("/{template_id}", status_code=204)
def delete_required_item_template(template_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, template_id):
        raise HTTPException(status_code=404, detail="Шаблон обязательной позиции не найден")
    return None
