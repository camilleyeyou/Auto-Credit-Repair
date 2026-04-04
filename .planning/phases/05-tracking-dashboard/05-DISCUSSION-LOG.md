# Phase 5: Tracking & Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-04
**Phase:** 05-tracking-dashboard
**Areas discussed:** Mark as sent flow, Deadline calculation, Tracker timeline UI, Dashboard layout
**Mode:** Auto (all decisions auto-selected as recommended defaults)

---

## Mark as Sent Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Modal on /letters page | Dialog with date picker + tracking number input | ✓ |
| Inline form | Expand card to show form fields | |
| Separate page | Dedicated /mark-sent page | |

**User's choice:** [auto] Modal on /letters page (recommended)

---

## Deadline Calculation

| Option | Description | Selected |
|--------|-------------|----------|
| sentAt + 30 days | Simple calendar day calculation | ✓ |
| sentAt + 5 business days + 30 days | Account for mail transit time | |
| Manual deadline entry | User sets their own deadline | |

**User's choice:** [auto] sentAt + 30 calendar days (recommended — matches FCRA standard)

---

## Tracker Timeline UI

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded card list | Cards with status colors, days remaining, sorted by urgency | ✓ |
| Vertical timeline | Visual timeline with dots and connecting lines | |
| Kanban board | Drag between status columns | |

**User's choice:** [auto] Color-coded card list (recommended — clearest for deadline tracking)

---

## Dashboard Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Summary cards + deadlines + actions | Cards row, upcoming deadlines, overdue alerts, quick actions | ✓ |
| Minimal stats | Just numbers, no details | |
| Full analytics | Charts, graphs, trends | |

**User's choice:** [auto] Summary cards + deadlines + quick actions (recommended)

## Claude's Discretion

- Card layouts, modal component, dashboard visual design, recharts vs HTML

## Deferred Ideas

- Email reminders (v2), escalation letters (v2), CFPB complaints (v2), response uploads (v2)
