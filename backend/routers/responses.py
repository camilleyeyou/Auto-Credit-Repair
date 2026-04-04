"""
Responses router — bureau response PDF parsing endpoint.

POST /api/responses/parse:  Download bureau response PDF, extract outcome via
                             Claude tool_use, return structured BureauResponseOut.
GET  /api/responses/health: Health check for this router.
"""
import logging

from fastapi import APIRouter

from models.bureau_response import BureauResponseParseRequest, BureauResponseOut
from services.response_parser import extract_text_from_pdf_url, parse_response_letter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/responses", tags=["responses"])


@router.get("/health")
def responses_health():
    """Health check for the response parsing service."""
    return {"status": "ok"}


@router.post("/parse")
async def parse_response(request: BureauResponseParseRequest) -> BureauResponseOut:
    """
    Download a bureau response PDF and extract the dispute outcome.

    Accepts a Convex Storage signed URL and bureau name.
    Returns a structured BureauResponseOut with outcome enum constrained to:
    verified | deleted | corrected | no_response | unknown.

    On any error, returns outcome='unknown' rather than raising a 5xx.
    """
    try:
        text = await extract_text_from_pdf_url(request.pdf_url)
        result = await parse_response_letter(text, request.bureau)
        return BureauResponseOut(**result)
    except Exception as exc:
        logger.error("Response parsing failed for bureau %s: %s", request.bureau, str(exc))
        return BureauResponseOut(outcome="unknown")
