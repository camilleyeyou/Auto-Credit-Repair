# Project Research Summary

**Project:** CreditFix
**Domain:** AI-powered credit repair / FCRA dispute automation
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

CreditFix is a personal, single-user tool that automates the FCRA consumer dispute process — a well-defined workflow with a fixed critical path. Research confirms the approach is sound: parse credit report PDFs from all three bureaus, use Claude AI to identify legally disputable items with validated FCRA citations, generate bureau-specific dispute letters as downloadable PDFs, and track the 30-day response window with dashboard and email reminders. The user always prints and mails letters herself, which keeps the project outside CROA regulatory scope and maintains personal control throughout the process.

The recommended stack (Next.js 15 + FastAPI + Supabase + Claude API) is well-matched to the domain. Python handles PDF parsing and AI coordination reliably; Next.js delivers a clean, deployable UI with native Vercel support; Supabase provides auth, database, file storage, and edge functions in a single platform. No task queues, no vector databases, no external auth providers — the stack stays lean because this is a single-user tool with predictable, low-volume workloads.

The critical risks are legal, not technical: AI hallucination of FCRA citations is a critical threat to dispute letter credibility and must be prevented via a hardcoded citation library and tool_use-constrained output. PII exposure to external APIs is similarly critical — full SSNs and account numbers must be stripped before any Claude API call. Bureau PDF format divergence is the primary technical challenge, requiring separate parser adapters per bureau with a common output schema. All three risks are preventable with deliberate architecture choices made early.

## Key Findings

### Recommended Stack

The stack is pre-decided by the user and validated by research. FastAPI (Python 3.11+) handles all backend business logic — PDF parsing with PyMuPDF/pdfplumber, AI orchestration with the Anthropic SDK using tool_use for structured output, and letter PDF generation with WeasyPrint. Next.js 15 (App Router) serves the frontend deployed to Vercel. Supabase provides the full data layer: PostgreSQL with Row-Level Security, file storage with signed URLs, email/password auth, and edge functions for deadline reminder emails via Resend.

Deliberately excluded: LangChain/LlamaIndex (overkill for single-model use), SQLAlchemy (Supabase client is sufficient), Tesseract OCR (annualcreditreport.com PDFs are text-based), Redis/task queues (async FastAPI routes handle single-user load), and Clerk/Auth0 (Supabase Auth is already included).

**Core technologies:**
- FastAPI 0.115+: Backend API framework — async-native, Pydantic v2 integration, stateless JWT validation
- PyMuPDF 1.24+ (fitz): Primary PDF parser — fast text extraction with positional data
- pdfplumber 0.11+: Fallback PDF parser — better at tabular data when PyMuPDF misses structure
- WeasyPrint 62+: Letter PDF generation — HTML/CSS to print-ready PDF; requires system libraries (cairo, pango)
- anthropic SDK 0.39+: Claude API client — tool_use for structured JSON output; never called from frontend
- Next.js 15.x: Frontend framework — App Router, RSC, Vercel deployment
- shadcn/ui: UI components — Radix-based, no vendor lock-in
- @supabase/ssr 0.5+: Server-side Supabase auth for Next.js App Router
- Supabase: Database + Auth + Storage + Edge Functions — all-in-one platform, RLS from day one

**Critical version notes:**
- WeasyPrint requires system-level libraries (cairo, pango, gdk-pixbuf) — must be documented in Railway/Docker setup
- PyMuPDF may require mupdf system dependency on some platforms

### Expected Features

The feature set follows a strict dependency chain — every feature depends on the one above it. No phase can be skipped. The MVP includes all table-stakes features plus AI-powered analysis with FCRA citations, which is the core value proposition.

**Must have (table stakes):**
- PDF upload and ingestion for all 3 bureaus — entry point to the entire workflow
- Multi-bureau PDF parsing (Experian, Equifax, TransUnion) — each format is structurally different
- Tradeline extraction (creditor, balance, status, dates, payment history) — raw material for AI analysis
- Negative item identification (late payments, collections, charge-offs, public records) — what gets disputed
- Dispute letter generation with FCRA citations and correct bureau mailing addresses — core deliverable
- Letter export as print-ready PDF — user prints and signs herself
- Dispute status tracking (pending → sent → waiting → resolved) — lifecycle management
- 30-day FCRA deadline tracking with alerts — legal requirement awareness
- Secure data handling — no full SSNs, RLS on all tables
- User review and approval before letter generation — maintains user control

**Should have (competitive differentiators):**
- AI-powered analysis with specific FCRA section citations — replaces $50-150/month services
- Personalized letter language per dispute item — avoids frivolous dispute flags
- Dashboard with summary cards, progress, and upcoming deadlines
- Certified mail tracking number entry to anchor the 30-day clock accurately
- Email reminders at day 25 for approaching deadlines
- Second demand letter generation for non-responses at day 30
- Escalation letter and CFPB complaint suggestion for denied disputes

**Defer to v2+:**
- Bureau response letter parsing and AI guidance (complex, low-frequency use case)
- Advanced round management beyond first dispute cycle
- Detailed success rate analytics

### Architecture Approach

CreditFix follows a clean two-tier architecture: Next.js frontend communicates with a FastAPI backend via HTTPS with Supabase JWT tokens in the Authorization header. All business logic lives in the backend — PDF parsing, AI calls, letter generation, dispute tracking. The frontend handles UI rendering, file upload UX, and auth state only. Claude API is never called from the frontend (API key security). Supabase serves as the shared data layer accessed by both the backend (direct queries) and frontend (auth + realtime subscriptions).

**Major components:**
1. PDF Parser Service (FastAPI) — bureau-specific adapters (Experian/Equifax/TransUnion) with common output schema; PyMuPDF primary, pdfplumber fallback
2. AI Analyzer (FastAPI + Claude API) — strips PII, calls Claude via tool_use, validates FCRA citations against hardcoded library, inserts dispute_items
3. Letter Generator (FastAPI + Claude API + WeasyPrint) — loads user profile and dispute items, generates personalized letter body via Claude, renders HTML template, converts to PDF, stores in Supabase Storage
4. Dispute Tracker (FastAPI + Supabase) — manages dispute lifecycle state machine, calculates deadlines, records certified mail tracking numbers
5. Deadline Reminder (Supabase Edge Function + Resend) — daily cron job querying disputes approaching 30-day window, sends email at day 25
6. Next.js Frontend — Upload, Disputes Review, Letters Center, and Tracker/Dashboard pages; auth via @supabase/ssr

**Key patterns:**
- JWT pass-through: Supabase JWT → FastAPI Authorization header → user_id extracted → all DB queries scoped to user
- Structured AI output: tool_use constraints map directly to Pydantic models and DB schema; no free-text parsing
- PII stripping before AI calls: SSNs removed, account numbers replaced with last-4 identifiers
- Bureau-specific parser adapters: one interface, three implementations, one output schema
- Signed storage URLs with short TTL: PDF files never exposed via raw storage paths

### Critical Pitfalls

1. **AI hallucination of FCRA citations** — Maintain a hardcoded validated citation library (§ 611, § 623, § 605, § 609, § 612); use tool_use with enum of valid sections; validate every citation before it touches a letter. This is the highest-risk issue in the entire project.

2. **PII exposure to Claude API** — Strip all SSNs and full account numbers from parsed data before any API call; replace with last-4 identifiers; log what data is sent (not the data itself) for audit purposes.

3. **Bureau PDF format divergence** — Build separate parser adapters per bureau with a common output schema; build a test suite with sample PDFs from all three bureaus; add field validation pass (account numbers should be digits, dates should parse). Silent misparse is worse than a failed parse.

4. **Frivolous dispute triggering under FCRA § 611(a)(3)** — AI must generate item-specific dispute language; recommend batching 3-5 items per bureau per round maximum; track previous disputes to prevent re-filing identical content.

5. **30-day clock miscalculation** — The FCRA window starts at bureau receipt, not mailing date. Primary anchor: certified mail delivery confirmation. Fallback: mailing date + 5 business day buffer. Show both estimated receipt date and 30-day deadline to the user.

## Implications for Roadmap

Based on the critical-path dependency chain identified in FEATURES.md and the build order confirmed in ARCHITECTURE.md, the phase structure follows directly from technical dependencies. No phase can be parallelized with the one before it.

### Phase 1: Foundation — Auth, Database Schema, and Project Scaffold
**Rationale:** Every feature depends on user identity and data structure. RLS must be in place before any sensitive data flows. The database schema (credit_reports, dispute_items, dispute_letters, dispute_timeline tables) must be designed before any services are built on top of it.
**Delivers:** Working auth (email/password via Supabase), complete database schema with RLS policies, project scaffold (Next.js + FastAPI connected, environment configured, Railway + Vercel deployment pipelines working)
**Addresses:** Secure data handling (table stake), user identity for all subsequent features
**Avoids:** Retrofitting RLS later (pitfall #2 prevention), schema migrations mid-development

### Phase 2: PDF Upload and Parsing
**Rationale:** AI analysis requires parsed data. Letter generation requires identified items. Nothing downstream works without reliable PDF parsing. Bureau format divergence is the primary technical risk and must be solved before any AI work begins.
**Delivers:** File upload UI with validation, Supabase Storage integration, PyMuPDF/pdfplumber parsing pipeline, bureau-specific adapters for all three bureaus (Experian/Equifax/TransUnion), normalized tradeline and negative item extraction
**Addresses:** PDF Upload, Multi-Bureau Support, Tradeline Extraction, Negative Item Identification (table stakes)
**Avoids:** Bureau PDF format divergence (pitfall #1) — test suite with sample PDFs from all 3 bureaus built here; scanned PDF detection (pitfall #7)
**Research flag:** Bureau-specific PDF format parsing may need hands-on testing with real sample PDFs; cannot be fully specified in advance

### Phase 3: AI Analysis and Dispute Identification
**Rationale:** Dispute item identification is the core intellectual value of the product. It must come before letter generation. The FCRA citation library and PII stripping must be implemented here, not retrofitted.
**Delivers:** Claude API integration via tool_use, validated FCRA citation library, PII stripping pipeline, dispute_items creation with pending_review status, Disputes Review UI for user approval/skip
**Addresses:** AI-powered analysis, FCRA section citations, user review before action (differentiators + table stake)
**Avoids:** AI hallucination of FCRA citations (critical pitfall #2), PII exposure to LLM APIs (critical pitfall #3), Date of First Delinquency confusion (pitfall #8)

### Phase 4: Letter Generation and Download
**Rationale:** This is where user value crystallizes — approved dispute items become actual, printable letters. Letter generation depends on having approved dispute_items (Phase 3) and user profile data.
**Delivers:** User profile/settings page (name, address), Claude-personalized letter body generation per dispute item, WeasyPrint HTML-to-PDF conversion, letter storage in Supabase Storage, letter download as print-ready PDF
**Addresses:** Dispute letter generation, letter export/download (table stakes); personalized letters, FCRA citation inclusion (differentiators)
**Avoids:** Frivolous dispute triggering (pitfall #4) — item-specific language enforced here; letter formatting that signals automation (pitfall #11)
**Research flag:** WeasyPrint system library dependencies on Railway need validation; Docker configuration required

### Phase 5: Tracking, Deadlines, and Reminders
**Rationale:** Post-send workflow. User marks letters as sent, 30-day clock starts, reminders fire at day 25. This phase completes the legal compliance workflow and delivers the deadline safety net.
**Delivers:** Mark-as-sent flow with certified mail tracking number entry, 30-day deadline calculation (receipt-anchored with 5-day buffer fallback), dispute_timeline event logging, Supabase Edge Function + Resend email reminders at day 25, overdue flagging at day 30+
**Addresses:** Status tracking, 30-day deadline tracking, certified mail tracking, email reminders (table stakes + differentiators)
**Avoids:** 30-day clock miscalculation (pitfall #5), no audit trail (pitfall #9)

### Phase 6: Dashboard, Escalation, and Polish
**Rationale:** Summary views, escalation workflows, and UX refinement come last — they depend on data generated by all previous phases. Second demand letters and CFPB escalation require tracking data from Phase 5.
**Delivers:** Dashboard with summary cards and dispute progress, visual timeline tracker with color-coded statuses, second demand letter generation for non-responses, escalation letter + CFPB complaint suggestion for denials, re-insertion risk notice for resolved items, UX polish and edge case handling
**Addresses:** Dashboard analytics, escalation workflow (differentiators); deletion re-insertion risk awareness (pitfall #10)

### Phase Ordering Rationale

- Phases 1-6 follow a hard dependency chain: each phase depends on the previous one's output
- No phase can be parallelized with the one before it — this is not a choice but a structural constraint of the domain
- Phase 3 (AI analysis) must come before Phase 4 (letter generation) because letters require identified dispute items
- Phase 5 (tracking) must come after Phase 4 (letters) because the 30-day clock is anchored to the send event
- Phase 6 (dashboard/escalation) must come last because it aggregates data from all preceding phases
- WeasyPrint system library setup in Phase 4 is the highest infrastructure risk and should be validated early in that phase

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Bureau-specific PDF format parsing — Experian, Equifax, and TransUnion PDF structures vary significantly. Hands-on testing with real sample PDFs will be needed; cannot be fully specified in advance. May require iterative development.
- **Phase 4:** WeasyPrint on Railway — system library dependencies (cairo, pango, gdk-pixbuf) require Docker configuration. Validate Railway Docker support and build times early in this phase.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Auth + DB scaffold with Supabase and Next.js — well-documented, established patterns. Supabase RLS configuration is straightforward.
- **Phase 3:** Claude API integration with tool_use — well-documented in Anthropic SDK. The FCRA citation library is hand-curated (only 5-6 sections), not a research problem.
- **Phase 5:** Supabase Edge Functions + Resend for email — standard integration with good documentation.
- **Phase 6:** Dashboard with recharts — well-documented, standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Pre-decided by user; research validates all choices. Only WeasyPrint system dependencies on Railway are uncertain. |
| Features | HIGH | FCRA is a well-defined law with clear consumer rights. Feature set maps directly to the legal workflow. |
| Architecture | MEDIUM-HIGH | Two-tier architecture is well-documented. Bureau PDF format specifics can only be fully confirmed with real sample PDFs. |
| Pitfalls | HIGH | Legal pitfalls (FCRA citations, CROA compliance) are well-documented in law. Technical pitfalls (PII, bureau divergence) are established engineering concerns. |

**Overall confidence:** HIGH

### Gaps to Address

- **Bureau PDF format specifics:** Experian, Equifax, and TransUnion PDF layouts are described at a high level in research but cannot be fully characterized without sample PDFs. Address during Phase 2 by obtaining and testing real PDFs from annualcreditreport.com before writing parser adapters.
- **WeasyPrint on Railway:** HTML-to-PDF generation with WeasyPrint requires system libraries not present in default Railway environments. Address early in Phase 4 by validating Docker-based Railway deployment with a minimal WeasyPrint test before building the full letter pipeline.
- **Claude tool_use schema design:** The exact tool definitions for AI analysis (dispute item extraction) and letter generation will need careful prompt engineering. Best addressed during Phase 3 planning with iterative testing against real parsed credit report data.
- **DOFD extraction reliability:** Date of First Delinquency may not be consistently present in all bureau PDFs. If missing, the system must flag the item rather than guess. Confirm handling during Phase 2 parser development.

## Sources

### Primary (HIGH confidence)
- Official Anthropic SDK documentation — tool_use structured output patterns, API key security
- FastAPI official documentation — async routes, middleware, JWT validation patterns
- Supabase official documentation — RLS policies, Storage signed URLs, Edge Functions, @supabase/ssr
- Next.js 15 official documentation — App Router, RSC, Vercel deployment

### Secondary (MEDIUM confidence)
- FCRA statute text (15 U.S.C. §§ 1681 et seq.) — citation sections validated against actual law
- PyMuPDF documentation — text extraction, positional data, multi-page PDF handling
- WeasyPrint documentation — HTML/CSS to PDF conversion, system library requirements
- pdfplumber documentation — tabular data extraction, fallback parsing use cases

### Tertiary (LOW confidence)
- Bureau PDF format descriptions — based on general knowledge of Experian/Equifax/TransUnion layouts; requires hands-on validation with real PDFs
- Railway Docker configuration for WeasyPrint — system library availability needs empirical verification

---
*Research completed: 2026-04-03*
*Ready for roadmap: yes*
