# -*- coding: utf-8 -*-
"""Подпись «Действие» для дашборда: поле action или fallback по названию статуса."""
import re

from app.models.crm import ProjectStatus


def _norm_name(name: str | None) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def resolve_status_action_display(st: ProjectStatus | None) -> str | None:
    if st is None:
        return None
    action = (getattr(st, "action", None) or "").strip()
    if action:
        return action
    name = _norm_name(st.name)
    if re.search(r"кп\s*отправлен", name):
        return "Позвонить"
    if "отправ" in name and "кп" in name:
        return "Отправить КП"
    if "состав" in name and "договор" in name:
        return "Составить договор"
    return None
