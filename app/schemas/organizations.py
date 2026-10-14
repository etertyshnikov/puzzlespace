# -*- coding: utf-8 -*-
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, field_serializer


def _serialize_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


class OrganizationBase(BaseModel):
    company_id: Optional[int] = None
    name: str
    inn: Optional[str] = None
    kpp: Optional[str] = None
    address: Optional[str] = None
    bank: Optional[str] = None
    bank_account: Optional[str] = None
    bik: Optional[str] = None
    director_name: Optional[str] = None
    director_position: Optional[str] = None
    is_default: bool = False


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    company_id: Optional[int] = None
    name: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    address: Optional[str] = None
    bank: Optional[str] = None
    bank_account: Optional[str] = None
    bik: Optional[str] = None
    director_name: Optional[str] = None
    director_position: Optional[str] = None
    is_default: Optional[bool] = None


class OrganizationOut(OrganizationBase):
    id: int
    company_name: Optional[str] = None
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("created_on", "modified_on")
    def _serialize_datetime(self, dt: datetime | None) -> str | None:
        return _serialize_utc(dt)


def build_organization_out(row, *, company_name: str | None = None) -> OrganizationOut:
    out = OrganizationOut.model_validate(row, from_attributes=True)
    updates: dict = {}
    if company_name is not None:
        updates["company_name"] = company_name
    return out.model_copy(update=updates) if updates else out
