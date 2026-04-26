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

GOODWILL_SYSTEM_PROMPT = (
    "You are a goodwill letter writer. Write a single courteous paragraph for a goodwill "
    "removal request to a creditor. Goodwill letters ask the creditor — as a gesture of "
    "good faith — to remove a late payment from a credit report on an account otherwise "
    "in good standing. They are NOT legal demands; they appeal to the creditor's discretion. "
    "Rules: "
    "1. Friendly, respectful, even apologetic tone — never adversarial. "
    "2. Acknowledge that the late payment occurred and take responsibility. "
    "3. Briefly mention any legitimate hardship if relevant (don't fabricate). "
    "4. Note the consumer's overall positive payment history with the creditor. "
    "5. Politely ask the creditor to remove the late payment as a goodwill gesture. "
    "6. Do NOT cite FCRA or any law — this is a goodwill ask, not a legal dispute. "
    "7. Do NOT make demands — use language like 'I respectfully request' or 'would you consider'. "
    "8. NEVER guarantee anything — the creditor is under no obligation to grant this. "
    "9. One paragraph, 4-6 sentences. No headers or salutations."
)

PAY_FOR_DELETE_SYSTEM_PROMPT = (
    "You are a debt-settlement letter writer. Write a single professional paragraph "
    "proposing a pay-for-delete arrangement to a debt collector. The consumer offers to "
    "pay a specified amount in exchange for the collector deleting the tradeline from "
    "all three major credit bureaus. "
    "Rules: "
    "1. Acknowledge the debt the collector claims, but neither admit nor deny it. "
    "2. State the offer amount clearly. "
    "3. Make it conditional: payment ONLY if the collector agrees IN WRITING to: "
    "   (a) delete the tradeline from Experian, Equifax, and TransUnion, "
    "   (b) consider the debt fully settled, "
    "   (c) stop all collection activity. "
    "4. Note that the offer is null and void if the collector does not provide written "
    "   confirmation of these terms BEFORE payment. "
    "5. Use firm, business-like tone — this is a settlement negotiation. "
    "6. Note that any partial payment without written agreement should not be deposited. "
    "7. NEVER guarantee outcomes — the collector may decline. "
    "8. One paragraph, 4-6 sentences. No headers or salutations."
)

IDENTITY_THEFT_BLOCK_SYSTEM_PROMPT = (
    "You are a credit dispute letter writer for an identity theft block request under "
    "FCRA § 605B (15 U.S.C. § 1681c-2). The consumer is the victim of identity theft and "
    "is exercising their right to have the disputed item BLOCKED from the credit report "
    "within 4 BUSINESS DAYS of receipt — without an investigation. This is the strongest "
    "tool when applicable. "
    "Rules: "
    "1. State clearly that this is a § 605B identity theft block request, citing 15 U.S.C. § 1681c-2. "
    "2. Identify the specific account/item to be blocked. "
    "3. Note that an FTC IdentityTheft.gov report (or equivalent police report) is enclosed. "
    "4. Reference the FTC Identity Theft Report number provided in the request data. "
    "5. State that the consumer is a victim of identity theft and that the disputed item "
    "   resulted from that identity theft. "
    "6. Note that under § 605B, the bureau must block the item within 4 business days. "
    "7. Use firm, formal, professional tone — this is a legal demand grounded in clear statute. "
    "8. Do NOT state what the bureau is 'legally required' to do — use procedural language only. "
    "9. NEVER guarantee removal — the bureau may temporarily decline if it has reasonable belief the consumer's claim is false. "
    "10. One paragraph, 5-7 sentences. No headers or salutations."
)

VALIDATION_SYSTEM_PROMPT = (
    "You are a debt validation letter writer. Write a single professional paragraph "
    "for a Fair Debt Collection Practices Act (FDCPA) § 1692g debt validation request. "
    "This letter is sent to a debt COLLECTOR (not a credit bureau) demanding that the "
    "collector validate the debt before continuing collection or reporting it to bureaus. "
    "Rules: "
    "1. Cite FDCPA § 1692g (15 U.S.C. § 1692g). "
    "2. State that the consumer disputes the debt and requests validation, including: "
    "   (a) the amount of the debt, (b) the name of the original creditor, (c) verification "
    "   that the collector has the right to collect, (d) a copy of the original signed agreement. "
    "3. Note that under § 1692e(8), continuing to report this debt to credit bureaus while "
    "   disputed without marking it as disputed is a potential FDCPA violation. "
    "4. Demand all collection activity (calls, letters, credit reporting) cease until validation is provided. "
    "5. Use firm but polite tone. "
    "6. NEVER guarantee removal — use hedged language only. "
    "7. One paragraph, 4-6 sentences. No headers or salutations."
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

    # Branch on letter_type — covers initial / demand / escalation / mov / validation /
    # goodwill / pay_for_delete / identity_theft_block
    if request.letter_type == "demand":
        system_prompt = DEMAND_SYSTEM_PROMPT
    elif request.letter_type == "escalation":
        system_prompt = ESCALATION_SYSTEM_PROMPT
    elif request.letter_type == "mov":
        system_prompt = MOV_SYSTEM_PROMPT
    elif request.letter_type == "validation":
        system_prompt = VALIDATION_SYSTEM_PROMPT
    elif request.letter_type == "goodwill":
        system_prompt = GOODWILL_SYSTEM_PROMPT
    elif request.letter_type == "pay_for_delete":
        system_prompt = PAY_FOR_DELETE_SYSTEM_PROMPT
    elif request.letter_type == "identity_theft_block":
        system_prompt = IDENTITY_THEFT_BLOCK_SYSTEM_PROMPT
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
    if request.letter_type == "validation":
        if request.collector_name:
            user_message += f"Debt collector: {request.collector_name}\n"
    if request.letter_type == "goodwill" and request.collector_name:
        user_message += f"Creditor (recipient): {request.collector_name}\n"
    if request.letter_type == "pay_for_delete":
        if request.collector_name:
            user_message += f"Debt collector: {request.collector_name}\n"
        if request.offer_amount:
            user_message += f"Settlement offer amount: {request.offer_amount}\n"
    if request.letter_type == "identity_theft_block" and request.ftc_report_number:
        user_message += f"FTC Identity Theft Report number: {request.ftc_report_number}\n"

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
    # Letters that go to a non-bureau recipient (collector or creditor).
    # Identity theft block goes to bureaus, so it stays on the bureau path.
    non_bureau_recipient_types = {"validation", "goodwill", "pay_for_delete"}
    if request.letter_type in non_bureau_recipient_types:
        if not request.collector_name or not request.collector_address:
            raise ValueError(
                f"{request.letter_type} letters require collector_name and collector_address",
            )
        bureau_display_name = request.collector_name
        bureau_address_raw = request.collector_address
    else:
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
