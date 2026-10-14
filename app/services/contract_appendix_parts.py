# -*- coding: utf-8 -*-
"""Приложение к договору: таблица ТЗ (шапка + состав по частям дома из согласованных КП)."""
from __future__ import annotations

import re
from typing import Any

from xml.sax.saxutils import escape as xml_escape

from sqlalchemy.orm import Session

from app.models import NomenclatureItem
from app.services import part as part_service
from app.services import specification as spec_service
from app.services import specification_item as item_service
from app.services.contract_placeholders import (
    customer_organization_name,
    format_building_type,
    format_building_type_genitive,
    format_house_size_mm,
)
from app.services.kp_crm_data import build_specification_kp_table_html
from app.services.kp_spec_photos import build_appendix_photos_html, load_specification_photos
from app.services.project_contract_data import _is_kp_approved

# Первая согласованная КП — III, следующая — IV и т.д.
APPENDIX_SPECS_ROMAN_START = 3


def _section_label(index: int, section: str) -> str:
    return f"{index + 1}. {section}"


def _to_roman(num: int) -> str:
    """Римские цифры для нумерации разделов (1–39)."""
    if num < 1:
        return str(num)
    pairs = (
        (39, "XXXIX"),
        (37, "XXXVII"),
        (36, "XXXVI"),
        (35, "XXXV"),
        (34, "XXXIV"),
        (33, "XXXIII"),
        (32, "XXXII"),
        (31, "XXXI"),
        (30, "XXX"),
        (29, "XXIX"),
        (28, "XXVIII"),
        (27, "XXVII"),
        (26, "XXVI"),
        (25, "XXV"),
        (24, "XXIV"),
        (23, "XXIII"),
        (22, "XXII"),
        (21, "XXI"),
        (20, "XX"),
        (19, "XIX"),
        (18, "XVIII"),
        (17, "XVII"),
        (16, "XVI"),
        (15, "XV"),
        (14, "XIV"),
        (13, "XIII"),
        (12, "XII"),
        (11, "XI"),
        (10, "X"),
        (9, "IX"),
        (8, "VIII"),
        (7, "VII"),
        (6, "VI"),
        (5, "V"),
        (4, "IV"),
        (3, "III"),
        (2, "II"),
        (1, "I"),
    )
    result: list[str] = []
    n = num
    for value, numeral in pairs:
        while n >= value:
            result.append(numeral)
            n -= value
    return "".join(result)


def _parts_for_specification(db: Session, specification_id: int) -> list[tuple[int, str]]:
    """
    Разделы приложения: части дома из справочника parts (sort_order),
    у которых есть позиции в данной спецификации.
    """
    all_parts = part_service.list_all(db)
    part_ids: set[int] = set()
    for it in item_service.list_by_specification(db, specification_id):
        pid = getattr(it, "part_id", None)
        if pid is not None:
            part_ids.add(int(pid))

    if not part_ids:
        return []

    return [(p.id, p.name) for p in all_parts if p.id in part_ids]


def resolve_specifications_for_appendix(
    db: Session,
    project_id: int,
    specification_id: int | None = None,
) -> list[Any]:
    """Все согласованные КП проекта (по id); при отсутствии — одна из specification_id."""
    specs = spec_service.list_by_project(db, project_id)
    agreed = sorted(
        [s for s in specs if _is_kp_approved(s)],
        key=lambda s: getattr(s, "id", 0) or 0,
    )
    if agreed:
        return agreed
    if specification_id is not None:
        spec = spec_service.get_by_id(db, specification_id)
        if spec and getattr(spec, "project_id", None) == project_id and _is_kp_approved(spec):
            return [spec]
    return []


def resolve_specification_for_appendix_single(
    db: Session,
    project_id: int,
    specification_id: int | None = None,
):
    """Одна согласованная КП (фото приложения и обратная совместимость)."""
    specs = resolve_specifications_for_appendix(db, project_id, specification_id)
    if len(specs) == 1:
        return specs[0]
    return None


def _item_display_name(db: Session, item) -> str:
    name = (getattr(item, "item_name", None) or "").strip()
    if name:
        return name
    nom_id = getattr(item, "nomenclature_item_id", None)
    if nom_id:
        nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == nom_id).first()
        if nom:
            return (nom.name or nom.item_number or "—").strip() or nom.item_number or "—"
    return "—"


def _gather_items_by_part_id(db: Session, specification_id: int) -> dict[int, list[str]]:
    by_part: dict[int, list[str]] = {}
    for it in item_service.list_by_specification(db, specification_id):
        part_id = getattr(it, "part_id", None)
        if part_id is None:
            continue
        by_part.setdefault(int(part_id), []).append(_item_display_name(db, it))
    return by_part


def _join_text_parts(*parts: str | None) -> str:
    return " ".join(p.strip() for p in parts if p and p.strip())


def _specs_cell_text(specification: Any) -> str:
    house_type_genitive = format_building_type_genitive(specification)
    house_size_mm = format_house_size_mm(specification)
    size_prefix = _join_text_parts("Размер", house_type_genitive, house_size_mm)
    if size_prefix:
        return f"{size_prefix}. Высота боковых стен первого этажа не менее 2200 мм."
    return "Высота боковых стен первого этажа не менее 2200 мм."


def _build_header_rows(
    *,
    customer: Any = None,
    contract_data: Any = None,
    specification: Any = None,
) -> str:
    """Заголовок таблицы, I–II (общие для всего приложения)."""
    house_type_genitive = format_building_type_genitive(specification)
    customer_address = (getattr(customer, "address", None) or "").strip() if customer else ""
    customer_phone = (getattr(customer, "phone", None) or "").strip() if customer else ""
    buyer_name = customer_organization_name(customer, contract_data)

    title_1 = _join_text_parts(
        "Техническое задание на изготовление",
        house_type_genitive,
        "из минибруса",
    )
    buyer_cell = _join_text_parts(buyer_name, customer_phone) or "—"

    rows = [
        f'<tr class="row-title"><td colspan="2">{xml_escape(title_1)}</td></tr>',
        (
            f'<tr><td class="col-label">I. Место выполнения работ</td>'
            f'<td class="col-value">{xml_escape(customer_address or "—")}</td></tr>'
        ),
        (
            f'<tr><td class="col-label">II. «Заказчик»:</td>'
            f'<td class="col-value">{xml_escape(buyer_cell)}</td></tr>'
        ),
    ]
    return "".join(rows)


def _build_specification_block_rows(
    db: Session,
    specification,
    *,
    roman_num: int,
    include_title_row: bool = True,
) -> str:
    """Подзаголовок КП, римский раздел III/IV/… и состав по частям дома."""
    if not specification or not _is_kp_approved(specification):
        return ""

    house_type = format_building_type(specification)
    house_size_mm = format_house_size_mm(specification)
    title_2 = _join_text_parts(house_type, "из минибруса размером", house_size_mm)
    specs_cell = _specs_cell_text(specification)
    roman_label = f"{_to_roman(roman_num)}. Технические характеристики объекта, комплектация:"

    row_parts: list[str] = []
    if include_title_row and title_2:
        row_parts.append(
            f'<tr class="row-title"><td colspan="2">{xml_escape(title_2)}</td></tr>'
        )
    row_parts.extend([
        (
            f'<tr><td class="col-label">{xml_escape(roman_label)}</td>'
            f'<td class="col-value">{xml_escape(specs_cell)}</td></tr>'
        ),
    ])

    spec_id = specification.id
    sections = _parts_for_specification(db, spec_id)
    by_part = _gather_items_by_part_id(db, spec_id)

    for index, (part_id, section_name) in enumerate(sections):
        names = by_part.get(part_id) or []
        label = _section_label(index, section_name)
        if not names:
            cell = "—"
        else:
            cell = "<br/>".join(xml_escape(name) for name in names)
        row_parts.append(
            f'<tr><td class="col-label">{xml_escape(label)}</td>'
            f'<td class="col-value">{cell}</td></tr>'
        )
    return "".join(row_parts)


def _appendix_header_in_template(template_html: str | None) -> bool:
    """В шаблоне уже есть строки I–II до плейсхолдера — шапку не дублируем."""
    if not (template_html or "").strip():
        return False
    if not re.search(r"\{\{\s*appendix_parts_table\s*\}\}", template_html, re.I):
        return False
    before = re.split(r"\{\{\s*appendix_parts_table\s*\}\}", template_html, maxsplit=1, flags=re.I)[0]
    return (
        "I. Место выполнения работ" in before
        and "II." in before
        and "Заказчик" in before
    )


def appendix_specs_blocks_in_template(template_html: str | None) -> bool:
    """Чередование «таблица КП → фото КП» через {{appendix_specs_blocks}}."""
    return bool(re.search(r"\{\{\s*appendix_specs_blocks\s*\}\}", template_html or "", re.I))


def _wrap_appendix_table_rows(rows: str) -> str:
    if not rows:
        return ""
    return f'<table class="appendix-tz-table"><tbody>{rows}</tbody></table>'


def build_appendix_specs_blocks_html(
    db: Session,
    project_id: int,
    *,
    specification_id: int | None = None,
) -> str:
    """
    Для каждой согласованной КП: таблица ТЗ + фотографии этой спецификации.
    """
    agreed_specs = resolve_specifications_for_appendix(db, project_id, specification_id)
    if not agreed_specs:
        return ""

    blocks: list[str] = []
    for index, spec in enumerate(agreed_specs):
        rows = _build_specification_block_rows(
            db,
            spec,
            roman_num=APPENDIX_SPECS_ROMAN_START + index,
        )
        table_html = _wrap_appendix_table_rows(rows)
        photos_html = build_appendix_photos_html(load_specification_photos(db, spec.id))
        if not table_html and not photos_html:
            continue
        chunk = ['<div class="appendix-spec-block">']
        if index == 0:
            chunk[0] = '<div class="appendix-spec-block appendix-spec-block-first">'
        if table_html:
            chunk.append(table_html)
        if photos_html:
            chunk.append(photos_html)
        chunk.append("</div>")
        blocks.append("".join(chunk))

    return "".join(blocks)


def build_appendix_parts_table_rows(
    db: Session,
    project_id: int,
    *,
    customer: Any = None,
    contract_data: Any = None,
    specification_id: int | None = None,
    fallback_specification: Any = None,
    template_html: str | None = None,
) -> str:
    """Строки <tr> для <tbody> таблицы #appendix-tz-table."""
    if appendix_specs_blocks_in_template(template_html):
        return ""

    agreed_specs = resolve_specifications_for_appendix(db, project_id, specification_id)
    title_spec = agreed_specs[0] if agreed_specs else fallback_specification

    parts: list[str] = []
    if not _appendix_header_in_template(template_html):
        parts.append(
            _build_header_rows(
                customer=customer,
                contract_data=contract_data,
                specification=title_spec,
            )
        )

    for index, spec in enumerate(agreed_specs):
        block = _build_specification_block_rows(
            db,
            spec,
            roman_num=APPENDIX_SPECS_ROMAN_START + index,
        )
        if block:
            parts.append(block)

    return "".join(parts)


def build_appendix_parts_table_html(
    db: Session,
    project_id: int,
    *,
    customer: Any = None,
    contract_data: Any = None,
    specification_id: int | None = None,
    fallback_specification: Any = None,
    template_html: str | None = None,
) -> str:
    """
    Строки <tr> для #appendix-tz-table (плейсхолдер внутри <tbody> шаблона).
    Если в шаблоне уже есть I–II, подставляются только блоки согласованных КП.
    """
    return build_appendix_parts_table_rows(
        db,
        project_id,
        customer=customer,
        contract_data=contract_data,
        specification_id=specification_id,
        fallback_specification=fallback_specification,
        template_html=template_html,
    )


def appendix_parts_table_for_project(
    db: Session,
    project_id: int,
    specification_id: int | None = None,
    *,
    customer: Any = None,
    contract_data: Any = None,
    specification: Any = None,
    template_html: str | None = None,
) -> str:
    return build_appendix_parts_table_html(
        db,
        project_id,
        customer=customer,
        contract_data=contract_data,
        specification_id=specification_id,
        fallback_specification=specification,
        template_html=template_html,
    )


def appendix_specs_blocks_for_project(
    db: Session,
    project_id: int,
    specification_id: int | None = None,
) -> str:
    return build_appendix_specs_blocks_html(
        db,
        project_id,
        specification_id=specification_id,
    )


def _format_total_amount_ru(specification: Any) -> str:
    amount = getattr(specification, "total_amount", None)
    if amount is None:
        return "—"
    try:
        val = float(amount)
    except (TypeError, ValueError):
        return "—"
    formatted = f"{val:,.2f}".replace(",", " ").replace(".", ",")
    if formatted.endswith(",00"):
        formatted = formatted[:-3]
    return f"{formatted} ₽"


def _spec_display_number(specification: Any) -> str:
    number = (getattr(specification, "number", None) or "").strip()
    if number:
        return number
    spec_id = getattr(specification, "id", None)
    return str(spec_id) if spec_id is not None else "—"


def _wrap_appendix2_kp_table(rows_html: str, total_display: str) -> str:
    return (
        '<table class="kp-table appendix2-kp-table">'
        "<thead>"
        "<tr>"
        '<th style="width:5%;">№</th>'
        "<th>Номенклатура</th>"
        '<th style="width:8%;">Ед.</th>'
        '<th style="width:10%;">Кол-во</th>'
        '<th style="width:12%;">Сумма, ₽</th>'
        "</tr>"
        "</thead>"
        f"<tbody>{rows_html}</tbody>"
        "</table>"
        f'<p class="kp-total">Итого: <strong>{xml_escape(total_display)}</strong></p>'
    )


def build_appendix2_specs_content_html(
    db: Session,
    project_id: int,
    *,
    specification_id: int | None = None,
) -> str:
    """
    Приложение № 2: все согласованные КП — заголовок и таблица позиций как в КП «Стандарт».
    """
    agreed_specs = resolve_specifications_for_appendix(db, project_id, specification_id)
    if not agreed_specs:
        return ""

    sections: list[str] = []
    for index, spec in enumerate(agreed_specs):
        rows_html, total_display = build_specification_kp_table_html(db, spec.id)
        if not rows_html:
            continue

        house_type = format_building_type(spec)
        house_size_mm = format_house_size_mm(spec)
        title_2 = _join_text_parts(house_type, "из минибруса размером", house_size_mm)
        meta = _join_text_parts(
            title_2 + "." if title_2 else "",
            f"Сумма: {_format_total_amount_ru(spec)}",
        )
        section_class = "appendix2-spec-section"
        if index == 0:
            section_class += " appendix2-spec-section-first"

        sections.append(
            f'<div class="{section_class}">'
            f'<div class="appendix2-spec-header">'
            f'<p class="appendix2-spec-title">Спецификация № {xml_escape(_spec_display_number(spec))}</p>'
            f'<p class="appendix2-spec-meta">{xml_escape(meta or "—")}</p>'
            f"</div>"
            f"{_wrap_appendix2_kp_table(rows_html, total_display)}"
            f"</div>"
        )

    return "".join(sections)


def appendix2_specs_content_for_project(
    db: Session,
    project_id: int,
    specification_id: int | None = None,
) -> str:
    return build_appendix2_specs_content_html(
        db,
        project_id,
        specification_id=specification_id,
    )


def appendix_photos_for_project(
    db: Session,
    project_id: int,
    specification_id: int | None = None,
    *,
    template_html: str | None = None,
) -> str:
    """Фотографии всех согласованных КП (в конце документа; не используется с appendix_specs_blocks)."""
    if appendix_specs_blocks_in_template(template_html):
        return ""
    specs = resolve_specifications_for_appendix(db, project_id, specification_id)
    if not specs:
        return ""
    photos: list[dict] = []
    for spec in specs:
        photos.extend(load_specification_photos(db, spec.id))
    return build_appendix_photos_html(photos)
