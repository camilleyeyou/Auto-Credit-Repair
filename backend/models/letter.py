"""
Pydantic models for the letter generation endpoint.

Per D-09: POST /api/letters/generate accepts LetterRequest and returns LetterResponse.
Per D-04: User profile fields (full_name, street_address, city, state, zip_code) are
          passed in from the Convex action (sourced from the users table).
Per research Pattern 1.
"""
from typing import Optional
from pydantic import BaseModel


class LetterRequest(BaseModel):
    bureau: str                          # "experian" | "equifax" | "transunion"
    creditor_name: str
    account_number_last4: Optional[str] = None
    dispute_reason: str
    fcra_section: str                    # e.g. "611"
    fcra_section_title: str              # e.g. "Right to Dispute"
    fcra_section_usc: str                # e.g. "15 U.S.C. § 1681i"
    # User profile fields (per D-04)
    full_name: str
    street_address: str
    city: str
    state: str
    zip_code: str
    # Phase 6 extension — letter type for demand/escalation branches
    letter_type: Optional[str] = None           # "initial" | "demand" | "escalation"
    original_sent_date: Optional[str] = None    # ISO date, used in demand letter narrative
    bureau_outcome_summary: Optional[str] = None  # used in escalation letter narrative


class LetterResponse(BaseModel):
    letter_html: str      # full rendered HTML stored in dispute_letters.letterContent
    pdf_base64: str       # base64-encoded PDF bytes uploaded to Convex Storage by action
