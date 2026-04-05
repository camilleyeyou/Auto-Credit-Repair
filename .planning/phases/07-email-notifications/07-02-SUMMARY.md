# Plan 07-02: Notification Engine — Summary

**Status:** complete
**Tasks:** 2/2

## What was built

- `frontend/convex/notifications.ts` — `"use node"` internalAction calling Resend SDK. Plain HTML templates for day-25 (deadline approaching) and day-31 (no response, escalation suggestions). Errors logged, not thrown.
- `frontend/convex/crons.ts` — Daily 8 AM UTC scan via `crons.cron("0 8 * * *")`. De-duplication via reminder_log index. Checks: sentAt defined, initial letterType only, dispute status "sent", no bureau response, emailRemindersEnabled not false, no existing log entry. Per-letter try/catch for resilience.
- `resend` npm package installed

## Self-Check: PASSED

- "use node" at line 1 of notifications.ts
- No queries/mutations in notifications.ts (actions-only)
- crons.cron() used, not crons.daily()
- De-duplication via by_letter_and_type index
- Response suppression via by_dispute_item index
- Opt-out check on emailRemindersEnabled
