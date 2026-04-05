---
phase: 07-email-notifications
plan: "01"
subsystem: database
tags: [convex, schema, mutations, internalQuery]

# Dependency graph
requires:
  - phase: 06-response-escalation
    provides: dispute_letters and cfpb_complaints tables that reminder_log references via letterId

provides:
  - users table extended with emailRemindersEnabled and reminderEmail optional fields
  - reminder_log table with by_letter_and_type index for cron de-duplication
  - updateEmailPrefs mutation for profile UI (Plan 03)
  - getEmailPrefs internalQuery for cron scan (Plan 02)

affects:
  - 07-02-cron-engine
  - 07-03-profile-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "internalQuery pattern: expose user record to cron scan without public API surface"
    - "Optional fields on users table for backward-compatible preference extensions"

key-files:
  created: []
  modified:
    - frontend/convex/schema.ts
    - frontend/convex/users.ts

key-decisions:
  - "reminderEmail stored as undefined (not empty string) per Pitfall 5 in RESEARCH.md anti-patterns"
  - "emailRemindersEnabled absent = true (opt-out model) per D-21"
  - "getEmailPrefs returns full user record (not projected subset) — callers handle null"
  - "reminder_log by_letter_and_type index on [letterId, reminderType] enables idempotent cron sends"

patterns-established:
  - "internalQuery for cron-accessible data: accepts userId string, casts to Id<'users'>, returns full record"

requirements-completed:
  - NOTF-01
  - NOTF-02
  - NOTF-03

# Metrics
duration: 1min
completed: 2026-04-03
---

# Phase 7 Plan 01: Email Notifications Schema Summary

**Convex schema extended with email preference fields on users table and reminder_log de-duplication table; updateEmailPrefs mutation and getEmailPrefs internalQuery added to users.ts**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-03T15:08:26Z
- **Completed:** 2026-04-03T15:09:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended users table with `emailRemindersEnabled` (v.optional(v.boolean())) and `reminderEmail` (v.optional(v.string())) — fully backward-compatible optional fields
- Added `reminder_log` table with `by_letter_and_type` index on `[letterId, reminderType]` for idempotent cron reminder dispatch
- Added `updateEmailPrefs` mutation (auth-guarded, patches both preference fields)
- Added `getEmailPrefs` internalQuery (takes userId string, returns user record for cron scan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend schema — users email prefs + reminder_log table** - `1b9106f` (feat)
2. **Task 2: Add updateEmailPrefs mutation and getEmailPrefs internalQuery** - `50912b8` (feat)

## Files Created/Modified
- `frontend/convex/schema.ts` - Added emailRemindersEnabled + reminderEmail to users table; added reminder_log table with by_letter_and_type index
- `frontend/convex/users.ts` - Added updateEmailPrefs mutation, getEmailPrefs internalQuery, internalQuery + Id imports

## Decisions Made
- `reminderEmail` stored as `undefined` (not empty string) when not provided — per RESEARCH.md Pitfall 5 (empty strings cause false-positive comparisons)
- `emailRemindersEnabled` absent treated as `true` (opt-out model) per D-21 — no migration needed for existing users
- `getEmailPrefs` returns full user record rather than projected subset — cron scan needs both email fields; callers handle null
- `reminder_log` index covers `[letterId, reminderType]` to allow day25 and day31 reminders per letter without collision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (cron engine): can now read `emailRemindersEnabled`/`reminderEmail` via `internal.users.getEmailPrefs` and write to `reminder_log` with the `by_letter_and_type` index for de-duplication
- Plan 03 (profile UI): can now call `updateEmailPrefs` mutation directly from the settings form
- TypeScript compiles cleanly — 0 errors

---
*Phase: 07-email-notifications*
*Completed: 2026-04-03*
