# -*- coding: utf-8 -*-
from pydantic import BaseModel


class PrintSettingsBase(BaseModel):
    margin_top_mm: int = 20
    margin_bottom_mm: int = 25
    margin_left_mm: int = 15
    margin_right_mm: int = 15
    font_size_pt: int = 12
    font_family: str = "Arial, sans-serif"


class PrintSettingsUpdate(BaseModel):
    margin_top_mm: int | None = None
    margin_bottom_mm: int | None = None
    margin_left_mm: int | None = None
    margin_right_mm: int | None = None
    font_size_pt: int | None = None
    font_family: str | None = None


class PrintSettingsOut(PrintSettingsBase):
    id: int

    class Config:
        from_attributes = True
