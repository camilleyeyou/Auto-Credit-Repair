"""
Letters router — FastAPI endpoints for letter generation.

POST /api/letters/generate: Accepts LetterRequest, calls Claude for body,
                             renders HTML, converts to PDF, returns LetterResponse.
GET  /api/letters/health:   Validates WeasyPrint is importable and functional.

Mirrors routers/reports.py pattern per D-09.
Errors propagate to FastAPI's 500 handler — the Convex action's per-item try/catch
handles graceful recovery without stopping the whole batch (per research Pitfall 6).
"""
import base64
import logging

from fastapi import APIRouter

from models.letter import LetterRequest, LetterResponse
from services.letter_writer import generate_letter_body, render_letter_html, html_to_pdf_bytes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/letters", tags=["letters"])


@router.get("/health")
def letters_health():
    """Health check — validates WeasyPrint is importable and functional.

    Calls HTML(string="<p>test</p>").write_pdf() to confirm system libs are present.
    Returns 500 if WeasyPrint raises OSError (missing system library).
    """
    from weasyprint import HTML
    HTML(string="<p>test</p>").write_pdf()
    return {"status": "ok", "service": "creditfix-letters"}


@router.post("/generate")
async def generate_letter(request: LetterRequest) -> LetterResponse:
    """Generate a dispute letter for a single approved dispute item.

    Steps:
    1. Call Claude to generate a unique body paragraph (generate_letter_body)
    2. Render full HTML letter with bureau address, user profile, body (render_letter_html)
    3. Convert HTML to PDF bytes (html_to_pdf_bytes via WeasyPrint)
    4. Return LetterResponse with letter_html and base64-encoded PDF

    Errors propagate — do NOT swallow them. The calling Convex action wraps
    each item in try/catch so one failure does not block the whole batch.
    """
    body = await generate_letter_body(request)
    html = render_letter_html(request, body)
    pdf_bytes = html_to_pdf_bytes(html)
    return LetterResponse(
        letter_html=html,
        pdf_base64=base64.b64encode(pdf_bytes).decode("utf-8"),
    )
