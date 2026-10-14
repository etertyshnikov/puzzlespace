# -*- coding: utf-8 -*-
"""Настройки столбцов таблицы проектов на дашборде (per user)."""
from __future__ import annotations

import json
from typing import Any

DEFAULT_DASHBOARD_COLUMN_ORDER: list[str] = [
    "action",
    "name",
    "customer",
    "customerPhone",
    "createdBy",
    "address",
    "statusDate",
    "executionDays",
    "remaining",
    "amount",
    "statusSelect",
]

ALL_DASHBOARD_COLUMN_IDS = frozenset(DEFAULT_DASHBOARD_COLUMN_ORDER)


def default_dashboard_columns_payload() -> dict[str, Any]:
    return {
        "order": list(DEFAULT_DASHBOARD_COLUMN_ORDER),
        "hidden": [],
    }


def parse_dashboard_columns(raw: str | None) -> dict[str, Any]:
    if not raw or not str(raw).strip():
        return default_dashboard_columns_payload()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return default_dashboard_columns_payload()
    if not isinstance(data, dict):
        return default_dashboard_columns_payload()
    return normalize_dashboard_columns(data)


def normalize_dashboard_columns(data: dict[str, Any]) -> dict[str, Any]:
    order_in = data.get("order")
    hidden_in = data.get("hidden")

    order: list[str] = []
    if isinstance(order_in, list):
        for item in order_in:
            cid = str(item).strip()
            if cid in ALL_DASHBOARD_COLUMN_IDS and cid not in order:
                order.append(cid)
    for cid in DEFAULT_DASHBOARD_COLUMN_ORDER:
        if cid not in order:
            order.append(cid)
    if "customer" in order and "customerPhone" not in order:
        order.insert(order.index("customer") + 1, "customerPhone")
    if "customerPhone" in order and "createdBy" not in order:
        order.insert(order.index("customerPhone") + 1, "createdBy")

    hidden: list[str] = []
    if isinstance(hidden_in, list):
        seen: set[str] = set()
        for item in hidden_in:
            cid = str(item).strip()
            if cid in ALL_DASHBOARD_COLUMN_IDS and cid not in seen:
                hidden.append(cid)
                seen.add(cid)

    return {"order": order, "hidden": hidden}


def serialize_dashboard_columns(data: dict[str, Any]) -> str:
    normalized = normalize_dashboard_columns(data)
    return json.dumps(normalized, ensure_ascii=False)
