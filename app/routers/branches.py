# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import BranchOut, BranchCreate, BranchUpdate
from app.services import branch as service

router = APIRouter()


@router.get("", response_model=list[BranchOut])
def list_branches(db: Session = Depends(get_db)):
    return service.list_all(db)


@router.get("/{branch_id}", response_model=BranchOut)
def get_branch(branch_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, branch_id)
    if not row:
        raise HTTPException(status_code=404, detail="Филиал не найден")
    return row


@router.post("", response_model=BranchOut, status_code=201)
def create_branch(payload: BranchCreate, db: Session = Depends(get_db)):
    return service.create(
        db,
        name=payload.name,
        address=payload.address,
        phone=payload.phone,
        email=payload.email,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )


@router.patch("/{branch_id}", response_model=BranchOut)
def update_branch(branch_id: int, payload: BranchUpdate, db: Session = Depends(get_db)):
    row = service.update(db, branch_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Филиал не найден")
    return row


@router.delete("/{branch_id}", status_code=204)
def delete_branch(branch_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, branch_id):
        raise HTTPException(status_code=404, detail="Филиал не найден")
    return None
