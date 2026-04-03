from io import BytesIO
from services.pdf_parser.base import BureauParser
from models.parsed_report import ParsedReport


class ExperianParser(BureauParser):
    """Experian credit report adapter. Full implementation in Plan 03."""

    def parse(self, pdf_bytes: BytesIO) -> ParsedReport:
        blocks, full_text = self.extract_text_blocks(pdf_bytes)
        return ParsedReport(
            bureau="experian",
            personal_info={},
            accounts=[],
            negative_items=[],
            inquiries=[],
            public_records=[],
            raw_text=full_text,
            confidence=0.0,
            parse_warnings=["Experian parser not yet implemented — stub only"],
        )
