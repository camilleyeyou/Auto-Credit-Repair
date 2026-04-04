---
phase: 06-bureau-response-escalation
plan: 01
subsystem: convex-data-layer
tags: [schema, convex, bureau-responses, cfpb, data-layer]
dependency_graph:
  requires: []
  provides: [bureau_responses-table, cfpb_complaints-table, letterType-field, bureauResponses-module, cfpbComplaints-module]
  affects: [06-02, 06-03, 06-04]
tech_stack:
  added: []
  patterns: [internalMutation-for-action-targets, outcome-to-status-mapping, auth-ownership-guard]
key_files:
  created:
    - frontend/convex/bureauResponses.ts
    - frontend/convex/cfpbComplaints.ts
  modified:
    - frontend/convex/schema.ts
decisions:
  - "Multiple responses per dispute item allowed — no unique index on bureau_responses.disputeItemId (Pitfall 7)"
  - "outcome 'unknown' and 'no_response' leave dispute_items.status unchanged (stays 'sent')"
  - "saveCfpbComplaint and saveResponse are internalMutations — called only by Plan 02 actions"
  - "recordResponseManual is a public mutation — direct UI entry path (RESP-03)"
metrics:
  duration: "~4 min"
  completed: "2026-04-04"
  tasks_completed: 3
  files_modified: 3
---

# Phase 06 Plan 01: Convex Schema & Data Layer Summary

**One-liner:** Convex schema extended with bureau_responses and cfpb_complaints tables plus letterType on dispute_letters, backed by full CRUD modules for both new tables.

## What Was Built

### Task 1: schema.ts Extended (bb15918)

Three additions to `frontend/convex/schema.ts`:

1. `letterType` optional field on `dispute_letters` — union of `"initial" | "demand" | "escalation"`. Backward-compatible via `v.optional`.

2. `bureau_responses` table — captures outcome (verified/deleted/corrected/no_response/unknown), entryMethod (pdf_upload/manual), optional PDF storageId, and three indexes: `by_dispute_item`, `by_user`, `by_user_bureau`. No unique index on `disputeItemId` (multiple responses per dispute allowed).

3. `cfpb_complaints` table — captures AI-generated narrative, portalStatus lifecycle (draft/filed/response_received/closed), and timeline timestamps. Indexes: `by_dispute_item`, `by_user`.

### Task 2: bureauResponses.ts Created (d1e4529)

`frontend/convex/bureauResponses.ts` with five exports:

| Export | Type | Purpose |
|--------|------|---------|
| `generateResponseUploadUrl` | public mutation | Returns Convex Storage upload URL for response PDFs |
| `saveResponse` | internalMutation | Plan 02 target — called after PDF parse, updates dispute status |
| `recordResponseManual` | public mutation | RESP-03 manual entry form path |
| `getResponseForItem` | public query | Most recent response for a dispute item (auth-guarded) |
| `getResponsesForUser` | public query | Full response history for authenticated user |

Status mapping in `saveResponse` and `recordResponseManual`:
- `deleted` → `resolved`
- `corrected` → `resolved`
- `verified` → `denied`
- `no_response` / `unknown` → status unchanged (stays `sent`)

### Task 3: cfpbComplaints.ts Created (7330bdf)

`frontend/convex/cfpbComplaints.ts` with four exports:

| Export | Type | Purpose |
|--------|------|---------|
| `saveCfpbComplaint` | internalMutation | Plan 02 target — creates complaint with `portalStatus: "draft"` |
| `getCfpbComplaint` | public query | Most recent complaint for a dispute item (auth-guarded) |
| `updateCfpbStatus` | public mutation | ESC-04 manual portal tracking after filing at consumerfinance.gov |
| `getCfpbComplaintsForUser` | public query | Full complaint history for authenticated user |

## Verification

- TypeScript compilation: clean (`npx tsc --noEmit` — no output = no errors)
- All acceptance criteria checked: 14/14 grep checks passed
- No existing tables modified or removed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functions are fully implemented. `saveResponse` and `saveCfpbComplaint` are internalMutations awaiting Plan 02 action callers, but the functions themselves are complete.

## Self-Check: PASSED
