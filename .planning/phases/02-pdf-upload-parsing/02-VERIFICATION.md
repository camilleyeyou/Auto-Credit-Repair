---
phase: 02-pdf-upload-parsing
verified: 2026-04-03T00:00:00Z
status: gaps_found
score: 3/4 success criteria verified
gaps:
  - truth: "User can upload a PDF for each of the three bureaus (Experian, Equifax, TransUnion) from the upload page"
    status: partial
    reason: "The /upload page exists and is fully functional, but there is no navigation link to it from anywhere in the app. The protected layout nav (Dashboard, Profile) does not include Upload. The dashboard page has no link either. A user cannot reach /upload without typing the URL directly. Additionally, the middleware isProtectedRoute matcher only covers /dashboard and /profile — /upload is missing, so server-side auth redirect does not fire for unauthenticated access to /upload (only client-side layout guard catches it)."
    artifacts:
      - path: "frontend/app/(protected)/layout.tsx"
        issue: "Nav links only Dashboard and Profile — no Upload link"
      - path: "frontend/middleware.ts"
        issue: "isProtectedRoute only covers /dashboard(.*) and /profile(.*); /upload not included"
    missing:
      - "Add Upload nav link to frontend/app/(protected)/layout.tsx"
      - "Add '/upload(.*)' to isProtectedRoute in frontend/middleware.ts"
human_verification:
  - test: "Upload a real text-based credit report PDF from annualcreditreport.com for each of the three bureaus"
    expected: "Each bureau zone progresses uploading → parsing → done, confidence score shown, parsedData stored in Convex with non-empty accounts or negative_items arrays"
    why_human: "Requires a real credit report PDF; parser confidence and field extraction accuracy cannot be verified without actual bureau PDF content"
  - test: "Upload a scanned/image-only PDF to any bureau drop zone"
    expected: "Orange 'Cannot Process' warning appears referencing annualcreditreport.com; Convex record shows parseStatus: image_only"
    why_human: "Requires a real image-only PDF to trigger the detection branch end-to-end"
  - test: "Refresh the page after uploading one report; verify persistence display"
    expected: "Previously uploaded report date appears under the relevant bureau zone; idle state shows '— drop a new PDF to replace'"
    why_human: "Requires browser interaction and live Convex connection to observe reactive query behavior"
---

# Phase 2: PDF Upload & Parsing Verification Report

**Phase Goal:** User can upload all three bureau credit report PDFs and the system produces clean, structured data ready for AI analysis
**Verified:** 2026-04-03
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can upload a PDF for each of the three bureaus from the upload page | PARTIAL | /upload page exists and is functional; BureauDropZone renders all three bureaus; but no nav link exists to reach /upload from within the app; middleware does not protect the route server-side |
| 2 | Upload page shows distinct progress states (uploading → parsing → done) for each file | VERIFIED | BureauDropZone.tsx renders 6 distinct states (idle, uploading, parsing, done, failed, image_only) with distinct visual treatments; upload handler drives idle→uploading→parsing; useEffect syncs terminal states from Convex |
| 3 | A text-only PDF is parsed into structured tradeline and negative item data normalized across all three bureau formats | VERIFIED | All three bureau adapters (ExperianParser, EquifaxParser, TransUnionParser) implement real regex-based extraction returning Tradeline and NegativeItem objects in a normalized ParsedReport shape; not stubs |
| 4 | An image-only (scanned) PDF triggers a visible warning telling the user it cannot be processed | VERIFIED | ImageOnlyPDFError raised for PDFs with < 100 chars (confirmed by smoke test); router returns parse_status="image_only"; Convex action sets parseStatus="image_only" with error message; BureauDropZone renders orange warning with annualcreditreport.com instruction |

**Score:** 3/4 truths fully verified (Truth 1 is partial — upload page works but is unreachable from the app)

---

## Required Artifacts

| Artifact | Purpose | Status | Details |
|----------|---------|--------|---------|
| `frontend/convex/schema.ts` | credit_reports table with 9 fields, 2 indexes, 5 parseStatus literals | VERIFIED | Table present with all required fields, by_user and by_user_bureau indexes, all 5 literals |
| `frontend/convex/creditReports.ts` | 4 public + 3 internal Convex functions | VERIFIED | generateUploadUrl, saveReport, parseReport, listByUser exported; getReport, setParseStatus, saveParsedData as internal; no "use node" directive; FASTAPI_URL guard present; null storage URL guard present |
| `backend/requirements.txt` | pdfplumber dependency | VERIFIED | pdfplumber==0.11.9 present; httpx==0.28.1 present |
| `backend/models/parsed_report.py` | ParsedReport, Tradeline, NegativeItem, ImageOnlyPDFError | VERIFIED | All four importable; account_number_last4 enforces last-4-only; DOFD field present with None default |
| `backend/services/pdf_parser/base.py` | BureauParser ABC with image-only detection | VERIFIED | extract_text_blocks() raises ImageOnlyPDFError for < 100 chars; detect_bureau() present; abstract parse() method |
| `backend/services/pdf_parser/__init__.py` | get_parser() factory | VERIFIED | Returns correct adapter for experian/equifax/transunion; raises ValueError for unknown bureau |
| `backend/services/pdf_parser/experian.py` | ExperianParser with real extraction | VERIFIED | Real regex extraction, not stub; creditor_name, account_number_last4, balance, status, dates, DOFD, payment_history extracted; confidence scoring |
| `backend/services/pdf_parser/equifax.py` | EquifaxParser with pdfplumber fallback | VERIFIED | pdfplumber imported and used; Pitfall 7 DOFD vs charge-off separation; real extraction logic |
| `backend/services/pdf_parser/transunion.py` | TransUnionParser with DOFD patterns | VERIFIED | date_of_first_delinquency extraction present; real extraction logic |
| `backend/routers/reports.py` | POST /api/reports/parse and GET /api/reports/health | VERIFIED | Both routes present (/api/reports/health, /api/reports/parse); ImageOnlyPDFError handled as structured response; httpx timeout 25.0s |
| `backend/main.py` | reports router mounted | VERIFIED | include_router(reports_router) present; router mounted under /api/reports/ prefix |
| `frontend/components/upload/BureauDropZone.tsx` | Drop zone component with all progress states | VERIFIED | useDropzone from react-dropzone; application/pdf MIME filter; all 6 states rendered; image_only warning with annualcreditreport.com reference; confidence display |
| `frontend/app/(protected)/upload/page.tsx` | Upload page with three bureau zones | VERIFIED | useQuery(listByUser), useMutation(generateUploadUrl/saveReport), useAction(parseReport) all called; md:grid-cols-3 layout; upload handler drives full pipeline; useEffect syncs terminal statuses |
| `frontend/app/(protected)/layout.tsx` | Nav with Upload link | FAILED | Nav only contains Dashboard and Profile links — no Upload link |
| `frontend/middleware.ts` | /upload in protected routes | FAILED | isProtectedRoute only covers /dashboard(.*) and /profile(.*); /upload not listed |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `creditReports.ts (parseReport)` | FastAPI /api/reports/parse | fetch(FASTAPI_URL + "/api/reports/parse") | WIRED | FASTAPI_URL guard present; POST with bureau + pdf_url; FastAPI error handled |
| `creditReports.ts (parseReport)` | `credit_reports` table via saveParsedData | ctx.runMutation(internal.creditReports.saveParsedData) | WIRED | parsedData, rawText, confidence written back; parseStatus set to "done" |
| `routers/reports.py` | `services/pdf_parser/__init__.py` | from services.pdf_parser import get_parser | WIRED | Imported and called; ValueError caught as 400 |
| `routers/reports.py` | `models/parsed_report.py` | from models.parsed_report import ParsedReport, ImageOnlyPDFError | WIRED | Both used; ImageOnlyPDFError caught and returned as structured image_only response |
| `backend/main.py` | `routers/reports.py` | app.include_router(reports_router) | WIRED | Router mounted at /api/reports/ prefix |
| `upload/page.tsx` | `convex/creditReports.ts` | api.creditReports.{generateUploadUrl, saveReport, parseReport, listByUser} | WIRED | All four Convex functions called in upload handler and useQuery |
| `upload/page.tsx` | `BureauDropZone.tsx` | import BureauDropZone | WIRED | Rendered in grid for each of 3 bureaus; all props passed |
| `equifax.py` | pdfplumber | import pdfplumber; pdfplumber.open(pdf_bytes) | WIRED | pdfplumber used in _extract_payment_history_pdfplumber fallback |
| Nav layout | `/upload` page | href="/upload" | NOT WIRED | No Link to /upload exists in protected layout nav |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `upload/page.tsx` | reports (CreditReport[]) | useQuery(api.creditReports.listByUser) → ctx.db.query("credit_reports") | Real DB query via Convex | FLOWING |
| `upload/page.tsx` | localStatuses | useState + useEffect syncing Convex parseStatus | Terminal states from Convex propagate to UI | FLOWING |
| `experian.py` | accounts, negative_items | regex extraction on PyMuPDF full_text blocks | Real text extraction (confidence-scored; empty on no-match is valid behavior) | FLOWING |
| `equifax.py` | accounts, negative_items | regex + pdfplumber fallback | Real text extraction with pdfplumber payment grid fallback | FLOWING |
| `transunion.py` | accounts, negative_items | regex extraction on PyMuPDF full_text blocks | Real text extraction | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All backend imports clean | python3 -c "from models.parsed_report import ...; from services.pdf_parser import get_parser; from routers.reports import router" | All imports OK | PASS |
| get_parser() returns correct adapter for each bureau | python3 -c "get_parser('experian')" etc. | ExperianParser, EquifaxParser, TransUnionParser | PASS |
| ImageOnlyPDFError raised for blank PDF | Extract text from 0-char PDF | PASS: ImageOnlyPDFError raised with correct message referencing annualcreditreport.com | PASS |
| Router exposes correct routes | router.routes paths | ['/api/reports/health', '/api/reports/parse'] | PASS |
| react-dropzone in package.json | grep react-dropzone frontend/package.json | "react-dropzone": "^15.0.0" | PASS |
| Real PDF parsing (end-to-end with actual bureau PDF) | Requires running server + real PDF | Cannot verify without live environment | SKIP — human needed |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PDF-01 | 02-01, 02-04, 02-05 | User can upload credit report PDFs for each bureau | PARTIAL | Upload page and Convex pipeline work; no nav link to reach /upload from within the app |
| PDF-02 | 02-02, 02-03, 02-05 | System parses uploaded PDFs using PyMuPDF with bureau-specific adapters | VERIFIED | All three parsers use PyMuPDF via BureauParser.extract_text_blocks(); real regex extraction implemented |
| PDF-03 | 02-01, 02-02, 02-03, 02-05 | Parser normalizes output into common structured format across all three bureaus | VERIFIED | ParsedReport shape is identical for all three bureaus; accounts, negative_items, inquiries, public_records, confidence, parse_warnings |
| PDF-04 | 02-01, 02-04, 02-05 | Upload page shows progress indicators (uploading → parsing → done) | VERIFIED | BureauDropZone renders 6 distinct states with distinct visual treatments; state machine in upload handler |
| PDF-05 | 02-01, 02-02, 02-03, 02-04, 02-05 | System detects image-only PDFs and warns user | VERIFIED | ImageOnlyPDFError at < 100 chars confirmed by smoke test; parse_status="image_only" surfaced; orange warning in BureauDropZone |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/app/(protected)/layout.tsx` | 34-39 | Nav links: Dashboard, Profile only — /upload missing | Blocker | User cannot navigate to the upload page from within the app; must know to type /upload manually |
| `frontend/middleware.ts` | 9-12 | isProtectedRoute covers /dashboard(.*) and /profile(.*) only; /upload not listed | Warning | /upload route does not trigger server-side auth redirect for unauthenticated users; relies solely on client-side layout check |

---

## Human Verification Required

### 1. End-to-End Upload with Real Bureau PDF

**Test:** Start both services (`cd backend && uvicorn main:app --reload --port 8000` and `cd frontend && npm run dev`), set `npx convex env set FASTAPI_URL http://localhost:8000`, navigate directly to http://localhost:3000/upload, and drop a real text-based credit report PDF from annualcreditreport.com into one of the bureau zones.
**Expected:** Status progresses uploading → parsing → done; confidence score appears; parsedData in Convex contains non-empty accounts or negative_items (or parse_warnings if the specific PDF format needs tuning — this is acceptable per STATE.md).
**Why human:** Requires a real credit report PDF; parser accuracy depends on actual bureau PDF formatting that cannot be validated programmatically.

### 2. Image-Only PDF Warning

**Test:** Upload a scanned/image-only PDF (any image saved as PDF) to a bureau drop zone.
**Expected:** Orange "Cannot Process" warning appears; text references annualcreditreport.com; Convex record shows parseStatus: image_only.
**Why human:** Requires a real image-only PDF file; the smoke test confirmed ImageOnlyPDFError fires programmatically, but the end-to-end UI rendering needs visual confirmation.

### 3. Upload Page Reachability After Adding Nav Link

**Test:** After the nav link gap is fixed, verify that clicking "Upload" in the nav from any authenticated page navigates to /upload and shows three distinct bureau drop zones.
**Expected:** Three zones labeled Experian (red border), Equifax (blue border), TransUnion (cyan border); each shows "Ready" badge; drop zones accept drag-and-drop.
**Why human:** Visual appearance and navigation UX require browser interaction.

---

## Gaps Summary

**One gap blocks full goal achievement:**

Truth 1 ("User can upload from the upload page") is rated PARTIAL rather than FAILED because the upload page is fully implemented and functional — the pipeline works end-to-end once you reach the page. However, the page is only reachable by typing the URL directly. The protected layout nav does not include an Upload link, and the dashboard page (the user's landing page after login) has no link to the upload workflow. This means the user cannot discover or access Phase 2's primary feature through normal in-app navigation.

**Fix required:**
1. Add `<Link href="/upload" ...>Upload</Link>` to the nav in `frontend/app/(protected)/layout.tsx`
2. Add `"/upload(.*)"` to `isProtectedRoute` in `frontend/middleware.ts`

These are minimal one-line fixes. All other Phase 2 deliverables (parsers, API, Convex pipeline, UI component, progress states, image-only warning) are fully implemented and structurally verified.

---

_Verified: 2026-04-03_
_Verifier: Claude (gsd-verifier)_
