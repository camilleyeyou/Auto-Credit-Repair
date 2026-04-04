"""
Reports router — PDF parsing and AI analysis endpoints.

POST /api/reports/parse:              Downloads PDF from Convex storage URL, dispatches to
                                       bureau-specific parser, returns ParsedReport JSON.
POST /api/reports/{report_id}/analyze: Fetches parsed report from Convex, calls Claude tool_use,
                                       validates FCRA citations, returns dispute items.
GET  /api/reports/health:             Health check specific to the parsing service.

Per D-23, D-24, D-25, D-06.
"""
import json
import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from io import BytesIO

from models.parsed_report import ParsedReport, ImageOnlyPDFError
from models.dispute_item import DisputeItemOut, AnalyzeResponse
from services.pdf_parser import get_parser
from services.ai_analyzer import analyze_parsed_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ParseRequest(BaseModel):
    bureau: str   # "experian" | "equifax" | "transunion"
    pdf_url: str


@router.get("/health")
def reports_health():
    """Health check for the parsing service (D-24)."""
    return {"status": "ok", "service": "creditfix-parser"}


@router.post("/parse")
async def parse_report(request: ParseRequest) -> dict:
    """
    Download PDF from Convex storage URL and parse with bureau-specific adapter.

    Returns ParsedReport as JSON. On image-only PDFs, returns
    parse_status="image_only" with a user-facing warning message.
    """
    # Download PDF from Convex storage URL
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(request.pdf_url)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to download PDF from storage: {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error downloading PDF: {str(e)}",
        )

    pdf_bytes = BytesIO(response.content)

    # Dispatch to bureau-specific adapter
    try:
        parser = get_parser(request.bureau)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Parse — ImageOnlyPDFError is surfaced as a structured response (not 4xx)
    # so the Convex action can set parse_status = "image_only" cleanly
    try:
        result: ParsedReport = parser.parse(pdf_bytes)
    except ImageOnlyPDFError as e:
        return ParsedReport(
            bureau=request.bureau,
            personal_info={},
            accounts=[],
            negative_items=[],
            inquiries=[],
            public_records=[],
            raw_text=None,
            confidence=0.0,
            parse_warnings=[str(e)],
            parse_status="image_only",
        ).model_dump()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF parsing failed: {str(e)}",
        )

    return result.model_dump()


class AnalyzeRequest(BaseModel):
    """Request body for analyze endpoint — parsed data passed directly from Convex action."""
    parsed_data: dict


@router.post("/{report_id}/analyze")
async def analyze_report(report_id: str, request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze a parsed credit report with Claude AI.
    Receives parsed data directly from the Convex analyzeReport action (no callback to Convex).
    FastAPI stays stateless — all data comes in the request body.
    """
    try:
        report_obj = ParsedReport.model_validate(request.parsed_data)
        dispute_items = await analyze_parsed_report(report_obj)
        return AnalyzeResponse(dispute_items=dispute_items, reused=False)
    except Exception as e:
        logger.error("AI analysis failed for report %s: %s", report_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))
