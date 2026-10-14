# -*- coding: utf-8 -*-
from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.project_contract_data import ProjectContractDataUpdate


class ContractDocumentPdfRequest(BaseModel):
    document_id: str
    html_body: Optional[str] = None
    contract_data: Optional[ProjectContractDataUpdate] = None
    customer: Optional[dict[str, Any]] = None
    specification_id: Optional[int] = None
    filename: Optional[str] = None
