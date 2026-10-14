# -*- coding: utf-8 -*-
from typing import Optional
from pydantic import BaseModel


class PartOut(BaseModel):
    id: int
    name: str
    sort_order: int = 0

    class Config:
        from_attributes = True


class PartCreate(BaseModel):
    name: str
    sort_order: Optional[int] = None


class PartUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class PartReorder(BaseModel):
    ids: list[int]
