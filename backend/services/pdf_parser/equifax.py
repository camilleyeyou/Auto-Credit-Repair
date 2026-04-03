"""
Equifax credit report adapter.

Equifax layout characteristics:
- Dense payment history grids with implicit borders (no visible cell lines)
- Account numbers often format: XXXXXXXXXXXX1234 (long masked string ending in 4 digits)
- Section headers less prominent than Experian — often in bold but same font size
- DOFD labeling inconsistent: may say "Delinquency Date" or mix with "Charge-off Date"
  -> Per Pitfall 7: only treat explicit DOFD labels as DOFD; charge-off date never substituted

Parsing strategy:
- Primary: PyMuPDF block extraction for all text fields
- Fallback: pdfplumber extract_tables() for payment history grids where PyMuPDF returns
  only whitespace or single-char cells (per D-15)

Per D-16: bureau parameter from request takes precedence; detect_bureau() is fallback.
"""
import re
from io import BytesIO
import pdfplumber
from services.pdf_parser.base import BureauParser
from models.parsed_report import ParsedReport, Tradeline, NegativeItem


RE_ACCOUNT_NUMBER = re.compile(r'(?:account|acct)(?:\s+(?:#|number|no\.?))?[:\s]+[X\*\s\d\-]{0,30}(\d{4})', re.IGNORECASE)
RE_BALANCE = re.compile(r'(?:balance|amount\s+past\s+due|high\s+credit)[:\s]+\$?([\d,]+)', re.IGNORECASE)
RE_STATUS = re.compile(r'(?:account|pay)\s+status[:\s]+([^\n\r]{1,60})', re.IGNORECASE)
RE_DATE_OPENED = re.compile(r'(?:date\s+)?opened[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_DATE_REPORTED = re.compile(r'(?:date\s+)?reported[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_ACCOUNT_TYPE = re.compile(r'(?:account|credit)\s+type[:\s]+([^\n\r]{1,40})', re.IGNORECASE)

# DOFD patterns — Equifax-specific label variants (Pitfall 7)
# Accept: these are interpreted as date of first delinquency
RE_DOFD_ACCEPT = re.compile(
    r'(?:date\s+of\s+first\s+delinquency|first\s+delinquency|delinquency\s+date)[:\s]+([\w\s,/\-]{4,20})',
    re.IGNORECASE
)
# Reject: these are charge-off date, NOT DOFD — never substitute
RE_CHARGE_OFF_DATE = re.compile(r'charge.?off\s+date[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)

RE_NEGATIVE_REASON = re.compile(r'(late\s+payment|collection|charge.?off|bankruptcy|delinquent|past\s+due)', re.IGNORECASE)
RE_NEGATIVE_SECTION = re.compile(r'potentially\s+negative|negative\s+items|derogatory', re.IGNORECASE)


def _extract_payment_history_pdfplumber(pdf_bytes: BytesIO) -> list[list]:
    """
    Fallback: extract payment grid tables using pdfplumber.
    Per D-15: only used when PyMuPDF misses tabular data.
    Returns list of table rows (each row is list of cell strings).
    """
    pdf_bytes.seek(0)
    tables: list = []
    try:
        with pdfplumber.open(pdf_bytes) as pdf:
            for page in pdf.pages:
                page_tables = page.extract_tables()
                if page_tables:
                    tables.extend(page_tables)
    except Exception:
        pass  # pdfplumber failure is non-fatal — PyMuPDF result is primary
    return tables


class EquifaxParser(BureauParser):

    def parse(self, pdf_bytes: BytesIO) -> ParsedReport:
        blocks, full_text = self.extract_text_blocks(pdf_bytes)

        warnings: list[str] = []
        accounts: list[Tradeline] = []
        negative_items: list[NegativeItem] = []
        inquiries: list[dict] = []
        public_records: list[dict] = []
        personal_info: dict = {}
        dofd_missing_count = 0
        charge_off_only_count = 0

        text_blocks = re.split(r'\n{2,}', full_text)
        in_negative_section = False

        for block in text_blocks:
            block = block.strip()
            if not block:
                continue

            if RE_NEGATIVE_SECTION.search(block):
                in_negative_section = True
                continue

            acct_match = RE_ACCOUNT_NUMBER.search(block)
            if not acct_match:
                continue

            account_number_last4 = acct_match.group(1)

            lines = [l.strip() for l in block.splitlines() if l.strip()]
            creditor_name = lines[0] if lines else "Unknown Creditor"

            balance_match = RE_BALANCE.search(block)
            balance = None
            if balance_match:
                try:
                    balance = float(balance_match.group(1).replace(',', ''))
                except ValueError:
                    pass

            status_match = RE_STATUS.search(block)
            status = status_match.group(1).strip() if status_match else None

            date_opened_match = RE_DATE_OPENED.search(block)
            date_opened = date_opened_match.group(1).strip() if date_opened_match else None

            date_reported_match = RE_DATE_REPORTED.search(block)
            date_reported = date_reported_match.group(1).strip() if date_reported_match else None

            # DOFD — Equifax Pitfall 7: only accept explicit DOFD labels
            dofd_match = RE_DOFD_ACCEPT.search(block)
            date_of_first_delinquency = dofd_match.group(1).strip() if dofd_match else None
            if date_of_first_delinquency is None:
                dofd_missing_count += 1
                # Check if only charge-off date is present — do NOT use it as DOFD
                if RE_CHARGE_OFF_DATE.search(block):
                    charge_off_only_count += 1

            account_type_match = RE_ACCOUNT_TYPE.search(block)
            account_type = account_type_match.group(1).strip() if account_type_match else None

            payment_cells = re.findall(r'\b(OK|30|60|90|120|CO|ND|---|\*|Current|Late|R\d|I\d|O\d)\b', block)
            payment_history = payment_cells if payment_cells else None

            tradeline = Tradeline(
                creditor_name=creditor_name,
                account_number_last4=account_number_last4,
                account_type=account_type,
                balance=balance,
                status=status,
                payment_history=payment_history,
                date_opened=date_opened,
                date_reported=date_reported,
                date_of_first_delinquency=date_of_first_delinquency,
            )

            negative_reason_match = RE_NEGATIVE_REASON.search(block)
            if in_negative_section or negative_reason_match:
                negative_items.append(NegativeItem(
                    **tradeline.model_dump(),
                    reason_negative=negative_reason_match.group(1).lower().replace(' ', '_') if negative_reason_match else "delinquent",
                ))
            else:
                accounts.append(tradeline)

        # pdfplumber fallback for payment grids (D-15)
        accounts_without_payments = sum(1 for t in accounts + list(negative_items) if not t.payment_history)
        if accounts_without_payments > 0:
            pdfplumber_tables = _extract_payment_history_pdfplumber(pdf_bytes)
            if pdfplumber_tables:
                warnings.append(
                    f"pdfplumber fallback extracted {len(pdfplumber_tables)} payment grid table(s) — "
                    "grid data available in raw_text but not yet mapped to individual accounts"
                )
            else:
                warnings.append(
                    f"{accounts_without_payments} accounts have no payment history — "
                    "Equifax payment grids may require hands-on parser tuning with real PDF"
                )

        if dofd_missing_count > 0:
            warnings.append(f"DOFD not found for {dofd_missing_count} accounts — left as None")
        if charge_off_only_count > 0:
            warnings.append(
                f"{charge_off_only_count} accounts had charge-off date but NOT date of first delinquency — "
                "charge-off date was NOT used as DOFD substitute (per Pitfall 7)"
            )

        all_trades = accounts + list(negative_items)
        if all_trades:
            complete = sum(
                1 for t in all_trades
                if sum([
                    t.creditor_name != "Unknown Creditor",
                    t.account_number_last4 is not None,
                    t.balance is not None,
                    t.status is not None,
                    t.date_opened is not None,
                    t.date_reported is not None,
                ]) >= 4
            )
            confidence = round(complete / len(all_trades), 2)
        else:
            confidence = 0.1
            warnings.append("No accounts extracted — parser may need tuning for this Equifax PDF format")

        return ParsedReport(
            bureau="equifax",
            personal_info=personal_info,
            accounts=accounts,
            negative_items=negative_items,
            inquiries=inquiries,
            public_records=public_records,
            raw_text=full_text,
            confidence=confidence,
            parse_warnings=warnings,
        )
