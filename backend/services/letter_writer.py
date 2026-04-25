"""
Letter writer service — Claude body generation + WeasyPrint PDF rendering.

Three public functions:
  generate_letter_body(request) -> str        — Claude API call (async)
  render_letter_html(request, body) -> str    — builds complete HTML letter string
  html_to_pdf_bytes(html_string) -> bytes     — WeasyPrint HTML → PDF

Per D-10/D-16: Claude generates the body paragraph only (not header/footer).
Per D-17: System prompt enforces professional tone, FCRA citation, NEVER guarantee removal.
Per D-19: Model is claude-sonnet-4-20250514.
Per D-03: Bureau addresses hardcoded.
Per D-08: 8.5"x11" with 1" margins via CSS @page rule.

Note: The canonical letter template lives in this file as a Python f-string.
The backend/templates/letter.html file is a human-readable reference — rendering
happens entirely in render_letter_html() below.
"""
import os
from datetime import datetime
from typing import Optional

import anthropic

from models.letter import LetterRequest


# ---------------------------------------------------------------------------
# Bureau address constants — per D-03 (locked)
# ---------------------------------------------------------------------------

BUREAU_ADDRESSES: dict[str, tuple[str, str]] = {
    "experian":   ("Experian",   "P.O. Box 4500\nAllen, TX 75013"),
    "equifax":    ("Equifax",    "P.O. Box 740256\nAtlanta, GA 30374-0256"),
    "transunion": ("TransUnion", "P.O. Box 2000\nChester, PA 19016"),
}


# ---------------------------------------------------------------------------
# System prompt for letter body generation — per D-17
# ---------------------------------------------------------------------------

LETTER_SYSTEM_PROMPT = (
    "You are a credit dispute letter writer. Write a single professional paragraph "
    "for a formal dispute letter under the Fair Credit Reporting Act (FCRA). "
    "Rules: "
    "1. Use firm but polite tone. "
    "2. Cite the specific FCRA section provided. "
    "3. Reference the specific account and creditor by name. "
    "4. Request investigation and correction within 30 days. "
    "5. NEVER guarantee removal — use hedged language only. "
    "6. Write one paragraph, 3-5 sentences. Do not include headers or salutations. "
    "7. Make the language unique and specific to this account — not generic boilerplate."
)

DEMAND_SYSTEM_PROMPT = (
    "You are a credit dispute follow-up letter writer. Write a single professional paragraph "
    "for a formal demand letter under the Fair Credit Reporting Act (FCRA) Section 611. "
    "The bureau failed to respond within the required 30-day investigation window. "
    "Rules: "
    "1. Reference the specific FCRA 30-day investigation requirement (15 U.S.C. § 1681i). "
    "2. State that the original dispute was sent and no response was received within 30 days. "
    "3. Demand immediate investigation and written response. "
    "4. Use firm but polite tone. "
    "5. NEVER guarantee removal — use hedged language. "
    "6. Do NOT state what the bureau is 'legally required' to do — use procedural language only. "
    "7. One paragraph, 3-5 sentences."
)

MOV_SYSTEM_PROMPT = (
    "You are a credit dispute follow-up letter writer. Write a single professional paragraph "
    "for a Method of Verification (MOV) letter under FCRA § 611(a)(6)(B)(iii) and § 611(a)(7) "
    "(15 U.S.C. § 1681i). The bureau verified the disputed item — but FCRA gives the consumer "
    "the right to demand the bureau describe the procedure used to verify, including the "
    "name, address, and telephone number of every furnisher contacted, within 15 days. "
    "Rules: "
    "1. Reference the original dispute and the bureau's verification response. "
    "2. Cite FCRA § 611(a)(6)(B)(iii) and § 611(a)(7) (15 U.S.C. § 1681i) requesting "
    "   a description of the procedure used to determine the accuracy of the disputed item. "
    "3. Specifically request: (a) name/address/telephone of every furnisher contacted, "
    "   (b) copies of all documents the bureau relied on, (c) date the verification was made. "
    "4. Note that the bureau has 15 days to provide this information. "
    "5. Do NOT re-dispute the underlying item in this letter — this is a procedural request. "
    "6. Use firm but polite tone. "
    "7. NEVER guarantee removal — use hedged language only. "
    "8. Do NOT state what the bureau is 'legally required' to do — use procedural language only. "
    "9. One paragraph, 4-6 sentences."
)

ESCALATION_SYSTEM_PROMPT = (
    "You are a credit dispute escalation letter writer. Write a single professional paragraph "
    "for a formal escalation letter under the Fair Credit Reporting Act (FCRA). "
    "The bureau verified or denied the original dispute. "
    "Rules: "
    "1. Reference the original dispute and the bureau's verification response. "
    "2. Note that furnishers have an obligation to investigate disputes under FCRA § 623 "
    "   (15 U.S.C. § 1681s-2) and that this escalation puts the furnisher on notice. "
    "3. State that new or additional documentation is enclosed contradicting the bureau's findings. "
    "4. Request re-investigation under FCRA Section 611 (15 U.S.C. § 1681i). "
    "5. Use firm but polite tone. "
    "6. NEVER guarantee removal — use hedged language. "
    "7. Do NOT state what the bureau is 'legally required' to do — use procedural language only. "
    "8. One paragraph, 3-5 sentences."
)


# ---------------------------------------------------------------------------
# Claude letter body generator — per D-10, D-15, D-16, D-18, D-19
# ---------------------------------------------------------------------------

async def generate_letter_body(request: LetterRequest) -> str:
    """Call Claude to generate a unique body paragraph for the dispute letter.

    Mirrors the ai_analyzer.py client pattern exactly.
    Model: claude-sonnet-4-20250514 (per D-19 — do not change).

    Args:
        request: LetterRequest containing dispute item details and user profile.

    Returns:
        A unique, professional dispute paragraph (3-5 sentences).

    Raises:
        ValueError: If bureau is not recognized.
        Exception: Propagated from Anthropic client on API errors.
    """
    if request.bureau not in BUREAU_ADDRESSES:
        raise ValueError(
            f"Unknown bureau: {request.bureau!r}. "
            f"Must be one of: {list(BUREAU_ADDRESSES.keys())}"
        )

    # Branch on letter_type for demand/escalation/mov — per Phase 6 / MOV plan
    if request.letter_type == "demand":
        system_prompt = DEMAND_SYSTEM_PROMPT
    elif request.letter_type == "escalation":
        system_prompt = ESCALATION_SYSTEM_PROMPT
    elif request.letter_type == "mov":
        system_prompt = MOV_SYSTEM_PROMPT
    else:
        system_prompt = LETTER_SYSTEM_PROMPT

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    user_message = (
        f"Write a dispute paragraph for:\n"
        f"Bureau: {request.bureau.title()}\n"
        f"Creditor: {request.creditor_name}\n"
        f"Account ending in: {request.account_number_last4 or 'unknown'}\n"
        f"Dispute reason: {request.dispute_reason}\n"
        f"FCRA basis: {request.fcra_section_usc} ({request.fcra_section_title})\n"
    )

    # Add context fields for demand/escalation/mov letter types
    if request.letter_type == "demand" and request.original_sent_date:
        user_message += f"Original dispute sent date: {request.original_sent_date}\n"
    if request.letter_type == "escalation" and request.bureau_outcome_summary:
        user_message += f"Bureau outcome summary: {request.bureau_outcome_summary}\n"
    if request.letter_type == "mov":
        if request.original_sent_date:
            user_message += f"Original dispute sent date: {request.original_sent_date}\n"
        if request.bureau_outcome_summary:
            user_message += f"Bureau verification outcome: {request.bureau_outcome_summary}\n"

    # Opus 4.7 with extended thinking — drafts persuasive, FCRA-grounded letters.
    # Budget reasoning so each letter is tailored, not boilerplate.
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=8000,
        thinking={"type": "enabled", "budget_tokens": 4000},
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    # Extract the text block (skipping thinking blocks).
    text_block = next(
        (b for b in response.content if b.type == "text"),
        None,
    )
    if text_block is None:
        raise ValueError("Claude did not return a text block")
    return text_block.text.strip()


# ---------------------------------------------------------------------------
# HTML letter renderer — per D-02, D-05, D-06, D-07, D-08
# ---------------------------------------------------------------------------

def render_letter_html(request: LetterRequest, body_paragraph: str) -> str:
    """Build a complete HTML letter string for this dispute item.

    The HTML includes embedded CSS with @page rule for 8.5"x11" print output.
    Bureau address is looked up from BUREAU_ADDRESSES and formatted with <br> tags.

    Args:
        request: LetterRequest with user profile and dispute item details.
        body_paragraph: Claude-generated unique paragraph (no HTML — plain text).

    Returns:
        Complete HTML string suitable for passing to html_to_pdf_bytes().

    Raises:
        ValueError: If request.bureau is not in BUREAU_ADDRESSES.
    """
    if request.bureau not in BUREAU_ADDRESSES:
        raise ValueError(
            f"Unknown bureau: {request.bureau!r}. "
            f"Must be one of: {list(BUREAU_ADDRESSES.keys())}"
        )

    bureau_display_name, bureau_address_raw = BUREAU_ADDRESSES[request.bureau]

    # Format date as "April 3, 2026" — cross-platform safe
    today = datetime.now()
    # strftime("%-d") is Linux-only; use manual lstrip for cross-platform safety
    day = str(today.day)  # no leading zero — already an int
    letter_date = today.strftime(f"%B {day}, %Y")

    # Format bureau address lines for HTML
    bureau_address_html = bureau_address_raw.replace("\n", "<br>")

    account_display = request.account_number_last4 or "N/A"

    # Escape any plain-text ampersands in body paragraph for HTML safety
    safe_body = (
        body_paragraph
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: 8.5in 11in;
    margin: 1in;
  }}
  body {{
    font-family: "Liberation Serif", Georgia, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
  }}
  .header {{
    margin-bottom: 2em;
  }}
  .bureau-address {{
    margin-bottom: 2em;
  }}
  .re-line {{
    font-weight: bold;
    margin-bottom: 1.5em;
  }}
  .body-text {{
    margin-bottom: 2em;
  }}
  .certified-mail {{
    margin-bottom: 2em;
  }}
  .signature-block {{
    margin-top: 3em;
  }}
  .signature-space {{
    height: 3em;
  }}
  .enclosures {{
    margin-top: 2em;
    font-size: 10pt;
  }}
</style>
</head>
<body>

<div class="header">
  <p>{letter_date}</p>
  <p>{request.full_name}<br>{request.street_address}<br>{request.city}, {request.state} {request.zip_code}</p>
</div>

<div class="bureau-address">
  <p>{bureau_display_name}<br>{bureau_address_html}</p>
</div>

<p class="re-line">RE: Dispute of Inaccurate Credit Information &mdash; Account Ending in {account_display}</p>

<p>Dear {bureau_display_name} Dispute Center,</p>

<div class="body-text">
  <p>{safe_body}</p>
</div>

<p class="certified-mail">This letter is being sent via USPS Certified Mail.</p>

<div class="signature-block">
  <p>Sincerely,</p>
  <div class="signature-space"></div>
  <p>{request.full_name}</p>
</div>

<div class="enclosures">
  <p>Enclosures: Copy of government-issued ID, Copy of relevant credit report page</p>
</div>

</body>
</html>"""

    return html


# ---------------------------------------------------------------------------
# WeasyPrint PDF renderer — per D-11
# ---------------------------------------------------------------------------

def html_to_pdf_bytes(html_string: str) -> bytes:
    """Convert an HTML string to PDF bytes using WeasyPrint.

    Operates entirely in memory — no temp files.
    WeasyPrint applies @page CSS rule for 8.5"x11" with 1" margins.

    Args:
        html_string: Complete HTML string (typically from render_letter_html()).

    Returns:
        PDF bytes starting with b'%PDF'.

    Raises:
        OSError: If WeasyPrint system libraries are missing (see Dockerfile apt deps).
    """
    from weasyprint import HTML
    return HTML(string=html_string).write_pdf()
