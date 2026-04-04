# Phase 7: Email Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-04
**Phase:** 07-email-notifications
**Areas discussed:** Resend setup, Reminder scheduling, Email templates, Preferences UI
**Mode:** Auto (all decisions auto-selected as recommended defaults)

---

## Resend Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Convex action + Resend SDK | Action calls resend.emails.send() | ✓ |
| Convex Edge Function | Separate edge function for email | |
| Direct SMTP | Configure SMTP transport | |

**User's choice:** [auto] Convex action + Resend SDK (recommended)

---

## Reminder Scheduling

| Option | Description | Selected |
|--------|-------------|----------|
| Convex crons + scheduler | Daily cron scan + per-dispute scheduling | ✓ |
| External cron (Railway) | Separate cron job hitting an API | |
| Client-side polling | Check on page load | |

**User's choice:** [auto] Convex native crons (recommended — zero new infra)

---

## Email Templates

| Option | Description | Selected |
|--------|-------------|----------|
| Plain HTML strings | Simple, no deps | ✓ |
| React Email components | Full React email framework | |
| Markdown to HTML | Template in markdown | |

**User's choice:** [auto] Plain HTML (recommended — only 2 templates, keep lean)

---

## Preferences UI

| Option | Description | Selected |
|--------|-------------|----------|
| Section on /profile | Add to existing page | ✓ |
| Separate /settings page | New page for all settings | |
| Modal from nav | Settings modal accessible anywhere | |

**User's choice:** [auto] Section on /profile page (recommended — no new page needed)

## Claude's Discretion

- Email HTML styling, batch vs individual, retry logic, loading states

## Deferred Ideas

- Configurable timing, daily digest, SMS
