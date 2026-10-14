# -*- coding: utf-8 -*-
from typing import Optional

from pydantic import BaseModel


class RequiredItemMaterialOut(BaseModel):
    id: int
    required_item_template_id: int
    nomenclature_id: int

    class Config:
        from_attributes = True


class RequiredItemMaterialCreate(BaseModel):
    required_item_template_id: int
    nomenclature_id: int


class RequiredItemMaterialUpdate(BaseModel):
    required_item_template_id: Optional[int] = None
    nomenclature_id: Optional[int] = None
