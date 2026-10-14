# -*- coding: utf-8 -*-
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.nomenclature_items import (
    NomenclatureItemOut,
    NomenclatureItemCreate,
    NomenclatureItemUpdate,
)
from app.services import nomenclature_item as service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=list[NomenclatureItemOut])
def list_nomenclature_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=5000),
    part_id: Optional[int] = Query(None, description="Фильтр по части дома"),
    db: Session = Depends(get_db),
):
    try:
        return service.list_all(db, skip=skip, limit=limit, part_id=part_id)
    except Exception as e:
        logger.exception("list_nomenclature_items failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{item_id}", response_model=NomenclatureItemOut)
def get_nomenclature_item(item_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Позиция номенклатуры не найдена")
    return row


@router.post("", response_model=NomenclatureItemOut, status_code=201)
def create_nomenclature_item(payload: NomenclatureItemCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        item_number=payload.item_number or None,
        name=payload.name,
        part_id=payload.part_id,
        item_date=payload.item_date,
        unit=payload.unit,
        unit_alt=payload.unit_alt,
        total_cost=payload.total_cost,
        price_alt=payload.price_alt,
        description=payload.description,
    )


@router.patch("/{item_id}", response_model=NomenclatureItemOut)
def update_nomenclature_item(item_id: int, payload: NomenclatureItemUpdate, db: Session = Depends(get_db)):
    row = service.update(db, item_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Позиция номенклатуры не найдена")
    return row


@router.delete("/{item_id}", status_code=204)
def delete_nomenclature_item(item_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, item_id):
        raise HTTPException(status_code=404, detail="Позиция номенклатуры не найдена")
    return None
