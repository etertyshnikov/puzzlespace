# -*- coding: utf-8 -*-
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.crm import SpecificationPhoto
from app.schemas.specification_photos import SpecificationPhotoOut, SpecificationPhotoSortUpdate

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
EXT_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_FILES_PER_UPLOAD = 50


def _resolve_content_type(content_type: str | None, filename: str | None) -> str:
    ct = (content_type or "").strip().lower()
    if ct in ALLOWED_IMAGE_TYPES:
        return ct
    ext = os.path.splitext(filename or "")[1].lower()
    return EXT_TO_MIME.get(ext, ct)


def _validate_photo_upload_target(
    specification_id: Optional[int],
    house_specification_template_id: Optional[int],
) -> None:
    if not specification_id and not house_specification_template_id:
        raise HTTPException(
            status_code=400,
            detail="Укажите specification_id или house_specification_template_id",
        )


def _read_photo_file(file: UploadFile) -> tuple[bytes, str, str]:
    filename = file.filename or "photo"
    content_type = _resolve_content_type(file.content_type, filename)
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый тип файла «{filename}». Разрешены: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )
    data = file.file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Файл «{filename}» слишком большой (макс. 10 МБ)",
        )
    if not data:
        raise HTTPException(status_code=400, detail=f"Файл «{filename}» пустой")
    return data, content_type, filename


def _save_photo(
    db: Session,
    *,
    data: bytes,
    content_type: str,
    filename: str,
    specification_id: Optional[int],
    house_specification_template_id: Optional[int],
    sort_order: int,
) -> SpecificationPhoto:
    photo = SpecificationPhoto(
        specification_id=specification_id,
        house_specification_template_id=house_specification_template_id,
        image_data=data,
        content_type=content_type,
        filename=filename,
        sort_order=sort_order,
    )
    db.add(photo)
    return photo


@router.get("/by-specification/{specification_id}", response_model=list[SpecificationPhotoOut])
def list_by_specification(specification_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.specification_id == specification_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
        .all()
    )


@router.get("/by-template/{template_id}", response_model=list[SpecificationPhotoOut])
def list_by_template(template_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.house_specification_template_id == template_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
        .all()
    )


@router.get("/{photo_id}/image")
def get_image(photo_id: int, db: Session = Depends(get_db)):
    row = db.query(SpecificationPhoto).filter(SpecificationPhoto.id == photo_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Фото не найдено")
    return Response(
        content=row.image_data,
        media_type=row.content_type,
        headers={"Cache-Control": "max-age=86400"},
    )


@router.post("/upload", response_model=SpecificationPhotoOut, status_code=201)
def upload_photo(
    file: UploadFile = File(...),
    specification_id: Optional[int] = Form(None),
    house_specification_template_id: Optional[int] = Form(None),
    sort_order: int = Form(0),
    db: Session = Depends(get_db),
):
    _validate_photo_upload_target(specification_id, house_specification_template_id)
    data, content_type, filename = _read_photo_file(file)
    photo = _save_photo(
        db,
        data=data,
        content_type=content_type,
        filename=filename,
        specification_id=specification_id,
        house_specification_template_id=house_specification_template_id,
        sort_order=sort_order,
    )
    db.commit()
    db.refresh(photo)
    return photo


@router.post("/upload-many", response_model=list[SpecificationPhotoOut], status_code=201)
def upload_photos(
    files: list[UploadFile] = File(...),
    specification_id: Optional[int] = Form(None),
    house_specification_template_id: Optional[int] = Form(None),
    sort_order: int = Form(0),
    db: Session = Depends(get_db),
):
    """Загрузка нескольких фотографий за один запрос."""
    _validate_photo_upload_target(specification_id, house_specification_template_id)
    if not files:
        raise HTTPException(status_code=400, detail="Не выбраны файлы")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"Можно загрузить не более {MAX_FILES_PER_UPLOAD} файлов за раз",
        )

    created: list[SpecificationPhoto] = []
    for index, file in enumerate(files):
        data, content_type, filename = _read_photo_file(file)
        created.append(
            _save_photo(
                db,
                data=data,
                content_type=content_type,
                filename=filename,
                specification_id=specification_id,
                house_specification_template_id=house_specification_template_id,
                sort_order=sort_order + index,
            )
        )
    db.commit()
    for photo in created:
        db.refresh(photo)
    return created


@router.patch("/{photo_id}", response_model=SpecificationPhotoOut)
def update_sort_order(photo_id: int, payload: SpecificationPhotoSortUpdate, db: Session = Depends(get_db)):
    row = db.query(SpecificationPhoto).filter(SpecificationPhoto.id == photo_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Фото не найдено")
    row.sort_order = payload.sort_order
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    row = db.query(SpecificationPhoto).filter(SpecificationPhoto.id == photo_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Фото не найдено")
    db.delete(row)
    db.commit()
    return None
