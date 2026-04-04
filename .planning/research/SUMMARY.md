# Research Summary — v1.1 Escalation & Notifications

**Synthesized:** 2026-04-04

## Executive Summary

Milestone v1.1 completes the dispute lifecycle: what happens after a letter is sent. The core dependency is a response intake system — every escalation, reminder, and CFPB feature builds on knowing whether and how a bureau responded. Stack additions are minimal (Resend for email, Convex native scheduling). No new Python packages needed.

## Stack Additions
- **Resend** (^3.x) for transactional email — single SDK call from Convex actions
- **Convex native scheduling** — crons.ts for daily scans, ctx.scheduler.runAfter() for per-dispute reminders
- **No new Python packages** — PyMuPDF + Claude tool_use handles bureau response parsing
- **CFPB** — static content + link only, no API integration possible

## Feature Table Stakes
- Response intake with outcome classification (verified/deleted/corrected) — **foundation for everything**
- 30-day deadline email reminders via Resend
- Second-round escalation letter generation (reuses existing AI letter gen)
- CFPB complaint narrative generation
- No-response escalation nudge at day 31

## Watch Out For
- **FCRA entity type branching** — CRA vs furnisher disputes have different legal requirements
- **Bureau response misclassification** — need confidence scoring + human review path
- **UPL risk in CFPB guidance** — process info only, never outcome predictions
- **Email timing** — use estimated_receipt_date (sent + 3-5 days), not send date
- **Email infrastructure** — SPF/DKIM/DMARC + unsubscribe required before first send

## Suggested Phase Structure (continues from Phase 5)
6. **Response Intake & Escalation Letters** — bureau response upload/parsing, demand letters, escalation letters, CFPB narrative
7. **Email Reminders & Polish** — Resend setup, Convex crons, day-25 alerts, preferences, edge cases

## Roadmap Implications
- Response intake is the foundation — must be built first
- Escalation letters reuse existing letter generation (Phase 4) with new prompts
- Email reminders are independent of escalation — can be a separate phase
- CFPB guidance is UI + Claude narrative, no API — lowest risk feature

---
*Research completed: 2026-04-04*
*Ready for requirements: yes*
