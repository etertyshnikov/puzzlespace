# -*- coding: utf-8 -*-
"""Публичный квиз /estimate: сохранить смету, отдать страницу, PDF и фото."""
from __future__ import annotations

import json
import secrets
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal, get_db
from app.estimate.calculator import calculate
from app.estimate.constants import (
    FACADE,
    FLOOR_COEF,
    PURPOSE_COEF,
    RELIEF,
    ROOF_MATERIAL,
    ROOF_TYPE,
    SEWER_RUB,
    TECH_RATE_RUB_M2,
)
from app.estimate.max_publish import publish_estimate
from app.estimate.pdf import render_estimate_pdf
from app.models.estimate_quote import EstimateQuote

router = APIRouter()
_PHOTO_DIR = Path(__file__).resolve().parents[2] / "data" / "estimate_photos"
_ALLOWED_PHOTO = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
_MAX_PHOTO = 8 * 1024 * 1024


class EstimateIn(BaseModel):
    purpose: str
    region: str = Field(min_length=2, max_length=160)
    plot_owned: bool = False
    cadastral: str = ""
    geology: bool = False
    access_road: bool = False
    clearing: bool = False
    area_m2: float
    floors: str
    ceiling_m: float
    plot_sotkas: float | None = None
    relief: str
    sewer: str
    technology: str
    roof_type: str
    roof_material: str
    facade: str
    style: str = ""

    @field_validator("purpose")
    @classmethod
    def _purpose(cls, value: str) -> str:
        if value not in PURPOSE_COEF:
            raise ValueError("Выберите назначение строительства")
        return value

    @field_validator("floors")
    @classmethod
    def _floors(cls, value: str) -> str:
        if value not in FLOOR_COEF:
            raise ValueError("Выберите этажность")
        return value

    @field_validator("relief")
    @classmethod
    def _relief(cls, value: str) -> str:
        if value not in RELIEF:
            raise ValueError("Выберите рельеф")
        return value

    @field_validator("sewer")
    @classmethod
    def _sewer(cls, value: str) -> str:
        if value not in SEWER_RUB:
            raise ValueError("Выберите канализацию")
        return value

    @field_validator("technology")
    @classmethod
    def _tech(cls, value: str) -> str:
        if value not in TECH_RATE_RUB_M2:
            raise ValueError("Выберите технологию")
        return value

    @field_validator("roof_type")
    @classmethod
    def _roof_type(cls, value: str) -> str:
        if value not in ROOF_TYPE:
            raise ValueError("Выберите тип кровли")
        return value

    @field_validator("roof_material")
    @classmethod
    def _roof_material(cls, value: str) -> str:
        if value not in ROOF_MATERIAL:
            raise ValueError("Выберите материал кровли")
        return value

    @field_validator("facade")
    @classmethod
    def _facade(cls, value: str) -> str:
        if value not in FACADE:
            raise ValueError("Выберите фасад")
        return value

    @field_validator("area_m2")
    @classmethod
    def _area(cls, value: float) -> float:
        if value <= 0 or value > 20000:
            raise ValueError("Площадь дома должна быть больше нуля")
        return value

    @field_validator("ceiling_m")
    @classmethod
    def _ceiling(cls, value: float) -> float:
        if value < 2 or value > 8:
            raise ValueError("Высота потолков — от 2 до 8 метров")
        return value

    @field_validator("cadastral")
    @classmethod
    def _cadastral(cls, value: str) -> str:
        text = value.strip()
        if text and (len(text) > 40 or any(ch not in "0123456789:" for ch in text)):
            raise ValueError("Кадастровый номер выглядит неверно")
        return text

    @field_validator("style")
    @classmethod
    def _style(cls, value: str) -> str:
        return value.strip()[:200]

    @field_validator("plot_sotkas")
    @classmethod
    def _plot(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if value <= 0 or value > 100000:
            raise ValueError("Размер участка укажите в сотках, число больше нуля")
        return value


def _public_url(slug: str) -> str:
    base = get_settings().public_base_url.rstrip("/")
    return f"{base}/estimate/{slug}"


def _dump(quote: EstimateQuote) -> dict:
    return {
        "slug": quote.slug,
        "url": _public_url(quote.slug),
        "created_at": quote.created_at.isoformat() + "Z",
        "input": json.loads(quote.payload_json),
        "result": json.loads(quote.result_json),
        "has_photo": bool(quote.photo_path),
    }


def _new_slug(db: Session) -> str:
    for _ in range(6):
        slug = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:10]
        if not db.query(EstimateQuote).filter(EstimateQuote.slug == slug).first():
            return slug
    return secrets.token_hex(6)


def _send_to_channel(quote_id: int) -> None:
    db = SessionLocal()
    try:
        quote = db.get(EstimateQuote, quote_id)
        if quote is None or "опубликовано" in (quote.publish_log or ""):
            return
        packed = _dump(quote)
        pdf = render_estimate_pdf(packed, packed["url"])
        quote.publish_log = publish_estimate(packed["url"], pdf)
        db.commit()
    finally:
        db.close()


@router.post("/quotes")
def create_quote(body: EstimateIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    payload = body.model_dump()
    result = calculate(payload)
    quote = EstimateQuote(
        slug=_new_slug(db),
        payload_json=json.dumps(payload, ensure_ascii=False),
        result_json=json.dumps(result, ensure_ascii=False),
        publish_log="",
        created_at=datetime.utcnow(),
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)
    background.add_task(_send_to_channel, quote.id)
    return _dump(quote)


@router.get("/quotes/{slug}")
def read_quote(slug: str, db: Session = Depends(get_db)):
    quote = db.query(EstimateQuote).filter(EstimateQuote.slug == slug).first()
    if quote is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    return _dump(quote)


@router.get("/quotes/{slug}/pdf")
def download_pdf(slug: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    quote = db.query(EstimateQuote).filter(EstimateQuote.slug == slug).first()
    if quote is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    packed = _dump(quote)
    pdf = render_estimate_pdf(packed, packed["url"])
    if "опубликовано" not in (quote.publish_log or ""):
        background.add_task(_send_to_channel, quote.id)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="smeta-{slug}.pdf"'},
    )


@router.post("/quotes/{slug}/photo")
async def upload_photo(slug: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    quote = db.query(EstimateQuote).filter(EstimateQuote.slug == slug).first()
    if quote is None:
        raise HTTPException(status_code=404, detail="Смета не найдена")
    ext = _ALLOWED_PHOTO.get((file.content_type or "").lower())
    if not ext:
        raise HTTPException(status_code=400, detail="Нужна фотография JPG, PNG или WEBP")
    raw = await file.read()
    if not raw or len(raw) > _MAX_PHOTO:
        raise HTTPException(status_code=400, detail="Фото должно быть меньше 8 МБ")
    _PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    path = _PHOTO_DIR / f"{slug}{ext}"
    path.write_bytes(raw)
    quote.photo_path = str(path)
    db.commit()
    return {"ok": True}


@router.get("/quotes/{slug}/photo")
def read_photo(slug: str, db: Session = Depends(get_db)):
    quote = db.query(EstimateQuote).filter(EstimateQuote.slug == slug).first()
    if quote is None or not quote.photo_path:
        raise HTTPException(status_code=404, detail="Фото нет")
    path = Path(quote.photo_path).resolve()
    if not path.is_file() or path.parent != _PHOTO_DIR.resolve():
        raise HTTPException(status_code=404, detail="Фото нет")
    media = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(path.suffix, "application/octet-stream")
    return Response(content=path.read_bytes(), media_type=media)
