# -*- coding: utf-8 -*-
"""Фотографии спецификации для HTML/PDF коммерческого предложения."""
from __future__ import annotations

import base64
from xml.sax.saxutils import escape as xml_escape

from sqlalchemy.orm import Session

from app.models.crm import SpecificationPhoto

KP_PHOTOS_PER_PAGE = 2


def load_specification_photos(
    db: Session,
    specification_id: int,
    *,
    limit: int | None = None,
) -> list[dict]:
    """Все фото вкладки «Фотографии» (sort_order, id). limit — опционально."""
    q = (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.specification_id == specification_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
    )
    if limit is not None:
        q = q.limit(limit)
    rows = q.all()
    out: list[dict] = []
    for p in rows:
        if not p.image_data:
            continue
        out.append(
            {
                "image_data": bytes(p.image_data),
                "content_type": p.content_type or "image/jpeg",
                "filename": p.filename or "photo",
            }
        )
    return out


def _photo_img_tag(photo: dict) -> str:
    data = photo.get("image_data")
    if not data:
        return ""
    ct = photo.get("content_type") or "image/jpeg"
    b64 = base64.b64encode(data).decode("ascii")
    alt = xml_escape(str(photo.get("filename") or "Фото"))
    return (
        f'<img class="kp-photo-img" src="data:{ct};base64,{b64}" '
        f'alt="{alt}" loading="eager"/>'
    )


def _build_kp_photos_single_page_html(
    page_photos: list[dict],
    *,
    slots: int = KP_PHOTOS_PER_PAGE,
) -> str:
    """Одна страница: до двух фото в ряд."""
    if not page_photos:
        return ""
    cells: list[str] = []
    for i in range(slots):
        if i < len(page_photos):
            img = _photo_img_tag(page_photos[i])
            cells.append(f'<div class="kp-photo-slot">{img}</div>')
        else:
            cells.append('<div class="kp-photo-slot kp-photo-slot-empty"></div>')
    grid = "".join(cells)
    return (
        '\n  <div class="kp-page kp-page-photos">\n'
        '  <div class="kp-panel kp-panel-photos">\n'
        f'    <div class="kp-photos-grid">{grid}</div>\n'
        "  </div>\n"
        "  </div>\n"
    )


def build_kp_photos_page_html(photos: list[dict], *, per_page: int = KP_PHOTOS_PER_PAGE) -> str:
    """Все фото КП: по per_page штук на отдельной странице. Пустая строка, если фото нет."""
    if not photos:
        return ""
    pages: list[str] = []
    for start in range(0, len(photos), per_page):
        chunk = photos[start : start + per_page]
        page_html = _build_kp_photos_single_page_html(chunk, slots=per_page)
        if page_html:
            pages.append(page_html)
    return "".join(pages)


def _appendix_photo_img_tag(photo: dict) -> str:
    data = photo.get("image_data")
    if not data:
        return ""
    ct = photo.get("content_type") or "image/jpeg"
    b64 = base64.b64encode(data).decode("ascii")
    alt = xml_escape(str(photo.get("filename") or "Фото"))
    return (
        f'<img class="appendix-photo-img" src="data:{ct};base64,{b64}" '
        f'alt="{alt}" loading="eager"/>'
    )


def build_appendix_photos_html(photos: list[dict]) -> str:
    """
    Фото приложения к договору: каждое на всю ширину страницы.
    Блок целиком переносится на следующую страницу, если не помещается.
    """
    if not photos:
        return ""
    blocks: list[str] = []
    for photo in photos:
        img = _appendix_photo_img_tag(photo)
        if img:
            blocks.append(f'<div class="appendix-photo">{img}</div>')
    if not blocks:
        return ""
    return f'<div class="appendix-photos">{"".join(blocks)}</div>'
