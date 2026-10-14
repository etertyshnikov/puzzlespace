# -*- coding: utf-8 -*-
"""Формулы сметы.

Коробка = ставка технологии за м² × площадь × рельеф × назначение × этажность × высота.
Фундамент, кровля и фасад — доли от этой коробки (плюс подготовка участка у фундамента).
Инженерия — фиксированная канализация и электричество по формуле из ТЗ.
Накладные — 2% от суммы статей. Проценты на экране считаются от итога и дают 100%.
"""
from __future__ import annotations

from app.estimate.constants import (
    CEILING_BASE_M,
    ELECTRIC_BASE_RUB,
    ELECTRIC_RUB_M2,
    FACADE,
    FACADE_SHARE,
    FLOOR_COEF,
    FLOOR_LABELS,
    LINE_INCLUDES,
    LINE_TITLES,
    OVERHEAD_SHARE,
    PURPOSE_COEF,
    PURPOSE_LABELS,
    RELIEF,
    ROOF_MATERIAL,
    ROOF_TYPE,
    SEWER_LABELS,
    SEWER_RUB,
    TECH_LABELS,
    TECH_RATE_RUB_M2,
)

LINE_ORDER = ("foundation", "walls", "roof", "facade", "engineering", "overhead")


def _ceiling_label(ceiling_m: float) -> str:
    text = f"{ceiling_m:.1f}".replace(".", ",")
    if text.endswith(",0"):
        text = text[:-2]
    return f"{text} м"


def _ceiling_coef(ceiling_m: float) -> float:
    """2,7 м — база. 3, 3,5, 4 и выше 4 м остаются разными ценами.
    Ниже ~2,3 м цена почти не падает, выше ~6 м — не растёт, чтобы опечатка не взрывала смету.
    """
    if ceiling_m <= 0:
        return 1.0
    return max(0.85, min(2.2, ceiling_m / CEILING_BASE_M))


def _box_rub(data: dict, technology: str) -> int:
    rate = TECH_RATE_RUB_M2[technology]
    relief = RELIEF[data["relief"]]["coef"]
    purpose = PURPOSE_COEF[data["purpose"]]
    floors = FLOOR_COEF[data["floors"]]
    height = _ceiling_coef(float(data["ceiling_m"]))
    return int(round(rate * float(data["area_m2"]) * relief * purpose * floors * height))


def _parts(data: dict, technology: str) -> dict[str, int]:
    """Считает шесть статей в рублях. Итог равен их сумме."""
    box = _box_rub(data, technology)
    relief = RELIEF[data["relief"]]
    roof_share = ROOF_TYPE[data["roof_type"]]["share"] * ROOF_MATERIAL[data["roof_material"]]["coef"]
    facade_share = FACADE_SHARE * FACADE[data["facade"]]["coef"]
    area = float(data["area_m2"])
    foundation = int(round(box * relief["foundation_share"] + relief["prep_rub"]))
    walls = box
    roof = int(round(box * roof_share))
    facade = int(round(box * facade_share))
    engineering = int(round(SEWER_RUB[data["sewer"]] + ELECTRIC_BASE_RUB + area * ELECTRIC_RUB_M2))
    subtotal = foundation + walls + roof + facade + engineering
    overhead = int(round(subtotal * OVERHEAD_SHARE))
    return {
        "foundation": foundation,
        "walls": walls,
        "roof": roof,
        "facade": facade,
        "engineering": engineering,
        "overhead": overhead,
    }


def _percents(amounts: list[int]) -> list[int]:
    """Целые проценты от итога. Остаток от округления уходит в самую крупную статью, сумма всегда 100."""
    total = sum(amounts)
    if total <= 0:
        return [0 for _ in amounts]
    pcts = [int(round(amount * 100 / total)) for amount in amounts]
    drift = 100 - sum(pcts)
    largest = max(range(len(amounts)), key=lambda index: amounts[index])
    pcts[largest] += drift
    return pcts


def _cards(data: dict) -> list[dict[str, str]]:
    flags = []
    if data.get("plot_owned"):
        flags.append("участок в собственности")
    if data.get("geology"):
        flags.append("есть геология")
    if data.get("access_road"):
        flags.append("есть подъезд для техники")
    if data.get("clearing"):
        flags.append("нужна расчистка")
    cadastral = (data.get("cadastral") or "").strip()
    plot = data.get("plot_sotkas")
    plot_text = f"{plot:g} сот." if isinstance(plot, (int, float)) and plot else "не указан"
    return [
        {"label": "Назначение", "value": PURPOSE_LABELS[data["purpose"]]},
        {"label": "Регион", "value": (data.get("region") or "").strip() or "не указан"},
        {"label": "Участок", "value": ", ".join(flags) if flags else "без дополнительных отметок"},
        {"label": "Кадастровый номер", "value": cadastral or "не указан"},
        {"label": "Площадь дома", "value": f"{float(data['area_m2']):g} м²"},
        {"label": "Этажность", "value": FLOOR_LABELS[data["floors"]]},
        {"label": "Высота потолков", "value": _ceiling_label(float(data["ceiling_m"]))},
        {"label": "Размер участка", "value": plot_text},
        {"label": "Рельеф", "value": RELIEF[data["relief"]]["label"]},
        {"label": "Канализация", "value": SEWER_LABELS[data["sewer"]]},
        {"label": "Электричество", "value": "Подключение и внутренняя разводка"},
        {"label": "Технология", "value": TECH_LABELS[data["technology"]]},
        {"label": "Кровля", "value": f"{ROOF_TYPE[data['roof_type']]['label']}, {ROOF_MATERIAL[data['roof_material']]['label']}"},
        {"label": "Фасад", "value": FACADE[data["facade"]]["label"]},
        {"label": "Стиль", "value": (data.get("style") or "").strip() or "не указан"},
    ]


def calculate(data: dict) -> dict:
    """Полный расчёт выбранной технологии и сравнение остальных при тех же вводных."""
    parts = _parts(data, data["technology"])
    amounts = [parts[key] for key in LINE_ORDER]
    percents = _percents(amounts)
    lines = [
        {
            "key": key,
            "title": LINE_TITLES[key],
            "amount": parts[key],
            "percent": percents[index],
            "includes": LINE_INCLUDES[key],
        }
        for index, key in enumerate(LINE_ORDER)
    ]
    total = sum(amounts)
    comparison = []
    for tech_id, title in TECH_LABELS.items():
        tech_total = sum(_parts(data, tech_id).values()) if tech_id != data["technology"] else total
        comparison.append({
            "id": tech_id,
            "title": title,
            "total": tech_total,
            "selected": tech_id == data["technology"],
        })
    comparison.sort(key=lambda item: item["total"])
    return {
        "lines": lines,
        "total": total,
        "comparison": comparison,
        "cards": _cards(data),
        "area_m2": float(data["area_m2"]),
    }
