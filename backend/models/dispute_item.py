"""Pydantic models for AI dispute analysis output."""
from pydantic import BaseModel
from typing import Optional


class DisputeItemOut(BaseModel):
    """A single dispute item returned by the AI analyzer."""
    creditor_name: str
    account_number_last4: Optional[str] = None
    item_type: str
    description: str
    dispute_reason: str
    fcra_section: str          # e.g. "611"
    fcra_section_title: str    # e.g. "Right to Dispute" — denormalized for UI
    fcra_section_usc: str      # e.g. "15 U.S.C. § 1681i"
    ai_confidence: float       # 0.0–1.0
    citation_validated: bool   # True if fcra_section was in FCRA_LIBRARY


class AnalyzeResponse(BaseModel):
    """Response from POST /api/reports/{report_id}/analyze."""
    dispute_items: list[DisputeItemOut]
    reused: bool = False       # True if returning cached results without calling Claude
