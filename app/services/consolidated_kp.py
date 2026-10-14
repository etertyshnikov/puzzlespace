# -*- coding: utf-8 -*-
"""Сводное КП: объединение согласованных спецификаций с одинаковым составом позиций."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.models import Specification, SpecificationItem
from app.services import specification as spec_service
from app.services import specification_item as item_service


def _item_fingerprint(item: SpecificationItem) -> tuple[Any, ...]:
    """Отпечаток одной позиции для сравнения (наименование, кол-во, ед., цена)."""
    name = (getattr(item, "item_name", None) or "").strip()
    qty = float(getattr(item, "quantity", 0) or 0)
    unit = (getattr(item, "unit", None) or "шт").strip()
    price = float(getattr(item, "price", 0) or 0)
    return (name, qty, unit, price)


def _spec_fingerprint(db: Session, specification_id: int) -> tuple[tuple[Any, ...], ...]:
    """Отпечаток всей спецификации: отсортированный кортеж отпечатков позиций."""
    items = item_service.list_by_specification(db, specification_id)
    return tuple(sorted(_item_fingerprint(it) for it in items))


def get_consolidated_kp(db: Session, project_id: int) -> list[dict]:
    """
    Сводное КП по проекту: только согласованные спецификации, сгруппированные по
    100% одинаковому составу позиций. Каждая группа — одно «под-КП» с полями
    spec_numbers, house_count, rows (с кол-во всего и сумма всего).
    """
    specs = spec_service.list_by_project(db, project_id)
    agreed = [s for s in specs if getattr(s, "kp_approved", False)]
    if not agreed:
        return []

    # Группируем по отпечатку: fingerprint -> list of spec ids
    groups_by_fp: dict[tuple, list[int]] = defaultdict(list)
    for spec in agreed:
        fp = _spec_fingerprint(db, spec.id)
        groups_by_fp[fp].append(spec.id)

    result = []
    for _fp, spec_ids in groups_by_fp.items():
        if not spec_ids:
            continue
        # Номера спецификаций и количество домов
        spec_objs = [spec_service.get_by_id(db, sid) for sid in spec_ids]
        spec_numbers = [
            getattr(s, "number", None) or f"#{getattr(s, 'id', sid)}"
            for s, sid in zip(spec_objs, spec_ids)
            if s
        ]
        house_count = len(spec_ids)
        # Позиции берём из первой спецификации группы (все одинаковые)
        first_spec_id = spec_ids[0]
        items = item_service.list_by_specification(db, first_spec_id)
        rows = []
        for it in items:
            if item_service.is_kp_excluded_item(db, it):
                continue
            if not bool(getattr(it, "include_in_total", True)):
                continue
            name = (getattr(it, "item_name", None) or "—").strip()
            qty = float(getattr(it, "quantity", 0) or 0)
            unit = (getattr(it, "unit", None) or "шт").strip()
            price = float(getattr(it, "price", 0) or 0)
            total_one = float(getattr(it, "total", 0) or 0) or (qty * price)
            total_qty = qty * house_count
            total_sum = total_one * house_count
            rows.append({
                "item_name": name,
                "quantity": qty,
                "unit": unit,
                "price": price,
                "sum_per_house": total_one,
                "house_count": house_count,
                "total_quantity": total_qty,
                "total_sum": total_sum,
            })
        result.append({
            "spec_numbers": spec_numbers,
            "house_count": house_count,
            "rows": rows,
            "group_total": sum(r["total_sum"] for r in rows),
        })

    return result
