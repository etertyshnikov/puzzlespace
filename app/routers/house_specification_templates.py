# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.house_specification_templates import (
    HouseSpecificationTemplateOut,
    HouseSpecificationTemplateCreate,
    HouseSpecificationTemplateUpdate,
)
from app.services import house_specification_template as service

router = APIRouter()


@router.get("", response_model=list[HouseSpecificationTemplateOut])
def list_house_specification_templates(db: Session = Depends(get_db)):
    return service.list_all(db)


@router.get("/{item_id}", response_model=HouseSpecificationTemplateOut)
def get_house_specification_template(item_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон спецификации домов не найден")
    return row


@router.post("", response_model=HouseSpecificationTemplateOut, status_code=201)
def create_house_specification_template(payload: HouseSpecificationTemplateCreate, db: Session = Depends(get_db)):
    return service.create(db, name=payload.name)


@router.patch("/{item_id}", response_model=HouseSpecificationTemplateOut)
def update_house_specification_template(item_id: int, payload: HouseSpecificationTemplateUpdate, db: Session = Depends(get_db)):
    row = service.update(db, item_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон спецификации домов не найден")
    return row


@router.delete("/{item_id}", status_code=204)
def delete_house_specification_template(item_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, item_id):
        raise HTTPException(status_code=404, detail="Шаблон спецификации домов не найден")
    return None
