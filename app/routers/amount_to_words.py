# -*- coding: utf-8 -*-
from fastapi import APIRouter, Query
from app.utils.num_to_words import amount_to_words
from app.utils.date_format import format_date_long

router = APIRouter()


@router.get("", response_model=dict)
def get_amount_in_words(amount: str | float | None = Query(None, description="Сумма (число или строка)")):
    """Переводит сумму в пропись (рубли и копейки) на русском."""
    if amount is None or amount == "":
        return {"words": ""}
    return {"words": amount_to_words(amount)}


@router.get("/format-date-long", response_model=dict)
def get_date_long_format(date: str | None = Query(None, description="Дата (YYYY-MM-DD или ДД.ММ.ГГГГ)")):
    """Преобразует дату в длинный формат: «дд» месяц ГГГГ г."""
    if not date:
        return {"formatted": ""}
    return {"formatted": format_date_long(date)}
