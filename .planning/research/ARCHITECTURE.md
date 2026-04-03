# Architecture Research: CreditFix

**Domain:** AI-powered credit repair / FCRA dispute automation
**Date:** 2026-04-03
**Confidence:** MEDIUM-HIGH

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                   Next.js 15 (Vercel)                        │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Upload   │ │ Disputes │ │ Letters  │ │ Tracker/Dash  │  │
│  │ Page     │ │ Review   │ │ Center   │ │               │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       │             │            │               │           │
│  ┌────┴─────────────┴────────────┴───────────────┴────────┐ │
│  │              API Client (lib/api.ts)                    │ │
│  └────────────────────────┬───────────────────────────────┘ │
│  ┌────────────────────────┴───────────────────────────────┐ │
│  │         Supabase Client (Auth + Realtime)               │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS (JWT in Authorization header)
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                        BACKEND                                 │
│                   FastAPI (Railway)                             │
│                                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ Auth        │  │ CORS        │  │ Error Handling       │   │
│  │ Middleware  │  │ Middleware  │  │ Middleware           │   │
│  └─────┬───────┘  └─────────────┘  └─────────────────────┘   │
│        │                                                       │
│  ┌─────┴───────────────────────────────────────────────────┐  │
│  │                    API Routers                            │  │
│  │  /api/reports  /api/disputes  /api/letters  /api/tracker │  │
│  └─────┬──────────────┬──────────────┬──────────────┬──────┘  │
│        │              │              │              │          │
│  ┌─────┴──────┐ ┌─────┴──────┐ ┌────┴───────┐ ┌───┴───────┐ │
│  │ PDF Parser │ │ AI         │ │ Letter     │ │ Dispute   │ │
│  │ Service    │ │ Analyzer   │ │ Generator  │ │ Tracker   │ │
│  └─────┬──────┘ └─────┬──────┘ └────┬───────┘ └───┬───────┘ │
│        │              │              │             │          │
└────────┼──────────────┼──────────────┼─────────────┼──────────┘
         │              │              │             │
         ▼              ▼              ▼             ▼
┌────────────────┐ ┌──────────┐ ┌──────────────────────────────┐
│ Supabase       │ │ Claude   │ │ Supabase PostgreSQL          │
│ Storage        │ │ API      │ │ (+ Auth + Edge Functions)    │
│ (PDF files)    │ │          │ │                              │
└────────────────┘ └──────────┘ └──────────────────────────────┘
```

## Component Boundaries

### Frontend (Next.js 15)
- **Responsibility:** UI rendering, user interactions, auth state, file upload UX
- **Does NOT:** Call Claude API directly, parse PDFs, generate letters
- **Talks to:** FastAPI backend (REST), Supabase (Auth + realtime subscriptions)
- **Auth flow:** Supabase Auth → JWT → passed to FastAPI in Authorization header

### Backend (FastAPI)
- **Responsibility:** All business logic — PDF parsing, AI analysis, letter generation, dispute tracking
- **Does NOT:** Serve frontend assets, handle user sessions (JWT is stateless)
- **Talks to:** Supabase (DB + Storage), Claude API
- **Auth:** Validates Supabase JWT on every request; extracts user_id for RLS

### Supabase
- **PostgreSQL:** All structured data (reports, disputes, letters, timeline)
- **Storage:** PDF file storage with signed URLs (short TTL for security)
- **Auth:** Email/password authentication, JWT issuance
- **Edge Functions:** Email reminder delivery (day 25 deadline alerts)
- **RLS:** All tables enforce user_id = auth.uid() policies

### Claude API
- **Called only from FastAPI** — never from frontend (API key security)
- **Two use cases:** (1) Analyze parsed credit report → identify disputable items, (2) Generate personalized dispute letter text
- **Must use tool_use/structured output** — ensures reliable JSON, not free-text parsing
- **FCRA citations must come from a validated set** — don't let the LLM invent section numbers

## Data Flows

### Flow 1: Upload & Parse
```
User uploads PDF → Next.js (file validation) → FastAPI POST /api/reports/upload
  → Store PDF in Supabase Storage (get file_path)
  → Insert credit_reports row (status: pending)
  → PyMuPDF extracts text + positions
  → Bureau-specific normalizer structures data
  → Update credit_reports row (status: done, raw_parsed_data: JSON)
  → Return parsed report summary to frontend
```

### Flow 2: AI Analysis
```
User clicks "Analyze" → FastAPI POST /api/reports/{id}/analyze
  → Read raw_parsed_data from credit_reports
  → Strip PII (full account numbers, SSN) before sending to Claude
  → Call Claude API with structured tool_use prompt
  → Parse tool_use response → list of dispute items
  → Validate FCRA citations against known section list
  → Insert dispute_items rows (status: pending_review)
  → Return flagged items to frontend
```

### Flow 3: Letter Generation
```
User approves items → Frontend batches approved item IDs
  → FastAPI POST /api/letters/generate
  → For each approved item:
    → Load user profile (name, address)
    → Load dispute item details
    → Call Claude API for personalized letter body (or use template + AI refinement)
    → Render HTML letter template with data
    → Convert to PDF via WeasyPrint
    → Store PDF in Supabase Storage
    → Insert dispute_letters row
  → Update dispute_items status → letter_generated
  → Return letter list to frontend
```

### Flow 4: Tracking & Deadlines
```
User marks letter as sent → FastAPI PATCH /api/letters/{id}/sent
  → Record sent_at date and certified_mail_number
  → Calculate deadline (sent_at + 30 days)
  → Insert dispute_timeline event (type: letter_sent)
  → Update dispute_items status → sent

Day 25 check (Supabase Edge Function, daily cron):
  → Query dispute_timeline WHERE deadline - NOW() <= 5 days
  → Send email reminder via Resend
  → Log reminder in timeline

Day 30+ check:
  → Query overdue items
  → Flag on dashboard
  → Offer to generate follow-up letter
```

## Patterns to Follow

1. **JWT pass-through:** Frontend gets JWT from Supabase Auth → sends in Authorization header → FastAPI validates and extracts user_id → all DB queries scoped to that user

2. **Structured AI output via tool_use:** Define tools that match your Pydantic models. Claude returns structured JSON that maps directly to your database schema. No regex parsing of free text.

3. **PII stripping before AI calls:** Credit reports contain SSNs and full account numbers. Strip these BEFORE sending to Claude API. Only send last 4 digits and anonymized identifiers.

4. **Bureau-specific parser adapters:** One parser interface, three implementations. Each bureau's PDF format is different enough to warrant separate parsing logic, but output normalizes to the same schema.

5. **Signed storage URLs with short TTL:** PDF files (credit reports and letters) accessed via time-limited signed URLs. Never expose raw storage paths to the frontend.

## Anti-Patterns to Avoid

1. **Never call Claude API from the frontend** — API key exposure, no prompt versioning, no cost control
2. **Never store full SSNs or complete account numbers** — only last 4 digits in database
3. **Never let AI generate FCRA section numbers freely** — maintain a validated citation library
4. **Never skip RLS** — even for single user; it's the security foundation
5. **Never queue-ify for single user** — async FastAPI routes are sufficient; a task queue adds operational complexity for no benefit

## Build Order (Dependencies)

| Phase | What | Why This Order |
|-------|------|----------------|
| 1 | Auth + DB Schema + Project Scaffold | Everything depends on user identity and data structure |
| 2 | PDF Upload + Parsing | AI analysis needs parsed data to work with |
| 3 | AI Analysis + Dispute Identification | Letter generation needs identified dispute items |
| 4 | Dispute Review UI + Letter Generation | User value starts here — they can actually create letters |
| 5 | Tracking + Deadlines + Reminders | Post-send workflow; tracks the dispute lifecycle |
| 6 | Dashboard + Polish | Summary views, UX refinement, edge cases |

Each phase has a hard dependency on the previous. No phase can be parallelized with the one before it.
