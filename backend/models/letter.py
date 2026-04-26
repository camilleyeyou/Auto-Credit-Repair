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
    # Phase 6 extension — letter type for non-initial branches
    letter_type: Optional[str] = None
    # initial | demand | escalation | mov | validation | goodwill | pay_for_delete | identity_theft_block
    original_sent_date: Optional[str] = None    # ISO date, used in demand letter narrative
    bureau_outcome_summary: Optional[str] = None  # used in escalation letter narrative
    # Recipient fields for non-bureau letters (collector / creditor address).
    # User-supplied via the relevant generation dialog.
    collector_name:    Optional[str] = None
    collector_address: Optional[str] = None     # multi-line address (use \n)
    # Pay-for-delete: dollar amount the consumer offers
    offer_amount: Optional[str] = None          # e.g. "$250" or "250.00"
    # Identity theft block: FTC IdentityTheft.gov report number (or police report)
    ftc_report_number: Optional[str] = None


class LetterResponse(BaseModel):
    letter_html: str      # full rendered HTML stored in dispute_letters.letterContent
    pdf_base64: str       # base64-encoded PDF bytes uploaded to Convex Storage by action
