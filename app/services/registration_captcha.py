# -*- coding: utf-8 -*-
"""Капча (сложение) и rate limit для публичной регистрации."""
from __future__ import annotations

import random
import secrets
import threading
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import HTTPException, Request

CAPTCHA_TTL = timedelta(minutes=10)
RATE_LIMIT_WINDOW = timedelta(hours=1)
MAX_REGISTRATIONS_PER_IP = 5

_lock = threading.Lock()
_challenges: dict[str, tuple[int, datetime]] = {}
_ip_attempts: dict[str, list[datetime]] = defaultdict(list)


def _purge_expired() -> None:
    now = datetime.utcnow()
    expired = [cid for cid, (_, exp) in _challenges.items() if exp < now]
    for cid in expired:
        _challenges.pop(cid, None)


def create_captcha_challenge() -> dict[str, str]:
    a = random.randint(1, 20)
    b = random.randint(1, 20)
    challenge_id = secrets.token_urlsafe(16)
    with _lock:
        _purge_expired()
        _challenges[challenge_id] = (a + b, datetime.utcnow() + CAPTCHA_TTL)
    return {"challenge_id": challenge_id, "question": f"{a} + {b}"}


def verify_captcha(challenge_id: str, answer: int) -> None:
    with _lock:
        _purge_expired()
        row = _challenges.pop(challenge_id, None)
    if row is None:
        raise HTTPException(status_code=400, detail="Капча устарела. Обновите пример.")
    expected, _expires = row
    try:
        given = int(answer)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Неверный ответ капчи")
    if given != expected:
        raise HTTPException(status_code=400, detail="Неверный ответ капчи")


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def check_registration_rate_limit(request: Request) -> None:
    ip = client_ip(request)
    now = datetime.utcnow()
    cutoff = now - RATE_LIMIT_WINDOW
    with _lock:
        attempts = [t for t in _ip_attempts[ip] if t > cutoff]
        if len(attempts) >= MAX_REGISTRATIONS_PER_IP:
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток регистрации. Попробуйте позже.",
            )
        attempts.append(now)
        _ip_attempts[ip] = attempts


def record_failed_attempt(request: Request) -> None:
    """Учитывает неудачную попытку (опционально, для капчи уже есть лимит на submit)."""
    check_registration_rate_limit(request)
