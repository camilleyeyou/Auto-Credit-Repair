# Requirements: CreditFix

**Defined:** 2026-04-03
**Core Value:** Automate knowing what to dispute and how to write the letters, replacing expensive credit repair services.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Profile

- [x] **AUTH-01**: User can sign up and log in with email and password via Convex Auth
- [x] **AUTH-02**: User session persists across browser refresh
- [x] **AUTH-03**: User can create and edit a profile with full name and mailing address

### PDF Upload & Parsing

- [x] **PDF-01**: User can upload credit report PDFs for each bureau (Experian, Equifax, TransUnion)
- [x] **PDF-02**: System parses uploaded PDFs using PyMuPDF with bureau-specific adapters
- [x] **PDF-03**: Parser normalizes output into a common structured format across all three bureaus
- [x] **PDF-04**: Upload page shows progress indicators (uploading → parsing → done)
- [x] **PDF-05**: System detects image-only PDFs and warns user (no OCR support)

### AI Analysis

- [ ] **AI-01**: Claude API analyzes parsed credit report data and identifies disputable items
- [ ] **AI-02**: Each flagged item includes dispute reason and relevant FCRA section citation
- [ ] **AI-03**: FCRA citations validated against a hardcoded library of real statute sections
- [ ] **AI-04**: PII (SSNs, full account numbers) stripped from data before sending to Claude API
- [ ] **AI-05**: AI generates item-specific dispute reasoning, not generic boilerplate

### Dispute Management

- [ ] **DISP-01**: User can view all AI-flagged items grouped by bureau
- [ ] **DISP-02**: User can approve or skip each flagged item individually
- [ ] **DISP-03**: Dispute items track status lifecycle (pending_review → approved → letter_generated → sent → resolved/denied)

### Letter Generation

- [ ] **LTR-01**: System generates dispute letters addressed to the correct bureau with proper mailing address
- [ ] **LTR-02**: Letters auto-populate user's name and address from profile
- [ ] **LTR-03**: Letters cite specific FCRA section and reference specific account/issue
- [ ] **LTR-04**: Letters include signature line and enclosure notes (ID copy, report page)
- [ ] **LTR-05**: Letters download as print-ready PDFs via WeasyPrint
- [ ] **LTR-06**: AI personalizes letter language per dispute item (unique wording, not templates)

### Tracking & Deadlines

- [ ] **TRK-01**: User can mark a letter as sent with send date and certified mail tracking number
- [ ] **TRK-02**: System calculates 30-day response deadline from send date
- [ ] **TRK-03**: Tracker page shows visual timeline with color-coded dispute statuses
- [ ] **TRK-04**: Overdue disputes (past 30 days, no response) highlighted on dashboard and tracker

### Dashboard

- [ ] **DASH-01**: Dashboard shows summary cards (total disputes, letters sent, responses received, resolved)
- [ ] **DASH-02**: Dashboard shows upcoming deadlines for active disputes
- [ ] **DASH-03**: Dashboard has quick action buttons (Upload Report, Review Items, Download Letters)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Email Reminders

- **NOTF-01**: User receives email reminder at day 25 for approaching dispute deadlines
- **NOTF-02**: Email sent via Resend from Convex action

### Escalation

- **ESC-01**: System generates second demand letter for disputes ignored past 30 days
- **ESC-02**: System generates escalation letter for denied disputes
- **ESC-03**: System suggests filing CFPB complaint for denied disputes
- **ESC-04**: User can upload bureau response letters for next-round AI guidance

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automatic letter mailing | User must always send herself — intentional safety constraint |
| Full SSN / complete account storage | Security — only last 4 digits of account numbers |
| Multi-tenancy / billing / teams | Single user personal tool; avoids CROA regulation |
| OAuth / social login | Email/password via Convex Auth is sufficient |
| Mobile app | Web-first; responsive design covers mobile browsers |
| Credit score simulation | FICO scoring is proprietary; predictions would be inaccurate |
| Debt settlement / negotiation | Different domain and legal framework |
| Credit monitoring integration | Unnecessary cost; user checks annualcreditreport.com free |
| OCR for scanned PDFs | annualcreditreport.com PDFs are text-based; detect and warn only |
| Guaranteed removal language | AI must use hedged language per FCRA ethics |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| PDF-01 | Phase 2 | Complete |
| PDF-02 | Phase 2 | Complete |
| PDF-03 | Phase 2 | Complete |
| PDF-04 | Phase 2 | Complete |
| PDF-05 | Phase 2 | Complete |
| AI-01 | Phase 3 | Pending |
| AI-02 | Phase 3 | Pending |
| AI-03 | Phase 3 | Pending |
| AI-04 | Phase 3 | Pending |
| AI-05 | Phase 3 | Pending |
| DISP-01 | Phase 3 | Pending |
| DISP-02 | Phase 3 | Pending |
| DISP-03 | Phase 3 | Pending |
| LTR-01 | Phase 4 | Pending |
| LTR-02 | Phase 4 | Pending |
| LTR-03 | Phase 4 | Pending |
| LTR-04 | Phase 4 | Pending |
| LTR-05 | Phase 4 | Pending |
| LTR-06 | Phase 4 | Pending |
| TRK-01 | Phase 5 | Pending |
| TRK-02 | Phase 5 | Pending |
| TRK-03 | Phase 5 | Pending |
| TRK-04 | Phase 5 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation — all 29 requirements mapped*
