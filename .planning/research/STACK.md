# Technology Stack — Escalation & Notification Milestone

**Researched:** 2026-04-04
**Scope:** NEW additions only. Existing stack validated and not re-evaluated.

## New Additions

| Package | Runtime | Purpose |
|---------|---------|---------|
| `resend` ^3.x | Convex actions (Node.js) | Transactional email delivery |
| `@react-email/components` ^0.0.x | Convex actions | Email-safe UI primitives |
| `react-email` ^3.x | Dev only | Email template preview |

## Scheduling — Convex Native (No New Library)

- `crons.ts` for daily deadline scans
- `ctx.scheduler.runAfter()` for per-dispute timed reminders
- Store scheduler IDs on dispute documents for cancellation

## Bureau Response Parsing — PyMuPDF (Already in Stack)

- No new library needed
- New FastAPI endpoint + Claude tool_use prompt
- Extracts: outcome, account_name, response_date, reason_code

## CFPB — Static Content + Link (No API)

- CFPB public API is read-only; filing requires their web form
- Claude generates complaint narrative from dispute history
- Link to consumerfinance.gov/complaint/

## What NOT to Add

| Rejected | Reason |
|----------|--------|
| SendGrid/SES | Worse DX for this scale |
| BullMQ/Redis | Convex has native scheduling |
| Tesseract OCR | Bureau responses are digital PDFs |
| CFPB submission API | Read-only; automated filing violates ToS |
