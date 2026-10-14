# -*- coding: utf-8 -*-
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, field_validator

from app.services.customer import compute_full_name


CustomerDealStatus = Literal["in_progress", "success", "rejected"]
CustomerGender = Literal["male", "female"]
CustomerAgeBracket = Literal["18_24", "25_30", "31_40", "41_50", "51_plus"]

CUSTOMER_LEGAL_FIELDS = (
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


class CustomerBase(BaseModel):
    name: str
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    address: str
    deal_status: CustomerDealStatus = "in_progress"
    gender: Optional[CustomerGender] = None
    age_bracket: Optional[CustomerAgeBracket] = None
    lead_source_id: Optional[int] = None
    link: Optional[str] = None
    notes: Optional[str] = None
    comments: Optional[str] = None
    budget: Optional[float] = None
    passport_series: Optional[str] = None
    passport_number: Optional[str] = None
    passport_issued_by: Optional[str] = None
    passport_issue_date: Optional[date] = None
    passport_department_code: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
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


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    deal_status: Optional[CustomerDealStatus] = None
    gender: Optional[CustomerGender] = None
    age_bracket: Optional[CustomerAgeBracket] = None
    lead_source_id: Optional[int] = None
    link: Optional[str] = None
    notes: Optional[str] = None
    comments: Optional[str] = None
    budget: Optional[float] = None
    passport_series: Optional[str] = None
    passport_number: Optional[str] = None
    passport_issued_by: Optional[str] = None
    passport_issue_date: Optional[date] = None
    passport_department_code: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
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


class CustomerOut(CustomerBase):
    id: int
    number: Optional[str] = None
    full_name: Optional[str] = None
    has_passport_scan: bool = False
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None

    @field_validator("budget", mode="before")
    @classmethod
    def coerce_budget(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, Decimal):
            return float(v)
        return float(v)

    class Config:
        from_attributes = True


def build_customer_out(row, *, created_by_name: str | None = None) -> "CustomerOut":
    """Собирает CustomerOut с гарантированными legal_* (даже если ORM/схема отстают)."""
    out = CustomerOut.model_validate(row, from_attributes=True)
    legal_updates = {field: getattr(row, field, None) for field in CUSTOMER_LEGAL_FIELDS}
    if created_by_name is not None:
        legal_updates["created_by_name"] = created_by_name
    computed_full_name = compute_full_name(
        getattr(row, "last_name", None),
        getattr(row, "name", None),
        getattr(row, "middle_name", None),
    ) or (getattr(row, "name", None) or "")
    legal_updates["full_name"] = computed_full_name
    return out.model_copy(update=legal_updates)
