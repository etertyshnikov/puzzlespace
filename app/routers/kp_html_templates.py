# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.kp_html_templates import (
    KpHtmlTemplateCreate,
    KpHtmlTemplateUpdate,
    KpHtmlTemplateOut,
)
from app.services import kp_html_template as service

router = APIRouter()


@router.get("", response_model=list[KpHtmlTemplateOut])
def list_kp_html_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return service.list_all(db, skip=skip, limit=limit)


@router.get("/{template_id}", response_model=KpHtmlTemplateOut)
def get_kp_html_template(template_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, template_id)
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон КП не найден")
    return row


@router.post("", response_model=KpHtmlTemplateOut, status_code=201)
def create_kp_html_template(payload: KpHtmlTemplateCreate, db: Session = Depends(get_db)):
    return service.create(db, **payload.model_dump())


@router.patch("/{template_id}", response_model=KpHtmlTemplateOut)
def update_kp_html_template(
    template_id: int,
    payload: KpHtmlTemplateUpdate,
    db: Session = Depends(get_db),
):
    row = service.update(db, template_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Шаблон КП не найден")
    return row


@router.delete("/{template_id}", status_code=204)
def delete_kp_html_template(template_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, template_id):
        raise HTTPException(status_code=404, detail="Шаблон КП не найден")
    return None
