# -*- coding: utf-8 -*-
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal, Optional, Any
from pydantic import BaseModel, field_serializer, field_validator

BuyerPartyType = Literal["individual", "legal"]

LEGAL_JSON_KEYS = (
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
)


class BuyerLegalData(BaseModel):
    """Устаревшее: реквизиты юр. лица хранятся в customers.legal_* (поле buyer_legal_json в БД не используется)."""

    legal_company_name: Optional[str] = None
    legal_inn: Optional[str] = None
    legal_kpp: Optional[str] = None
    legal_ogrn: Optional[str] = None
    legal_company_address: Optional[str] = None
    legal_bank: Optional[str] = None
    legal_bank_account: Optional[str] = None
    legal_bik: Optional[str] = None
    legal_signatory_name: Optional[str] = None
    legal_signatory_basis: Optional[str] = None


def parse_buyer_legal_json_value(v: Any) -> Optional[dict[str, Any]]:
    if v is None or v == "":
        return None
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            parsed = json.loads(v)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def dump_buyer_legal_json(data: BuyerLegalData | dict[str, Any] | None) -> str | None:
    if data is None:
        return None
    if isinstance(data, BuyerLegalData):
        payload = data.model_dump()
    else:
        payload = {k: data.get(k) for k in LEGAL_JSON_KEYS if k in data}
    if not any(v not in (None, "") for v in payload.values()):
        return None
    return json.dumps(payload, ensure_ascii=False)


def _serialize_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace('+00:00', 'Z')


class ProjectContractDataBase(BaseModel):
    contract_date: Optional[date] = None
    city: Optional[str] = None
    contract_supply_amount: Optional[Decimal] = None  # сумма согласованных КП (только для чтения/синхронизации)
    contract_supply_amount_words: Optional[str] = None  # сумма договора поставки прописью
    house_kits_count: Optional[int] = None  # количество согласованных КП
    prepayment_amount: Optional[Decimal] = None
    prepayment_words: Optional[str] = None
    balance_amount: Optional[Decimal] = None
    balance_words: Optional[str] = None
    delivery_deadline: Optional[date] = None
    buyer_party_type: BuyerPartyType = "individual"
    buyer_legal_json: Optional[dict[str, Any]] = None  # legacy, только чтение из БД

    @field_validator("buyer_legal_json", mode="before")
    @classmethod
    def _parse_buyer_legal_json_base(cls, v: Any) -> Optional[dict[str, Any]]:
        return parse_buyer_legal_json_value(v)

    @field_validator("buyer_party_type", mode="before")
    @classmethod
    def normalize_buyer_party_type(cls, v: Any) -> str:
        if isinstance(v, str) and v.strip().lower() == "legal":
            return "legal"
        return "individual"


class ProjectContractDataUpdate(BaseModel):
    contract_date: Optional[date] = None
    city: Optional[str] = None
    house_kits_count: Optional[int] = None
    prepayment_amount: Optional[Decimal] = None
    prepayment_words: Optional[str] = None
    balance_amount: Optional[Decimal] = None
    balance_words: Optional[str] = None
    delivery_deadline: Optional[date] = None
    buyer_party_type: Optional[BuyerPartyType] = None

    @field_validator("buyer_party_type", mode="before")
    @classmethod
    def normalize_buyer_party_type_update(cls, v: Any) -> str | None:
        if v is None or v == "":
            return None
        if isinstance(v, str) and v.strip().lower() == "legal":
            return "legal"
        return "individual"

    @field_validator("contract_date", "delivery_deadline", mode="before")
    @classmethod
    def empty_str_to_none_date(cls, v: Any) -> Optional[date]:
        if v is None or v == "":
            return None
        return v

    @field_validator("city", "prepayment_words", "balance_words", mode="before")
    @classmethod
    def empty_str_to_none_str(cls, v: Any) -> Optional[str]:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return None
        return v

    @field_validator("prepayment_amount", "balance_amount", mode="before")
    @classmethod
    def coerce_decimal(cls, v: Any) -> Optional[Decimal]:
        if v is None or v == "":
            return None
        try:
            if isinstance(v, (int, float)):
                return Decimal(str(v))
            if isinstance(v, str):
                return Decimal(v.replace(",", ".").replace(" ", ""))
            return v
        except (ValueError, Exception):
            return None


class ProjectContractDataOut(ProjectContractDataBase):
    id: int
    project_id: int
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("created_on", "modified_on")
    def _serialize_datetime(self, dt: datetime | None) -> str | None:
        return _serialize_utc(dt)
