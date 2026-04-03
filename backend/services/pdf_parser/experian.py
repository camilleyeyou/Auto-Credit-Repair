"""
Experian credit report adapter.

Experian layout characteristics:
- Clear section headers in all-caps: "ACCOUNT HISTORY", "POTENTIALLY NEGATIVE ITEMS",
  "INQUIRIES", "PUBLIC RECORDS", "PERSONAL INFORMATION"
- Each account block starts with creditor name on its own line
- Account numbers labeled "Account Number:" with format XXXX XXXX XXXX 1234 (mask last 4)
- Balances labeled "Balance:" or "Current Balance:"
- Status labeled "Account Status:" or "Status:"
- Date opened labeled "Date Opened:"
- Date reported labeled "Date Reported:" or "Last Reported:"
- DOFD labeled "Date of First Delinquency:" (Experian is explicit about this label)

Per D-16: bureau parameter from request takes precedence; detect_bureau() is fallback.
"""
import re
from io import BytesIO
from services.pdf_parser.base import BureauParser
from models.parsed_report import ParsedReport, Tradeline, NegativeItem


# Section header patterns — Experian uses these in all-caps
SECTION_ACCOUNT_HISTORY = re.compile(r'account\s+history', re.IGNORECASE)
SECTION_NEGATIVE = re.compile(r'potentially\s+negative|negative\s+items', re.IGNORECASE)
SECTION_INQUIRIES = re.compile(r'^inquiries', re.IGNORECASE | re.MULTILINE)
SECTION_PUBLIC_RECORDS = re.compile(r'public\s+records', re.IGNORECASE)
SECTION_PERSONAL = re.compile(r'personal\s+information', re.IGNORECASE)

# Field label patterns
RE_ACCOUNT_NUMBER = re.compile(r'account\s+(?:number|#)[:\s]+[\w\s\-*X]{0,30}(\d{4})', re.IGNORECASE)
RE_BALANCE = re.compile(r'(?:current\s+)?balance[:\s]+\$?([\d,]+)', re.IGNORECASE)
RE_STATUS = re.compile(r'(?:account\s+)?status[:\s]+([^\n\r]{1,60})', re.IGNORECASE)
RE_DATE_OPENED = re.compile(r'date\s+opened[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_DATE_REPORTED = re.compile(r'(?:date|last)\s+reported[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_DOFD = re.compile(r'date\s+of\s+first\s+delinquency[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_ACCOUNT_TYPE = re.compile(r'account\s+type[:\s]+([^\n\r]{1,40})', re.IGNORECASE)
RE_CREDITOR = re.compile(r'^([A-Z][A-Z\s&.,\'\-]{2,50})$', re.MULTILINE)
RE_NEGATIVE_REASON = re.compile(r'(late\s+payment|collection|charge.?off|bankruptcy|delinquent|past\s+due)', re.IGNORECASE)


class ExperianParser(BureauParser):

    def parse(self, pdf_bytes: BytesIO) -> ParsedReport:
        blocks, full_text = self.extract_text_blocks(pdf_bytes)

        warnings: list[str] = []
        accounts: list[Tradeline] = []
        negative_items: list[NegativeItem] = []
        inquiries: list[dict] = []
        public_records: list[dict] = []
        personal_info: dict = {}

        text_blocks = re.split(r'\n{2,}', full_text)

        in_negative_section = False
        dofd_missing_count = 0

        for block in text_blocks:
            block = block.strip()
            if not block:
                continue

            if SECTION_NEGATIVE.search(block):
                in_negative_section = True
                continue
            if SECTION_ACCOUNT_HISTORY.search(block) and not SECTION_NEGATIVE.search(block):
                in_negative_section = False
                continue

            acct_match = RE_ACCOUNT_NUMBER.search(block)
            if not acct_match:
                continue

            account_number_last4 = acct_match.group(1)

            creditor_lines = [
                line.strip() for line in block.splitlines()
                if RE_CREDITOR.match(line.strip()) and len(line.strip()) > 3
            ]
            creditor_name = creditor_lines[0] if creditor_lines else "Unknown Creditor"

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

            # DOFD — only from explicit label (Pitfall 7: never substitute charge-off date)
            dofd_match = RE_DOFD.search(block)
            date_of_first_delinquency = dofd_match.group(1).strip() if dofd_match else None
            if date_of_first_delinquency is None:
                dofd_missing_count += 1

            account_type_match = RE_ACCOUNT_TYPE.search(block)
            account_type = account_type_match.group(1).strip() if account_type_match else None

            payment_cells = re.findall(r'\b(OK|30|60|90|120|CO|ND|---|\*)\b', block)
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

        if dofd_missing_count > 0:
            warnings.append(f"DOFD not found for {dofd_missing_count} accounts — left as None")

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
            warnings.append("No accounts extracted — parser may need tuning for this Experian PDF format")

        return ParsedReport(
            bureau="experian",
            personal_info=personal_info,
            accounts=accounts,
            negative_items=negative_items,
            inquiries=inquiries,
            public_records=public_records,
            raw_text=full_text,
            confidence=confidence,
            parse_warnings=warnings,
        )
