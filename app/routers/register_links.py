# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.registration_captcha import create_captcha_challenge
from app.services.registration_link import get_manager_by_ref, manager_display_name

router = APIRouter()


class RegisterLinkPreviewOut(BaseModel):
    ref: str
    manager_name: str
    level_label: str = "Агент"


class CaptchaOut(BaseModel):
    challenge_id: str
    question: str


@router.get("/preview", response_model=RegisterLinkPreviewOut)
def preview_register_link(ref: str, db: Session = Depends(get_db)):
    manager = get_manager_by_ref(db, ref)
    return RegisterLinkPreviewOut(
        ref=ref.strip(),
        manager_name=manager_display_name(manager),
    )


@router.get("/captcha", response_model=CaptchaOut)
def get_captcha():
    data = create_captcha_challenge()
    return CaptchaOut(**data)
