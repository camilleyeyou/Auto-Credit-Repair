---
phase: 07-email-notifications
plan: "03"
subsystem: ui
tags: [nextjs, convex, react, email-preferences, profile]

# Dependency graph
requires:
  - phase: 07-email-notifications
    provides: updateEmailPrefs mutation and getEmailPrefs internalQuery from Plan 01

provides:
  - Email Reminders Card in /profile page with checkbox toggle and optional reminder email input
  - handlePrefsSubmit handler calling updateEmailPrefs mutation with empty-string-to-undefined conversion
  - Pre-populated form reading emailRemindersEnabled and reminderEmail from currentUser query

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate form state per card section (prefsSaved/prefsError/prefsLoading alongside saved/error/loading)"
    - "HTML checkbox input (not Switch) for boolean preference toggle — only button/card/input/label available in project"
    - "defaultChecked={user?.emailRemindersEnabled !== false} for opt-out model (absent = enabled)"
    - "empty string to undefined conversion: reminderEmailValue || undefined"

key-files:
  created: []
  modified:
    - frontend/app/(protected)/profile/page.tsx

key-decisions:
  - "Used plain <input type='checkbox'> instead of Switch — Switch not present in frontend/components/ui/"
  - "Separate state variables (prefsSaved/prefsError/prefsLoading) isolate email prefs form from existing profile form"
  - "defaultChecked={user?.emailRemindersEnabled !== false} implements opt-out default (new users without field get checkbox checked)"

patterns-established:
  - "Multi-card profile page pattern: each Card has its own form + state tuple, shares only the top-level useQuery"

requirements-completed:
  - NOTF-03

# Metrics
duration: 2min
completed: 2026-04-05
---

# Phase 07 Plan 03: Email Preferences Profile UI Summary

**Email Reminders Card added to /profile page with checkbox toggle, optional email input, and separate form state calling updateEmailPrefs mutation**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-05T17:14:26Z
- **Completed:** 2026-04-05T17:16:30Z
- **Tasks:** 1 (+ 1 auto-approved checkpoint)
- **Files modified:** 1

## Accomplishments
- Added `updateEmailPrefs` mutation usage with isolated state variables (prefsSaved, prefsError, prefsLoading) keeping email prefs form independent from existing profile form
- Added `handlePrefsSubmit` handler with empty-string-to-undefined conversion for `reminderEmail` (per RESEARCH.md Pitfall 5)
- Appended Email Reminders Card below existing Profile Card with checkbox pre-populated from `currentUser.emailRemindersEnabled` and email input pre-populated from `currentUser.reminderEmail`
- TypeScript compiles with 0 errors; existing profile form untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Add EmailPreferences card section to /profile page** - `b04397d` (feat)
2. **Task 2: checkpoint:human-verify** - auto-approved (auto mode)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/app/(protected)/profile/page.tsx` - Added updateEmailPrefs mutation, separate prefs state, handlePrefsSubmit handler, and Email Reminders Card with checkbox + optional email input

## Decisions Made
- Used plain `<input type="checkbox">` (not Switch) — Switch component is not present in `frontend/components/ui/` (only button, card, input, label available)
- Separate state tuple (prefsSaved/prefsError/prefsLoading) keeps email prefs form fully isolated from existing profile form, preventing cross-form state interference
- `defaultChecked={user?.emailRemindersEnabled !== false}` correctly handles new users (field absent = enabled, consistent with opt-out model from D-21)

## Deviations from Plan

None - plan executed exactly as written. The plan already specified using a plain checkbox if Switch was not present, which it was not.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required for this plan. Email sending (Plan 02) requires Resend API key in RESEND_API_KEY environment variable.

## Next Phase Readiness
- All three NOTF requirements completed:
  - NOTF-01: reminder_log table + by_letter_and_type index (Plan 01)
  - NOTF-02: cron engine (notifications.ts + crons.ts) (Plan 02)
  - NOTF-03: profile UI toggle + custom email input (this plan)
- Phase 07 email notification system is complete

## Known Stubs

None — form is wired to real `updateEmailPrefs` mutation; `defaultValue` and `defaultChecked` read from live `currentUser` query.

## Self-Check: PASSED
