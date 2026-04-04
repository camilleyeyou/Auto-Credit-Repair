# CreditFix

## What This Is

A private, personal AI-powered credit repair tool built for a single user (a friend in the US). It reads credit report PDFs, uses Claude AI to identify legally disputable items under the FCRA, generates bureau-specific dispute letters as downloadable PDFs, and tracks the 30-day dispute response window with email + dashboard reminders. The user always prints and mails letters herself via certified USPS mail — the system never sends anything on her behalf.

## Core Value

Anyone can dispute inaccurate credit report items for free under FCRA — this tool automates knowing *what* to dispute and *how* to write the letters, replacing $50-150/month credit repair services.

## Current Milestone: v1.1 Escalation & Notifications

**Goal:** Complete the dispute lifecycle with escalation workflows, bureau response handling, and proactive email reminders.

**Target features:**
- Second demand letter for disputes ignored past 30 days
- Escalation letter for denied disputes
- CFPB complaint suggestion and guidance
- Bureau response upload with AI next-round guidance
- Day 25 email reminders for approaching deadlines (via Resend)

## Requirements

### Validated

- ✓ User can upload credit report PDFs (one per bureau) — v1.0 Phase 2
- ✓ System parses PDF text and normalizes across bureau formats — v1.0 Phase 2
- ✓ AI analyzes parsed reports and identifies disputable items with FCRA basis — v1.0 Phase 3
- ✓ User reviews AI-flagged items and approves/skips each one — v1.0 Phase 3
- ✓ System generates professional, bureau-specific dispute letters — v1.0 Phase 4
- ✓ Letters download as print-ready PDFs with user info and signature line — v1.0 Phase 4
- ✓ User's personal info stored via profile page — v1.0 Phase 1
- ✓ User marks letters as sent with certified mail tracking number — v1.0 Phase 5
- ✓ System calculates 30-day response deadline with countdown — v1.0 Phase 5
- ✓ Dashboard shows summary cards, upcoming deadlines, and recent activity — v1.0 Phase 5
- ✓ Visual timeline tracker with color-coded dispute statuses — v1.0 Phase 5

### Active

- [ ] Second demand letter auto-generated for disputes ignored past 30 days
- [ ] Escalation letter generated for denied disputes
- [ ] CFPB complaint suggestion and guidance for denied disputes
- [ ] User can upload bureau response letters for next-round AI guidance
- [ ] Email reminders sent at day 25 for approaching deadlines via Resend

### Out of Scope

- Automatic letter mailing — user always sends herself (intentional constraint)
- Full SSN or complete account number storage — only last 4 digits (security)
- Multi-tenancy, team features, or billing — single user system
- OAuth/social login — email/password via Convex Auth is sufficient
- Mobile app — web-first
- Real-time chat or messaging features — not relevant to the workflow
- Guaranteed removal language — AI must always use hedged language per FCRA ethics

## Context

- **Regulatory basis:** Fair Credit Reporting Act (FCRA) gives consumers the right to dispute inaccurate, outdated, or unverifiable items on their credit reports. Bureaus must investigate within 30 days.
- **Not a commercial product:** Built for personal use by one person, not subject to CROA (Credit Repair Organizations Act).
- **Bureau formats differ:** Experian uses clear section headers with tabular data, Equifax has denser layouts with payment grids, TransUnion is the most structured with clear date formatting. Parser must normalize across all three.
- **Bureau dispute mailing addresses:** Experian (P.O. Box 4500, Allen, TX 75013), Equifax (P.O. Box 740256, Atlanta, GA 30374), TransUnion (P.O. Box 2000, Chester, PA 19016).
- **Letter requirements:** Must cite specific FCRA section, reference specific account/issue, include space for signature, note enclosed ID copy and report page.
- **Dispute lifecycle:** flagged → approved → letter generated → sent → waiting (30 days) → response received / overdue → resolved / denied / escalated.

## Constraints

- **Tech stack**: Next.js 15 (App Router) + Convex (DB, Auth, Storage, real-time) + FastAPI (PDF parsing, Claude API) — decided during initialization
- **AI model**: claude-sonnet-4-20250514 for analysis and letter generation
- **PDF parsing**: PyMuPDF (fitz) primary, pdfplumber fallback
- **Deployment**: Frontend → Vercel, Backend → Railway
- **Single developer**: Built and maintained by one person
- **Security**: Never store full SSNs or complete account numbers; only last 4 digits of account numbers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate frontend/backend (Next.js + FastAPI) | Python ecosystem better for PDF parsing + AI; Next.js better for UI | — Pending |
| Convex for DB + Auth + Storage | Reactive backend, real-time sync, built-in file storage, replaces Supabase | — Pending |
| Convex + FastAPI split | Convex handles DB/auth/storage/real-time; FastAPI handles PDF parsing + Claude API (Python ecosystem) | — Pending |
| PDF download format for letters | Professional, print-ready output; user prints and signs | — Pending |
| Profile page for user info | Entered once, reused across all letters; cleaner than per-letter entry | — Pending |
| Email + dashboard reminders | Email ensures she doesn't miss deadlines even if she doesn't log in daily | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 after milestone v1.1 start*
