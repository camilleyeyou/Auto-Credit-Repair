---
phase: 03-ai-analysis-dispute-review
plan: "02"
subsystem: api
tags: [anthropic, claude, fcra, pydantic, fastapi, tool_use, ai, dispute]

# Dependency graph
requires:
  - phase: 03-ai-analysis-dispute-review
    provides: ParsedReport model and bureau parser infrastructure from Plan 01

provides:
  - DisputeItemOut and AnalyzeResponse Pydantic models (backend/models/dispute_item.py)
  - FCRA_LIBRARY with 5 validated sections (611, 623, 605, 609, 612)
  - analyze_parsed_report() Claude tool_use service (backend/services/ai_analyzer.py)
  - POST /api/reports/{report_id}/analyze endpoint with idempotency guard

affects: [03-ai-analysis-dispute-review, 04-letter-generation, frontend-dispute-review]

# Tech tracking
tech-stack:
  added: [anthropic==0.88.0]
  patterns:
    - Dual-defense FCRA validation: enum in tool schema (prompt-level) + post-call validate_fcra_section()
    - PII stripping via model_dump(include=...) — personal_info never sent to Claude
    - Claude tool_use with tool_choice=any to force structured JSON output
    - Idempotency pattern: check Convex for existing items before calling Claude

key-files:
  created:
    - backend/models/dispute_item.py
    - backend/services/ai_analyzer.py
  modified:
    - backend/routers/reports.py
    - backend/requirements.txt

key-decisions:
  - "anthropic==0.88.0 pinned in requirements.txt for Claude SDK"
  - "FCRA sections constrained by enum in tool schema AND validated post-call (dual defense per D-02/D-13/D-15)"
  - "personal_info excluded from Claude prompt via model_dump(include=...) — never full model_dump() (D-07/D-09)"
  - "tool_choice={'type':'any'} forces Claude to always return tool_use block, no free-text fallback"
  - "Analyze endpoint is stateless — stores nothing in Convex; Plan 03 Convex action handles storage"
  - "validate_fcra_section() maps unknown sections to 611 (general dispute) with citation_validated=False"

patterns-established:
  - "PII strip pattern: model_dump(include={safe_fields}) before any external AI call"
  - "FCRA dual-defense: enum constraint in tool schema + validate_fcra_section() post-call pass"
  - "Idempotency: query Convex for existing results before expensive Claude call"

requirements-completed: [AI-01, AI-02, AI-03, AI-04, AI-05]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 3 Plan 02: AI Analyzer Summary

**Claude tool_use analyzer with dual-defense FCRA validation, PII-stripped prompts, and idempotent analyze endpoint using anthropic==0.88.0**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-04T00:34:00Z
- **Completed:** 2026-04-04T00:39:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created `DisputeItemOut` and `AnalyzeResponse` Pydantic models with full FCRA citation fields
- Built `ai_analyzer.py` with FCRA_LIBRARY (5 sections), Claude tool_use call, PII stripper, and dual validation defense
- Extended `reports.py` with `POST /api/reports/{report_id}/analyze` — idempotent, guards against unprocessed reports, delegates all Claude calls to ai_analyzer

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dispute_item.py Pydantic models and add anthropic to requirements** - `252c07f` (feat)
2. **Task 2: Create ai_analyzer.py with FCRA library, PII stripper, and Claude tool_use call** - `d32e89c` (feat)
3. **Task 3: Add POST /api/reports/{report_id}/analyze endpoint to reports.py** - `8e62f77` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/models/dispute_item.py` - DisputeItemOut and AnalyzeResponse Pydantic models
- `backend/services/ai_analyzer.py` - FCRA_LIBRARY, validate_fcra_section, build_prompt_payload, analyze_parsed_report
- `backend/routers/reports.py` - Added analyze endpoint; existing parse/health endpoints untouched
- `backend/requirements.txt` - Added anthropic==0.88.0

## Decisions Made

- `validate_fcra_section("unknown")` returns `("611", False)` — maps to general right-to-dispute with `citation_validated=False` flag so UI can surface a warning without crashing
- System prompt explicitly handles DOFD null case for § 605 disputes (Pitfall 6): "note it as unverifiable rather than assuming the item is current"
- Analyze endpoint does NOT write to Convex — separation of concerns keeps FastAPI stateless; Plan 03 Convex action calls this endpoint and handles storage
- `tool_choice={"type": "any"}` prevents Claude from returning free text, ensuring structured dispute_items output always arrives

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pymupdf` not installed in local environment causes import error when loading `routers/reports.py` directly (pre-existing, not introduced by this plan). Python AST parse confirmed `analyze_report` function and all routes are correctly structured. This will resolve in the Railway deployment environment where full requirements are installed.

## User Setup Required

One environment variable must be set before the analyze endpoint will function:

- `ANTHROPIC_API_KEY` — obtain from https://console.anthropic.com

This should be added to Railway environment variables (backend service) and to `.env` locally.

## Next Phase Readiness

- Plan 03 can now implement the Convex action that calls `POST /api/reports/{report_id}/analyze` and stores returned dispute items
- All Claude interaction is encapsulated in `ai_analyzer.py` — Plan 04 (letter generation) can follow the same pattern
- FCRA_LIBRARY is importable from `services.ai_analyzer` for any future plan needing citation lookups

---
*Phase: 03-ai-analysis-dispute-review*
*Completed: 2026-04-04*
