# -*- coding: utf-8 -*-
"""Публикация одобренного объявления в отдельные чаты Max, Telegram и Дзен."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from app.config import get_settings

KINDS = ("vacancy", "resume", "sell", "buy", "order")
NETWORKS = ("max", "telegram", "dzen")
PUBLISH_KINDS = ("vacancy", "resume", "sell", "buy")


def listing_text(title: str, body: dict) -> str:
    lines = [title, ""]
    for key, value in body.items():
        if str(key).startswith("_") or key in ("phone", "Автор") or not value:
            continue
        lines.append(f"{key}: {value}")
    lines.append("")
    lines.append("Телефон в открытом посте не публикуется.")
    return "\n".join(lines)


def _post_json(url: str, payload: dict, headers: dict | None = None, timeout: int = 20) -> str:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")[:500]


def publish_to(network: str, target: str, text: str, body: dict | None = None) -> str:
    settings = get_settings()
    target = (target or "").strip()
    body = body or {}
    if not target:
        return "чат не задан"
    try:
        if network == "max":
            token = (settings.max_bot_token or "").strip()
            if not token:
                return "не задан MAX_BOT_TOKEN"
            url = "https://platform-api2.max.ru/messages?" + urllib.parse.urlencode({"chat_id": target})
            payload: dict = {"text": text}
            bot_listing = str(body.get("_bot_listing_id") or "").strip()
            username = (settings.max_bot_username or "").strip()
            if bot_listing and username:
                payload["attachments"] = [{
                    "type": "inline_keyboard",
                    "payload": {
                        "buttons": [[{
                            "type": "link",
                            "text": "Написать автору",
                            "url": f"https://max.ru/{username}?start=lot_{urllib.parse.quote(bot_listing)}",
                        }]],
                    },
                }]
            _post_json(url, payload, {"Authorization": token})
            return "опубликовано в Max"
        if network == "telegram":
            token = (settings.telegram_bot_token or "").strip()
            if not token:
                return "не задан TELEGRAM_BOT_TOKEN"
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            _post_json(url, {"chat_id": target, "text": text})
            return "опубликовано в Telegram"
        if network == "dzen":
            if target.startswith("http://") or target.startswith("https://"):
                _post_json(target, {"text": text})
                return "отправлено на URL Дзена"
            return "для Дзена укажите URL вебхука: открытого API публикации нет"
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:240]
        return f"ошибка {exc.code}: {detail}"
    except Exception as exc:
        return f"ошибка: {exc}"
    return "сеть не поддерживается"
