# Plan 02-03: Bureau Parser Adapters — Summary

**Status:** complete
**Tasks:** 2/2

## What was built

Three fully-implemented bureau-specific PDF parser adapters replacing the stubs from Plan 02-02:

- **ExperianParser** — regex-based extraction using section headers (ACCOUNT HISTORY, POTENTIALLY NEGATIVE ITEMS). Extracts creditor name, last-4 account number, balance, status, dates, DOFD, payment history.
- **TransUnionParser** — similar structure with TransUnion-specific label patterns. Most reliable DOFD extraction of the three bureaus.
- **EquifaxParser** — includes pdfplumber fallback for payment history grids where PyMuPDF misses tabular data. Strict DOFD vs charge-off date separation (Pitfall 7).

All three return normalized `ParsedReport` with confidence scores and parse warnings.

## Key files

### created
- `backend/services/pdf_parser/experian.py`
- `backend/services/pdf_parser/transunion.py`
- `backend/services/pdf_parser/equifax.py`

## Deviations

None — implemented exactly as planned.

## Self-Check: PASSED

- All three parsers import cleanly
- No "stub only" strings remain
- DOFD only from explicit labels
- Only account_number_last4 used (no full account numbers)
- pdfplumber used only in Equifax adapter
