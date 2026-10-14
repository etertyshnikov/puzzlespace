# -*- coding: utf-8 -*-
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, field_validator


class HouseTemplateOut(BaseModel):
    id: int
    house_specification_template_id: Optional[int] = None
    part_id: Optional[int] = None
    required_item_template_id: Optional[int] = None
    nomenclature_item_id: Optional[int] = None
    unit: str = "шт"
    quantity: float = 1
    price: Optional[float] = None
    comment: Optional[str] = None
    qty_basis: Optional[str] = None  # fixed | perimeter | … | linked_wall_kit_qty | area
    qty_multiplier: Optional[float] = None
    qty_use_floors: Optional[bool] = None

    @field_validator("quantity", "price", "qty_multiplier", mode="before")
    @classmethod
    def coerce_decimal(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, Decimal):
            return float(v)
        return v

    class Config:
        from_attributes = True


class HouseTemplateCreate(BaseModel):
    house_specification_template_id: Optional[int] = None
    part_id: Optional[int] = None
    required_item_template_id: Optional[int] = None
    nomenclature_item_id: Optional[int] = None
    unit: str = "шт"
    quantity: float = 1
    price: Optional[float] = None
    comment: Optional[str] = None
    qty_basis: Optional[str] = None
    qty_multiplier: Optional[float] = None
    qty_use_floors: Optional[bool] = True


class HouseTemplateUpdate(BaseModel):
    house_specification_template_id: Optional[int] = None
    part_id: Optional[int] = None
    required_item_template_id: Optional[int] = None
    nomenclature_item_id: Optional[int] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    comment: Optional[str] = None
    qty_basis: Optional[str] = None
    qty_multiplier: Optional[float] = None
    qty_use_floors: Optional[bool] = None
