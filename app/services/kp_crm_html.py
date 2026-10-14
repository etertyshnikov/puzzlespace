# -*- coding: utf-8 -*-
"""КП в HTML с подстановкой данных CRM (шаблон из БД или встроенный по умолчанию)."""
from __future__ import annotations

import re

from sqlalchemy.orm import Session
from app.services.kp_crm_data import (
    _build_items_table_html,
    _house_area_sqm_label,
    _house_size_m_label,
    _payment_for_spec,
    _spec_total_amount,
    collect_kp_document_data,
)
from app.services import kp_html_template as kp_template_service
from app.services.contract_placeholders import amount_with_words, apply_placeholders
from app.services.kp_dom_kubani_standart import (
    KP_DOM_KUBANI_STANDART_BODY,
    KP_DOM_KUBANI_STANDART_CLIENT_BODY,
    KP_DOM_KUBANI_STANDART_TITLE,
    build_standart_default_items_table_html,
    format_standart_default_total,
)
from app.services.kp_spec_photos import build_kp_photos_page_html, load_specification_photos
from app.services.kp_landscape_assets import (
    DEFAULT_KP_LANDSCAPE_BODY,
    KP_LAYOUT_MARKER,
    inject_kp_assets,
    is_client_table_only_kp_html,
    is_landscape_kp_html,
    kp_logo_img_markup,
    kp_title_banner_markup,
    landscape_body_prefix,
    landscape_print_css,
    landscape_print_css_table_only,
)

DEFAULT_KP_HTML_TEMPLATE = DEFAULT_KP_LANDSCAPE_BODY


def _normalize_template(html: str) -> str:
    """Убирает артефакты редактора и извлекает тело из полного HTML-документа."""
    t = html.replace("mo" + "tion.div", "div")
    trimmed = t.strip()
    if re.search(r"<!DOCTYPE|<html[\s>]", trimmed, re.I):
        m = re.search(r"<body[^>]*>(.*)</body>", t, re.I | re.DOTALL)
        if m:
            return m.group(1).strip()
    return trimmed


def _template_has_placeholders(html: str) -> bool:
    return "{{kp_items_table}}" in html or "{{customer_full_name}}" in html


def _pick_template_row(db: Session):
    preferred = kp_template_service.get_by_title(db, KP_DOM_KUBANI_STANDART_TITLE)
    if preferred:
        return preferred
    templates = kp_template_service.list_all(db, limit=1)
    return templates[0] if templates else None


def _load_template_html(db: Session) -> str:
    row = _pick_template_row(db)
    if row and (row.html_content or "").strip():
        t = _normalize_template(row.html_content.strip())
        if _template_has_placeholders(t):
            return t
    return _normalize_template(KP_DOM_KUBANI_STANDART_BODY)


def _is_standart_template(html: str) -> bool:
    return "kp-badge-standart" in html or KP_DOM_KUBANI_STANDART_TITLE in html


def _inject_photos_page(body: str, photos_page: str) -> str:
    """Вставляет страницу фото, если в шаблоне из БД нет {{kp_photos_page}}."""
    if not photos_page or "kp-page-photos" in body:
        return body
    closing = "</div>\n</div>"
    pos = body.rfind(closing)
    if pos == -1:
        return body + photos_page
    return body[:pos] + photos_page + body[pos:]


def _ensure_title_banner(body: str) -> str:
    """Верхний баннер в начало первой панели, если в шаблоне из БД нет плейсхолдера."""
    if "kp-title-banner-img" in body or "{{kp_title_banner}}" in body:
        return body
    from app.services.kp_landscape_assets import kp_title_banner_markup

    markup = kp_title_banner_markup()
    if not markup:
        return body
    block = (
        '<div class="kp-prelim-cols">\n'
        f'  <div class="kp-prelim-banner"><div class="kp-title-banner">{markup}</div></div>\n'
        '  <div class="kp-prelim-right"></div>\n'
        "</div>\n"
    )
    m = re.search(r'(<div class="kp-panel[^"]*">)', body, re.I)
    if m:
        return body[: m.start()] + block + body[m.start() :]
    return block + body


def _ensure_landscape_body(body: str) -> str:
    """КП из CRM всегда альбомный: маркер и обёртка для стилей/подложки."""
    trimmed = body.strip()
    if is_landscape_kp_html(trimmed):
        return trimmed
    if "kp-page" in trimmed or "kp-landscape-doc" in trimmed:
        return KP_LAYOUT_MARKER + trimmed
    return (
        KP_LAYOUT_MARKER
        + f'<div class="kp-landscape-doc"><div class="kp-page">{trimmed}</div></div>'
    )


def _wrap_html_document(body: str, *, client_table_only: bool = False) -> str:
    trimmed = _ensure_landscape_body(body).strip()
    if client_table_only or is_client_table_only_kp_html(trimmed):
        style = landscape_print_css_table_only()
        body_inner = trimmed
        title = "Коммерческое предложение — таблица"
    elif re.match(r"<!DOCTYPE", trimmed, re.I) or re.match(r"<html[\s>]", trimmed, re.I):
        return trimmed
    elif is_landscape_kp_html(trimmed):
        style = landscape_print_css()
        body_inner = landscape_body_prefix() + trimmed
        title = "Коммерческое предложение"
    else:
        style = """
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 20px 24px; font-size: 12pt; line-height: 1.5;
      font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
      color: #000; background: #fff;
    }
    table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
    th, td { border: 1px solid #999; padding: 6px 8px; min-width: 50px; }
    th { background: #f5f5f5; font-weight: 600; }
    ul, ol { padding-left: 1.5em; }
    """
        return (
            '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/>'
            "<title>Коммерческое предложение</title>"
            f"<style>{style}</style></head><body>{trimmed}</body></html>"
        )
    return (
        '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/>'
        f"<title>{title}</title>"
        f"<style>{style}</style></head><body>{body_inner}</body></html>"
    )


def build_kp_crm_html(
    db: Session,
    specification_id: int,
    *,
    client_table_only: bool = False,
) -> str:
    d = collect_kp_document_data(db, specification_id)
    spec = d.spec
    spec_total = _spec_total_amount(spec, d.items_data)
    _, _, prepayment_amount, balance_amount = _payment_for_spec(spec_total, d.contract_data)
    contract_supply_amount = amount_with_words(spec_total) if spec_total > 0 else ""

    if client_table_only:
        template = _normalize_template(KP_DOM_KUBANI_STANDART_CLIENT_BODY)
        use_standart_defaults = True
    else:
        template = _load_template_html(db)
        use_standart_defaults = _is_standart_template(template)

    hide_unit_price = client_table_only
    items_html = _build_items_table_html(
        d.items_data, d.parts_data, hide_unit_price=hide_unit_price
    )
    total_amount = d.total_amount
    if not d.items_data and use_standart_defaults:
        items_html = build_standart_default_items_table_html(hide_unit_price=hide_unit_price)
        total_amount = format_standart_default_total()

    include_photos = client_table_only or use_standart_defaults
    photos_page = ""
    if include_photos:
        spec_photos = load_specification_photos(db, specification_id)
        photos_page = build_kp_photos_page_html(spec_photos)

    extra = {
        "kp_number": d.kp_number,
        "kp_date": d.kp_date,
        "kp_validity_days": "14",
        "specification_number": d.specification_number,
        "project_title": d.project_title,
        "project_name": d.project_name,
        "project_number": d.project_number,
        "customer_contact_line": d.customer_contact_line.replace("\n", "<br>"),
        "house_type": d.house_type,
        "house_area": d.house_area,
        "house_size_m": _house_size_m_label(spec),
        "house_area_sqm": _house_area_sqm_label(spec),
        "length_m": f"{float(spec.length_m):g}" if getattr(spec, "length_m", None) is not None else "—",
        "width_m": f"{float(spec.width_m):g}" if getattr(spec, "width_m", None) is not None else "—",
        "floors": d.floors_label,
        "room_count": d.room_count_label,
        "double_timber": d.double_timber_label,
        "terrace": d.terrace_label,
        "terrace_second_floor": d.terrace_second_floor_label,
        "floors_label": d.floors_label,
        "room_count_label": d.room_count_label,
        "foundation": d.foundation,
        "delivery_terms": d.delivery_terms,
        "kp_items_table": items_html,
        "total_amount": total_amount,
        "contract_supply_amount": contract_supply_amount,
        "prepayment": d.prepayment,
        "balance": d.balance,
        "prepayment_amount": prepayment_amount,
        "balance_amount": balance_amount,
        "manager_name": d.manager_name,
        "contact_phone": d.contact_phone,
        "contact_email_line": d.contact_email_line,
        "kp_logo": kp_logo_img_markup(),
        "kp_title_banner": kp_title_banner_markup(),
        "kp_photos_page": photos_page,
    }

    body = apply_placeholders(
        template,
        customer=d.customer,
        organization=d.organization,
        contract_data=d.contract_data,
        extra=extra,
    )
    if include_photos and photos_page and "kp-page-photos" not in body:
        body = _inject_photos_page(body, photos_page)
    body = inject_kp_assets(body)
    if client_table_only or use_standart_defaults:
        body = _ensure_title_banner(body)
    return _wrap_html_document(body, client_table_only=client_table_only)
