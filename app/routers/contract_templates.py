# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.contract_templates import (
    ContractTemplateCreate,
    ContractTemplateUpdate,
    ContractTemplateOut,
    ContractTemplateReorder,
)
from app.services import contract_template as service

router = APIRouter()


@router.get("", response_model=list[ContractTemplateOut])
def list_contract_templates(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return service.list_all(db, skip=skip, limit=limit)


@router.put("/reorder", response_model=list[ContractTemplateOut])
def reorder_contract_templates(payload: ContractTemplateReorder, db: Session = Depends(get_db)):
    """Сохранить порядок шаблонов договоров (drag-and-drop в настройках)."""
    return service.reorder(db, payload.ids)


@router.get("/by-code/{code}", response_model=ContractTemplateOut)
def get_contract_template_by_code(code: str, db: Session = Depends(get_db)):
    row = service.get_by_code(db, code)
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return row


@router.get("/{template_id}", response_model=ContractTemplateOut)
def get_contract_template(template_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, template_id)
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return row


@router.post("", response_model=ContractTemplateOut, status_code=201)
def create_contract_template(payload: ContractTemplateCreate, db: Session = Depends(get_db)):
    return service.create(db, **payload.model_dump())


@router.patch("/{template_id}", response_model=ContractTemplateOut)
def update_contract_template(template_id: int, payload: ContractTemplateUpdate, db: Session = Depends(get_db)):
    row = service.update(db, template_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return row


@router.delete("/{template_id}", status_code=204)
def delete_contract_template(template_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, template_id):
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return None
