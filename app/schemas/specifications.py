# -*- coding: utf-8 -*-
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class SpecificationBase(BaseModel):
    customer_id: int
    project_id: Optional[int] = None
    status_id: int
    description: Optional[str] = None
    total_amount: Optional[float] = None
    kp_approved: Optional[bool] = False
    kp_internal_comment: Optional[str] = None  # название в договоре
    comment: Optional[str] = None  # комментарий (список спецификаций)
    length_m: Optional[float] = None  # длина дома, м
    width_m: Optional[float] = None  # ширина дома, м
    terrace_length_m: Optional[float] = None  # длина террасы, м
    terrace_width_m: Optional[float] = None  # ширина террасы, м
    balcony_length_m: Optional[float] = None  # длина балкона, м
    terrace_second_floor: Optional[bool] = False  # терраса на втором этаже
    floors: Optional[int] = None  # этажность
    room_count: Optional[int] = None  # количество комнат
    double_timber: Optional[bool] = False  # двойной брус
    wall_height_m: Optional[float] = None  # высота k для площади стен комнат, м
    building_type: Literal["house", "banya"] = "house"  # Дом / Баня


class SpecificationCreate(SpecificationBase):
    """При создании без габаритов подставляются длина 5 м, ширина 6 м, этажность 1."""

    length_m: float = Field(default=5, description="Длина по умолчанию, м")
    width_m: float = Field(default=6, description="Ширина по умолчанию, м")
    floors: int = Field(default=1, ge=1, description="Этажность по умолчанию")
    room_count: int = Field(default=1, ge=1, description="Количество комнат по умолчанию")
    wall_height_m: float = Field(default=2.8, gt=0, description="Высота k по умолчанию, м")


class SpecificationUpdate(BaseModel):
    kp_approved: Optional[bool] = None
    kp_internal_comment: Optional[str] = None
    comment: Optional[str] = None
    description: Optional[str] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    terrace_length_m: Optional[float] = None
    terrace_width_m: Optional[float] = None
    balcony_length_m: Optional[float] = None
    terrace_second_floor: Optional[bool] = None
    floors: Optional[int] = None
    room_count: Optional[int] = None
    double_timber: Optional[bool] = None
    wall_height_m: Optional[float] = None
    building_type: Optional[Literal["house", "banya"]] = None


class SpecificationOut(SpecificationBase):
    id: int
    number: Optional[str] = None  # человекочитаемый номер A00001-P01-S01
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None

    @field_validator(
        "total_amount",
        "length_m",
        "width_m",
        "terrace_length_m",
        "terrace_width_m",
        "balcony_length_m",
        "wall_height_m",
        mode="before",
    )
    @classmethod
    def coerce_numeric_optional(cls, v: Any) -> Optional[float]:
        return _coerce_decimal(v)

    @field_validator("building_type", mode="before")
    @classmethod
    def normalize_building_type(cls, v: Any) -> str:
        if v is None or v == "":
            return "house"
        key = str(v).strip().lower()
        return key if key in ("house", "banya") else "house"

    class Config:
        from_attributes = True


class SpecificationItemBase(BaseModel):
    specification_id: int
    item_name: str
    quantity: Optional[float] = 1
    unit: Optional[str] = "шт"
    price: Optional[float] = 0
    discount_percent: Optional[float] = 0
    total: Optional[float] = 0
    description: Optional[str] = None


def _coerce_decimal(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return v


class SpecificationItemOut(SpecificationItemBase):
    id: int
    part_id: Optional[int] = None
    template_id: Optional[int] = None
    nomenclature_item_id: Optional[int] = None
    nomenclature_name: Optional[str] = None  # название из номенклатуры по nomenclature_item_id
    qty_basis: Optional[str] = None
    qty_multiplier: Optional[float] = None
    qty_use_floors: Optional[bool] = None
    quantity_auto: Optional[float] = None
    quantity_manual: Optional[float] = None
    template_line_no: Optional[int] = None
    include_in_total: bool = True

    @field_validator("quantity", "price", "discount_percent", "total", "quantity_auto", "quantity_manual", "qty_multiplier", mode="before")
    @classmethod
    def coerce_numeric(cls, v: Any) -> Optional[float]:
        return _coerce_decimal(v)

    class Config:
        from_attributes = True


class SpecificationItemCreate(BaseModel):
    specification_id: int
    part_id: Optional[int] = None
    template_id: Optional[int] = None
    nomenclature_item_id: Optional[int] = None
    item_name: str
    quantity: float = 1
    unit: str = "шт"
    price: float = 0
    discount_percent: float = 0
    total: float = 0
    description: Optional[str] = None


class SpecificationItemUpdate(BaseModel):
    specification_id: Optional[int] = None
    part_id: Optional[int] = None
    template_id: Optional[int] = None
    nomenclature_item_id: Optional[int] = None
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    quantity_manual: Optional[float] = None  # null в JSON — сбросить ручное, снова брать авто
    unit: Optional[str] = None
    price: Optional[float] = None
    discount_percent: Optional[float] = None
    total: Optional[float] = None
    description: Optional[str] = None
    qty_basis: Optional[str] = None
    qty_multiplier: Optional[float] = None
    qty_use_floors: Optional[bool] = None
    include_in_total: Optional[bool] = None


class SpecificationItemAddBody(BaseModel):
    """Тело запроса для добавления позиции в спецификацию (specification_id берётся из URL)."""
    nomenclature_item_id: Optional[int] = None
    item_name: str = "—"
    part_id: Optional[int] = None
    template_id: Optional[int] = None
    quantity: float = 1
    unit: str = "шт"
    price: float = 0
    discount_percent: float = 0
    description: Optional[str] = None


class ApplyHouseTemplateBody(BaseModel):
    house_specification_template_id: int
