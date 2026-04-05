# CreditFix Roadmap

**Project:** CreditFix
**Created:** 2026-04-03
**Granularity:** Coarse

## Milestones

- ✅ **v1.0 Initial Release** - Phases 1-5 (shipped 2026-04-04)
- 🚧 **v1.1 Escalation & Notifications** - Phases 6-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 Initial Release (Phases 1-5) - SHIPPED 2026-04-04</summary>

### Phase 1: Foundation
**Goal**: User can securely access the app and store their personal information for use in letters
**Depends on**: Nothing
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can create an account with email and password and land on a home screen
  2. User can log out and log back in; session survives a browser refresh without re-entering credentials
  3. User can fill out a profile page (full name, mailing address) and see saved values on return visits
  4. Next.js frontend and FastAPI backend are connected, Convex schema is initialized, and Vercel + Railway deployments are live
**Plans:** 4/4 plans complete

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold, Convex init, auth config, middleware, provider wiring
- [x] 01-02-PLAN.md — Sign-in/sign-up form, profile page, Convex user functions
- [x] 01-03-PLAN.md — FastAPI stub with health check, CORS, Dockerfile, frontend API client
- [x] 01-04-PLAN.md — Vercel + Railway deployments, end-to-end validation

**UI hint**: yes

### Phase 2: PDF Upload & Parsing
**Goal**: User can upload all three bureau credit report PDFs and the system produces clean, structured data ready for AI analysis
**Depends on**: Phase 1
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05
**Success Criteria** (what must be TRUE):
  1. User can upload a PDF for each of the three bureaus (Experian, Equifax, TransUnion) from the upload page
  2. Upload page shows distinct progress states (uploading → parsing → done) for each file
  3. A text-only PDF from annualcreditreport.com is parsed into structured tradeline and negative item data normalized across all three bureau formats
  4. An image-only (scanned) PDF triggers a visible warning telling the user it cannot be processed
**Plans:** 5/5 plans complete

Plans:
- [x] 02-01-PLAN.md — Convex schema extension (credit_reports table) and all Convex functions
- [x] 02-02-PLAN.md — FastAPI ParsedReport models, BureauParser base class, stub adapters, reports router
- [x] 02-03-PLAN.md — Bureau parser adapters: Experian, Equifax (pdfplumber fallback), TransUnion
- [x] 02-04-PLAN.md — Upload page UI with three bureau drop zones and progress state machine
- [x] 02-05-PLAN.md — Integration smoke tests and human verification checkpoint

**UI hint**: yes

### Phase 3: AI Analysis & Dispute Review
**Goal**: User can see every AI-identified disputable item with its FCRA basis, then approve or skip each one before any letter is created
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, DISP-01, DISP-02, DISP-03
**Success Criteria** (what must be TRUE):
  1. After a report is parsed, the system automatically identifies disputable items and each item shows a specific FCRA section citation (e.g., § 611, § 623)
  2. Every FCRA citation in an identified item matches a section in the hardcoded validated citation library — no hallucinated statute numbers reach the UI
  3. No SSNs or full account numbers are present in data sent to the Claude API
  4. User can view flagged items grouped by bureau and approve or skip each one individually
  5. Approved items enter a tracked lifecycle (pending_review → approved) visible in the dispute list
**Plans:** 4/4 plans complete

Plans:
- [x] 03-01-PLAN.md — Convex schema extension (dispute_items table, analysisStatus) and data layer functions
- [x] 03-02-PLAN.md — FastAPI AI analyzer: FCRA library, PII stripping, Claude tool_use, analyze endpoint
- [x] 03-03-PLAN.md — analyzeReport Convex action (orchestrates FastAPI call, stores dispute items)
- [x] 03-04-PLAN.md — Disputes review page, Analyze button on upload page, nav link, middleware

**UI hint**: yes

### Phase 4: Letter Generation
**Goal**: User can download a print-ready, bureau-addressed dispute letter for every approved dispute item, pre-filled with their personal information
**Depends on**: Phase 3
**Requirements**: LTR-01, LTR-02, LTR-03, LTR-04, LTR-05, LTR-06
**Success Criteria** (what must be TRUE):
  1. For each approved dispute item, a letter is generated addressed to the correct bureau mailing address (Experian, Equifax, or TransUnion)
  2. Each letter is automatically filled with the user's name and mailing address from their profile
  3. Each letter cites the specific FCRA section, references the specific account or item being disputed, and includes a signature line with enclosure notes
  4. The user can download a letter as a PDF that is formatted and readable when printed on standard paper
  5. Letter body language is personalized per dispute item — two different dispute items do not produce identical letter text
**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md — WeasyPrint Dockerfile deps, FastAPI letter models, HTML template, letter_writer service, /api/letters/generate endpoint
- [x] 04-02-PLAN.md — Convex schema (dispute_letters table), generateLetters action, CRUD queries
- [x] 04-03-PLAN.md — /letters page UI, Generate Letters button on /disputes, nav link, human verification

**UI hint**: yes

### Phase 5: Tracking & Dashboard
**Goal**: User can track the status and 30-day deadline for every sent dispute and see a full summary of their repair progress from one screen
**Depends on**: Phase 4
**Requirements**: TRK-01, TRK-02, TRK-03, TRK-04, DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User can mark a letter as sent, enter a certified mail tracking number, and see the 30-day response deadline calculated from that send date
  2. Tracker page shows each dispute on a visual timeline with color-coded status (pending, sent, waiting, overdue, resolved, denied)
  3. Disputes past their 30-day window with no recorded response are visually flagged as overdue on both the tracker and dashboard
  4. Dashboard shows summary cards (total disputes, letters sent, responses received, resolved count), upcoming deadlines, and quick action buttons to start common workflows
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — date-fns install, dispute_letters schema extension, markAsSent/getSentLetters/getDashboardStats/getUpcomingDeadlines Convex functions
- [x] 05-02-PLAN.md — Mark as Sent button and dialog on /letters page
- [x] 05-03-PLAN.md — /tracker page, /dashboard replacement, nav + middleware

**UI hint**: yes

</details>

### 🚧 v1.1 Escalation & Notifications (In Progress)

**Milestone Goal:** Complete the dispute lifecycle — record what the bureau said, generate escalation letters for ignored or denied disputes, suggest CFPB complaints where warranted, and send proactive email reminders so deadlines are never missed.

#### Phase 6: Bureau Response & Escalation
**Goal**: User can record a bureau's response to any dispute and immediately generate the appropriate next-step letter — second demand, escalation, or CFPB complaint
**Depends on**: Phase 5
**Requirements**: RESP-01, RESP-02, RESP-03, RESP-04, ESC-01, ESC-02, ESC-03, ESC-04
**Success Criteria** (what must be TRUE):
  1. User can upload a bureau response PDF for a sent dispute and the system extracts the outcome (verified, deleted, or corrected) using AI
  2. User can manually enter a dispute outcome without uploading a PDF, and the dispute status updates to resolved or denied accordingly
  3. For disputes with no bureau response after 30 days, the system generates a second demand letter the user can download and print
  4. For disputes the bureau verified (denied), the system generates an escalation letter the user can download and print
  5. User can generate a CFPB-ready complaint narrative from a denied dispute's history, and track CFPB complaint status and company response timeline
**Plans:** 3/4 plans executed

Plans:
- [x] 06-01-PLAN.md — Convex schema extension (bureau_responses, cfpb_complaints tables, letterType on dispute_letters) + data layer functions
- [x] 06-02-PLAN.md — FastAPI response parser, complaint generator, letter_writer demand/escalation extension
- [x] 06-03-PLAN.md — Convex actions: parseResponse, generateDemandLetter, generateEscalationLetter, generateCfpbNarrative
- [x] 06-04-PLAN.md — UI: RecordResponseDialog, tracker escalation actions, CFPB tracking, letters page badges

**UI hint**: yes

#### Phase 7: Email Notifications
**Goal**: User receives timely email reminders for approaching deadlines and overdue disputes without needing to log in daily
**Depends on**: Phase 6
**Requirements**: NOTF-01, NOTF-02, NOTF-03
**Success Criteria** (what must be TRUE):
  1. User receives an email reminder at day 25 for any active dispute approaching its 30-day deadline
  2. User receives an email nudge at day 31 if no bureau response has been logged for a dispute
  3. User can enable or disable email reminders and adjust reminder timing from a preferences page
**Plans:** 2/3 plans executed

Plans:
- [x] 07-01-PLAN.md — Schema extension (users email prefs + reminder_log table) + Convex data layer functions
- [ ] 07-02-PLAN.md — Notification engine: notifications.ts (Resend internalAction) + crons.ts (daily 8 AM UTC scan)
- [x] 07-03-PLAN.md — Profile page email preferences UI + human verification checkpoint

**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-04-03 |
| 2. PDF Upload & Parsing | v1.0 | 5/5 | Complete | 2026-04-03 |
| 3. AI Analysis & Dispute Review | v1.0 | 4/4 | Complete | 2026-04-04 |
| 4. Letter Generation | v1.0 | 3/3 | Complete | 2026-04-04 |
| 5. Tracking & Dashboard | v1.0 | 3/3 | Complete | 2026-04-04 |
| 6. Bureau Response & Escalation | v1.1 | 4/4 | Complete | 2026-04-04 |
| 7. Email Notifications | v1.1 | 2/3 | In Progress|  |

---
*Roadmap created: 2026-04-03*
*Last updated: 2026-04-05 — Phase 7 plans created (3 plans, 2 waves)*
