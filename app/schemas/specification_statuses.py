# -*- coding: utf-8 -*-
from typing import Optional
from pydantic import BaseModel


class SpecificationStatusBase(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class SpecificationStatusCreate(SpecificationStatusBase):
    pass


class SpecificationStatusUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class SpecificationStatusOut(SpecificationStatusBase):
    id: int

    class Config:
        from_attributes = True
