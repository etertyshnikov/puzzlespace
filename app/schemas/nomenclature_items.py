# -*- coding: utf-8 -*-
from datetime import date
from decimal import Decimal
from typing import Any, Optional
from pydantic import BaseModel, field_validator


class NomenclatureItemOut(BaseModel):
    id: int
    item_number: str
    name: Optional[str] = None
    part_id: Optional[int] = None
    item_date: Optional[date] = None
    unit: str = "шт"
    unit_alt: Optional[str] = None
    total_cost: float = 0
    price_alt: Optional[float] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True

    @field_validator("total_cost", mode="before")
    @classmethod
    def coerce_total_cost(cls, v: Any) -> float:
        if v is None:
            return 0.0
        if isinstance(v, Decimal):
            return float(v)
        return float(v)

    @field_validator("price_alt", mode="before")
    @classmethod
    def coerce_price_alt(cls, v: Any) -> float | None:
        if v is None:
            return None
        if isinstance(v, Decimal):
            return float(v)
        return float(v)


class NomenclatureItemCreate(BaseModel):
    item_number: Optional[str] = None  # пустое — авто: POZ_N000001, …
    name: Optional[str] = None
    part_id: Optional[int] = None
    item_date: Optional[date] = None
    unit: str = "шт"
    unit_alt: Optional[str] = None
    total_cost: float = 0
    price_alt: Optional[float] = None
    description: Optional[str] = None


class NomenclatureItemUpdate(BaseModel):
    item_number: Optional[str] = None
    name: Optional[str] = None
    part_id: Optional[int] = None
    item_date: Optional[date] = None
    unit: Optional[str] = None
    unit_alt: Optional[str] = None
    total_cost: Optional[float] = None
    price_alt: Optional[float] = None
    description: Optional[str] = None
