---
phase: 06-bureau-response-escalation
plan: "02"
subsystem: backend
tags: [fastapi, claude, response-parsing, cfpb, letter-generation, pydantic]
dependency_graph:
  requires: []
  provides:
    - "POST /api/responses/parse — bureau response PDF parsing with Claude tool_use"
    - "POST /api/complaints/generate — CFPB complaint narrative generation"
    - "letter_writer.py demand/escalation branches"
  affects:
    - "backend/main.py — new router registrations"
    - "backend/models/letter.py — extended LetterRequest"
    - "Plan 06-03 — Convex actions call these FastAPI endpoints"
tech_stack:
  added: []
  patterns:
    - "Claude tool_use for structured outcome extraction (mirrors ai_analyzer.py)"
    - "Plain-text Claude response for CFPB narrative (no tool_use)"
    - "Letter type branching via request.letter_type field"
    - "PyMuPDF fitz.open(stream=...) for bureau response PDFs"
key_files:
  created:
    - backend/models/bureau_response.py
    - backend/services/response_parser.py
    - backend/routers/responses.py
    - backend/models/complaint.py
    - backend/routers/complaints.py
  modified:
    - backend/models/letter.py
    - backend/services/letter_writer.py
    - backend/main.py
decisions:
  - "Claude tool_use (tool_choice: any) used for response parsing — guarantees structured outcome extraction even for ambiguous letters"
  - "Fallback to outcome='unknown' on any parse failure — never raises 5xx from /api/responses/parse"
  - "CFPB narrative uses plain-text Claude response (no tool_use) — free-form narrative is intentional"
  - "letter_type branch added inline to generate_letter_body — minimal change, no refactor of render_letter_html needed"
  - "UPL constraints enforced in all three new system prompts — no legal conclusions, hedged language only"
metrics:
  duration: "~10 min"
  completed: "2026-04-04"
  tasks_completed: 3
  files_created: 5
  files_modified: 3
---

# Phase 06 Plan 02: FastAPI Bureau Response & Escalation Backend Summary

**One-liner:** Bureau response PDF parsing via Claude tool_use, CFPB narrative generation, and demand/escalation letter branches added to FastAPI backend.

## What Was Built

Three tasks added all FastAPI backend pieces needed before Plan 03 (Convex actions) can be tested end-to-end.

### Task 1: Response Parser (models, service, router)

- `backend/models/bureau_response.py` — `BureauResponseParseRequest` (pdf_url + bureau Literal) and `BureauResponseOut` (outcome enum: verified|deleted|corrected|no_response|unknown, plus optional account_name, response_date, reason_code)
- `backend/services/response_parser.py` — `PARSE_RESPONSE_TOOL` Claude tool_use schema; `parse_response_letter(text, bureau)` mirrors ai_analyzer.py client pattern exactly; `extract_text_from_pdf_url(url)` uses PyMuPDF fitz
- `backend/routers/responses.py` — `GET /api/responses/health` + `POST /api/responses/parse`; catches all exceptions and returns `outcome='unknown'` rather than 5xx

### Task 2: CFPB Complaint Router + Letter Writer Extension

- `backend/models/complaint.py` — `ComplaintRequest` (bureau, creditor_name, original_dispute_reason, bureau_outcome, sent_date, optional bureau_response_date + escalation_summary) and `ComplaintResponse`
- `backend/routers/complaints.py` — `GET /api/complaints/health` + `POST /api/complaints/generate`; plain-text Claude call (no tool_use); `COMPLAINT_SYSTEM_PROMPT` enforces first-person, factual, no legal conclusions
- `backend/models/letter.py` — Extended `LetterRequest` with `letter_type`, `original_sent_date`, `bureau_outcome_summary` optional fields
- `backend/services/letter_writer.py` — Added `DEMAND_SYSTEM_PROMPT` (cites FCRA § 611 / 15 U.S.C. § 1681i, 30-day window) and `ESCALATION_SYSTEM_PROMPT` (cites FCRA § 623 / 15 U.S.C. § 1681s-2 and § 611); branched `generate_letter_body` on `request.letter_type`

### Task 3: Router Registration in main.py

- Added `responses_router` and `complaints_router` imports and `app.include_router()` calls
- All 4 new routes active: `/api/responses/health`, `/api/responses/parse`, `/api/complaints/health`, `/api/complaints/generate`

## Verification

```
FastAPI app ok
All routes: ['/api/reports/health', '/api/reports/parse', '/api/reports/{report_id}/analyze',
             '/api/letters/health', '/api/letters/generate',
             '/api/responses/health', '/api/responses/parse',
             '/api/complaints/health', '/api/complaints/generate',
             '/api/health']
```

All Python imports succeed. No existing functionality changed.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | eeeb405 | feat(06-02): response parser — models, service, router |
| 2 | 178cd32 | feat(06-02): CFPB complaint router + demand/escalation letter branches |
| 3 | 698569a | feat(06-02): register responses and complaints routers in main.py |

## Known Stubs

None — all endpoints return real Claude API calls. No hardcoded/placeholder data flows to UI rendering.

## Self-Check: PASSED
