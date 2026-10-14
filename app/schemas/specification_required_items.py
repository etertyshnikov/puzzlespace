# -*- coding: utf-8 -*-
from typing import Optional
from pydantic import BaseModel


class SpecificationRequiredItemOut(BaseModel):
    id: int
    spec_id: int
    part_id: int
    template_id: int
    required_qty: float = 0
    added_qty: float = 0

    class Config:
        from_attributes = True


class SpecificationRequiredItemCreate(BaseModel):
    spec_id: int
    part_id: int
    template_id: int
    required_qty: float = 0
    added_qty: float = 0


class SpecificationRequiredItemUpdate(BaseModel):
    spec_id: Optional[int] = None
    part_id: Optional[int] = None
    template_id: Optional[int] = None
    required_qty: Optional[float] = None
    added_qty: Optional[float] = None
