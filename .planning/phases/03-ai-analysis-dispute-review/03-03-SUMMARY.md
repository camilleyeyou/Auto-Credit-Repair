---
phase: 03-ai-analysis-dispute-review
plan: "03"
subsystem: api
tags: [convex, action, fastapi, ai-analysis, dispute-items, status-lifecycle]

# Dependency graph
requires:
  - phase: 03-ai-analysis-dispute-review
    provides: setAnalysisStatus internalMutation and saveDisputeItems internalMutation from Plans 01
  - phase: 03-ai-analysis-dispute-review
    provides: POST /api/reports/{report_id}/analyze FastAPI endpoint from Plan 02

provides:
  - analyzeReport public Convex action (exported from creditReports.ts)
  - Full AI analysis status lifecycle: analyzing → analyzed | analysis_failed
  - Idempotency guard (skips re-analysis if analysisStatus already "analyzed")
  - snake_case → camelCase field mapping from FastAPI response to Convex schema

affects: [03-ai-analysis-dispute-review, 04-letter-generation, frontend-upload-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - analyzeReport mirrors parseReport action pattern exactly (status lifecycle, try/catch, FASTAPI_URL guard)
    - FASTAPI_URL guard throws inside try/catch so outer catch always sets analysis_failed — record never stuck
    - Idempotency via analysisStatus check before calling FastAPI
    - snake_case → camelCase mapping at Convex action boundary (FastAPI response → saveDisputeItems args)

key-files:
  created: []
  modified:
    - frontend/convex/creditReports.ts

key-decisions:
  - "analyzeReport mirrors parseReport pattern so both actions have identical structure, error handling, and status update flow"
  - "FASTAPI_URL guard throws inside try/catch so outer catch catches it and sets analysis_failed — prevents record stuck in analyzing state"
  - "Idempotency guard (analysisStatus === analyzed) prevents re-analysis without user triggering a re-run"

patterns-established:
  - "Convex action status lifecycle pattern: set in-progress → try { call FastAPI + store + set done } catch { set failed }"

requirements-completed: [AI-01, AI-02, DISP-03]

# Metrics
duration: ~2min
completed: 2026-04-04
---

# Phase 3 Plan 03: analyzeReport Convex Action Summary

**analyzeReport Convex action wires Plan 01 data layer to Plan 02 FastAPI endpoint: fetches report, guards parseStatus/idempotency, sets analyzing, calls FastAPI, maps snake_case response to camelCase, stores dispute items, sets analyzed — outer catch always sets analysis_failed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-04T07:40:00Z
- **Completed:** 2026-04-04T07:42:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `analyzeReport` public Convex action to `creditReports.ts` following exact `parseReport` pattern
- Implements full status lifecycle: analyzing → analyzed on success, analysis_failed on any error (including FASTAPI_URL missing)
- Idempotency: guard skips analysis if `analysisStatus === "analyzed"` — safe to call multiple times
- Maps FastAPI snake_case fields (`item_type`, `creditor_name`, `fcra_section_title`, etc.) to camelCase args expected by `saveDisputeItems`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add analyzeReport action to creditReports.ts** - `b71cb37` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/convex/creditReports.ts` - Added `analyzeReport` action (104 lines appended); all prior 8 exports unchanged

## Decisions Made

- **analyzeReport mirrors parseReport exactly**: same pattern, same guard structure, same try/catch shape — consistency reduces cognitive overhead for future maintenance
- **FASTAPI_URL guard inside try/catch**: the guard throws rather than returning early, so the outer catch catches it and calls `setAnalysisStatus(analysis_failed)`. This matches the existing `parseReport` pattern (D-28 / Phase 02 pitfall fix).
- **Idempotency guard returns early (not throw)**: returns void silently if already analyzed — calling analyzeReport on an already-analyzed report is not an error condition, just a no-op.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- IDE diagnostics show TypeScript errors for missing `_generated/server` and `_generated/api` modules — these are pre-existing errors expected until `npx convex dev --once` completes Convex cloud initialization (documented in Phase 01 auth gate). No new TypeScript errors were introduced by this plan.

## User Setup Required

None - no new external service configuration required. `FASTAPI_URL` environment variable was already documented in prior plans.

## Next Phase Readiness

- `analyzeReport` is now callable from the frontend upload page "Analyze" button (Plan 04)
- Full pipeline complete: upload → parse (Phase 02) → analyze (this plan) → store dispute items
- Plan 04 can call `api.creditReports.analyzeReport({ reportId })` from the upload page component

---
*Phase: 03-ai-analysis-dispute-review*
*Completed: 2026-04-04*
