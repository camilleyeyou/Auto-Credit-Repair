"""
Pydantic models for the bureau response parsing endpoint.

POST /api/responses/parse accepts a Convex Storage PDF URL + bureau,
extracts dispute outcome via Claude tool_use, returns structured JSON.
"""
from typing import Optional, Literal
from pydantic import BaseModel


class BureauResponseParseRequest(BaseModel):
    pdf_url: str                          # Convex Storage signed URL
    bureau: Literal["experian", "equifax", "transunion"]


class BureauResponseOut(BaseModel):
    outcome: Literal["verified", "deleted", "corrected", "no_response", "unknown"]
    account_name: Optional[str] = None
    response_date: Optional[str] = None  # ISO 8601 or None
    reason_code: Optional[str] = None
