# -*- coding: utf-8 -*-
from typing import Optional
from pydantic import BaseModel


class RequiredItemTemplateOut(BaseModel):
    id: int
    part_id: int
    name: str
    required_qty: float = 1
    unit: str = "шт"

    class Config:
        from_attributes = True


class RequiredItemTemplateCreate(BaseModel):
    part_id: int
    name: str
    required_qty: float = 1
    unit: str = "шт"


class RequiredItemTemplateUpdate(BaseModel):
    part_id: Optional[int] = None
    name: Optional[str] = None
    required_qty: Optional[float] = None
    unit: Optional[str] = None
