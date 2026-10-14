# -*- coding: utf-8 -*-
from typing import Optional
from pydantic import BaseModel


class BranchOut(BaseModel):
    id: int
    name: str
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class LeadSourceOut(BaseModel):
    id: int
    name: str
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class LeadSourceCreate(BaseModel):
    name: str
    is_active: bool = True
    sort_order: int = 0


class LeadSourceUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
