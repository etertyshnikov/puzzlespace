# -*- coding: utf-8 -*-
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, field_serializer


def _serialize_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace('+00:00', 'Z')


class ContractTemplateBase(BaseModel):
    code: str
    title: str
    body: Optional[str] = None


class ContractTemplateCreate(ContractTemplateBase):
    pass


class ContractTemplateUpdate(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None


class ContractTemplateOut(ContractTemplateBase):
    id: int
    sort_order: int = 0
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("created_on", "modified_on")
    def _serialize_datetime(self, dt: datetime | None) -> str | None:
        return _serialize_utc(dt)


class ContractTemplateReorder(BaseModel):
    ids: list[int]
