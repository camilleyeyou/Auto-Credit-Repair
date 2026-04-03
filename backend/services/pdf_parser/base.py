"""
Abstract base class for bureau PDF parsers.

All three bureau adapters (ExperianParser, EquifaxParser, TransUnionParser)
inherit from BureauParser and implement parse().

Per D-14: PyMuPDF is the primary extraction engine.
Per D-17: image-only detection raises ImageOnlyPDFError before any extraction.
Per Pitfall 4: check image-only FIRST, before any field extraction.
"""
import pymupdf  # canonical import name for PyMuPDF >= 1.24
from io import BytesIO
from abc import ABC, abstractmethod
from models.parsed_report import ParsedReport, ImageOnlyPDFError

# Bureau header markers for auto-detection (D-16)
# Uses broad case-insensitive partial matching — exact labels vary by PDF version
BUREAU_MARKERS: dict[str, list[str]] = {
    "experian": ["experian", "personal credit report"],
    "equifax": ["equifax", "credit file"],
    "transunion": ["transunion", "consumer disclosure"],
}

IMAGE_ONLY_THRESHOLD = 100  # characters — per D-17


class BureauParser(ABC):
    """Abstract base for bureau-specific credit report parsers."""

    def extract_text_blocks(self, pdf_bytes: BytesIO) -> tuple[list, str]:
        """
        Extract text blocks and full text from PDF using PyMuPDF.

        Returns:
            (blocks, full_text) where blocks are PyMuPDF block tuples
            (x0, y0, x1, y1, text, block_no, block_type).

        Raises:
            ImageOnlyPDFError: if total extracted text is below IMAGE_ONLY_THRESHOLD.
        """
        # Reset stream position before reading
        pdf_bytes.seek(0)
        doc = pymupdf.open(stream=pdf_bytes.read(), filetype="pdf")
        all_blocks: list = []
        full_text = ""
        for page in doc:
            full_text += page.get_text()
            all_blocks.extend(page.get_text("blocks"))
        doc.close()

        # Per Pitfall 4: check image-only BEFORE any field extraction
        if len(full_text.strip()) < IMAGE_ONLY_THRESHOLD:
            raise ImageOnlyPDFError(
                f"PDF contains only {len(full_text.strip())} characters of text. "
                "This appears to be a scanned/image-only PDF. "
                "Please upload a text-based PDF from annualcreditreport.com."
            )

        return all_blocks, full_text

    @staticmethod
    def detect_bureau(full_text: str) -> str | None:
        """
        Infer bureau from PDF content using header text patterns (D-16).
        Used as fallback when bureau is not explicitly provided by the caller.
        Checks only the first 2000 characters for efficiency.
        """
        text_lower = full_text[:2000].lower()
        for bureau, markers in BUREAU_MARKERS.items():
            if any(m in text_lower for m in markers):
                return bureau
        return None

    @abstractmethod
    def parse(self, pdf_bytes: BytesIO) -> ParsedReport:
        """
        Parse a credit report PDF and return a normalized ParsedReport.

        Must:
        - Call extract_text_blocks() first (raises ImageOnlyPDFError if image-only)
        - Store only last 4 digits of account numbers (never full numbers)
        - Leave date_of_first_delinquency as None if not found (do not substitute charge-off date)
        - Return confidence score 0.0–1.0 reflecting extraction quality
        """
        raise NotImplementedError
