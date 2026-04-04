"""
Complaints router — CFPB complaint narrative generation endpoint.

POST /api/complaints/generate:  Accept dispute summary fields, return a factual
                                 first-person CFPB complaint narrative via Claude.
GET  /api/complaints/health:    Health check for this router.

Note: Claude is called directly (plain text response — no tool_use).
UPL constraints enforced in system prompt: no legal conclusions, hedged language.
"""
import logging
import os

import anthropic
from fastapi import APIRouter

from models.complaint import ComplaintRequest, ComplaintResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

# ---------------------------------------------------------------------------
# CFPB complaint system prompt — UPL safe, fact-only, first-person
# ---------------------------------------------------------------------------

COMPLAINT_SYSTEM_PROMPT = (
    "You are helping a consumer write a CFPB complaint narrative about a credit bureau dispute. "
    "Write a factual, first-person account. "
    "Rules: "
    "1. Report facts only — dates, outcomes, what was disputed, what the bureau responded. "
    "2. Never say 'I will sue' or 'they violated the law' — state facts, not legal conclusions. "
    "3. Never guarantee removal or outcomes. "
    "4. Write in a clear, professional tone. "
    "5. Format as 2-3 paragraphs suitable for the CFPB complaint portal. "
    "6. Begin with 'I disputed...' and include all provided dates."
)


@router.get("/health")
def complaints_health():
    """Health check for the complaint generation service."""
    return {"status": "ok"}


@router.post("/generate")
async def generate_complaint(request: ComplaintRequest) -> ComplaintResponse:
    """
    Generate a CFPB complaint narrative from dispute summary fields.

    Calls Claude directly (plain text — no tool_use).
    Returns a factual, first-person narrative suitable for the CFPB complaint portal.
    UPL constraints enforced: no legal conclusions, hedged language, facts only.
    """
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Build user message from all provided fields
    user_message_parts = [
        f"Bureau: {request.bureau}",
        f"Creditor: {request.creditor_name}",
        f"Original dispute reason: {request.original_dispute_reason}",
        f"Original dispute sent date: {request.sent_date}",
        f"Bureau outcome: {request.bureau_outcome}",
    ]
    if request.bureau_response_date:
        user_message_parts.append(f"Bureau response date: {request.bureau_response_date}")
    if request.escalation_summary:
        user_message_parts.append(f"Escalation letter summary: {request.escalation_summary}")

    user_message = "\n".join(user_message_parts)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=COMPLAINT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    return ComplaintResponse(narrative=response.content[0].text)
