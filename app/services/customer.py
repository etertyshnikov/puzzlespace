# -*- coding: utf-8 -*-
import re
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Customer, Project
from app.services import user_activity as activity_service
from app.services.project import next_project_number
from app.services.cascade_delete import delete_customer_bundle

_ALLOWED_DEAL_STATUS = frozenset({"in_progress", "success", "rejected"})

_CUSTOMER_UPDATE_FIELDS = frozenset({
    "name",
    "middle_name",
    "last_name",
    "full_name",
    "phone",
    "email",
    "address",
    "deal_status",
    "gender",
    "age_bracket",
    "lead_source_id",
    "link",
    "notes",
    "comments",
    "budget",
    "passport_series",
    "passport_number",
    "passport_issued_by",
    "passport_issue_date",
    "passport_department_code",
    "birth_date",
    "birth_place",
    "legal_company_name",
    "legal_inn",
    "legal_kpp",
    "legal_ogrn",
    "legal_company_address",
    "legal_bank",
    "legal_bank_account",
    "legal_bik",
    "legal_signatory_name",
    "legal_signatory_basis",
})


def _normalize_phone_digits(phone: str | None) -> str:
    """Нормализация телефона до 10 цифр (как в формате +7 (xxx) xxx-xx-xx)."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) == 11 and digits[0] in "78":
        digits = digits[1:]
    return digits[:10]


def compute_full_name(last_name: str | None, name: str | None, middle_name: str | None) -> str:
    """ФИО из частей; если частей нет — имя."""
    parts = [p for p in (last_name, name, middle_name) if p]
    return " ".join(parts) if parts else (name or "")


_compute_full_name = compute_full_name  # совместимость внутри модуля


def list_all(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    created_by_user_id: int | None = None,
    created_by_user_ids: list[int] | None = None,
    deal_status: list[str] | None = None,
) -> list[Customer]:
    q = db.query(Customer)
    if created_by_user_ids:
        q = q.filter(Customer.created_by_user_id.in_(created_by_user_ids))
    elif created_by_user_id is not None:
        q = q.filter(Customer.created_by_user_id == created_by_user_id)
    if deal_status:
        allowed = [s for s in deal_status if s in _ALLOWED_DEAL_STATUS]
        if allowed:
            q = q.filter(Customer.deal_status.in_(allowed))
    return q.order_by(Customer.id.desc()).offset(skip).limit(limit).all()


def get_by_id(db: Session, customer_id: int) -> Customer | None:
    return db.query(Customer).filter(Customer.id == customer_id).first()


def phone_exists(db: Session, phone: str, exclude_customer_id: int | None = None) -> bool:
    """Проверка, есть ли уже клиент с таким номером (сравнение по 10 цифрам)."""
    normalized = _normalize_phone_digits(phone)
    if len(normalized) != 10:
        return False
    rows = db.query(Customer.id, Customer.phone).limit(5000).all()
    for row in rows:
        if exclude_customer_id is not None and row.id == exclude_customer_id:
            continue
        if _normalize_phone_digits(row.phone) == normalized:
            return True
    return False


def _next_customer_number(db: Session) -> str:
    """Следующий человекочитаемый номер клиента: A00001, A00002, ... (5 цифр)."""
    rows = db.query(Customer.number).filter(Customer.number.isnot(None), Customer.number.like("A%")).all()
    max_n = 0
    for (num,) in rows:
        if len(num) == 6 and num[0] == "A" and num[1:].isdigit():
            max_n = max(max_n, int(num[1:]))
    return f"A{max_n + 1:05d}"


def create(db: Session, *, actor_user_id: int | None = None, **data) -> Customer:
    payload = dict(data)
    if not payload.get("deal_status"):
        payload["deal_status"] = "in_progress"
    full_name = compute_full_name(
        payload.get("last_name"),
        payload.get("name"),
        payload.get("middle_name"),
    ) or payload.get("name", "")
    payload["full_name"] = full_name
    if payload.get("number") is None and getattr(Customer, "number", None) is not None:
        payload["number"] = _next_customer_number(db)
    obj = Customer(**payload)
    db.add(obj)
    db.flush()
    if actor_user_id:
        activity_service.log_event(
            db,
            actor_user_id,
            activity_service.EVENT_CUSTOMER_CREATED,
            entity_type="customer",
            entity_id=obj.id,
        )
    db.commit()
    db.refresh(obj)
    return obj


def create_customer_and_project(
    db: Session,
    *,
    actor_user_id: int,
    customer_data: dict,
    project_name: str = "Новый проект",
    project_status_id: int | None = None,
) -> tuple[Customer, Project]:
    """Клиент и стартовый проект в одной транзакции с записью в журнал активности."""
    payload = dict(customer_data)
    if not payload.get("deal_status"):
        payload["deal_status"] = "in_progress"
    full_name = compute_full_name(
        payload.get("last_name"),
        payload.get("name"),
        payload.get("middle_name"),
    ) or payload.get("name", "")
    payload["full_name"] = full_name
    if payload.get("number") is None and getattr(Customer, "number", None) is not None:
        payload["number"] = _next_customer_number(db)

    customer = Customer(**payload)
    db.add(customer)
    db.flush()
    activity_service.log_event(
        db,
        actor_user_id,
        activity_service.EVENT_CUSTOMER_CREATED,
        entity_type="customer",
        entity_id=customer.id,
    )

    project = Project(
        customer_id=customer.id,
        name=project_name,
        status_id=project_status_id,
        created_by_user_id=actor_user_id,
        project_number=next_project_number(db, customer.id),
    )
    db.add(project)
    db.flush()
    activity_service.log_event(
        db,
        actor_user_id,
        activity_service.EVENT_PROJECT_CREATED,
        entity_type="project",
        entity_id=project.id,
        project_id=project.id,
    )
    from app.services import notification_service

    notification_service.dispatch_customer_created(
        db,
        actor_user_id=actor_user_id,
        customer=customer,
        project=project,
    )
    db.commit()
    db.refresh(customer)
    db.refresh(project)
    return customer, project


def update(db: Session, customer_id: int, **data) -> Customer | None:
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        return None
    if any(k in data for k in ("name", "last_name", "middle_name")):
        data["full_name"] = compute_full_name(
            data.get("last_name", row.last_name),
            data.get("name", row.name),
            data.get("middle_name", row.middle_name),
        ) or (data.get("name") or row.name or "")
    for k, v in data.items():
        if k in _CUSTOMER_UPDATE_FIELDS and hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, customer_id: int) -> bool:
    """Удалить клиента вместе с проектами, спецификациями, заказами и КП."""
    try:
        if not delete_customer_bundle(db, customer_id):
            return False
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return True


def set_passport_scan(db: Session, customer_id: int, data: bytes, content_type: str | None = None) -> bool:
    """Сохранить скан паспорта (изображение) в БД. Возвращает True при успехе."""
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        return False
    row.passport_scan_data = data
    row.passport_scan_content_type = (content_type or "application/octet-stream")[:100]
    db.commit()
    return True


def clear_passport_scan(db: Session, customer_id: int) -> bool:
    """Удалить скан паспорта из БД. Возвращает True при успехе."""
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        return False
    row.passport_scan_data = None
    row.passport_scan_content_type = None
    db.commit()
    return True


def get_passport_scan(db: Session, customer_id: int) -> tuple[bytes, str] | None:
    """Получить скан паспорта (bytes, content_type) или None."""
    row = db.query(Customer.passport_scan_data, Customer.passport_scan_content_type).filter(
        Customer.id == customer_id
    ).first()
    if not row or not row.passport_scan_data:
        return None
    ct = (row.passport_scan_content_type or "application/octet-stream").strip() or "application/octet-stream"
    return (bytes(row.passport_scan_data), ct)
