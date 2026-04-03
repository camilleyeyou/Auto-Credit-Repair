"""
TransUnion credit report adapter.

TransUnion layout characteristics:
- Clearest date formatting of the three bureaus
- Explicit "Date of First Delinquency" label — most reliable DOFD extraction
- Account sections typically start with creditor name followed by account details
- Account numbers often appear as "Account #" or "Acct #"
- Negative items in a dedicated section or flagged with status codes
- Payment history shown as a grid of monthly codes

Per D-16: bureau parameter from request takes precedence; detect_bureau() is fallback.
"""
import re
from io import BytesIO
from services.pdf_parser.base import BureauParser
from models.parsed_report import ParsedReport, Tradeline, NegativeItem


RE_ACCOUNT_NUMBER = re.compile(r'acct(?:ount)?\s+(?:#|number|no\.?)[:\s]+[\w\s\-*X]{0,30}(\d{4})', re.IGNORECASE)
RE_BALANCE = re.compile(r'(?:balance|amount)[:\s]+\$?([\d,]+)', re.IGNORECASE)
RE_STATUS = re.compile(r'(?:account\s+)?(?:status|condition)[:\s]+([^\n\r]{1,60})', re.IGNORECASE)
RE_DATE_OPENED = re.compile(r'(?:date\s+)?opened[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_DATE_REPORTED = re.compile(r'(?:date\s+)?reported[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_DOFD = re.compile(r'date\s+of\s+first\s+delinquency[:\s]+([\w\s,/\-]{4,20})', re.IGNORECASE)
RE_ACCOUNT_TYPE = re.compile(r'(?:account|loan)\s+type[:\s]+([^\n\r]{1,40})', re.IGNORECASE)
RE_NEGATIVE_REASON = re.compile(r'(late\s+payment|collection|charge.?off|bankruptcy|delinquent|past\s+due)', re.IGNORECASE)
RE_NEGATIVE_SECTION = re.compile(r'adverse\s+accounts|potentially\s+negative|negative\s+items', re.IGNORECASE)


class TransUnionParser(BureauParser):

    def parse(self, pdf_bytes: BytesIO) -> ParsedReport:
        blocks, full_text = self.extract_text_blocks(pdf_bytes)

        warnings: list[str] = []
        accounts: list[Tradeline] = []
        negative_items: list[NegativeItem] = []
        inquiries: list[dict] = []
        public_records: list[dict] = []
        personal_info: dict = {}
        dofd_missing_count = 0

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

            # TransUnion has explicit DOFD labels — most reliable of the three bureaus
            # Per Pitfall 7: only use this label, never substitute charge-off date
            dofd_match = RE_DOFD.search(block)
            date_of_first_delinquency = dofd_match.group(1).strip() if dofd_match else None
            if date_of_first_delinquency is None:
                dofd_missing_count += 1

            account_type_match = RE_ACCOUNT_TYPE.search(block)
            account_type = account_type_match.group(1).strip() if account_type_match else None

            payment_cells = re.findall(r'\b(OK|30|60|90|120|CO|ND|---|\*|Current|Late)\b', block)
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
            warnings.append("No accounts extracted — parser may need tuning for this TransUnion PDF format")

        return ParsedReport(
            bureau="transunion",
            personal_info=personal_info,
            accounts=accounts,
            negative_items=negative_items,
            inquiries=inquiries,
            public_records=public_records,
            raw_text=full_text,
            confidence=confidence,
            parse_warnings=warnings,
        )
