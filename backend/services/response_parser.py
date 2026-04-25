"""
Bureau response letter parsing service — Claude tool_use extraction.

Uses PyMuPDF (fitz) for PDF text extraction and Claude tool_use for
structured outcome extraction from dispute response letters.

Outcome enum: verified | deleted | corrected | no_response | unknown
Be conservative — if outcome is ambiguous, use 'unknown'.
"""
import os
import urllib.request

import anthropic
import fitz  # PyMuPDF


# ---------------------------------------------------------------------------
# Claude tool definition for response parsing
# ---------------------------------------------------------------------------

PARSE_RESPONSE_TOOL = {
    "name": "parse_bureau_response",
    "description": (
        "Extract structured information from a credit bureau dispute response letter. "
        "Be conservative — if the outcome is ambiguous, use 'unknown'. "
        "Only extract what is explicitly stated in the letter."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "outcome": {
                "type": "string",
                "enum": ["verified", "deleted", "corrected", "no_response", "unknown"],
                "description": (
                    "The dispute outcome: "
                    "'verified' = bureau confirmed the item is accurate; "
                    "'deleted' = item was removed from the report; "
                    "'corrected' = item was updated/modified; "
                    "'no_response' = no response received within investigation window; "
                    "'unknown' = outcome cannot be determined from the letter."
                ),
            },
            "account_name": {
                "type": "string",
                "description": "Name of the creditor or account referenced in the response, if stated.",
            },
            "response_date": {
                "type": "string",
                "description": "Date of the bureau's response letter in ISO 8601 format (YYYY-MM-DD), or null if not found.",
            },
            "reason_code": {
                "type": "string",
                "description": "Any reason code or explanation code provided by the bureau, if present.",
            },
        },
        "required": ["outcome"],
    },
}


# ---------------------------------------------------------------------------
# System prompt — conservative, factual, no UPL
# ---------------------------------------------------------------------------

PARSE_SYSTEM_PROMPT = (
    "You are analyzing a credit bureau dispute response letter. "
    "Extract the outcome, account name, response date, and reason code. "
    "Be conservative — if the outcome is ambiguous, use 'unknown'. "
    "Only report what is explicitly stated in the letter; do not infer or assume."
)


# ---------------------------------------------------------------------------
# PDF text extraction helper
# ---------------------------------------------------------------------------

async def extract_text_from_pdf_url(pdf_url: str) -> str:
    """Download a PDF from a URL and extract its text content.

    Uses PyMuPDF (fitz) — same pattern as existing PDF parsers.
    Falls back gracefully to empty string on extraction failure.

    Args:
        pdf_url: A publicly accessible URL (e.g. Convex Storage signed URL).

    Returns:
        Full text content of the PDF as a single string.
    """
    with urllib.request.urlopen(pdf_url) as response:  # noqa: S310
        pdf_bytes = response.read()

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    return " ".join(page.get_text() for page in doc)


# ---------------------------------------------------------------------------
# Claude tool_use response parser
# ---------------------------------------------------------------------------

async def parse_response_letter(text: str, bureau: str) -> dict:
    """Use Claude tool_use to extract structured outcome data from response letter text.

    Mirrors the ai_analyzer.py client pattern exactly.
    Model: claude-sonnet-4-20250514.

    Args:
        text: Full text content of the bureau response PDF.
        bureau: Bureau name (e.g. "experian", "equifax", "transunion").

    Returns:
        Dict with keys: outcome (required), account_name, response_date, reason_code.
        Falls back to {"outcome": "unknown"} if extraction fails.
    """
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    user_message = (
        f"Bureau: {bureau.title()}\n\n"
        f"Response letter text:\n{text}"
    )

    # Sonnet 4.6 — fast, accurate structured extraction from response PDFs.
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=PARSE_SYSTEM_PROMPT,
        tools=[PARSE_RESPONSE_TOOL],
        tool_choice={"type": "any"},
        messages=[{"role": "user", "content": user_message}],
    )

    tool_use_block = next(
        (b for b in response.content if b.type == "tool_use"),
        None,
    )
    if tool_use_block is None:
        return {"outcome": "unknown"}

    return tool_use_block.input
