---
phase: "05-tracking-dashboard"
plan: "01"
subsystem: "convex-data-layer"
tags: [schema, convex, mutations, queries, date-fns, tracking]
dependency_graph:
  requires: []
  provides:
    - "date-fns dependency for all Phase 5 UI plans"
    - "dispute_letters.sentAt field for markAsSent flow"
    - "dispute_letters.certifiedMailNumber field for USPS tracking"
    - "dispute_letters.deadline field for 30-day window"
    - "markAsSent mutation for Plan 02 letters page modal"
    - "getSentLetters query for Plan 02 tracker page"
    - "getDashboardStats query for Plan 03 dashboard"
    - "getUpcomingDeadlines query for Plan 03 dashboard"
  affects:
    - "frontend/convex/letters.ts — 4 new exports added"
    - "frontend/convex/schema.ts — dispute_letters table extended"
tech_stack:
  added:
    - "date-fns ^4.1.0 — date formatting and arithmetic (fixes existing broken import in letters/page.tsx)"
  patterns:
    - "Loop-join pattern in getSentLetters mirrors getApprovedWithoutLetters"
    - "itemStatusMap lookup for overdue detection avoids N+1 item fetches in getDashboardStats"
    - "Optional schema fields so existing records remain valid without migration"
key_files:
  created: []
  modified:
    - "frontend/package.json — date-fns ^4.1.0 added to dependencies"
    - "frontend/convex/schema.ts — dispute_letters extended with sentAt, certifiedMailNumber, deadline"
    - "frontend/convex/letters.ts — markAsSent, getSentLetters, getDashboardStats, getUpcomingDeadlines appended"
decisions:
  - "deadline stored at write time in markAsSent (not computed at read time) so queries can filter against it directly"
  - "overdue detection uses itemStatusMap lookup (not N+1 ctx.db.get calls) to avoid performance issues on large datasets"
  - "markAsSent guard throws if letter.sentAt !== undefined to prevent double-marking (Open Question 3)"
  - "getSentLetters/getUpcomingDeadlines use Array<{ letter: any; item: any }> type annotation — Convex _generated types unavailable until npx convex dev runs"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_modified: 3
---

# Phase 5 Plan 01: Schema Extension and Convex Data Functions Summary

**One-liner:** Installed date-fns, extended dispute_letters schema with optional sentAt/certifiedMailNumber/deadline fields, and added markAsSent mutation plus getSentLetters/getDashboardStats/getUpcomingDeadlines queries as the dependency anchor for Phase 5.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Install date-fns, extend dispute_letters schema | 0f5daf8 | frontend/package.json, frontend/convex/schema.ts, frontend/package-lock.json |
| 2 | Add 4 new Convex functions to letters.ts | 3a96838 | frontend/convex/letters.ts |

## What Was Built

### Schema Extension (dispute_letters table)
Three optional tracking fields added to `frontend/convex/schema.ts`:
- `sentAt: v.optional(v.number())` — Unix ms mailing date
- `certifiedMailNumber: v.optional(v.string())` — USPS tracking number
- `deadline: v.optional(v.number())` — sentAt + 30 days in ms

All three wrapped in `v.optional()` so existing letter records without these fields remain valid (no migration required).

### New Convex Functions (letters.ts)

**markAsSent** (mutation):
- Args: `letterId`, `sentAt`, `certifiedMailNumber` (optional)
- Auth check + ownership check pattern
- Double-send guard: throws if `letter.sentAt !== undefined`
- Deadline = `args.sentAt + 30 * 24 * 60 * 60 * 1000` (NOT Date.now())
- Atomically patches both `dispute_letters` and `dispute_items` in same handler

**getSentLetters** (query):
- Filters letters where `sentAt` is not undefined
- Loop-joins with `dispute_items` via `ctx.db.get(letter.disputeItemId)`
- Returns `{ letter, item }[]` sorted by `deadline` ascending

**getDashboardStats** (query):
- Fetches ALL items and ALL letters for user (no status filter)
- Builds `itemStatusMap` for O(1) overdue status checks
- Overdue = `deadline < now AND item.status === "sent"` (excludes resolved/denied)
- Returns: `{ totalDisputes, lettersGenerated, lettersSent, responsesReceived, resolved, overdue }`

**getUpcomingDeadlines** (query):
- Filters sent letters where `deadline >= now AND deadline <= now + 7 days`
- Loop-joins with `dispute_items`
- Returns `{ letter, item }[]` sorted by deadline ascending

## Verification Results

1. `node -e "require('date-fns')"` — PASSED
2. `package.json` contains `"date-fns": "^4.1.0"` — PASSED
3. `schema.ts` dispute_letters has `sentAt`, `certifiedMailNumber`, `deadline` all optional — PASSED
4. `letters.ts` exports 10 functions total (6 original + 4 new) — PASSED
5. TypeScript errors in letters.ts are all pre-existing `_generated` missing module errors (expected until `npx convex dev` runs) — no new errors introduced

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Minor notation:** Used `Array<{ letter: any; item: any }>` for return type in `getSentLetters` and `getUpcomingDeadlines` instead of complex generic expressions, because `_generated/dataModel` types are unavailable until Convex dev server initializes. This is consistent with the rest of the codebase where the same module-not-found errors exist throughout all convex files.

## Known Stubs

None. This plan is pure data layer (schema + mutations/queries). No UI components, no stub data.

## Self-Check: PASSED

- `frontend/package.json` — contains date-fns: FOUND
- `frontend/convex/schema.ts` — contains sentAt, certifiedMailNumber, deadline: FOUND
- `frontend/convex/letters.ts` — contains markAsSent, getSentLetters, getDashboardStats, getUpcomingDeadlines: FOUND
- Commit 0f5daf8 — exists in git log: FOUND
- Commit 3a96838 — exists in git log: FOUND
