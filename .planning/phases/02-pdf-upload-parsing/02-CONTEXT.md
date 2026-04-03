# Phase 2: PDF Upload & Parsing - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

User can upload credit report PDFs for all three bureaus (Experian, Equifax, TransUnion). The system stores them in Convex Storage, sends them to FastAPI for parsing via PyMuPDF, normalizes the extracted data into a common structured format, and stores the parsed output in Convex. Upload page shows progress states. Image-only PDFs are detected and warned about. AI analysis of parsed data is Phase 3 — this phase only extracts and structures.

</domain>

<decisions>
## Implementation Decisions

### Upload UX
- **D-01:** Three distinct drop zones on the upload page, one per bureau (Experian, Equifax, TransUnion)
- **D-02:** Each drop zone accepts only PDF files, shows the bureau name/logo
- **D-03:** Progress states per file: idle → uploading → parsing → done (or failed)
- **D-04:** User can upload one, two, or all three — no requirement to upload all at once
- **D-05:** Previously uploaded reports shown with date, with option to re-upload

### PDF Storage Flow
- **D-06:** PDFs uploaded from frontend directly to Convex Storage (generates a storage ID)
- **D-07:** `credit_reports` table in Convex stores: user_id, bureau, storageId, uploaded_at, parse_status, raw_parsed_data
- **D-08:** After upload, frontend triggers a Convex action that calls FastAPI with the storage URL
- **D-09:** FastAPI downloads the PDF via the Convex storage URL, parses it, returns structured JSON
- **D-10:** Convex action receives parsed JSON and updates the `credit_reports` row (status: done, parsed data stored)
- **D-11:** On parse failure, status set to "failed" with error message stored

### Parser Architecture
- **D-12:** Adapter pattern: one parser class/function per bureau, all implementing a common interface
- **D-13:** Common interface returns a `ParsedReport` structure (same shape regardless of bureau)
- **D-14:** PyMuPDF (fitz) is the primary parser — extracts text blocks with page positions
- **D-15:** pdfplumber used as fallback only when PyMuPDF misses tabular data (Equifax payment grids)
- **D-16:** Bureau detection: infer bureau from PDF content (header text patterns) if not specified
- **D-17:** Image-only PDF detection: check if PyMuPDF returns fewer than 100 characters of text → warn user

### Parsed Data Schema
- **D-18:** Normalized JSON structure with sections: personal_info, accounts, negative_items, inquiries, public_records
- **D-19:** Each account/tradeline: creditor_name, account_number (last 4 only), account_type, balance, status, payment_history, date_opened, date_reported, date_of_first_delinquency (if available)
- **D-20:** Each negative item: same as account fields plus reason_negative (late_payment, collection, charge_off, etc.)
- **D-21:** Personal info extracted but NOT sent to AI in Phase 3 — PII stripping happens at the AI boundary
- **D-22:** Raw parsed text also stored for debugging/fallback, but structured JSON is the primary output

### FastAPI Endpoint Design
- **D-23:** `POST /api/reports/parse` — accepts bureau name + PDF URL, returns parsed JSON
- **D-24:** `GET /api/reports/health` — health check for the parsing service (extends existing /api/health)
- **D-25:** Response includes a `confidence` score (0-1) indicating parser's confidence in extraction quality

### Claude's Discretion
- Exact regex patterns for bureau-specific parsing
- PyMuPDF text extraction strategy (by page, by block, etc.)
- Error handling and retry logic for PDF download from Convex Storage
- Exact UI component choices for drop zones and progress indicators
- How to handle multi-page reports (concatenation strategy)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, bureau mailing addresses, dispute lifecycle
- `.planning/REQUIREMENTS.md` — PDF-01 through PDF-05 acceptance criteria
- `.planning/research/STACK.md` — PyMuPDF and pdfplumber recommendations (ignore Supabase references)
- `.planning/research/ARCHITECTURE.md` — Data flow diagrams, component boundaries
- `.planning/research/PITFALLS.md` — Bureau PDF format divergence (Pitfall 1), image PDF detection (Pitfall 7), DOFD confusion (Pitfall 8)

### Phase 1 Code (foundation)
- `frontend/convex/schema.ts` — Existing Convex schema to extend with credit_reports table
- `frontend/lib/api.ts` — Existing API client to extend with parse endpoint
- `backend/main.py` — Existing FastAPI app to add parse router to

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/lib/api.ts` — typed `apiFetch<T>` function for calling FastAPI
- `frontend/convex/schema.ts` — Convex schema with authTables + users table
- `frontend/components/ConvexClientProvider.tsx` — Convex provider already wired
- `backend/main.py` — FastAPI app with CORS already configured

### Established Patterns
- Convex mutations/queries for data operations (from Phase 1 auth/profile)
- Convex actions for external API calls (pattern established but not yet used)
- FastAPI routers pattern (main.py ready for router includes)

### Integration Points
- New `credit_reports` table added to Convex schema
- New FastAPI router mounted at `/api/reports/`
- Upload page added to frontend routing under `/(protected)/upload/`
- Convex action bridges frontend upload → FastAPI parse → Convex storage

</code_context>

<specifics>
## Specific Ideas

- Bureau formats differ significantly: Experian uses clear section headers, Equifax has dense payment grids, TransUnion has the clearest date formatting
- PDFs from annualcreditreport.com are text-based (not scanned), so OCR is not needed
- Only last 4 digits of account numbers should be extracted and stored
- Parser should extract Date of First Delinquency (DOFD) when available — critical for 7-year calculation in Phase 3

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-pdf-upload-parsing*
*Context gathered: 2026-04-03*
