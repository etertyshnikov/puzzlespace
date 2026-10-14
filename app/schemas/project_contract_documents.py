# -*- coding: utf-8 -*-
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectContractDocumentOut(BaseModel):
    id: int
    project_id: int
    document_id: str
    html_body: Optional[str] = None
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectContractDocumentUpdate(BaseModel):
    html_body: Optional[str] = Field(None, description="HTML содержимое документа")
