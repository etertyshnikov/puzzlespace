# -*- coding: utf-8 -*-
"""
Перевод суммы (рубли и копейки) в пропись на русском языке.
Используется для предоплаты и остатка в данных договора.
"""
from decimal import Decimal
from typing import Union

# Единицы, десятки, сотни (женский род для согласования с "копейка/тысяча")
_ONES = (
    "",
    "одна",
    "две",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
)
_ONES_M = ("", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять")
_TENS = (
    "",
    "",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
)
_TENS_SMALL = (
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
)
_HUNDREDS = (
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
)


def _triplet_to_words(value: int, female: bool = False) -> str:
    """Переводит число 0..999 в слова (female для «одна тысяча», «две копейки»)."""
    if value == 0:
        return ""
    ones_list = _ONES if female else _ONES_M
    h = value // 100
    t = (value % 100) // 10
    o = value % 10
    parts = []
    if h:
        parts.append(_HUNDREDS[h])
    if t >= 2:
        parts.append(_TENS[t])
        if o:
            parts.append(ones_list[o])
    elif t == 1:
        parts.append(_TENS_SMALL[o])
    else:
        if o:
            parts.append(ones_list[o])
    return " ".join(p for p in parts if p).strip()


def _rubles_phrase(n: int) -> str:
    """Склонение слова «рубль»: 1 рубль, 2 рубля, 5 рублей."""
    if n % 100 in (11, 12, 13, 14):
        return "рублей"
    if n % 10 == 1:
        return "рубль"
    if n % 10 in (2, 3, 4):
        return "рубля"
    return "рублей"


def _kopeks_phrase(n: int) -> str:
    """Склонение слова «копейка»."""
    if n % 100 in (11, 12, 13, 14):
        return "копеек"
    if n % 10 == 1:
        return "копейка"
    if n % 10 in (2, 3, 4):
        return "копейки"
    return "копеек"


def amount_to_words(amount: Union[Decimal, float, int, str, None]) -> str:
    """
    Переводит сумму в пропись (только число, без «рублей» и «копеек»).
    Пример: 1234.56 -> "одна тысяча двести тридцать четыре"
    Дробная часть (копейки) отбрасывается.
    """
    if amount is None:
        return ""
    try:
        if isinstance(amount, str):
            amount = Decimal(amount.replace(",", ".").replace(" ", ""))
        else:
            amount = Decimal(str(amount))
    except Exception:
        return ""
    int_part = int(amount.quantize(Decimal("1")))

    if int_part == 0:
        return "ноль"

    parts: list[str] = []
    rest = int_part
    blocks: list[int] = []
    while rest:
        blocks.append(rest % 1000)
        rest //= 1000
    blocks.reverse()
    n_blocks = len(blocks)
    for i, block in enumerate(blocks):
        if block == 0:
            continue
        level = n_blocks - 1 - i
        if level == 2:  # миллионы
            word = _triplet_to_words(block, female=False)
            if word:
                if 11 <= block % 100 <= 14:
                    word += " миллионов"
                elif block % 10 == 1:
                    word += " миллион"
                elif block % 10 in (2, 3, 4):
                    word += " миллиона"
                else:
                    word += " миллионов"
                parts.append(word)
        elif level == 1:  # тысячи
            word = _triplet_to_words(block, female=True)
            if word:
                if 11 <= block % 100 <= 14:
                    word += " тысяч"
                elif block % 10 == 1:
                    word += " тысяча"
                elif block % 10 in (2, 3, 4):
                    word += " тысячи"
                else:
                    word += " тысяч"
                parts.append(word)
        else:
            parts.append(_triplet_to_words(block, female=False))
    return " ".join(parts).strip() if parts else "ноль"
