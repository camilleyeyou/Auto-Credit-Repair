"""
AI analysis service — all Claude API interaction is encapsulated here.

Per D-01 (API key security): Claude calls only happen in FastAPI, never in Convex.
Per D-02/D-05: FCRA section constrained by enum in tool schema.
Per D-07/D-09: personal_info is NEVER included in the Claude prompt payload.
Per D-11/D-12: FCRA_LIBRARY values are exact — do not alter.
Per D-13/D-15: Dual-defense against FCRA hallucination:
    1. fcra_section enum constraint in tool definition (prompt-level)
    2. validate_fcra_section() post-call pass on every returned item
"""
import json
import logging
import os
from typing import Optional

import anthropic

from models.dispute_item import DisputeItemOut
from models.parsed_report import ParsedReport

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# FCRA library — exact values per D-11, D-12. Do NOT alter.
# ---------------------------------------------------------------------------

FCRA_LIBRARY = {
    "611": {
        "title": "Right to Dispute",
        "usc": "15 U.S.C. § 1681i",
        "description": "Consumer's right to dispute inaccurate information; bureau must investigate within 30 days.",
    },
    "623": {
        "title": "Furnisher Obligations",
        "usc": "15 U.S.C. § 1681s-2",
        "description": "Furnishers must investigate and correct inaccurate information when notified.",
    },
    "605": {
        "title": "Obsolete Information",
        "usc": "15 U.S.C. § 1681c",
        "description": "Most negative items must be removed after 7 years from Date of First Delinquency.",
    },
    "609": {
        "title": "Right to Disclosure",
        "usc": "15 U.S.C. § 1681g",
        "description": "Consumer's right to request their full credit file.",
    },
    "612": {
        "title": "Free Annual Reports",
        "usc": "15 U.S.C. § 1681j",
        "description": "Consumer's right to one free annual credit report per bureau.",
    },
}

FCRA_SECTION_ENUM = list(FCRA_LIBRARY.keys())  # ["611", "623", "605", "609", "612"]


# ---------------------------------------------------------------------------
# Claude tool definition — per D-02, D-05
# ---------------------------------------------------------------------------

ANALYZE_TOOL = {
    "name": "report_dispute_items",
    "description": (
        "Analyze a consumer credit report and flag items with a SPECIFIC, ARTICULABLE "
        "factual reason to dispute. Bureaus dismiss generic shotgun disputes as frivolous "
        "under FCRA § 611(a)(3) — vague disputes never start the 30-day investigation clock. "
        "Each flagged item must have a concrete, item-specific reason: wrong balance, "
        "wrong dates, not the consumer's account, paid but reported open, duplicate "
        "tradeline, mixed file, obsolete under § 605, or identity theft. "
        "Skip items that are accurate and timely with no factual angle for dispute. "
        "Cap output at 5 items per bureau per round — quality over quantity. "
        "Use hedged language — never guarantee removal. "
        "Use only the provided fcra_section values."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "dispute_items": {
                "type": "array",
                "description": "List of disputable items found in the credit report.",
                "items": {
                    "type": "object",
                    "properties": {
                        "creditor_name": {
                            "type": "string",
                            "description": "Name of the creditor or furnisher.",
                        },
                        "account_number_last4": {
                            "type": "string",
                            "description": "Last 4 digits of account number, if available.",
                        },
                        "item_type": {
                            "type": "string",
                            "enum": [
                                "late_payment",
                                "collection",
                                "charge_off",
                                "bankruptcy",
                                "inquiry",
                                "public_record",
                                "other",
                            ],
                            "description": "Category of the disputable item.",
                        },
                        "description": {
                            "type": "string",
                            "description": "Clear description of the item as it appears on the report.",
                        },
                        "dispute_reason": {
                            "type": "string",
                            "description": (
                                "Item-specific dispute reasoning — explain exactly why this "
                                "particular item may be inaccurate, unverifiable, or obsolete. "
                                "Do not use generic boilerplate."
                            ),
                        },
                        "fcra_section": {
                            "type": "string",
                            "enum": FCRA_SECTION_ENUM,
                            "description": (
                                "The FCRA section supporting this dispute. "
                                "Use 605 for obsolete items (7-year rule). "
                                "Use 623 for furnisher inaccuracies. "
                                "Use 611 for general disputes. "
                                "Use 609 for disclosure issues. "
                                "Use 612 for free report rights."
                            ),
                        },
                        "confidence_score": {
                            "type": "number",
                            "minimum": 0.0,
                            "maximum": 1.0,
                            "description": "Confidence that this item is genuinely disputable (0.0–1.0).",
                        },
                    },
                    "required": [
                        "creditor_name",
                        "item_type",
                        "description",
                        "dispute_reason",
                        "fcra_section",
                        "confidence_score",
                    ],
                },
            }
        },
        "required": ["dispute_items"],
    },
}


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are a careful, strategic credit repair analyst. Your job is to identify items "
    "on a consumer's credit report that have a SPECIFIC, ARTICULABLE factual basis for "
    "dispute — not blanket challenges to every negative item.\n\n"
    "## Critical strategic context\n\n"
    "FCRA § 611(a)(3) lets bureaus dismiss disputes that are 'frivolous or irrelevant.' "
    "Shotgun disputes (challenging every negative item without specific reasons) are the #1 "
    "thing bureau fraud filters target. They never start the 30-day investigation clock — "
    "they get suppressed within 5 days. Quality beats quantity every time.\n\n"
    "## What makes a strong dispute\n\n"
    "Flag an item ONLY when you can articulate a concrete, factual reason from the data:\n"
    "1. **Inaccurate data** — balance doesn't match payment history, dates inconsistent, "
    "status conflicts with payment record (e.g., reported open but last payment 3 years ago)\n"
    "2. **Obsolete under § 605** — collections/charge-offs >7 years + 180 days from "
    "date_of_first_delinquency; bankruptcies >10 years old\n"
    "3. **Missing required fields** — no date_of_first_delinquency on a negative tradeline "
    "(furnisher cannot verify obsolescence)\n"
    "4. **Duplicate tradeline** — same account appearing twice\n"
    "5. **Identity discrepancies** — creditor name unfamiliar, account opened during a known "
    "identity-theft window (this needs the consumer's input, so flag for their review)\n"
    "6. **Hard inquiries** — only flag inquiries within 24 months that lack a clear "
    "matching tradeline (suggesting unauthorized inquiry)\n\n"
    "## What NOT to flag\n\n"
    "- Accurate, timely negative items with no factual angle to challenge\n"
    "- Positive accounts in good standing\n"
    "- Items where you can't point to a specific data inconsistency\n\n"
    "## Output rules\n\n"
    "1. **Cap: maximum 5 items per analysis.** Bureaus correlate dispute volume with "
    "frivolous-flag risk. Pick the 5 with strongest factual angles.\n"
    "2. Each item must have item-specific reasoning that points to actual data in the report. "
    "Do NOT use generic boilerplate like 'requires verification.'\n"
    "3. Pick the strongest applicable FCRA section:\n"
    "   - § 605: obsolete items past 7 years from DOFD (or 10 years for bankruptcy)\n"
    "   - § 623: furnisher inaccuracies (wrong balance/dates/status/payment history)\n"
    "   - § 611: general disputes only when § 623 or § 605 don't fit\n"
    "   - § 609: disclosure issues, account ownership disputes\n"
    "4. Use hedged language: 'appears to be inaccurate,' 'cannot be verified from the data,' "
    "'requires furnisher confirmation.' Never guarantee removal.\n"
    "5. Confidence scoring:\n"
    "   - 0.85+: clearly inaccurate (data conflict visible) or clearly obsolete\n"
    "   - 0.60–0.84: missing required field (DOFD), duplicate, or inquiry without matching tradeline\n"
    "   - Below 0.60: skip — too weak to risk frivolous-flag\n"
    "6. If there are no items meeting these criteria, return an empty array. Do NOT fabricate.\n"
    "7. For § 605 obsolete calculations: today's date - date_of_first_delinquency. If DOFD "
    "is null/missing, classify as 'missing required field' (still strong) rather than assuming."
)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_fcra_section(section: str) -> tuple[str, bool]:
    """Validate an FCRA section against FCRA_LIBRARY.

    Returns (section, True) if the section is valid.
    Returns ("611", False) if the section is unknown — maps to general right-to-dispute
    and flags as unvalidated so callers can surface a warning.
    """
    if section in FCRA_LIBRARY:
        return section, True
    return "611", False


# ---------------------------------------------------------------------------
# PII stripper
# ---------------------------------------------------------------------------

def build_prompt_payload(parsed_report: ParsedReport) -> dict:
    """Build the payload sent to Claude.

    SECURITY: personal_info is explicitly excluded (per D-07/D-09).
    Only accounts, negative_items, inquiries, public_records, and bureau are sent.
    """
    payload = parsed_report.model_dump(
        include={"accounts", "negative_items", "inquiries", "public_records", "bureau"}
    )
    # Log category names only — never log actual data values
    logger.info("Sending categories to Claude: %s", list(payload.keys()))
    return payload


# ---------------------------------------------------------------------------
# Main analyzer
# ---------------------------------------------------------------------------

async def analyze_parsed_report(parsed_report: ParsedReport) -> list[DisputeItemOut]:
    """Call Claude with tool_use to identify disputable FCRA items.

    PII is stripped before the call. FCRA sections are validated post-call.

    Args:
        parsed_report: The fully parsed credit report (personal_info excluded from prompt).

    Returns:
        List of DisputeItemOut objects with validated FCRA citations.

    Raises:
        ValueError: If Claude does not return a tool_use block.
        Exception: Propagated from the Anthropic client on API errors.
    """
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    payload = build_prompt_payload(parsed_report)

    # Opus 4.7 with extended thinking — high-reasoning credit report analysis.
    # tool_choice must be "auto" when thinking is enabled (per Anthropic docs).
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=16000,
        thinking={"type": "enabled", "budget_tokens": 8000},
        system=SYSTEM_PROMPT,
        tools=[ANALYZE_TOOL],
        tool_choice={"type": "auto"},
        messages=[
            {
                "role": "user",
                "content": json.dumps(payload),
            }
        ],
    )

    # Extract tool_use block — comes after thinking blocks in the response.
    tool_block = next(
        (b for b in response.content if b.type == "tool_use"),
        None,
    )
    if tool_block is None:
        raise ValueError("Claude did not return tool_use block")

    raw_items = tool_block.input.get("dispute_items", [])

    dispute_items: list[DisputeItemOut] = []
    for raw in raw_items:
        validated_section, citation_valid = validate_fcra_section(raw["fcra_section"])
        fcra_entry = FCRA_LIBRARY[validated_section]

        dispute_items.append(
            DisputeItemOut(
                creditor_name=raw["creditor_name"],
                account_number_last4=raw.get("account_number_last4"),
                item_type=raw["item_type"],
                description=raw["description"],
                dispute_reason=raw["dispute_reason"],
                fcra_section=validated_section,
                fcra_section_title=fcra_entry["title"],
                fcra_section_usc=fcra_entry["usc"],
                ai_confidence=raw["confidence_score"],
                citation_validated=citation_valid,
            )
        )

    return dispute_items
