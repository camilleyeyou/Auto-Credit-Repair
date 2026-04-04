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
    "equifax":    ("Equifax",    "P.O. Box 740256\nAtlanta, GA 30374"),
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

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    user_message = (
        f"Write a dispute paragraph for:\n"
        f"Bureau: {request.bureau.title()}\n"
        f"Creditor: {request.creditor_name}\n"
        f"Account ending in: {request.account_number_last4 or 'unknown'}\n"
        f"Dispute reason: {request.dispute_reason}\n"
        f"FCRA basis: {request.fcra_section_usc} ({request.fcra_section_title})\n"
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=LETTER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text.strip()


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
