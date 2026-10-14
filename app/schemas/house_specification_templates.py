# -*- coding: utf-8 -*-
from pydantic import BaseModel


class HouseSpecificationTemplateOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class HouseSpecificationTemplateCreate(BaseModel):
    name: str


class HouseSpecificationTemplateUpdate(BaseModel):
    name: str | None = None
