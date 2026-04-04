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

- [x] **AI-01**: Claude API analyzes parsed credit report data and identifies disputable items
- [x] **AI-02**: Each flagged item includes dispute reason and relevant FCRA section citation
- [x] **AI-03**: FCRA citations validated against a hardcoded library of real statute sections
- [x] **AI-04**: PII (SSNs, full account numbers) stripped from data before sending to Claude API
- [x] **AI-05**: AI generates item-specific dispute reasoning, not generic boilerplate

### Dispute Management

- [x] **DISP-01**: User can view all AI-flagged items grouped by bureau
- [x] **DISP-02**: User can approve or skip each flagged item individually
- [x] **DISP-03**: Dispute items track status lifecycle (pending_review → approved → letter_generated → sent → resolved/denied)

### Letter Generation

- [x] **LTR-01**: System generates dispute letters addressed to the correct bureau with proper mailing address
- [x] **LTR-02**: Letters auto-populate user's name and address from profile
- [x] **LTR-03**: Letters cite specific FCRA section and reference specific account/issue
- [x] **LTR-04**: Letters include signature line and enclosure notes (ID copy, report page)
- [x] **LTR-05**: Letters download as print-ready PDFs via WeasyPrint
- [x] **LTR-06**: AI personalizes letter language per dispute item (unique wording, not templates)

### Tracking & Deadlines

- [x] **TRK-01**: User can mark a letter as sent with send date and certified mail tracking number
- [x] **TRK-02**: System calculates 30-day response deadline from send date
- [x] **TRK-03**: Tracker page shows visual timeline with color-coded dispute statuses
- [x] **TRK-04**: Overdue disputes (past 30 days, no response) highlighted on dashboard and tracker

### Dashboard

- [x] **DASH-01**: Dashboard shows summary cards (total disputes, letters sent, responses received, resolved)
- [x] **DASH-02**: Dashboard shows upcoming deadlines for active disputes
- [x] **DASH-03**: Dashboard has quick action buttons (Upload Report, Review Items, Download Letters)

## v1.1 Requirements

Requirements for Escalation & Notifications milestone. Each maps to roadmap phases.

### Bureau Response Handling

- [ ] **RESP-01**: User can upload a bureau response PDF for a sent dispute
- [ ] **RESP-02**: AI parses response PDF and extracts outcome (verified, deleted, corrected)
- [ ] **RESP-03**: User can manually enter dispute outcome without uploading a PDF
- [ ] **RESP-04**: Dispute item status updates to reflect bureau response (resolved/denied)

### Escalation

- [ ] **ESC-01**: System generates a second demand letter for disputes with no response after 30 days
- [ ] **ESC-02**: System generates an escalation letter for disputes where bureau verified (denied)
- [ ] **ESC-03**: System generates a CFPB-ready complaint narrative from dispute history
- [ ] **ESC-04**: User can track CFPB complaint status and company response timeline

### Email Reminders

- [ ] **NOTF-01**: User receives email reminder at day 25 for approaching dispute deadlines
- [ ] **NOTF-02**: User receives email nudge at day 31 if no bureau response is logged
- [ ] **NOTF-03**: User can configure email preferences (enable/disable, customize timing)

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
| AI-01 | Phase 3 | Complete |
| AI-02 | Phase 3 | Complete |
| AI-03 | Phase 3 | Complete |
| AI-04 | Phase 3 | Complete |
| AI-05 | Phase 3 | Complete |
| DISP-01 | Phase 3 | Complete |
| DISP-02 | Phase 3 | Complete |
| DISP-03 | Phase 3 | Complete |
| LTR-01 | Phase 4 | Complete |
| LTR-02 | Phase 4 | Complete |
| LTR-03 | Phase 4 | Complete |
| LTR-04 | Phase 4 | Complete |
| LTR-05 | Phase 4 | Complete |
| LTR-06 | Phase 4 | Complete |
| TRK-01 | Phase 5 | Complete |
| TRK-02 | Phase 5 | Complete |
| TRK-03 | Phase 5 | Complete |
| TRK-04 | Phase 5 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 5 | Complete |
| DASH-03 | Phase 5 | Complete |
| RESP-01 | Phase 6 | Pending |
| RESP-02 | Phase 6 | Pending |
| RESP-03 | Phase 6 | Pending |
| RESP-04 | Phase 6 | Pending |
| ESC-01 | Phase 6 | Pending |
| ESC-02 | Phase 6 | Pending |
| ESC-03 | Phase 6 | Pending |
| ESC-04 | Phase 6 | Pending |
| NOTF-01 | Phase 7 | Pending |
| NOTF-02 | Phase 7 | Pending |
| NOTF-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 29 total (all complete)
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 — v1.1 traceability complete (Phase 6: 8 reqs, Phase 7: 3 reqs)*
