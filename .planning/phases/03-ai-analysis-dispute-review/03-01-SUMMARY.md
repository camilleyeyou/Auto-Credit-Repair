---
phase: "03"
plan: "01"
subsystem: convex-data-layer
tags: [convex, schema, dispute-items, credit-reports, data-contract]
dependency_graph:
  requires: []
  provides:
    - dispute_items table in Convex schema
    - analysisStatus/analysisErrorMessage on credit_reports
    - saveDisputeItems internal mutation (idempotent, called by analyzeReport)
    - updateDisputeStatus public mutation (auth-guarded, approve/skip UI)
    - listByUser public query (user dispute items)
    - listByReport public query (per-report dispute items with ownership check)
    - setAnalysisStatus internal mutation (AI pipeline progress tracking)
  affects:
    - frontend/convex/schema.ts
    - frontend/convex/disputeItems.ts
    - frontend/convex/creditReports.ts
tech_stack:
  added: []
  patterns:
    - Convex internalMutation for server-side-only mutations
    - Idempotent mutation pattern (delete-then-insert for re-analysis)
    - Auth + ownership guard pattern (getUserIdentity + userId === identity.subject)
key_files:
  created:
    - frontend/convex/disputeItems.ts
  modified:
    - frontend/convex/schema.ts
    - frontend/convex/creditReports.ts
decisions:
  - dispute_items status lifecycle has 7 states (pending_review, approved, skipped, letter_generated, sent, resolved, denied) to cover full dispute tracking lifecycle through Phase 4/5
  - fcraSectionTitle denormalized on dispute_items so UI can display it without additional lookups
  - saveDisputeItems is idempotent via delete-before-insert so re-analysis cleanly replaces prior results
  - listByReport ownership verified against parent credit_reports record (not just item userId)
metrics:
  duration: "~2 minutes"
  completed: "2026-04-04"
  tasks: 3
  files: 3
---

# Phase 3 Plan 01: Convex Data Layer for Dispute Items Summary

Convex schema extended with dispute_items table (7-status lifecycle, 3 indexes) and analysisStatus tracking on credit_reports; full CRUD/query module for dispute items implemented with auth guards and idempotency.

## What Was Built

### Task 1 — Extend Convex schema (commit: af25b30)
Added two extensions to `frontend/convex/schema.ts`:
- `analysisStatus` (4-state union: not_analyzed, analyzing, analyzed, analysis_failed) and `analysisErrorMessage` on `credit_reports`
- New `dispute_items` table with 14 fields covering the full dispute item lifecycle including FCRA section reference, AI confidence score, denormalized bureau/userId, and a 7-state status lifecycle

### Task 2 — Create disputeItems.ts module (commit: aaa847a)
Created `frontend/convex/disputeItems.ts` with four exports:
- `saveDisputeItems` — internalMutation, idempotent (deletes existing by_report index before re-inserting), sets status=pending_review and createdAt server-side
- `updateDisputeStatus` — public mutation, auth + ownership guard, accepts only approved/skipped
- `listByUser` — public query, returns user's items via by_user index ordered createdAt asc
- `listByReport` — public query, verifies caller owns parent report before returning items

### Task 3 — Add setAnalysisStatus to creditReports.ts (commit: 21e247e)
Appended `setAnalysisStatus` internalMutation to `frontend/convex/creditReports.ts` following exact setParseStatus pattern. All 7 pre-existing exports unchanged.

## Decisions Made

- **Idempotency via delete-then-insert**: saveDisputeItems deletes all existing dispute_items for the reportId before inserting the new batch. This makes re-analysis safe without needing a separate "clear" step.
- **fcraSectionTitle denormalized**: Stored on each dispute_items row (not just fcraSection code) to avoid client-side joins with the FCRA_LIBRARY lookup table. Slightly more storage, much simpler UI queries.
- **listByReport ownership via parent report**: Rather than checking item.userId on each returned item, we check the parent report once. This is consistent with the authorization model and prevents orphaned items from being accessible.

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Status

Pre-existing TS errors from missing Convex generated files (`_generated/server`, `_generated/api`, `_generated/dataModel`) remain unchanged. These are expected until `npx convex dev --once` completes the Convex cloud init (known auth gate from Phase 01). No new TypeScript errors were introduced by Phase 3 code.

## Known Stubs

None — all functions are fully implemented with real logic. No placeholder data or hardcoded values that flow to UI rendering.

## Self-Check: PASSED

Files created/modified:
- FOUND: frontend/convex/schema.ts
- FOUND: frontend/convex/disputeItems.ts
- FOUND: frontend/convex/creditReports.ts

Commits:
- af25b30 — feat(03-01): extend Convex schema with dispute_items table and analysisStatus
- aaa847a — feat(03-01): create disputeItems.ts Convex module with mutations and queries
- 21e247e — feat(03-01): add setAnalysisStatus internalMutation to creditReports.ts
