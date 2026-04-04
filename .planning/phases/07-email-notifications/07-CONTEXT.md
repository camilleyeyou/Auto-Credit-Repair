# Phase 7: Email Notifications - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Proactive email reminders for approaching and overdue dispute deadlines. Day-25 alert for approaching deadlines, day-31 nudge if no bureau response logged. User can configure email preferences (enable/disable, customize timing). Uses Resend for email delivery and Convex native scheduling (crons + scheduler). This is the final phase of milestone v1.1.

</domain>

<decisions>
## Implementation Decisions

### Resend Setup
- **D-01:** Install `resend` npm package in frontend (Convex actions run Node.js)
- **D-02:** `RESEND_API_KEY` stored as Convex env var (via `npx convex env set`)
- **D-03:** Sending email address: configurable via `RESEND_FROM_EMAIL` Convex env var
- **D-04:** Convex action `sendReminderEmail` makes the Resend API call — never from mutations or frontend

### Reminder Scheduling
- **D-05:** `convex/crons.ts` defines a daily cron job (runs at 8 AM UTC) that scans for due reminders
- **D-06:** Daily cron calls a mutation that queries disputes with approaching deadlines
- **D-07:** For each due reminder, cron triggers the `sendReminderEmail` action
- **D-08:** Day-25 reminder: fires when deadline is 5 days away AND no response recorded AND reminders enabled
- **D-09:** Day-31 nudge: fires when deadline has passed by 1 day AND no response recorded AND status is still "sent"
- **D-10:** Check response status before firing — suppress reminder if response already recorded
- **D-11:** Use estimated_receipt_date (sentAt + 5 days buffer) as deadline anchor, consistent with Phase 5

### Email Templates
- **D-12:** Two email templates: "Deadline Approaching" (day 25) and "No Response Alert" (day 31)
- **D-13:** Templates include: dispute summary (creditor, bureau, dispute date), days remaining/overdue, action link to tracker page
- **D-14:** Plain HTML email (no React Email dependency needed for 2 simple templates — keep it lean)
- **D-15:** Email subject lines: "CreditFix: Deadline approaching for [creditor] dispute" and "CreditFix: No response from [bureau] — time to escalate"

### Email Preferences
- **D-16:** Add email preferences to Convex `users` table: emailRemindersEnabled (boolean, default true), reminderEmail (string, defaults to auth email)
- **D-17:** Preferences UI: section on existing /profile page (not a new page)
- **D-18:** Toggle for enable/disable email reminders
- **D-19:** Optional custom email address field (defaults to login email)
- **D-20:** Reminder timing is fixed (day 25 and day 31) — not user-customizable in v1.1
- **D-21:** Daily cron checks `emailRemindersEnabled` before sending — respects opt-out

### Logging & Tracking
- **D-22:** Log each sent reminder in a `reminder_log` field or separate lightweight tracking (avoid a full table for now)
- **D-23:** Don't send duplicate reminders — track last reminder sent date per dispute to prevent double-sends on cron re-runs

### Claude's Discretion
- Exact email HTML styling
- Whether to batch reminders into a single daily digest vs individual emails per dispute
- Error handling for Resend API failures (retry logic)
- Loading states on preferences form

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Email + dashboard reminders requirement
- `.planning/REQUIREMENTS.md` — NOTF-01, NOTF-02, NOTF-03
- `.planning/research/STACK.md` — Resend recommendation, Convex scheduling docs
- `.planning/research/PITFALLS.md` — Email timing (receipt vs send date), email infrastructure (SPF/DKIM)

### Existing Code
- `frontend/convex/schema.ts` — Users table to extend with email prefs
- `frontend/convex/users.ts` — Profile mutations to extend
- `frontend/convex/letters.ts` — `getSentLetters` query (has deadline data)
- `frontend/convex/bureauResponses.ts` — Response queries (to check before sending)
- `frontend/app/(protected)/profile/page.tsx` — Profile page to add preferences section
- `frontend/app/(protected)/tracker/page.tsx` — Tracker page (linked from emails)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getSentLetters` query returns letters with deadlines and dispute items (loop-join)
- `getResponseForItem` query checks if response exists for a dispute
- User profile mutation pattern (updateProfile in users.ts)

### Established Patterns
- Convex actions for external HTTP calls
- Schema extension with v.optional() for backward compat

### Integration Points
- Add emailRemindersEnabled + reminderEmail to users table schema
- Add preferences UI section to /profile page
- New `convex/crons.ts` file for scheduled jobs
- New `sendReminderEmail` action

</code_context>

<specifics>
## Specific Ideas

- Emails should be simple and clear — not marketing-style, just "here's what needs your attention"
- Include a direct link to the tracker page so she can take action immediately
- Day-31 nudge should suggest escalation options (demand letter, CFPB) — connect to Phase 6 work

</specifics>

<deferred>
## Deferred Ideas

- Configurable reminder timing (day 15, 20, 25 etc.) — keep fixed for v1.1
- Daily digest mode (batch all reminders into one email) — individual emails for now
- SMS notifications — requires TCPA compliance, defer indefinitely

</deferred>

---

*Phase: 07-email-notifications*
*Context gathered: 2026-04-04*
