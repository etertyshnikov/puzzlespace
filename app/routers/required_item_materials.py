# -*- coding: utf-8 -*-
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.required_item_materials import (
    RequiredItemMaterialOut,
    RequiredItemMaterialCreate,
    RequiredItemMaterialUpdate,
)
from app.services import required_item_material as service

router = APIRouter()


@router.get("", response_model=list[RequiredItemMaterialOut])
def list_required_item_materials(
    template_id: Optional[int] = Query(None, description="Фильтр по шаблону"),
    db: Session = Depends(get_db),
):
    return service.list_all(db, template_id=template_id)


@router.get("/{material_id}", response_model=RequiredItemMaterialOut)
def get_required_item_material(material_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, material_id)
    if not row:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return row


@router.post("", response_model=RequiredItemMaterialOut, status_code=201)
def create_required_item_material(payload: RequiredItemMaterialCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        required_item_template_id=payload.required_item_template_id,
        nomenclature_id=payload.nomenclature_id,
    )


@router.patch("/{material_id}", response_model=RequiredItemMaterialOut)
def update_required_item_material(
    material_id: int,
    payload: RequiredItemMaterialUpdate,
    db: Session = Depends(get_db),
):
    updated = service.update(db, material_id, **payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return updated


@router.delete("/{material_id}", status_code=204)
def delete_required_item_material(material_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, material_id):
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return None
