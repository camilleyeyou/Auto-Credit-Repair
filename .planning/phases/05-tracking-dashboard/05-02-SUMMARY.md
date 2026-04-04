---
phase: "05-tracking-dashboard"
plan: "02"
subsystem: "frontend-letters-page"
tags: [letters, mark-as-sent, dialog, base-ui, convex, date-fns, tracking]
dependency_graph:
  requires:
    - "05-01 — markAsSent mutation, sentAt/certifiedMailNumber/deadline schema fields"
  provides:
    - "Mark as Sent UI flow in /letters page"
    - "sentAt, certifiedMailNumber, deadline display on sent letter cards"
  affects:
    - "frontend/app/(protected)/letters/page.tsx — Mark as Sent button + dialog added"
tech_stack:
  added: []
  patterns:
    - "@base-ui/react Dialog with render prop pattern (not asChild) for v1.3.0"
    - "T12:00:00 anchor on date input to avoid UTC midnight off-by-one-day"
    - "Convex reactive query auto-refreshes LetterCard after mutation — no extra onSuccess state"
key_files:
  created: []
  modified:
    - "frontend/app/(protected)/letters/page.tsx — MarkAsSentDialog component, DisputeLetter interface updated"
decisions:
  - "Dialog.Trigger and Dialog.Close use className prop directly (not asChild) — @base-ui/react v1.3.0 uses render prop pattern, not Radix asChild pattern"
  - "sentAt conversion uses new Date(dateValue + 'T12:00:00').getTime() to avoid UTC midnight timezone boundary issues"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-03"
  tasks_completed: 1
  files_modified: 1
---

# Phase 5 Plan 02: Mark as Sent Flow Summary

**One-liner:** Added MarkAsSentDialog component to the letters page using @base-ui/react Dialog, collecting send date and optional certified mail number, with reactive card update via Convex query.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add Mark as Sent button, dialog, and post-sent display to LetterCard | c1babdd | frontend/app/(protected)/letters/page.tsx |

## What Was Built

### MarkAsSentDialog Component
New component added to `frontend/app/(protected)/letters/page.tsx`:
- Props: `letterId: Id<"dispute_letters">`, `onSuccess: () => void`
- Local state: `open`, `dateValue` (default today), `trackingNumber`, `submitting`, `error`
- Uses `useMutation(api.letters.markAsSent)` for the mutation call
- Date conversion: `new Date(dateValue + "T12:00:00").getTime()` — avoids UTC midnight off-by-one-day issue
- Uses `@base-ui/react Dialog` with controlled `open`/`onOpenChange` state

### DisputeLetter Interface Extension
Three optional fields added:
- `sentAt?: number`
- `certifiedMailNumber?: string`
- `deadline?: number`

### LetterCard Conditional Rendering
- Shows `<MarkAsSentDialog>` when `letter.sentAt === undefined`
- Shows sent info section when `letter.sentAt !== undefined`:
  - Sent date formatted with date-fns
  - Certified mail tracking number (if present)
  - 30-day deadline date (if present)

## Verification Results

1. TypeScript errors in letters/page.tsx are only the pre-existing `_generated` missing module errors (expected until `npx convex dev` runs) — PASSED
2. `asChild` TypeScript error resolved by using className prop directly on Dialog.Trigger and Dialog.Close — PASSED
3. All existing functionality (Download PDF, Preview toggle) preserved — PASSED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @base-ui/react v1.3.0 does not support `asChild` prop**
- **Found during:** Task 1
- **Issue:** Plan specified `Dialog.Trigger asChild` and `Dialog.Close asChild` patterns, but @base-ui/react v1.3.0 uses `render` prop pattern (Radix UI style `asChild` is not supported)
- **Fix:** Removed `asChild` prop; used `className` prop directly on `Dialog.Trigger` and `Dialog.Close` — these render native buttons by default, so no render prop needed
- **Files modified:** `frontend/app/(protected)/letters/page.tsx`
- **Commit:** c1babdd

**2. [Rule 3 - Blocking] File was already partially updated by previous session**
- **Found during:** Task 1
- **Issue:** The letters/page.tsx file already contained the core Mark as Sent functionality from a previous (uncommitted) session; needed verification and TypeScript fix rather than fresh write
- **Fix:** Read existing file, identified the asChild TypeScript errors, applied targeted fixes
- **Files modified:** `frontend/app/(protected)/letters/page.tsx`
- **Commit:** c1babdd

## Known Stubs

None. The Mark as Sent dialog calls the real `markAsSent` mutation. All fields are wired to real data.

## Self-Check: PASSED

- `frontend/app/(protected)/letters/page.tsx` — contains MarkAsSentDialog: FOUND
- `frontend/app/(protected)/letters/page.tsx` — contains Dialog from @base-ui/react/dialog: FOUND
- `frontend/app/(protected)/letters/page.tsx` — contains useMutation from convex/react: FOUND
- `frontend/app/(protected)/letters/page.tsx` — contains sentAt, certifiedMailNumber, deadline in DisputeLetter: FOUND
- Commit c1babdd — exists: FOUND
