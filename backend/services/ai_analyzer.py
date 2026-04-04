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
        "Analyze a consumer credit report and flag only genuine FCRA-disputable items. "
        "Use hedged language — never guarantee removal of any item. "
        "Use only the provided fcra_section values. "
        "Provide item-specific, individualized dispute reasoning for each flagged item. "
        "Do not flag items that are accurate and timely; only flag items that appear "
        "inaccurate, unverifiable, obsolete, or otherwise legally disputable under the FCRA."
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
    "You are a credit report analysis assistant. Your job is to review a consumer's "
    "credit report data and identify items that may be legally disputable under the "
    "Fair Credit Reporting Act (FCRA).\n\n"
    "Rules:\n"
    "1. Only flag items that appear inaccurate, unverifiable, or obsolete under the FCRA.\n"
    "2. Use hedged language — never guarantee that a dispute will result in removal.\n"
    "3. Provide item-specific, individualized dispute reasoning for each item.\n"
    "4. For § 605 obsolete item disputes, calculate from `date_of_first_delinquency`. "
    "If that field is null or missing, note it as unverifiable rather than assuming the item is current.\n"
    "5. Use only the FCRA section values provided in the tool schema.\n"
    "6. Do not flag items that are accurate and timely."
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

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=[ANALYZE_TOOL],
        tool_choice={"type": "any"},
        messages=[
            {
                "role": "user",
                "content": json.dumps(payload),
            }
        ],
    )

    # Extract tool_use block — required due to tool_choice={"type": "any"}
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
