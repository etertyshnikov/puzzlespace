# -*- coding: utf-8 -*-
"""Фото-вложения сообщений чата."""
from __future__ import annotations

import os

from fastapi import HTTPException, UploadFile

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
EXT_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_FILES_PER_MESSAGE = 10


def resolve_content_type(content_type: str | None, filename: str | None) -> str:
    ct = (content_type or "").strip().lower()
    if ct in ALLOWED_IMAGE_TYPES:
        return ct
    ext = os.path.splitext(filename or "")[1].lower()
    return EXT_TO_MIME.get(ext, ct)


def read_photo_file(file: UploadFile) -> tuple[bytes, str, str]:
    filename = file.filename or "photo"
    content_type = resolve_content_type(file.content_type, filename)
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый тип файла «{filename}». Разрешены: JPEG, PNG, GIF, WebP",
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


def read_photo_files(files: list[UploadFile]) -> list[tuple[bytes, str, str]]:
    if not files:
        raise HTTPException(status_code=400, detail="Не выбраны файлы")
    if len(files) > MAX_FILES_PER_MESSAGE:
        raise HTTPException(
            status_code=400,
            detail=f"Можно прикрепить не более {MAX_FILES_PER_MESSAGE} фото за раз",
        )
    return [read_photo_file(file) for file in files]
