# -*- coding: utf-8 -*-
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.specifications import (
    SpecificationItemOut,
    SpecificationItemCreate,
    SpecificationItemUpdate,
)
from app.services import specification_item as service

router = APIRouter()


@router.get("", response_model=list[SpecificationItemOut])
def list_specification_items(
    specification_id: Optional[int] = Query(None, description="Фильтр по спецификации"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    return service.list_all(db, specification_id=specification_id, skip=skip, limit=limit)


@router.get("/{item_id}", response_model=SpecificationItemOut)
def get_specification_item(item_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Позиция спецификации не найдена")
    return row


@router.post("", response_model=SpecificationItemOut, status_code=201)
def create_specification_item(payload: SpecificationItemCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        specification_id=payload.specification_id,
        part_id=payload.part_id,
        template_id=payload.template_id,
        nomenclature_item_id=payload.nomenclature_item_id,
        item_name=payload.item_name,
        quantity=payload.quantity,
        unit=payload.unit,
        price=payload.price,
        total=payload.total,
        description=payload.description,
    )


@router.patch("/{item_id}", response_model=SpecificationItemOut)
def update_specification_item(item_id: int, payload: SpecificationItemUpdate, db: Session = Depends(get_db)):
    row = service.update(db, item_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Позиция спецификации не найдена")
    return row


@router.delete("/{item_id}", status_code=204)
def delete_specification_item(item_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, item_id):
        raise HTTPException(status_code=404, detail="Позиция спецификации не найдена")
    return None
