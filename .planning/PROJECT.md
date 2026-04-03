# CreditFix

## What This Is

A private, personal AI-powered credit repair tool built for a single user (a friend in the US). It reads credit report PDFs, uses Claude AI to identify legally disputable items under the FCRA, generates bureau-specific dispute letters as downloadable PDFs, and tracks the 30-day dispute response window with email + dashboard reminders. The user always prints and mails letters herself via certified USPS mail — the system never sends anything on her behalf.

## Core Value

Anyone can dispute inaccurate credit report items for free under FCRA — this tool automates knowing *what* to dispute and *how* to write the letters, replacing $50-150/month credit repair services.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can upload credit report PDFs (one per bureau: Experian, Equifax, TransUnion)
- [ ] System parses PDF text and normalizes data across all three bureau formats
- [ ] AI analyzes parsed reports and identifies legally disputable items with FCRA basis
- [ ] User reviews AI-flagged items and approves/skips each one
- [ ] System generates professional, bureau-specific dispute letters for approved items
- [ ] Letters download as print-ready PDFs with user's name, address, and signature line
- [ ] User's personal info (name, address) stored via a profile/settings page
- [ ] User marks letters as sent and enters certified mail tracking number
- [ ] System calculates 30-day response deadline and shows countdown on tracker
- [ ] Email reminders sent at day 25 for approaching deadlines
- [ ] Dashboard shows summary cards, upcoming deadlines, and recent activity
- [ ] Visual timeline tracker with color-coded dispute statuses
- [ ] If no bureau response by day 30, system flags for follow-up and generates second demand letter
- [ ] If dispute denied, system generates escalation letter and suggests CFPB complaint
- [ ] User can upload bureau response letters for next-round AI guidance

### Out of Scope

- Automatic letter mailing — user always sends herself (intentional constraint)
- Full SSN or complete account number storage — only last 4 digits (security)
- Multi-tenancy, team features, or billing — single user system
- OAuth/social login — email/password via Supabase Auth is sufficient
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

- **Tech stack**: Next.js 15 (App Router) + FastAPI (Python 3.11+) + Supabase + Claude API — already decided
- **AI model**: claude-sonnet-4-20250514 for analysis and letter generation
- **PDF parsing**: PyMuPDF (fitz) primary, pdfplumber fallback
- **Deployment**: Frontend → Vercel, Backend → Railway
- **Single developer**: Built and maintained by one person
- **Security**: Never store full SSNs or complete account numbers; only last 4 digits of account numbers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate frontend/backend (Next.js + FastAPI) | Python ecosystem better for PDF parsing + AI; Next.js better for UI | — Pending |
| Supabase for DB + Auth + Storage | All-in-one platform, generous free tier, handles auth and file storage | — Pending |
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
*Last updated: 2026-04-03 after initialization*
