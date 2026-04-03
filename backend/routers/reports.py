"""
Reports router — PDF parsing endpoint.

POST /api/reports/parse: Downloads PDF from Convex storage URL, dispatches to
    bureau-specific parser, returns ParsedReport JSON.
GET  /api/reports/health: Health check specific to the parsing service.

Per D-23, D-24, D-25.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from io import BytesIO

from models.parsed_report import ParsedReport, ImageOnlyPDFError
from services.pdf_parser import get_parser

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
