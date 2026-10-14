# -*- coding: utf-8 -*-
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models import ProjectContractData
from app.schemas.project_contract_data import dump_buyer_legal_json
from app.services import specification as spec_service
from app.utils.num_to_words import amount_to_words


def get_by_project_id(db: Session, project_id: int) -> ProjectContractData | None:
    return db.query(ProjectContractData).filter(ProjectContractData.project_id == project_id).first()


def _is_kp_approved(spec) -> bool:
    """Согласовано ли КП: учитываем True и 1 (в БД может быть 0/1)."""
    v = getattr(spec, "kp_approved", None)
    if v is True:
        return True
    if isinstance(v, int) and v == 1:
        return True
    return False


def sync_from_agreed_specs(db: Session, row: ProjectContractData, project_id: int | None = None) -> None:
    """
    Обновляет house_kits_count, contract_supply_amount, prepayment и balance
    по согласованным КП проекта.
    Предоплата и остаток пересчитываются только если сумма договора изменилась.
    """
    pid = project_id if project_id is not None else row.project_id
    specs = spec_service.list_by_project(db, pid)
    agreed = [s for s in specs if _is_kp_approved(s)]
    total = sum(
        float(getattr(s, "total_amount", 0) or 0)
        for s in agreed
    )
    old_total = float(row.contract_supply_amount) if row.contract_supply_amount is not None else None
    new_total = round(total, 2) if agreed else None
    total_changed = old_total != new_total

    row.house_kits_count = len(agreed)
    if agreed:
        row.contract_supply_amount = Decimal(str(new_total))
        row.contract_supply_amount_words = amount_to_words(new_total)
        if total_changed:
            prepayment = round(total * 0.5, 2)
            balance = round(total - prepayment, 2)
            row.prepayment_amount = Decimal(str(prepayment))
            row.prepayment_words = amount_to_words(prepayment)
            row.balance_amount = Decimal(str(balance))
            row.balance_words = amount_to_words(balance)
    else:
        row.contract_supply_amount = None
        row.contract_supply_amount_words = None
        if total_changed:
            row.prepayment_amount = None
            row.prepayment_words = None
            row.balance_amount = None
            row.balance_words = None


def get_or_create_for_project(db: Session, project_id: int) -> ProjectContractData:
    row = get_by_project_id(db, project_id)
    if row:
        db.refresh(row)  # перезагрузка из БД, чтобы были все колонки и актуальные данные
        sync_from_agreed_specs(db, row, project_id=project_id)
        db.flush()
        db.commit()
        db.refresh(row)
        return row
    row = ProjectContractData(project_id=project_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    sync_from_agreed_specs(db, row, project_id=project_id)
    db.flush()
    db.commit()
    db.refresh(row)
    return row


def update_for_project(db: Session, project_id: int, **data) -> ProjectContractData:
    row = get_or_create_for_project(db, project_id)
    # Автозаполнение прописью для предоплаты и остатка, если передана сумма, а слова — нет
    prepayment_amount = data.get("prepayment_amount")
    if prepayment_amount is not None and data.get("prepayment_words") is None:
        try:
            data["prepayment_words"] = amount_to_words(prepayment_amount)
        except Exception:
            data["prepayment_words"] = None
    balance_amount = data.get("balance_amount")
    if balance_amount is not None and data.get("balance_words") is None:
        try:
            data["balance_words"] = amount_to_words(balance_amount)
        except Exception:
            data["balance_words"] = None
    if "buyer_legal_json" in data:
        row.buyer_legal_json = dump_buyer_legal_json(data.pop("buyer_legal_json"))
    for k, v in data.items():
        if hasattr(row, k) and k not in ("contract_supply_amount", "house_kits_count", "contract_supply_amount_words"):
            setattr(row, k, v)
    sync_from_agreed_specs(db, row, project_id=project_id)  # всегда пересчитываем из согласованных КП
    db.flush()
    db.commit()
    db.refresh(row)
    return row
