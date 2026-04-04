<!-- GSD:project-start source:PROJECT.md -->
## Project

**CreditFix**

A private, personal AI-powered credit repair tool built for a single user (a friend in the US). It reads credit report PDFs, uses Claude AI to identify legally disputable items under the FCRA, generates bureau-specific dispute letters as downloadable PDFs, and tracks the 30-day dispute response window with email + dashboard reminders. The user always prints and mails letters herself via certified USPS mail — the system never sends anything on her behalf.

**Core Value:** Anyone can dispute inaccurate credit report items for free under FCRA — this tool automates knowing *what* to dispute and *how* to write the letters, replacing $50-150/month credit repair services.

### Constraints

- **Tech stack**: Next.js 15 (App Router) + Convex (DB, Auth, Storage, real-time) + FastAPI (PDF parsing, Claude API) — decided during initialization
- **AI model**: claude-sonnet-4-20250514 for analysis and letter generation
- **PDF parsing**: PyMuPDF (fitz) primary, pdfplumber fallback
- **Deployment**: Frontend → Vercel, Backend → Railway
- **Single developer**: Built and maintained by one person
- **Security**: Never store full SSNs or complete account numbers; only last 4 digits of account numbers
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
