# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.parts import PartOut, PartCreate, PartUpdate, PartReorder
from app.services import part as service

router = APIRouter()


@router.get("", response_model=list[PartOut])
def list_parts(db: Session = Depends(get_db)):
    return service.list_all(db)


@router.put("/reorder", response_model=list[PartOut])
def reorder_parts(payload: PartReorder, db: Session = Depends(get_db)):
    """Сохранить порядок частей дома (drag-and-drop в настройках)."""
    return service.reorder(db, payload.ids)


@router.get("/{part_id}", response_model=PartOut)
def get_part(part_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, part_id)
    if not row:
        raise HTTPException(status_code=404, detail="Часть дома не найдена")
    return row


@router.post("", response_model=PartOut, status_code=201)
def create_part(payload: PartCreate, db: Session = Depends(get_db)):
    return service.create(db, name=payload.name)


@router.patch("/{part_id}", response_model=PartOut)
def update_part(part_id: int, payload: PartUpdate, db: Session = Depends(get_db)):
    row = service.update(db, part_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Часть дома не найдена")
    return row


@router.delete("/{part_id}", status_code=204)
def delete_part(part_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, part_id):
        raise HTTPException(status_code=404, detail="Часть дома не найдена")
    return None
