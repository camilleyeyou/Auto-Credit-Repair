"""
Pydantic models for the normalized ParsedReport output.

Schema per decisions D-18 through D-22.
Security: account_number_last4 stores ONLY last 4 digits — never full account numbers.
"""
from pydantic import BaseModel
from typing import Optional


class ImageOnlyPDFError(Exception):
    """Raised when a PDF contains fewer than 100 characters of extractable text.

    Per D-17: image-only (scanned) PDFs cannot be parsed. The caller should
    set parse_status = "image_only" and surface a warning to the user.
    """
    pass


class Tradeline(BaseModel):
    creditor_name: str
    account_number_last4: Optional[str] = None   # Only last 4 digits — never full number
    account_type: Optional[str] = None
    balance: Optional[float] = None
    status: Optional[str] = None
    payment_history: Optional[list[str]] = None
    date_opened: Optional[str] = None
    date_reported: Optional[str] = None
    date_of_first_delinquency: Optional[str] = None  # DOFD — leave None if not found (D-19, Pitfall 7)


class NegativeItem(Tradeline):
    reason_negative: Optional[str] = None  # late_payment | collection | charge_off | bankruptcy | other


class ParsedReport(BaseModel):
    bureau: str                          # experian | equifax | transunion
    personal_info: dict                  # Extracted but NOT sent to AI (D-21)
    accounts: list[Tradeline]
    negative_items: list[NegativeItem]
    inquiries: list[dict]
    public_records: list[dict]
    raw_text: Optional[str] = None       # Stored for debugging (D-22)
    confidence: float                    # 0.0–1.0 (D-25)
    parse_warnings: list[str]            # e.g., "DOFD not found for 3 accounts"
    parse_status: str = "done"           # "done" | "image_only"
