# Phase 5: Tracking & Dashboard - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

User can mark dispute letters as sent (with certified mail tracking number and send date), see a 30-day response deadline calculated and counting down, view all disputes on a visual tracker timeline with color-coded statuses, and see a summary dashboard with progress cards, upcoming deadlines, and quick action buttons. Email reminders are deferred to v2.

</domain>

<decisions>
## Implementation Decisions

### Mark as Sent Flow
- **D-01:** "Mark as Sent" button on each letter card in /letters page
- **D-02:** Clicking opens a modal/dialog to enter: send date (date picker, defaults to today) and certified mail tracking number (optional text input)
- **D-03:** On submit: update `dispute_letters` record with sentAt and certifiedMailNumber fields
- **D-04:** Update corresponding `dispute_items` status from "letter_generated" to "sent"
- **D-05:** Calculate 30-day deadline: sentAt + 30 days, stored as `deadline` field on `dispute_letters`

### Deadline Calculation
- **D-06:** Deadline = sentAt + 30 calendar days (FCRA 30-day investigation window)
- **D-07:** Days remaining = deadline - today; negative = overdue
- **D-08:** Overdue threshold: disputes past 30 days with no response flagged on tracker AND dashboard
- **D-09:** No automatic status change — user manually records responses or marks resolved/denied

### Tracker Page UI (/tracker)
- **D-10:** `/tracker` page showing all disputes that have been sent (status >= "sent")
- **D-11:** Each dispute shown as a card with: creditor name, bureau badge, status color, days remaining/overdue, certified mail number
- **D-12:** Color coding: sent/waiting (blue), approaching deadline (amber, <= 5 days), overdue (red), resolved (green), denied (red outline)
- **D-13:** Sort by deadline (most urgent first)
- **D-14:** Filter tabs: All, Active (sent/waiting), Overdue, Resolved

### Dashboard Page UI (/dashboard)
- **D-15:** Replace placeholder dashboard with real summary content
- **D-16:** Summary cards row: Total Disputes, Letters Generated, Letters Sent, Responses Received, Resolved
- **D-17:** Upcoming Deadlines section: list of disputes approaching 30-day deadline (next 7 days), sorted by urgency
- **D-18:** Overdue Alerts section: disputes past deadline with no response, highlighted in red
- **D-19:** Quick Action buttons: "Upload New Report", "Review Pending Items", "Download Letters"
- **D-20:** Recent Activity feed: last 5 status changes across all disputes

### Data Layer Changes
- **D-21:** Add to `dispute_letters` table: sentAt (optional number), certifiedMailNumber (optional string), deadline (optional number)
- **D-22:** Convex mutation: `markAsSent` — sets sentAt, certifiedMailNumber, deadline; updates dispute_items status to "sent"
- **D-23:** Convex query: `getSentLetters` — returns letters with sentAt set, includes deadline calculations
- **D-24:** Convex query: `getDashboardStats` — aggregates counts across disputes, letters, statuses
- **D-25:** Convex query: `getUpcomingDeadlines` — letters where deadline is within 7 days from now

### Navigation
- **D-26:** Add /tracker to nav and middleware
- **D-27:** Dashboard is already in nav at /dashboard — just update the page content

### Claude's Discretion
- Exact card layout and styling for tracker
- Dashboard card visual design (icons, colors, sizing)
- Modal/dialog component choice for Mark as Sent
- Whether to use recharts or simple HTML for any dashboard visualizations
- Loading states and empty states

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Dispute lifecycle, 30-day FCRA window, tracker requirements
- `.planning/REQUIREMENTS.md` — TRK-01 through TRK-04, DASH-01 through DASH-03

### Phase 4 Code (dependencies)
- `frontend/convex/schema.ts` — dispute_letters table to extend with sentAt/deadline fields
- `frontend/convex/letters.ts` — Letter queries/mutations to extend
- `frontend/convex/disputeItems.ts` — Status mutation pattern
- `frontend/app/(protected)/letters/page.tsx` — Letters page to add Mark as Sent button

### Phase 3 Code
- `frontend/convex/disputeItems.ts` — listByUser query for dashboard stats
- `frontend/app/(protected)/disputes/page.tsx` — Status badge pattern to reuse

### Phase 1 Code
- `frontend/app/(protected)/layout.tsx` — Nav to add /tracker link
- `frontend/middleware.ts` — Protected routes to add /tracker
- `frontend/app/(protected)/dashboard/page.tsx` — Dashboard page to replace

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Status badge component pattern from disputes page (color-coded by status)
- Convex mutation pattern for status updates (updateDisputeStatus)
- Nav + middleware update pattern (done 4 times already)
- Bureau badge colors from BureauDropZone (red/blue/cyan)

### Established Patterns
- Convex queries for aggregated data
- useQuery reactive data binding
- Protected route pages under (protected) group
- Date formatting with toLocaleDateString

### Integration Points
- Extend dispute_letters schema with sentAt, certifiedMailNumber, deadline
- New mutations/queries in letters.ts
- New /tracker page
- Replace /dashboard page content
- Add Mark as Sent button to /letters page

</code_context>

<specifics>
## Specific Ideas

- Dashboard should feel like a command center — user opens the app and immediately knows where things stand
- Overdue disputes should be impossible to miss — red background, bold text, top of the list
- Quick action buttons should link to the most common next steps based on current state
- Tracker should show a clear timeline feel — not just a list, but a sense of progression

</specifics>

<deferred>
## Deferred Ideas

- Email reminders at day 25 (v2 — NOTF-01, NOTF-02)
- Second demand letter for ignored disputes (v2 — ESC-01)
- Escalation letters for denied disputes (v2 — ESC-02)
- CFPB complaint suggestion (v2 — ESC-03)
- Bureau response upload for next-round guidance (v2 — ESC-04)

</deferred>

---

*Phase: 05-tracking-dashboard*
*Context gathered: 2026-04-04*
