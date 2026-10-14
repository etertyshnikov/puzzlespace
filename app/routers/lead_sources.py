# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import LeadSourceOut, LeadSourceCreate, LeadSourceUpdate
from app.services import lead_source as service

router = APIRouter()


@router.get("", response_model=list[LeadSourceOut])
def list_lead_sources(db: Session = Depends(get_db)):
    return service.list_all(db)


@router.get("/{lead_source_id}", response_model=LeadSourceOut)
def get_lead_source(lead_source_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, lead_source_id)
    if not row:
        raise HTTPException(status_code=404, detail="Источник лида не найден")
    return row


@router.post("", response_model=LeadSourceOut, status_code=201)
def create_lead_source(payload: LeadSourceCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        name=payload.name,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )


@router.patch("/{lead_source_id}", response_model=LeadSourceOut)
def update_lead_source(lead_source_id: int, payload: LeadSourceUpdate, db: Session = Depends(get_db)):
    row = service.update(db, lead_source_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Источник лида не найден")
    return row


@router.delete("/{lead_source_id}", status_code=204)
def delete_lead_source(lead_source_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, lead_source_id):
        raise HTTPException(status_code=404, detail="Источник лида не найден")
    return None
