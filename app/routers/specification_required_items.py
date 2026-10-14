# -*- coding: utf-8 -*-
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.specification_required_items import (
    SpecificationRequiredItemOut,
    SpecificationRequiredItemCreate,
    SpecificationRequiredItemUpdate,
)
from app.services import specification_required_item as service

router = APIRouter()


@router.get("", response_model=list[SpecificationRequiredItemOut])
def list_specification_required_items(
    spec_id: Optional[int] = Query(None, description="Фильтр по спецификации"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    return service.list_all(db, spec_id=spec_id, skip=skip, limit=limit)


@router.get("/{item_id}", response_model=SpecificationRequiredItemOut)
def get_specification_required_item(item_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Обязательная позиция не найдена")
    return row


@router.post("", response_model=SpecificationRequiredItemOut, status_code=201)
def create_specification_required_item(payload: SpecificationRequiredItemCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        spec_id=payload.spec_id,
        part_id=payload.part_id,
        template_id=payload.template_id,
        required_qty=payload.required_qty,
        added_qty=payload.added_qty,
    )


@router.patch("/{item_id}", response_model=SpecificationRequiredItemOut)
def update_specification_required_item(
    item_id: int, payload: SpecificationRequiredItemUpdate, db: Session = Depends(get_db)
):
    row = service.update(db, item_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Обязательная позиция не найдена")
    return row


@router.delete("/{item_id}", status_code=204)
def delete_specification_required_item(item_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, item_id):
        raise HTTPException(status_code=404, detail="Обязательная позиция не найдена")
    return None
