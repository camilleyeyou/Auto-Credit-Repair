---
phase: 06-bureau-response-escalation
plan: "03"
subsystem: frontend-convex
tags: [convex, actions, bureau-response, escalation, cfpb, letter-generation]
dependency_graph:
  requires:
    - "06-01 — saveResponse, saveCfpbComplaint, saveResponse internalMutations"
    - "06-02 — FastAPI /api/responses/parse, /api/letters/generate, /api/complaints/generate endpoints"
  provides:
    - "parseResponse action — bureau response PDF parsing orchestration"
    - "generateDemandLetter action — demand letter via FastAPI (ESC-01)"
    - "generateEscalationLetter action — escalation letter via FastAPI (ESC-02)"
    - "generateCfpbNarrative action — CFPB complaint narrative via FastAPI (ESC-03)"
  affects:
    - "Plan 06-04 — UI components call these actions directly"
tech_stack:
  added: []
  patterns:
    - "Convex action calling internalMutation pattern (mirrors creditReports.parseReport)"
    - "Convex Storage null-check (Pitfall 3) applied to parseResponse"
    - "PDF decode/store pattern: atob(pdf_base64) -> Uint8Array -> Blob -> ctx.storage.store"
    - "Auth check + FASTAPI_URL guard in every action"
key_files:
  created: []
  modified:
    - frontend/convex/bureauResponses.ts
    - frontend/convex/cfpbComplaints.ts
    - frontend/convex/letters.ts
    - frontend/convex/disputeItems.ts
decisions:
  - "parseResponse throws on outcome=unknown to surface bad parse to UI rather than storing broken record"
  - "generateDemandLetter and generateEscalationLetter reuse letters.saveLetter internalMutation with letterType arg"
  - "saveLetter updated with optional letterType field (backward compat — existing calls with no letterType still work)"
  - "escalation_summary in generateCfpbNarrative defaults to null (conservative) — UI context can pass it explicitly in future"
metrics:
  duration: "~8 min"
  completed: "2026-04-04"
  tasks_completed: 3
  files_created: 0
  files_modified: 4
---

# Phase 06 Plan 03: Convex Actions for Bureau Response & Escalation Summary

**One-liner:** Four Convex actions (parseResponse, generateDemandLetter, generateEscalationLetter, generateCfpbNarrative) wiring the Convex data layer to FastAPI endpoints for bureau response parsing, demand/escalation letters, and CFPB narrative generation.

## What Was Built

Three tasks added all Convex action-layer orchestration needed for Plans 01 (data layer) and 02 (FastAPI endpoints) to work end-to-end. These actions are the bridge the UI (Plan 04) calls directly.

### Task 1: parseResponse action + getResponseById internalQuery

Added to `frontend/convex/bureauResponses.ts`:
- Updated imports to include `internalQuery` and `internal` from `_generated/api`
- `getResponseById` internalQuery: fetch bureau_response by ID — used by escalation letter and CFPB narrative actions
- `parseResponse` public action (RESP-01):
  - Auth check
  - Null-check storage URL (Pitfall 3) — throws `"Storage URL not found"` rather than silently failing
  - FASTAPI_URL env guard
  - POST to `/api/responses/parse` with `{ pdf_url, bureau }`
  - Throws on `outcome === "unknown"` — surfaces to UI for manual entry (prevents storing broken records)
  - Saves via `saveResponse` internalMutation with `entryMethod: "pdf_upload"`

### Task 2: generateDemandLetter + generateEscalationLetter actions

Added to `frontend/convex/bureauResponses.ts`:
- `generateDemandLetter` public action (ESC-01): fetches dispute item + user profile + original letter sentAt, POSTs to `/api/letters/generate` with `letter_type: "demand"`, decodes PDF, stores in Convex Storage, saves via `letters.saveLetter` with `letterType: "demand"`
- `generateEscalationLetter` public action (ESC-02): fetches dispute item + user profile + bureau response outcome/reasonCode, POSTs to `/api/letters/generate` with `letter_type: "escalation"`, saves with `letterType: "escalation"`

Supporting changes:
- `frontend/convex/letters.ts` — `saveLetter` updated to accept optional `letterType` arg; passes it to `ctx.db.insert("dispute_letters", ...)`. Backward compatible — existing calls without `letterType` still work.
- `frontend/convex/letters.ts` — `getLetterById` internalQuery added: fetch dispute_letters record by ID
- `frontend/convex/disputeItems.ts` — `getItem` internalQuery added: fetch dispute_items by ID

### Task 3: generateCfpbNarrative action

Added to `frontend/convex/cfpbComplaints.ts`:
- Updated imports to include `action` and `internal`
- `generateCfpbNarrative` public action (ESC-03):
  - Auth check + FASTAPI_URL guard
  - Fetches dispute item and bureau response for complaint context
  - POSTs to `/api/complaints/generate` with `{ bureau, creditor_name, original_dispute_reason, bureau_outcome, sent_date, bureau_response_date, escalation_summary }`
  - Parses `{ narrative: string }` from response
  - Saves via `saveCfpbComplaint` internalMutation
  - No direct Anthropic SDK call — all Claude calls live in FastAPI (D-01)

## Verification

TypeScript compilation passes with no errors (exit code 0).

All exports confirmed present in target files:
- `bureauResponses.ts`: parseResponse, generateDemandLetter, generateEscalationLetter, getResponseById
- `cfpbComplaints.ts`: generateCfpbNarrative
- `letters.ts`: saveLetter (with letterType), getLetterById
- `disputeItems.ts`: getItem

## Deviations from Plan

### Auto-added Missing Critical Functionality (Rule 2)

**1. [Rule 2 - Missing] saveLetter missing letterType arg**
- **Found during:** Task 2
- **Issue:** Plan called for passing letterType="demand"/"escalation" to saveLetter, but the existing internalMutation had no letterType arg
- **Fix:** Added optional letterType to saveLetter args and db.insert
- **Files modified:** `frontend/convex/letters.ts`
- **Commit:** bd5dbd4

**2. [Rule 2 - Missing] getLetterById internalQuery missing**
- **Found during:** Task 2
- **Issue:** generateDemandLetter needed original letter sentAt but no internalQuery existed for fetching a letter by ID
- **Fix:** Added getLetterById internalQuery to letters.ts
- **Files modified:** `frontend/convex/letters.ts`
- **Commit:** bd5dbd4

**3. [Rule 2 - Missing] getItem internalQuery missing in disputeItems.ts**
- **Found during:** Task 2
- **Issue:** All three new actions needed dispute item details but no internal query existed
- **Fix:** Added getItem internalQuery to disputeItems.ts and updated imports
- **Files modified:** `frontend/convex/disputeItems.ts`
- **Commit:** bd5dbd4

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c344baa | feat(06-03): add parseResponse action to bureauResponses.ts |
| 2 | bd5dbd4 | feat(06-03): add generateDemandLetter and generateEscalationLetter actions |
| 3 | 2d837bb | feat(06-03): add generateCfpbNarrative action to cfpbComplaints.ts |

## Known Stubs

None — all actions make real calls to FastAPI endpoints. No hardcoded/placeholder data flows to UI rendering.

## Self-Check: PASSED
