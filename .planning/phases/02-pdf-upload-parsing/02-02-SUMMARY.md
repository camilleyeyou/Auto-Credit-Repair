---
phase: "02"
plan: "02"
subsystem: backend
tags: [pdf-parsing, fastapi, pydantic, pymupdf, pdfplumber]
dependency_graph:
  requires: []
  provides: [ParsedReport schema, BureauParser interface, get_parser factory, /api/reports/parse endpoint, /api/reports/health endpoint]
  affects: [backend/main.py, Plan 03 bureau adapters]
tech_stack:
  added: [pdfplumber==0.11.9, httpx==0.28.1, pymupdf (PyMuPDF)]
  patterns: [Abstract base class parser, Factory pattern for bureau dispatch, Pydantic v2 models, FastAPI APIRouter]
key_files:
  created:
    - backend/models/__init__.py
    - backend/models/parsed_report.py
    - backend/services/__init__.py
    - backend/services/pdf_parser/__init__.py
    - backend/services/pdf_parser/base.py
    - backend/services/pdf_parser/experian.py
    - backend/services/pdf_parser/equifax.py
    - backend/services/pdf_parser/transunion.py
    - backend/routers/__init__.py
    - backend/routers/reports.py
  modified:
    - backend/requirements.txt
    - backend/main.py
decisions:
  - "ParsedReport.parse_status returns structured image_only response (not HTTP 4xx) so Convex action can handle it gracefully"
  - "Stub adapters created for all 3 bureaus so get_parser() works before Plan 03 implements real extraction"
  - "Router import placed after app creation in main.py (deferred import pattern avoids circular dependency risk)"
metrics:
  duration: "12 minutes"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_created: 10
  files_modified: 2
---

# Phase 02 Plan 02: PDF Parser Infrastructure Summary

**One-liner:** FastAPI parsing contracts established — ParsedReport Pydantic schema, BureauParser ABC with image-only detection, get_parser() factory, and /api/reports/parse + /api/reports/health endpoints live.

## What Was Built

Established the full parsing infrastructure layer that Plan 03 bureau adapters will implement against:

1. **Pydantic Models** (`backend/models/parsed_report.py`): `ParsedReport`, `Tradeline`, `NegativeItem`, and `ImageOnlyPDFError` — normalized schema for all bureau outputs. `account_number_last4` enforces last-4-only security. DOFD defaults to `None` per Pitfall 7.

2. **BureauParser ABC** (`backend/services/pdf_parser/base.py`): Abstract base with `extract_text_blocks()` (PyMuPDF-powered), image-only detection (< 100 chars raises `ImageOnlyPDFError`), and `detect_bureau()` fallback using header text patterns.

3. **Parser Factory** (`backend/services/pdf_parser/__init__.py`): `get_parser(bureau)` dispatches to the correct adapter by bureau name; raises `ValueError` for unknown bureaus.

4. **Stub Adapters** (experian.py, equifax.py, transunion.py): Fully wired stubs that call `extract_text_blocks()` (so image-only detection works) but return empty fields with warnings — Plan 03 fills in real extraction logic.

5. **Reports Router** (`backend/routers/reports.py`): `POST /api/reports/parse` downloads PDF from Convex storage URL via httpx (25s timeout), dispatches to bureau parser, returns `ParsedReport` JSON. Image-only PDFs return structured `parse_status="image_only"` response rather than HTTP error. `GET /api/reports/health` confirmed returning `{"status":"ok","service":"creditfix-parser"}`.

6. **Router mounted in main.py** at `/api/reports/` prefix.

## Verification Results

- `GET /api/reports/health` → `{"status":"ok","service":"creditfix-parser"}` (confirmed via live server test)
- `GET /api/health` → `{"status":"ok","service":"creditfix-api"}` (existing endpoint unaffected)
- All model imports verified: `from models.parsed_report import ParsedReport, Tradeline, NegativeItem, ImageOnlyPDFError`
- All service imports verified: `from routers.reports import router; from services.pdf_parser import get_parser; from services.pdf_parser.base import BureauParser`
- `get_parser("experian")` returns `<class 'services.pdf_parser.experian.ExperianParser'>`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| ImageOnlyPDFError returns structured JSON (not HTTP 4xx) | Convex action needs clean `parse_status` field, not an exception to catch |
| Stub adapters created now | Allows get_parser() to fully work before Plan 03; adapters call extract_text_blocks() so image-only detection is live |
| httpx timeout=25.0s | Provides buffer within Convex action timeout per D-24 |
| pymupdf added to requirements.txt | PyMuPDF is the primary extraction engine (D-14); was in venv but not pinned |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Dependency] Added pymupdf to requirements.txt**
- **Found during:** Task 1
- **Issue:** `backend/requirements.txt` lacked `pymupdf` entry despite PyMuPDF being the primary extraction engine (D-14). The plan mentioned httpx and pdfplumber but not pymupdf explicitly in requirements.txt step.
- **Fix:** Added `pymupdf==1.25.5` to requirements.txt alongside pdfplumber and httpx.
- **Files modified:** `backend/requirements.txt`
- **Commit:** 9dbd7a5

**2. [Rule 3 - Blocking Issue] Installed runtime dependencies into venv**
- **Found during:** Task 2
- **Issue:** pymupdf, pdfplumber, httpx not installed in the project venv — would have caused `ModuleNotFoundError` at runtime.
- **Fix:** Installed `PyMuPDF`, `pdfplumber==0.11.9`, `httpx==0.28.1` into the venv.
- **Files modified:** None (runtime install only)

## Known Stubs

The bureau adapters are intentional stubs as documented in the plan:

| File | Stub Type | Reason |
|------|-----------|--------|
| `backend/services/pdf_parser/experian.py` | Returns empty accounts/negative_items/inquiries/public_records | Plan 03 implements real Experian extraction |
| `backend/services/pdf_parser/equifax.py` | Returns empty accounts/negative_items/inquiries/public_records | Plan 03 implements real Equifax extraction |
| `backend/services/pdf_parser/transunion.py` | Returns empty accounts/negative_items/inquiries/public_records | Plan 03 implements real TransUnion extraction |

Each stub includes a `parse_warnings` entry noting "not yet implemented — stub only" so callers are aware. Image-only detection is fully live in all stubs (via `extract_text_blocks()` call).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9dbd7a5 | feat(02-02): add pdfplumber/httpx to requirements and define Pydantic models |
| Task 2 | 47aa00b | feat(02-02): add BureauParser base, parser factory, stub adapters, and reports router |
