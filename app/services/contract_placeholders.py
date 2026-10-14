# -*- coding: utf-8 -*-
"""Подстановка плейсхолдеров {{name}} из данных CRM (как на фронтенде в replacePlaceholders)."""
from __future__ import annotations

import re
from datetime import date, datetime
from xml.sax.saxutils import escape as xml_escape
from decimal import Decimal
from typing import Any

from app.services.customer import compute_full_name

MONTHS_GENITIVE = {
    1: "января", 2: "февраля", 3: "марта", 4: "апреля",
    5: "мая", 6: "июня", 7: "июля", 8: "августа",
    9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
}


def _to_date(v: Any) -> date | None:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v)
        if m:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        m = re.match(r"^(\d{2})\.(\d{2})\.(\d{4})", v)
        if m:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    return None


def format_contract_date(v: Any) -> str:
    d = _to_date(v)
    if not d:
        return ""
    return d.strftime("%d.%m.%Y")


def format_contract_date_long(v: Any) -> str:
    d = _to_date(v)
    if not d:
        return ""
    month_name = MONTHS_GENITIVE.get(d.month, "")
    return f"«{d.day:02d}» {month_name} {d.year} г."


def format_contract_amount(v: Any) -> str:
    if v is None or v == "":
        return ""
    if isinstance(v, Decimal):
        n = float(v)
    else:
        try:
            n = float(v)
        except (TypeError, ValueError):
            return ""
    return f"{n:,.2f}".replace(",", " ").replace(".", ",")


def strip_currency_suffix(words: str) -> str:
    return re.sub(r"\s+рубл\S*(\s+\d+\s+копе\S*)?$", "", words or "", flags=re.I).strip()


def amount_with_words(amount: Any) -> str:
    """Сумма для КП/договора: «1 234,56 (одна тысяча ...)»."""
    if amount is None:
        return ""
    try:
        n = float(amount)
    except (TypeError, ValueError):
        return ""
    amt = format_contract_amount(n)
    try:
        words = strip_currency_suffix(amount_to_words(n))
    except Exception:
        words = ""
    return f"{amt} ({words})" if amt and words else amt or words


def customer_full_name(customer: Any) -> str:
    """ФИО для договора: из last_name + name + middle_name (актуальные части), иначе full_name из БД."""
    if not customer:
        return ""
    last = (getattr(customer, "last_name", None) or "").strip()
    first = (getattr(customer, "name", None) or "").strip()
    middle = (getattr(customer, "middle_name", None) or "").strip()
    if last or first or middle:
        return compute_full_name(
            last or None,
            first or None,
            middle or None,
        )
    return (getattr(customer, "full_name", None) or "").strip() or first


BUILDING_TYPE_LABELS = {
    "house": "Дом",
    "banya": "Баня",
}

BUILDING_TYPE_GENITIVE_LABELS = {
    "house": "дома",
    "banya": "бани",
}


def _building_type_key(spec: Any) -> str:
    if not spec:
        return "house"
    return (getattr(spec, "building_type", None) or "house").strip().lower()


def format_building_type(spec: Any) -> str:
    """Тип строения из спецификации: «Дом» или «Баня»."""
    if not spec:
        return ""
    key = _building_type_key(spec)
    return BUILDING_TYPE_LABELS.get(key, key)


def format_building_type_genitive(spec: Any) -> str:
    """Тип строения в родительном падеже: «дома» или «бани»."""
    if not spec:
        return ""
    key = _building_type_key(spec)
    return BUILDING_TYPE_GENITIVE_LABELS.get(key, key)


def format_house_size_mm(spec: Any) -> str:
    """Размер дома в мм: «6000 х 7500 мм» (длина и ширина из спецификации × 1000)."""
    if not spec:
        return ""
    length = getattr(spec, "length_m", None)
    width = getattr(spec, "width_m", None)
    try:
        l = float(length) if length is not None else None
        w = float(width) if width is not None else None
    except (TypeError, ValueError):
        return ""
    if l is not None and w is not None:
        return f"{int(round(l * 1000))} х {int(round(w * 1000))} мм"
    if l is not None:
        return f"{int(round(l * 1000))} мм"
    if w is not None:
        return f"{int(round(w * 1000))} мм"
    return ""


def customer_organization_name(
    customer: Any,
    contract_data: Any,
) -> str:
    """Наименование покупателя в договоре по типу из «Данных договора» (buyer_party_type)."""
    party = (
        getattr(contract_data, "buyer_party_type", None) or "individual"
        if contract_data
        else "individual"
    )
    if party == "legal":
        # Как {{organization_name}} — наименование организации (у покупателя: legal_company_name)
        if customer:
            return (getattr(customer, "legal_company_name", None) or "").strip()
        return ""
    return customer_full_name(customer)


def replace_placeholder(html: str, name: str, value: str, *, raw_html: bool = False) -> str:
    escaped = re.escape(name)
    pattern = re.compile(r"\{\{\s*" + escaped + r"\s*\}\}", re.IGNORECASE)
    text = value or ""
    if not raw_html:
        text = xml_escape(text)
    return pattern.sub(text, html)


def apply_placeholders(
    html: str,
    *,
    customer: Any = None,
    organization: Any = None,
    contract_data: Any = None,
    specification: Any = None,
    extra: dict[str, str] | None = None,
) -> str:
    out = html
    if customer:
        out = replace_placeholder(out, "customer_full_name", customer_full_name(customer))
        out = replace_placeholder(out, "customer_last_name", getattr(customer, "last_name", None) or "")
        out = replace_placeholder(out, "customer_name", getattr(customer, "name", None) or "")
        out = replace_placeholder(out, "customer_middle_name", getattr(customer, "middle_name", None) or "")
        out = replace_placeholder(out, "customer_address", getattr(customer, "address", None) or "")
        out = replace_placeholder(out, "customer_phone", getattr(customer, "phone", None) or "")
        out = replace_placeholder(out, "customer_email", getattr(customer, "email", None) or "")
        out = replace_placeholder(out, "customer_passport_series", getattr(customer, "passport_series", None) or "")
        out = replace_placeholder(out, "customer_passport_number", getattr(customer, "passport_number", None) or "")
        out = replace_placeholder(out, "customer_passport_issued_by", getattr(customer, "passport_issued_by", None) or "")
        out = replace_placeholder(
            out, "customer_passport_issue_date",
            format_contract_date(getattr(customer, "passport_issue_date", None)),
        )
        out = replace_placeholder(
            out, "customer_passport_issue_date_long",
            format_contract_date_long(getattr(customer, "passport_issue_date", None)),
        )
        out = replace_placeholder(
            out, "customer_passport_department_code",
            getattr(customer, "passport_department_code", None) or "",
        )
        out = replace_placeholder(out, "customer_birth_date", format_contract_date(getattr(customer, "birth_date", None)))
        out = replace_placeholder(
            out, "customer_birth_date_long",
            format_contract_date_long(getattr(customer, "birth_date", None)),
        )
        out = replace_placeholder(out, "customer_birth_place", getattr(customer, "birth_place", None) or "")
        out = replace_placeholder(out, "customer_legal_company_name", getattr(customer, "legal_company_name", None) or "")
        out = replace_placeholder(out, "customer_legal_inn", getattr(customer, "legal_inn", None) or "")
        out = replace_placeholder(out, "customer_legal_kpp", getattr(customer, "legal_kpp", None) or "")
        out = replace_placeholder(out, "customer_legal_ogrn", getattr(customer, "legal_ogrn", None) or "")
        out = replace_placeholder(
            out, "customer_legal_company_address", getattr(customer, "legal_company_address", None) or ""
        )
        out = replace_placeholder(out, "customer_legal_bank", getattr(customer, "legal_bank", None) or "")
        out = replace_placeholder(
            out, "customer_legal_bank_account", getattr(customer, "legal_bank_account", None) or ""
        )
        out = replace_placeholder(out, "customer_legal_bik", getattr(customer, "legal_bik", None) or "")
        out = replace_placeholder(
            out, "customer_legal_signatory_name", getattr(customer, "legal_signatory_name", None) or ""
        )
        out = replace_placeholder(
            out, "customer_legal_signatory_basis", getattr(customer, "legal_signatory_basis", None) or ""
        )

    if organization:
        out = replace_placeholder(out, "organization_name", getattr(organization, "name", None) or "")
        out = replace_placeholder(out, "organization_inn", getattr(organization, "inn", None) or "")
        out = replace_placeholder(out, "organization_kpp", getattr(organization, "kpp", None) or "")
        out = replace_placeholder(out, "organization_address", getattr(organization, "address", None) or "")
        out = replace_placeholder(out, "organization_bank", getattr(organization, "bank", None) or "")
        out = replace_placeholder(out, "organization_bank_account", getattr(organization, "bank_account", None) or "")
        out = replace_placeholder(out, "organization_bik", getattr(organization, "bik", None) or "")
        out = replace_placeholder(out, "organization_director_name", getattr(organization, "director_name", None) or "")
        out = replace_placeholder(
            out, "organization_director_position", getattr(organization, "director_position", None) or ""
        )

    prepayment = ""
    balance = ""
    if contract_data:
        supply_amt = (
            format_contract_amount(getattr(contract_data, "contract_supply_amount", None))
            if getattr(contract_data, "contract_supply_amount", None) is not None
            else ""
        )
        supply_words = strip_currency_suffix(getattr(contract_data, "contract_supply_amount_words", None) or "")
        contract_supply_amount = (
            f"{supply_amt} ({supply_words})" if supply_amt and supply_words
            else supply_amt or supply_words
        )
        prep_amt = (
            format_contract_amount(getattr(contract_data, "prepayment_amount", None))
            if getattr(contract_data, "prepayment_amount", None) is not None
            else ""
        )
        prep_words = strip_currency_suffix(getattr(contract_data, "prepayment_words", None) or "")
        prepayment = f"{prep_amt} ({prep_words})" if prep_amt and prep_words else prep_amt or prep_words
        bal_amt = (
            format_contract_amount(getattr(contract_data, "balance_amount", None))
            if getattr(contract_data, "balance_amount", None) is not None
            else ""
        )
        bal_words = strip_currency_suffix(getattr(contract_data, "balance_words", None) or "")
        balance = f"{bal_amt} ({bal_words})" if bal_amt and bal_words else bal_amt or bal_words

        out = replace_placeholder(out, "contract_date", format_contract_date(getattr(contract_data, "contract_date", None)))
        out = replace_placeholder(
            out, "contract_date_long", format_contract_date_long(getattr(contract_data, "contract_date", None))
        )
        out = replace_placeholder(out, "city", getattr(contract_data, "city", None) or "")
        out = replace_placeholder(out, "contract_supply_amount", contract_supply_amount)
        hk = getattr(contract_data, "house_kits_count", None)
        out = replace_placeholder(out, "house_kits_count", str(hk) if hk is not None else "")
        out = replace_placeholder(out, "prepayment_amount", prep_amt)
        out = replace_placeholder(out, "prepayment_words", prep_words)
        out = replace_placeholder(out, "balance_amount", bal_amt)
        out = replace_placeholder(out, "balance_words", bal_words)
        out = replace_placeholder(
            out, "delivery_deadline",
            format_contract_date(getattr(contract_data, "delivery_deadline", None)),
        )
        out = replace_placeholder(
            out, "delivery_deadline_long",
            format_contract_date_long(getattr(contract_data, "delivery_deadline", None)),
        )

    out = replace_placeholder(out, "prepayment", prepayment)
    out = replace_placeholder(out, "balance", balance)
    out = replace_placeholder(
        out,
        "customer_organization_name",
        customer_organization_name(customer, contract_data),
    )
    out = replace_placeholder(out, "house_size_mm", format_house_size_mm(specification))
    house_type_label = format_building_type(specification)
    house_type_genitive_label = format_building_type_genitive(specification)
    out = replace_placeholder(out, "building_type", house_type_label)
    out = replace_placeholder(out, "house_type", house_type_label)
    out = replace_placeholder(out, "building_type_genitive", house_type_genitive_label)
    out = replace_placeholder(out, "house_type_genitive", house_type_genitive_label)

    if extra:
        raw_keys = {
            "kp_items_table",
            "kp_logo",
            "kp_photos_page",
            "kp_title_banner",
            "appendix_parts_table",
            "appendix_specs_blocks",
            "appendix_photos",
            "appendix2_specs_content",
        }
        for key, value in extra.items():
            out = replace_placeholder(out, key, value, raw_html=key in raw_keys)
    return out
