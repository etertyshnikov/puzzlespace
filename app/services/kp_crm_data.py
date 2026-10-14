# -*- coding: utf-8 -*-
"""Данные CRM для коммерческого предложения (HTML и PDF)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from sqlalchemy.orm import Session

from app.models import (
    AuthUser,
    Branch,
    Customer,
    NomenclatureItem,
    Organization,
    Project,
    Specification,
)
from app.services import (
    customer as customer_service,
    specification_item as item_service,
    organization as organization_service,
    part as part_service,
    project as project_service,
    project_contract_data as contract_data_service,
    specification as spec_service,
)
from app.services.kp_landscape_assets import KP_DEFAULT_MANAGER_PHONE
from app.services.contract_placeholders import (
    amount_with_words,
    customer_full_name,
    format_contract_amount,
    format_contract_date,
)


def _num(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _fmt_money(v) -> str:
    return f"{_num(v):,.2f}".replace(",", " ")


def _gather_items_data(db: Session, specification_id: int) -> list[dict]:
    items = item_service.list_for_kp(db, specification_id)
    rows: list[dict] = []
    for it in items:
        name = (getattr(it, "item_name", None) or "").strip()
        if not name and getattr(it, "nomenclature_item_id", None):
            nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == it.nomenclature_item_id).first()
            if nom:
                name = (nom.name or nom.item_number or "—").strip() or nom.item_number
        rows.append(
            {
                "item_name": name or "—",
                "quantity": getattr(it, "quantity", None),
                "unit": getattr(it, "unit", None),
                "price": getattr(it, "price", None),
                "total": getattr(it, "total", None),
                "part_id": getattr(it, "part_id", None),
                "include_in_total": bool(getattr(it, "include_in_total", True)),
            }
        )
    return rows


def _spec_total_amount(spec: Specification, items_data: list[dict]) -> float:
    items_sum = sum(
        _num(it.get("total"))
        for it in items_data
        if it.get("include_in_total", True)
    )
    if items_sum > 0:
        return items_sum
    return _num(getattr(spec, "total_amount", None))


def _payment_for_spec(spec_total: float, contract_data) -> tuple[str, str, str, str]:
    if spec_total <= 0:
        return "", "", "", ""
    prepay = bal = 0.0
    supply = (
        float(contract_data.contract_supply_amount)
        if contract_data and getattr(contract_data, "contract_supply_amount", None) is not None
        else 0.0
    )
    prep_contract = (
        float(contract_data.prepayment_amount)
        if contract_data and getattr(contract_data, "prepayment_amount", None) is not None
        else 0.0
    )
    if supply > 0 and prep_contract > 0:
        ratio = min(max(prep_contract / supply, 0.0), 1.0)
        prepay = round(spec_total * ratio, 2)
        bal = round(spec_total - prepay, 2)
    else:
        prepay = round(spec_total * 0.5, 2)
        bal = round(spec_total - prepay, 2)
    return (
        amount_with_words(prepay),
        amount_with_words(bal),
        format_contract_amount(prepay),
        format_contract_amount(bal),
    )


def _house_type_label(spec: Specification) -> str:
    return "дом из минибруса"


def _yes_no_label(value: Any) -> str:
    return "да" if value else "нет"


def _floors_label(spec: Specification) -> str:
    f = getattr(spec, "floors", None)
    if f is None:
        return "—"
    try:
        return str(int(f))
    except (TypeError, ValueError):
        return "—"


def _room_count_label(spec: Specification) -> str:
    rc = getattr(spec, "room_count", None)
    if rc is None:
        return "—"
    try:
        return str(int(rc))
    except (TypeError, ValueError):
        return "—"


def _terrace_label(spec: Specification) -> str:
    """Терраса: нет или Lt×W из спецификации."""
    lt = getattr(spec, "terrace_length_m", None)
    w = getattr(spec, "width_m", None)
    if lt is None:
        return "нет"
    try:
        lt_f = float(lt)
    except (TypeError, ValueError):
        return "—"
    if lt_f <= 0:
        return "нет"
    if w is not None:
        try:
            return f"{lt_f:g}×{float(w):g} м"
        except (TypeError, ValueError):
            pass
    return f"{lt_f:g} м"


def _terrace_second_floor_label(spec: Specification) -> str:
    lt = getattr(spec, "terrace_length_m", None)
    try:
        has_terrace = lt is not None and float(lt) > 0
    except (TypeError, ValueError):
        has_terrace = False
    if not has_terrace:
        return "—"
    return _yes_no_label(bool(getattr(spec, "terrace_second_floor", False)))


def _house_area_label(spec: Specification) -> str:
    length = getattr(spec, "length_m", None)
    width = getattr(spec, "width_m", None)
    if length is None and width is None:
        return "—"
    try:
        l = float(length) if length is not None else None
        w = float(width) if width is not None else None
    except (TypeError, ValueError):
        return "—"
    if l is not None and w is not None:
        area = l * w
        return f"{l:g}×{w:g} м (≈ {area:g} м²)"
    if l is not None:
        return f"длина {l:g} м"
    return f"ширина {w:g} м"


def _house_size_m_label(spec: Specification) -> str:
    """Размер дома для шапки КП: «6 × 4,5»."""
    length = getattr(spec, "length_m", None)
    width = getattr(spec, "width_m", None)
    try:
        l = float(length) if length is not None else None
        w = float(width) if width is not None else None
    except (TypeError, ValueError):
        return "—"
    if l is not None and w is not None:
        return f"{l:g} × {w:g}"
    if l is not None:
        return f"{l:g}"
    if w is not None:
        return f"{w:g}"
    return "—"


def _house_area_sqm_label(spec: Specification) -> str:
    """Площадь дома, м² (число)."""
    length = getattr(spec, "length_m", None)
    width = getattr(spec, "width_m", None)
    try:
        l = float(length) if length is not None else None
        w = float(width) if width is not None else None
    except (TypeError, ValueError):
        return "—"
    if l is not None and w is not None:
        return f"{l * w:g}"
    return "—"


def _manager_display(user: AuthUser | None) -> str:
    if not user:
        return "—"
    parts = [getattr(user, "first_name", None), getattr(user, "last_name", None)]
    name = " ".join(p for p in parts if p).strip()
    return name or getattr(user, "nic", None) or "—"


def _build_items_table_html(
    items: list[dict],
    parts: list[dict],
    *,
    hide_unit_price: bool = False,
    always_show_part_headers: bool = False,
) -> str:
    by_part: dict = {}
    for it in items:
        key = it.get("part_id") if it.get("part_id") is not None else "none"
        by_part.setdefault(key, []).append(it)

    part_order: list = []
    for p in parts:
        if p["id"] in by_part:
            part_order.append(p["id"])
    if "none" in by_part:
        part_order.append("none")
    for key in by_part:
        if key not in part_order:
            part_order.append(key)

    parts_by_id = {p["id"]: p["name"] for p in parts}
    rows: list[str] = []
    n = 0
    for key in part_order:
        group = by_part.get(key, [])
        if not group:
            continue
        colspan = "5" if hide_unit_price else "6"
        if key != "none" and (len(part_order) > 1 or always_show_part_headers):
            part_name = parts_by_id.get(key, "Часть")
            rows.append(
                f'<tr class="kp-part-title"><td colspan="{colspan}">{xml_escape(part_name)}</td></tr>'
            )
        for it in group:
            n += 1
            name = xml_escape(str(it.get("item_name") or "—"))
            unit = xml_escape(str(it.get("unit") or "шт"))
            qty = _num(it.get("quantity"))
            price = _fmt_money(it.get("price"))
            total = _fmt_money(it.get("total"))
            price_cell = (
                ""
                if hide_unit_price
                else f'<td style="text-align:right;">{price}</td>'
            )
            rows.append(
                f"<tr><td>{n}</td><td>{name}</td><td>{unit}</td>"
                f'<td style="text-align:right;">{qty:g}</td>'
                f"{price_cell}"
                f'<td style="text-align:right;">{total}</td></tr>'
            )
    if not rows:
        colspan = "5" if hide_unit_price else "6"
        rows.append(
            f'<tr><td colspan="{colspan}" style="text-align:center;color:#666;">Позиции не добавлены</td></tr>'
        )
    return "\n".join(rows)


def build_specification_kp_table_html(
    db: Session,
    specification_id: int,
    *,
    hide_unit_price: bool = True,
    always_show_part_headers: bool = True,
) -> tuple[str, str]:
    """
    Таблица позиций как в КП «Стандарт»: разделы по частям дома (с «Фундамента»),
    колонки № / номенклатура / ед. / кол-во / сумма.
    """
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        return "", ""

    parts = part_service.list_all(db)
    parts_data = [{"id": p.id, "name": p.name} for p in parts]
    items_data = _gather_items_data(db, specification_id)
    rows_html = _build_items_table_html(
        items_data,
        parts_data,
        hide_unit_price=hide_unit_price,
        always_show_part_headers=always_show_part_headers,
    )
    spec_total = _spec_total_amount(spec, items_data)
    total_display = f"{_fmt_money(spec_total)} ₽"
    return rows_html, total_display


def _format_customer_contact_line(customer: Customer | None, phone: str, email: str) -> str:
    """ФИО и email в первой строке, телефон — отдельной строкой."""
    head_parts = [p for p in [customer_full_name(customer), email] if p]
    lines: list[str] = []
    if head_parts:
        lines.append(", ".join(head_parts))
    if phone:
        lines.append(phone)
    return "\n".join(lines) if lines else "—"


@dataclass
class KpDocumentData:
    spec: Specification
    items_data: list[dict]
    parts_data: list[dict]
    customer: Customer | None
    organization: Organization | None
    contract_data: Any
    manager: AuthUser | None
    branch: Branch | None
    kp_number: str
    kp_date: str
    specification_number: str
    project_title: str
    project_name: str
    project_number: str
    customer_full_name: str
    customer_contact_line: str
    customer_address: str
    organization_name: str
    organization_director_name: str
    organization_director_position: str
    house_type: str
    house_area: str
    floors_label: str
    room_count_label: str
    double_timber_label: str
    terrace_label: str
    terrace_second_floor_label: str
    foundation: str
    delivery_terms: str
    total_amount: str
    prepayment: str
    balance: str
    manager_name: str
    contact_phone: str
    contact_email_line: str


def collect_kp_document_data(db: Session, specification_id: int) -> KpDocumentData:
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise ValueError("Спецификация не найдена")

    parts = part_service.list_all(db)
    parts_data = [{"id": p.id, "name": p.name} for p in parts]
    items_data = _gather_items_data(db, specification_id)

    project: Project | None = None
    if getattr(spec, "project_id", None):
        project = project_service.get_by_id(db, spec.project_id)

    customer: Customer | None = None
    customer_id = getattr(spec, "customer_id", None) or (
        getattr(project, "customer_id", None) if project else None
    )
    if customer_id:
        customer = customer_service.get_by_id(db, customer_id)

    organization: Organization | None = None
    org_id = getattr(project, "organization_id_supply", None) if project else None
    if org_id:
        organization = organization_service.get_by_id(db, org_id)
    if not organization:
        organization = organization_service.get_default(db)

    contract_data = (
        contract_data_service.get_by_project_id(db, project.id) if project else None
    )

    manager: AuthUser | None = None
    branch: Branch | None = None
    manager_user_id = getattr(project, "created_by_user_id", None) if project else None
    if manager_user_id:
        manager = db.query(AuthUser).filter(AuthUser.id == manager_user_id).first()
        if manager and getattr(manager, "branch_id", None):
            branch = db.query(Branch).filter(Branch.id == manager.branch_id).first()

    spec_number = getattr(spec, "number", None) or str(specification_id)
    kp_number = spec_number if str(spec_number).upper().startswith("КП") else f"КП-{spec_number}"
    kp_date = format_contract_date(date.today())

    city = (getattr(contract_data, "city", None) or "").strip() if contract_data else ""
    project_name = (getattr(project, "name", None) or "Проект").strip() if project else "Проект"
    project_number = (getattr(project, "project_number", None) or "").strip() if project else ""
    project_title = f"{project_name}, {city}" if city else project_name

    phone = (getattr(customer, "phone", None) or "").strip() if customer else ""
    email = (getattr(customer, "email", None) or "").strip() if customer else ""
    customer_contact_line = _format_customer_contact_line(customer, phone, email)

    spec_total = _spec_total_amount(spec, items_data)
    total_display = f"{_fmt_money(spec_total)} ₽"
    prepayment, balance, _, _ = _payment_for_spec(spec_total, contract_data)

    delivery_deadline = (
        format_contract_date(getattr(contract_data, "delivery_deadline", None))
        if contract_data
        else ""
    )
    if delivery_deadline:
        delivery_terms = f"до {delivery_deadline}"
    elif getattr(spec, "deadline", None):
        delivery_terms = f"до {format_contract_date(spec.deadline)}"
    else:
        delivery_terms = "от 45 рабочих дней с момента аванса"

    foundation = (getattr(spec, "description", None) or "").strip()
    if not foundation and project:
        foundation = (getattr(project, "description", None) or "").strip()
    if not foundation and project:
        foundation = (getattr(project, "notes", None) or "").strip()
    foundation = foundation or "—"

    contact_phone = KP_DEFAULT_MANAGER_PHONE
    contact_email_line = ""

    return KpDocumentData(
        spec=spec,
        items_data=items_data,
        parts_data=parts_data,
        customer=customer,
        organization=organization,
        contract_data=contract_data,
        manager=manager,
        branch=branch,
        kp_number=kp_number,
        kp_date=kp_date,
        specification_number=spec_number,
        project_title=project_title,
        project_name=project_name,
        project_number=project_number or "—",
        customer_full_name=customer_full_name(customer) or "—",
        customer_contact_line=customer_contact_line,
        customer_address=(getattr(customer, "address", None) or "").strip() or "—",
        organization_name=(getattr(organization, "name", None) or "").strip() or "—",
        organization_director_name=(getattr(organization, "director_name", None) or "").strip() or "—",
        organization_director_position=(getattr(organization, "director_position", None) or "").strip() or "—",
        house_type=_house_type_label(spec),
        house_area=_house_area_label(spec),
        floors_label=_floors_label(spec),
        room_count_label=_room_count_label(spec),
        double_timber_label=_yes_no_label(bool(getattr(spec, "double_timber", False))),
        terrace_label=_terrace_label(spec),
        terrace_second_floor_label=_terrace_second_floor_label(spec),
        foundation=foundation,
        delivery_terms=delivery_terms,
        total_amount=total_display,
        prepayment=prepayment,
        balance=balance,
        manager_name=_manager_display(manager),
        contact_phone=contact_phone,
        contact_email_line=contact_email_line,
    )
