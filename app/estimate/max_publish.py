# -*- coding: utf-8 -*-
"""Отправка текста и PDF сметы в канал MAX. Код бота не меняется: ходим в тот же Bot API."""
from __future__ import annotations

import json
import uuid
import urllib.error
import urllib.parse
import urllib.request

from app.config import get_settings

API = "https://platform-api2.max.ru"


def _request(url: str, data: bytes | None, headers: dict, method: str = "POST", timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _upload_pdf(token: str, pdf: bytes) -> str:
    """Загружает файл и возвращает token вложения. Пустая строка — вложение не приложилось."""
    meta = _request(
        API + "/uploads?" + urllib.parse.urlencode({"type": "file"}),
        None,
        {"Authorization": token},
    )
    payload = json.loads(meta.decode("utf-8", errors="replace") or "{}")
    upload_url = str(payload.get("url") or "")
    if not upload_url:
        return ""
    boundary = "----estimate" + uuid.uuid4().hex
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="data"; filename="smeta.pdf"\r\n',
        b"Content-Type: application/pdf\r\n\r\n",
        pdf,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    raw = _request(
        upload_url,
        body,
        {"Content-Type": f"multipart/form-data; boundary={boundary}"},
        timeout=30,
    )
    uploaded = json.loads(raw.decode("utf-8", errors="replace") or "{}")
    return str(uploaded.get("token") or uploaded.get("fileId") or "")


def publish_estimate(public_url: str, pdf: bytes | None) -> str:
    """Пишет в канал. Без MAX_CHANNEL_ID смета всё равно сохраняется, пост просто не уходит."""
    settings = get_settings()
    chat_id = (settings.max_channel_id or "").strip()
    token = (settings.max_bot_token or "").strip()
    if not chat_id:
        return "канал не задан"
    if not token:
        return "не задан MAX_BOT_TOKEN"
    text = (
        "🏡 Новая смета рассчитана в автоматическом калькуляторе **Дом на Юге**!\n"
        f"🔗 Подробнее и свой расчёт: {public_url}\n"
        "#калькулятор #смета #домнаюге"
    )
    message: dict = {"text": text}
    try:
        if pdf:
            file_token = _upload_pdf(token, pdf)
            if file_token:
                message["attachments"] = [{"type": "file", "payload": {"token": file_token}}]
        url = API + "/messages?" + urllib.parse.urlencode({"chat_id": chat_id})
        _request(
            url,
            json.dumps(message, ensure_ascii=False).encode("utf-8"),
            {"Authorization": token, "Content-Type": "application/json"},
        )
        return "опубликовано в Max"
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:180]
        return f"ошибка {exc.code}: {detail}"
    except Exception as exc:
        return f"ошибка: {exc}"
