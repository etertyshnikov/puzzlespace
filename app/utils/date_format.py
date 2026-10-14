# -*- coding: utf-8 -*-
"""
Форматирование даты в длинный формат для договоров.
Пример: 2026-02-18 → «18» февраля 2026 г.
"""
from datetime import date, datetime
from typing import Union

_MONTHS_GENITIVE = {
    1: "января",
    2: "февраля",
    3: "марта",
    4: "апреля",
    5: "мая",
    6: "июня",
    7: "июля",
    8: "августа",
    9: "сентября",
    10: "октября",
    11: "ноября",
    12: "декабря",
}


def format_date_long(value: Union[str, date, datetime, None]) -> str:
    """
    Преобразует дату в формат: «дд» месяц ГГГГ г.

    Принимает:
      - строку ISO: "2026-02-18"
      - строку дд.мм.гггг: "18.02.2026"
      - объект date / datetime
      - None → ""
    """
    if value is None:
        return ""

    d: date | None = None

    if isinstance(value, datetime):
        d = value.date()
    elif isinstance(value, date):
        d = value
    elif isinstance(value, str):
        value = value.strip()
        if not value:
            return ""
        for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
            try:
                d = datetime.strptime(value, fmt).date()
                break
            except ValueError:
                continue

    if d is None:
        return str(value)

    month_name = _MONTHS_GENITIVE.get(d.month, "")
    return f"\u00ab{d.day:02d}\u00bb {month_name} {d.year} г."
