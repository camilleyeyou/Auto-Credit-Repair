---
phase: "04"
plan: "01"
subsystem: backend
tags: [weasyprint, pdf-generation, fastapi, letter-writer, claude, fcra]
dependency_graph:
  requires:
    - backend/services/ai_analyzer.py  # Claude API pattern mirrored
    - backend/routers/reports.py       # router pattern mirrored
  provides:
    - POST /api/letters/generate       # FastAPI letter generation endpoint
    - GET /api/letters/health          # WeasyPrint smoke test endpoint
    - backend/models/letter.py         # LetterRequest, LetterResponse
    - backend/services/letter_writer.py  # generate_letter_body, render_letter_html, html_to_pdf_bytes
    - backend/routers/letters.py       # letters APIRouter
  affects:
    - backend/main.py                  # letters router registered
    - backend/Dockerfile               # WeasyPrint system deps added
    - backend/requirements.txt         # weasyprint==68.1 added
tech_stack:
  added:
    - weasyprint==68.1
  patterns:
    - FastAPI router with prefix /api/letters (mirrors reports.py)
    - Claude text-only response (no tool_use — body is prose)
    - WeasyPrint HTML(string=...).write_pdf() in-memory PDF generation
    - Python f-string HTML template (no Jinja2 dependency)
key_files:
  created:
    - backend/models/letter.py
    - backend/services/letter_writer.py
    - backend/routers/letters.py
    - backend/templates/letter.html
    - backend/tests/__init__.py
    - backend/tests/test_letter_writer.py
  modified:
    - backend/Dockerfile
    - backend/requirements.txt
    - backend/main.py
decisions:
  - "HTML letter template implemented as Python f-string in letter_writer.py rather than Jinja2 to avoid new dependency; letter.html serves as human-readable reference only"
  - "body_paragraph HTML-escaped (& < >) before insertion to prevent template injection from Claude output"
  - "generate_letter_body validates bureau against BUREAU_ADDRESSES before Claude call to fail fast with clear ValueError"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-04T09:22:36Z"
  tasks: 2
  files: 9
---

# Phase 4 Plan 1: FastAPI Letter Generation Service Summary

**One-liner:** WeasyPrint-capable Dockerfile extended with system apt deps; FastAPI letter service with Claude body generation (claude-sonnet-4-20250514), f-string HTML template (8.5x11, 1in margins), and POST /api/letters/generate endpoint returning LetterResponse with letter_html and pdf_base64.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Dockerfile and add WeasyPrint to requirements.txt | 0a9d977 | backend/Dockerfile, backend/requirements.txt |
| 2 (RED) | Add failing tests for letter_writer service | 4ee2bc2 | backend/tests/__init__.py, backend/tests/test_letter_writer.py |
| 2 (GREEN) | Implement FastAPI letter service | 92c5e02 | backend/models/letter.py, backend/services/letter_writer.py, backend/routers/letters.py, backend/templates/letter.html, backend/main.py |

## What Was Built

### Task 1: Dockerfile + requirements.txt

Extended `backend/Dockerfile` to install WeasyPrint system library dependencies (libpango, libpangoft2, libpangocairo, libharfbuzz, libcairo2, libgdk-pixbuf2.0, libgobject-2.0, libjpeg, libopenjp2, fonts-liberation) using apt-get. The apt-get block is inserted BEFORE the `COPY requirements.txt .` line so system libraries are available when pip installs WeasyPrint.

Added `weasyprint==68.1` to `backend/requirements.txt`.

### Task 2: FastAPI Letter Service (TDD)

**models/letter.py** — `LetterRequest` and `LetterResponse` Pydantic models. Request carries bureau, creditor, account last 4, dispute reason, FCRA details, and user profile fields. Response returns `letter_html` (full HTML string) and `pdf_base64` (base64-encoded PDF bytes).

**services/letter_writer.py** — Three public functions:
- `generate_letter_body(request)` — async Claude text-only call using claude-sonnet-4-20250514; system prompt enforces professional tone, FCRA citation, 30-day investigation request, NEVER guarantee removal safeguard, unique language per item.
- `render_letter_html(request, body_paragraph)` — builds complete HTML with embedded @page CSS (8.5in x 11in, 1in margins, Liberation Serif 12pt). Includes date, sender block, bureau address (from BUREAU_ADDRESSES dict), RE line, salutation, Claude body, USPS Certified Mail note, Sincerely signature block, Enclosures line.
- `html_to_pdf_bytes(html_string)` — WeasyPrint `HTML(string=...).write_pdf()` in memory, returns bytes starting with `%PDF`.

**routers/letters.py** — FastAPI router at `/api/letters/` with:
- `GET /api/letters/health` — validates WeasyPrint is importable and functional
- `POST /api/letters/generate` — calls generate_letter_body + render_letter_html + html_to_pdf_bytes, returns LetterResponse

**main.py** — letters router registered after reports router.

**templates/letter.html** — human-readable reference copy of the letter structure; canonical template is the Python f-string in letter_writer.py.

## Decisions Made

1. **Template as Python f-string** — No Jinja2 dependency added. The letter has a single fixed structure with known substitution points; an f-string in `render_letter_html()` is simpler and sufficient. `letter.html` serves as a reference document only.

2. **body_paragraph HTML-escaped** — The Claude-generated body paragraph is HTML-escaped (`&`, `<`, `>`) before insertion into the template to prevent any HTML injection from model output.

3. **generate_letter_body validates bureau before Claude call** — Bureau validation happens at the top of `generate_letter_body()` to fail fast with a clear `ValueError` rather than letting an invalid bureau reach Claude or BUREAU_ADDRESSES lookup in render_letter_html.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] anthropic module missing from test venv**
- **Found during:** Task 2 (GREEN phase) — tests failed with `ModuleNotFoundError: No module named 'anthropic'`
- **Issue:** The test venv did not have anthropic==0.88.0 installed (it's in requirements.txt but the venv was set up independently and pip install hadn't been run for this package)
- **Fix:** Ran `pip install anthropic==0.88.0` in the venv
- **Impact:** No code changes needed; purely a dev environment setup issue

## Known Stubs

None. All functions are fully implemented:
- `generate_letter_body()` makes real Claude API calls
- `render_letter_html()` produces complete HTML with all required sections
- `html_to_pdf_bytes()` produces real PDF bytes via WeasyPrint

The endpoint is not connected to Convex yet (that is Plan 02's work) — this is by design, not a stub.

## Self-Check: PASSED

All created/modified files verified on disk:
- FOUND: backend/models/letter.py
- FOUND: backend/services/letter_writer.py
- FOUND: backend/routers/letters.py
- FOUND: backend/templates/letter.html
- FOUND: backend/tests/test_letter_writer.py
- FOUND: backend/tests/__init__.py
- FOUND: backend/Dockerfile (modified)
- FOUND: backend/requirements.txt (modified)
- FOUND: backend/main.py (modified)

All commits verified:
- FOUND commit: 0a9d977 (chore: Dockerfile + requirements)
- FOUND commit: 4ee2bc2 (test: failing tests RED phase)
- FOUND commit: 92c5e02 (feat: letter service implementation)
