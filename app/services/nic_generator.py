# -*- coding: utf-8 -*-
"""Генерация уникального логина (nic) для агентов."""
from __future__ import annotations

import re
import secrets

from sqlalchemy.orm import Session

from app.models.crm import AuthUser

_CYRILLIC = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def transliterate(text: str) -> str:
    out: list[str] = []
    for ch in text.lower():
        if ch in _CYRILLIC:
            out.append(_CYRILLIC[ch])
        elif ch.isascii() and ch.isalnum():
            out.append(ch)
    return "".join(out)


def _sanitize_nic_base(value: str) -> str:
    base = re.sub(r"[^a-z0-9]", "", transliterate(value))
    return base[:24]


def nic_base(
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
) -> str:
    if email and "@" in email:
        local = email.split("@", 1)[0]
        base = _sanitize_nic_base(local)
        if base:
            return base

    last = _sanitize_nic_base((last_name or "").strip())
    first = _sanitize_nic_base((first_name or "").strip())

    if last and first:
        return f"{last}-{first[:1]}"[:24]
    if last:
        return last
    if first:
        return first
    return "agent"


def generate_unique_nic(
    db: Session,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
) -> str:
    base = nic_base(first_name=first_name, last_name=last_name, email=email) or "agent"
    candidate = base
    suffix = 1
    while db.query(AuthUser.id).filter(AuthUser.nic == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"[:128]
        if suffix > 9999:
            candidate = f"agent{secrets.token_hex(4)}"
            if not db.query(AuthUser.id).filter(AuthUser.nic == candidate).first():
                break
    return candidate
