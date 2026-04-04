---
phase: "05-tracking-dashboard"
plan: "03"
subsystem: "frontend-tracker-dashboard"
tags: [tracker, dashboard, filter-tabs, color-coding, convex, date-fns, navigation, middleware]
dependency_graph:
  requires:
    - "05-01 — getSentLetters, getDashboardStats, getUpcomingDeadlines queries"
    - "05-02 — markAsSent mutation wired to letters page (sentAt data source)"
  provides:
    - "Dispute tracker page at /tracker with color-coded cards and filter tabs"
    - "Real dashboard with summary stats, overdue alerts, deadlines, quick actions, recent activity"
    - "Tracker nav link and protected route"
  affects:
    - "frontend/app/(protected)/tracker/page.tsx — NEW file"
    - "frontend/app/(protected)/dashboard/page.tsx — placeholder replaced with real content"
    - "frontend/app/(protected)/layout.tsx — Tracker nav link added"
    - "frontend/middleware.ts — /tracker(.*) added to protected routes"
tech_stack:
  added: []
  patterns:
    - "TrackerEntry interface typing the loop-join getSentLetters return shape (avoids implicit any)"
    - "differenceInCalendarDays from date-fns for deadline countdown at render time"
    - "Filter tab pattern with border-b-2 active indicator (consistent with disputes page)"
    - "typedData cast pattern (same as other pages where _generated types unavailable)"
key_files:
  created:
    - "frontend/app/(protected)/tracker/page.tsx — tracker page with filter tabs and color-coded cards"
  modified:
    - "frontend/app/(protected)/dashboard/page.tsx — full replacement with real summary content"
    - "frontend/app/(protected)/layout.tsx — Tracker nav link between Letters and Profile"
    - "frontend/middleware.ts — /tracker(.*) added to isProtectedRoute matcher"
decisions:
  - "TrackerEntry interface defined inline in tracker/page.tsx to type the getSentLetters any return — avoids all implicit-any errors without _generated types"
  - "Dashboard overdue detection re-filters sentLetters client-side (status === sent && days < 0) for the alert list, while stats.overdue count comes from getDashboardStats"
  - "Overdue filter tab uses status === sent && days < 0 (not denied) per Pitfall 7 — overdue and denied are visually and logically distinct"
metrics:
  duration: "10 minutes"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_modified: 4
---

# Phase 5 Plan 03: Tracker Page and Dashboard Summary

**One-liner:** Created /tracker page with color-coded FCRA dispute cards and filter tabs (All/Active/Overdue/Resolved), replaced the /dashboard placeholder with real summary stats, overdue alerts, upcoming deadlines, quick actions, and recent activity — completing all Phase 5 requirements.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create /tracker page with color-coded cards and filter tabs | d32a0b8 | frontend/app/(protected)/tracker/page.tsx |
| 2 | Replace dashboard, add /tracker to nav and middleware | ebab94c | frontend/app/(protected)/dashboard/page.tsx, frontend/app/(protected)/layout.tsx, frontend/middleware.ts |

## What Was Built

### Tracker Page (frontend/app/(protected)/tracker/page.tsx)

New "use client" page using `useQuery(api.letters.getSentLetters)`:

**Color coding (D-12):**
- Blue background: active (sent, days >= 0, not approaching)
- Amber background: approaching (days <= 5)
- Red background: overdue (status === "sent" AND days < 0)
- Green background: resolved
- Red border / white background: denied

**Filter tabs (D-14):**
- All: shows everything
- Active: status === "sent" && days >= 0
- Overdue: status === "sent" && days < 0 — ONLY sent past deadline, NOT denied (Pitfall 7)
- Resolved: status === "resolved" OR status === "denied"

**Each card shows:** creditorName, accountNumberLast4, bureau badge, getDaysLabel (days remaining/overdue/resolved/denied), sentAt date, deadline date, certifiedMailNumber, fcraSection and disputeReason

**TrackerEntry interface** types the loop-joined shape returned by getSentLetters to avoid implicit-any TypeScript errors.

### Dashboard Page (frontend/app/(protected)/dashboard/page.tsx)

Full replacement of the placeholder with a real "use client" component:

1. **Summary cards (D-16):** 5 cards in 2-col mobile / 5-col desktop grid:
   - Total Disputes (gray), Letters Generated (blue), Letters Sent (indigo), Responses Received (purple), Resolved (green)

2. **Overdue Alerts (D-18, TRK-04):** Red section shown only when `stats.overdue > 0`; lists creditor + bureau + days overdue; links to /tracker

3. **Upcoming Deadlines (D-17):** From `getUpcomingDeadlines` (already filtered to 7 days); shows days remaining with amber color if <= 3 days

4. **Quick Actions (D-19, DASH-03):** 3 Link buttons to /upload, /disputes, /letters

5. **Recent Activity (D-20):** Last 5 sent letters by sentAt desc; shows creditorName, bureau badge, sent date

### Nav and Middleware Updates (D-26)
- `layout.tsx`: Tracker link added between Letters and Profile
- `middleware.ts`: `/tracker(.*)` added to `isProtectedRoute` array

## Verification Results

1. `npx tsc --noEmit` — no new errors in tracker/page.tsx, dashboard/page.tsx, layout.tsx, middleware.ts (only pre-existing _generated module errors expected until npx convex dev runs) — PASSED
2. tracker/page.tsx exists with getSentLetters, FilterTab, getUrgencyClasses, overdue filter logic — PASSED
3. dashboard/page.tsx has 5 summary cards, overdue alert conditional, upcoming deadlines, quick actions, recent activity — PASSED
4. layout.tsx contains href="/tracker" — PASSED
5. middleware.ts contains "/tracker(.*)" in isProtectedRoute — PASSED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] TrackerEntry interface needed for TypeScript correctness**
- **Found during:** Task 1
- **Issue:** getSentLetters returns `Array<{ letter: any; item: any }>` (per Plan 01 decision — _generated types unavailable). Destructuring in filter and map callbacks produced TS7031 implicit-any errors.
- **Fix:** Added `TrackerEntry` interface inline in tracker/page.tsx; cast `data as TrackerEntry[]`; consistent with the cast pattern used on other pages (disputes/page.tsx uses `items as DisputeItem[]`)
- **Files modified:** `frontend/app/(protected)/tracker/page.tsx`
- **Commit:** d32a0b8

## Known Stubs

None. All queries (`getSentLetters`, `getDashboardStats`, `getUpcomingDeadlines`) are real Convex queries reading from the production database. No mock data or placeholder values flow to the UI.

## Self-Check: PASSED

- `frontend/app/(protected)/tracker/page.tsx` — exists: FOUND
- `frontend/app/(protected)/tracker/page.tsx` — contains getSentLetters, FilterTab, getUrgencyClasses, overdue filter: FOUND
- `frontend/app/(protected)/dashboard/page.tsx` — contains getDashboardStats, getUpcomingDeadlines, getSentLetters, 5 stat cards, stats.overdue conditional: FOUND
- `frontend/app/(protected)/layout.tsx` — contains href="/tracker": FOUND
- `frontend/middleware.ts` — contains "/tracker(.*)": FOUND
- Commit d32a0b8 — exists in git log: FOUND
- Commit ebab94c — exists in git log: FOUND
