# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.print_settings import PrintSettingsOut, PrintSettingsUpdate
from app.services import print_settings as service

router = APIRouter()


@router.get("", response_model=PrintSettingsOut)
def get_print_settings(db: Session = Depends(get_db)):
    return service.get_or_create(db)


@router.patch("", response_model=PrintSettingsOut)
def update_print_settings(payload: PrintSettingsUpdate, db: Session = Depends(get_db)):
    return service.update(db, **payload.model_dump(exclude_unset=True))
