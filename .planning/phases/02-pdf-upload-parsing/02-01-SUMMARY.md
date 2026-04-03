---
phase: "02"
plan: "01"
subsystem: convex-data-layer
tags: [convex, schema, storage, pdf-pipeline, credit-reports]
dependency_graph:
  requires: [Phase 01 Foundation]
  provides: [credit_reports table, generateUploadUrl, saveReport, parseReport, listByUser, internal helpers]
  affects: [02-02-PLAN (FastAPI parse endpoint), 02-04-PLAN (upload UI), 02-05-PLAN (integration tests)]
tech_stack:
  added: []
  patterns:
    - Convex action orchestrating multi-step pipeline via ctx.runQuery/runMutation
    - Internal query/mutation helpers for atomic status transitions
    - FASTAPI_URL env var guard in Convex action (process.env)
    - Convex storage URL resolution with null check before use
key_files:
  created:
    - frontend/convex/creditReports.ts
  modified:
    - frontend/convex/schema.ts
decisions:
  - "parseReport action uses ctx.auth.getUserIdentity() (not getAuthUserId) consistent with action runtime — internal helpers access DB directly via ctx.db"
  - "image_only status handled in action (not FastAPI) so the Convex record reflects the scan-only state for UI to react to"
  - "FASTAPI_URL guard throws immediately in action catch block — caught by outer try/catch which sets failed status"
metrics:
  duration: "6 minutes"
  completed: "2026-04-03"
  tasks: 2
  files: 2
---

# Phase 2 Plan 1: Convex Schema + Credit Report Functions Summary

**One-liner:** Convex credit_reports table with 9 fields, 2 indexes, and 4 public + 3 internal functions wiring the full upload-to-parse pipeline via FastAPI.

## What Was Built

Extended `frontend/convex/schema.ts` with the `credit_reports` table (userId, bureau, storageId, uploadedAt, parseStatus, parsedData, rawText, errorMessage, confidence) and two indexes (`by_user`, `by_user_bureau`). Created `frontend/convex/creditReports.ts` with the complete upload-and-parse pipeline:

- **generateUploadUrl** (mutation): auth-gated, returns Convex storage upload URL for direct browser PUT
- **saveReport** (mutation): inserts a new credit_reports record with `parseStatus: "uploaded"`
- **parseReport** (action): orchestrates the full pipeline — resolves storage URL, marks parsing, POSTs to FastAPI `/api/reports/parse`, handles FastAPI errors, image-only PDFs, successful parses, and network failures
- **listByUser** (query): returns all reports for the authenticated user via `by_user` index
- **getReport** (internalQuery): fetches a single report by ID; throws if missing
- **setParseStatus** (internalMutation): atomic status patch, optionally stores errorMessage
- **saveParsedData** (internalMutation): writes parsedData, rawText, confidence and sets status to "done"

## Decisions Made

1. `parseReport` uses `ctx.auth.getUserIdentity()` pattern (matching `users.ts`) rather than `getAuthUserId` from auth helper — consistent with action runtime context
2. `image_only` detection handled inside the Convex action (checking `parsed.parse_status`) so the Convex record immediately reflects the scan-only state, enabling reactive UI updates
3. `FASTAPI_URL` guard throws an `Error` inside the try/catch — this is intentional so the outer catch sets `failed` status with the missing-env-var message rather than leaving the record in `parsing` state

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates data layer functions only. No UI stubs or placeholder values were introduced.

## Self-Check: PASSED

Files verified:
- `frontend/convex/schema.ts` — credit_reports table with 5 parseStatus literals and 2 indexes confirmed
- `frontend/convex/creditReports.ts` — 4 public exports and 3 internal exports confirmed; no "use node" directive; FASTAPI_URL guard present; Storage URL null check present; image_only detection present

Commits verified:
- `1f9e6a1` — feat(02-01): extend Convex schema with credit_reports table
- `c125dd2` — feat(02-01): implement Convex credit report functions
