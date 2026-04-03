# Phase 2: PDF Upload & Parsing - Research

**Researched:** 2026-04-03
**Domain:** Convex file storage, PyMuPDF text extraction, bureau-specific PDF parsing, FastAPI router pattern
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Three distinct drop zones on the upload page, one per bureau (Experian, Equifax, TransUnion)
- **D-02:** Each drop zone accepts only PDF files, shows the bureau name/logo
- **D-03:** Progress states per file: idle → uploading → parsing → done (or failed)
- **D-04:** User can upload one, two, or all three — no requirement to upload all at once
- **D-05:** Previously uploaded reports shown with date, with option to re-upload
- **D-06:** PDFs uploaded from frontend directly to Convex Storage (generates a storage ID)
- **D-07:** `credit_reports` table in Convex stores: user_id, bureau, storageId, uploaded_at, parse_status, raw_parsed_data
- **D-08:** After upload, frontend triggers a Convex action that calls FastAPI with the storage URL
- **D-09:** FastAPI downloads the PDF via the Convex storage URL, parses it, returns structured JSON
- **D-10:** Convex action receives parsed JSON and updates the `credit_reports` row (status: done, parsed data stored)
- **D-11:** On parse failure, status set to "failed" with error message stored
- **D-12:** Adapter pattern: one parser class/function per bureau, all implementing a common interface
- **D-13:** Common interface returns a `ParsedReport` structure (same shape regardless of bureau)
- **D-14:** PyMuPDF (fitz) is the primary parser — extracts text blocks with page positions
- **D-15:** pdfplumber used as fallback only when PyMuPDF misses tabular data (Equifax payment grids)
- **D-16:** Bureau detection: infer bureau from PDF content (header text patterns) if not specified
- **D-17:** Image-only PDF detection: check if PyMuPDF returns fewer than 100 characters of text → warn user
- **D-18:** Normalized JSON structure with sections: personal_info, accounts, negative_items, inquiries, public_records
- **D-19:** Each account/tradeline: creditor_name, account_number (last 4 only), account_type, balance, status, payment_history, date_opened, date_reported, date_of_first_delinquency (if available)
- **D-20:** Each negative item: same as account fields plus reason_negative (late_payment, collection, charge_off, etc.)
- **D-21:** Personal info extracted but NOT sent to AI in Phase 3 — PII stripping happens at the AI boundary
- **D-22:** Raw parsed text also stored for debugging/fallback, but structured JSON is the primary output
- **D-23:** `POST /api/reports/parse` — accepts bureau name + PDF URL, returns parsed JSON
- **D-24:** `GET /api/reports/health` — health check for the parsing service (extends existing /api/health)
- **D-25:** Response includes a `confidence` score (0-1) indicating parser's confidence in extraction quality

### Claude's Discretion

- Exact regex patterns for bureau-specific parsing
- PyMuPDF text extraction strategy (by page, by block, etc.)
- Error handling and retry logic for PDF download from Convex Storage
- Exact UI component choices for drop zones and progress indicators
- How to handle multi-page reports (concatenation strategy)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | User can upload credit report PDFs for each bureau (Experian, Equifax, TransUnion) | Convex `generateUploadUrl` + `react-dropzone` + three-zone UI pattern |
| PDF-02 | System parses uploaded PDFs using PyMuPDF with bureau-specific adapters | PyMuPDF 1.26.7 installed; adapter pattern with common interface; `get_text("blocks")` for positional extraction |
| PDF-03 | Parser normalizes output into a common structured format across all three bureaus | `ParsedReport` Pydantic model; bureau-specific extractors all return same shape |
| PDF-04 | Upload page shows progress indicators (uploading → parsing → done) | Local React state machine; Convex reactive `parse_status` field drives UI after polling |
| PDF-05 | System detects image-only PDFs and warns user (no OCR support) | Character count threshold (< 100 chars total) triggers warning; no OCR path |
</phase_requirements>

---

## Summary

Phase 2 connects three systems: the Convex file storage layer (upload), a FastAPI endpoint (parsing), and a Convex action (orchestration). The upload flow is well-understood and follows the Convex standard pattern: generate upload URL → POST file directly to Convex → save storageId → trigger action → action calls FastAPI → FastAPI downloads PDF via storage URL, parses it, returns JSON → action writes result back to Convex.

The hardest part of this phase is the parser adapters. Each bureau's PDF layout differs significantly enough to require separate parsing logic, but the output schema must be identical. PyMuPDF 1.26.7 is already installed on this machine. pdfplumber 0.11.9 is the current latest and will need to be added to `requirements.txt`. The key text extraction method is `page.get_text("blocks")` which returns positional tuples — essential for interpreting PDF layout (section headers by Y position, table columns by X ranges).

Image-only detection is straightforward: count total extracted characters across all pages; if below 100, set `parse_status = "image_only"` and surface a warning in the UI. The Convex `parse_status` field is the reactive state variable that drives UI progress display — the frontend uses `useQuery` on the `credit_reports` table to watch this field change in real time.

**Primary recommendation:** Build the Convex schema extension and the action orchestrator first, then the FastAPI router with stub parsers, then flesh out each bureau adapter. This lets you validate the full data pipeline before parser accuracy is final.

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `CLAUDE.md` that the planner must enforce:

- Use GSD workflow entry points for all file changes (`/gsd:execute-phase`) — no direct repo edits outside GSD workflow
- Tech stack is locked: Next.js 15 App Router + Convex (DB/Auth/Storage) + FastAPI (PDF parsing)
- Never store full SSNs or complete account numbers — only last 4 digits of account numbers
- FastAPI handles PDF parsing and AI operations only; Convex handles auth/DB/storage/real-time
- Proxy path is `/api/backend/*` (not `/api/*`) to avoid Next.js API route collisions
- Convex mutations/queries for data operations; Convex actions for external API calls

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PyMuPDF (pymupdf) | 1.26.7 (installed); 1.27.2 (latest) | Primary PDF text extraction with positional data | Fast, handles multi-page, returns block coordinates essential for layout parsing |
| pdfplumber | 0.11.9 (latest) | Fallback table extraction (Equifax payment grids) | Best-in-class table detection from implicit borders; complements PyMuPDF |
| httpx | 0.28.1 (installed) | Async HTTP client for downloading PDFs from Convex storage URL | Already installed; async-native, better than requests for FastAPI |
| react-dropzone | 15.0.0 (latest) | Drag-and-drop file input with PDF-only validation | Mature, works with App Router, no required form library |
| convex | 1.34.1 (installed) | Storage upload, mutations, reactive queries, actions | Already in project; `generateUploadUrl`, `useAction`, `useQuery` |
| Pydantic v2 | 2.12.5 (installed) | ParsedReport schema validation on FastAPI response | Already installed; strict typing for parsed JSON |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| io.BytesIO | stdlib | In-memory PDF buffer for PyMuPDF | When PDF downloaded as bytes from httpx |
| python-multipart | — | Form data parsing in FastAPI | Not needed — endpoint accepts JSON body (URL string), not multipart |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-dropzone | Native `<input type="file">` | react-dropzone adds drag-and-drop UX and PDF MIME validation with less boilerplate |
| httpx | requests | httpx is already installed and async-native; requests is sync-only |
| pdfplumber (fallback) | PyMuPDF alone | PyMuPDF misses implicitly-bordered tables common in Equifax grids; pdfplumber catches these |

**Installation (additions to requirements.txt):**
```bash
pip install pdfplumber==0.11.9
```

**Frontend (react-dropzone not yet in package.json):**
```bash
npm install react-dropzone
```

**Version verification (confirmed 2026-04-03):**
- PyMuPDF: 1.26.7 installed, 1.27.2 available — use installed unless upgrade needed
- pdfplumber: 0.11.9 latest
- httpx: 0.28.1 installed
- react-dropzone: 15.0.0 latest

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── main.py                    # Existing — add router include
├── routers/
│   └── reports.py             # New — POST /api/reports/parse
├── services/
│   └── pdf_parser/
│       ├── __init__.py
│       ├── base.py            # BureauParser abstract base class
│       ├── experian.py        # ExperianParser
│       ├── equifax.py         # EquifaxParser
│       └── transunion.py      # TransUnionParser
├── models/
│   └── parsed_report.py       # ParsedReport Pydantic model
└── requirements.txt           # Add pdfplumber

frontend/
└── app/(protected)/
    └── upload/
        └── page.tsx           # New upload page
frontend/
└── convex/
    ├── schema.ts              # Extend with credit_reports table
    ├── creditReports.ts       # New: mutations, queries, action
    └── ...
```

### Pattern 1: Convex Upload Flow (Three-Step)

**What:** Generate upload URL → POST file to Convex → save storageId → trigger parse action
**When to use:** Any file upload to Convex Storage from browser

```typescript
// convex/creditReports.ts
import { mutation, action, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveReport = mutation({
  args: {
    storageId: v.id("_storage"),
    bureau: v.union(v.literal("experian"), v.literal("equifax"), v.literal("transunion")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.db.insert("credit_reports", {
      userId: identity.subject,
      bureau: args.bureau,
      storageId: args.storageId,
      uploadedAt: Date.now(),
      parseStatus: "uploaded",
    });
  },
});

export const parseReport = action({
  args: { reportId: v.id("credit_reports") },
  handler: async (ctx, args) => {
    // 1. Get the report record
    const report = await ctx.runQuery(internal.creditReports.getReport, { reportId: args.reportId });
    // 2. Get the storage download URL
    const fileUrl = await ctx.storage.getUrl(report.storageId);
    // 3. Update status to parsing
    await ctx.runMutation(internal.creditReports.setParseStatus, {
      reportId: args.reportId,
      status: "parsing",
    });
    // 4. Call FastAPI
    const response = await fetch(process.env.FASTAPI_URL + "/api/reports/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bureau: report.bureau, pdf_url: fileUrl }),
    });
    if (!response.ok) {
      await ctx.runMutation(internal.creditReports.setParseStatus, {
        reportId: args.reportId,
        status: "failed",
        errorMessage: `FastAPI error ${response.status}`,
      });
      return;
    }
    const parsed = await response.json();
    // 5. Save parsed data
    await ctx.runMutation(internal.creditReports.saveParsedData, {
      reportId: args.reportId,
      parsedData: parsed,
    });
  },
});
```

### Pattern 2: FastAPI Parse Router

**What:** Accept PDF URL + bureau name, download PDF, dispatch to correct adapter, return structured JSON
**When to use:** `POST /api/reports/parse` endpoint implementation

```python
# backend/routers/reports.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from io import BytesIO
from services.pdf_parser import get_parser

router = APIRouter(prefix="/api/reports", tags=["reports"])

class ParseRequest(BaseModel):
    bureau: str  # "experian" | "equifax" | "transunion"
    pdf_url: str

@router.post("/parse")
async def parse_report(request: ParseRequest):
    # Download PDF
    async with httpx.AsyncClient() as client:
        response = await client.get(request.pdf_url, timeout=30.0)
        response.raise_for_status()
    
    pdf_bytes = BytesIO(response.content)
    
    # Get bureau-specific parser
    parser = get_parser(request.bureau)
    result = parser.parse(pdf_bytes)
    
    return result.model_dump()
```

### Pattern 3: PyMuPDF Block Extraction

**What:** Extract text with positional data; detect image-only PDFs
**When to use:** Inside each bureau parser's `parse()` method

```python
# services/pdf_parser/base.py
import pymupdf  # or: import fitz
from io import BytesIO

class BureauParser:
    IMAGE_ONLY_THRESHOLD = 100  # chars — per D-17

    def extract_text_blocks(self, pdf_bytes: BytesIO) -> tuple[list, str]:
        """Returns (blocks, full_text). blocks are (x0,y0,x1,y1,text,block_no,type)."""
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        all_blocks = []
        full_text = ""
        for page in doc:
            blocks = page.get_text("blocks")
            all_blocks.extend(blocks)
            full_text += page.get_text()
        doc.close()
        return all_blocks, full_text

    def is_image_only(self, full_text: str) -> bool:
        return len(full_text.strip()) < self.IMAGE_ONLY_THRESHOLD

    def parse(self, pdf_bytes: BytesIO):
        raise NotImplementedError
```

### Pattern 4: Frontend Progress State Machine

**What:** Local React state tracks upload/parse progress; Convex reactive query confirms final status
**When to use:** Each bureau drop zone component

```typescript
// Per D-03: idle → uploading → parsing → done | failed
type ParseStatus = "idle" | "uploading" | "parsing" | "done" | "failed";

// In the upload page component:
const [status, setStatus] = useState<Record<Bureau, ParseStatus>>({
  experian: "idle",
  equifax: "idle",
  transunion: "idle",
});

// Local state drives UI during upload + trigger
// Convex reactive query on credit_reports.parseStatus drives final confirmation
const reports = useQuery(api.creditReports.listByUser);
```

### Pattern 5: Convex Schema Extension

**What:** Add `credit_reports` table per D-07
**When to use:** Wave 0 schema task

```typescript
// convex/schema.ts addition
credit_reports: defineTable({
  userId: v.string(),
  bureau: v.union(v.literal("experian"), v.literal("equifax"), v.literal("transunion")),
  storageId: v.id("_storage"),
  uploadedAt: v.number(),
  parseStatus: v.union(
    v.literal("uploaded"),
    v.literal("parsing"),
    v.literal("done"),
    v.literal("failed"),
    v.literal("image_only"),
  ),
  parsedData: v.optional(v.any()),   // structured ParsedReport JSON
  rawText: v.optional(v.string()),    // per D-22: stored for debugging
  errorMessage: v.optional(v.string()),
  confidence: v.optional(v.number()), // per D-25: 0-1 parser confidence
}).index("by_user", ["userId"])
  .index("by_user_bureau", ["userId", "bureau"]),
```

### Anti-Patterns to Avoid

- **Uploading to FastAPI directly:** The decision (D-06) is frontend → Convex Storage. FastAPI never receives the raw binary file — it only receives a URL.
- **Blocking the action on slow parse:** The action is fire-and-forget from the frontend's perspective. Use `useAction` and set local state to "parsing" immediately; the reactive query update signals completion.
- **Calling `ctx.storage.getUrl()` from a mutation:** `getUrl()` is available on `ActionCtx` via `ctx.storage.getUrl()`. In the action, this returns a public URL for the stored file that FastAPI can download.
- **Single monolithic parser:** Do not write one parser that branches on bureau. Keep three separate adapter classes implementing a common abstract base — tested independently.
- **Storing full account numbers:** Extract only last 4 digits at parse time. Never store, log, or return full account numbers from the parser.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop file input | Custom drag event handlers | react-dropzone | react-dropzone handles drag-enter/leave/over, file type filtering, multiple files, rejected files with reasons |
| PDF table detection | Custom line-intersection algorithms | pdfplumber `page.extract_tables()` | pdfplumber's multi-step algorithm handles implicit borders (no visible lines) — Equifax payment grids have these |
| Async HTTP client in FastAPI | requests (sync) | httpx AsyncClient | httpx is already installed and async-native; requests blocks the event loop in async FastAPI handlers |
| File size/type validation | Manual MIME sniffing | react-dropzone `accept` prop (`application/pdf`) | react-dropzone validates on both MIME type and extension |
| Progress state management | Complex state machine | Simple `useState` with 4-5 literal states | The upload flow is linear; a full state machine library is overkill |

**Key insight:** The PDF parsing domain has well-established libraries for every hard sub-problem. The only custom code needed is the bureau-specific text pattern matching (regex, section header recognition) — everything else should delegate to PyMuPDF, pdfplumber, or httpx.

---

## Common Pitfalls

### Pitfall 1: Bureau PDF Format Divergence (from PITFALLS.md — HIGH risk)
**What goes wrong:** A parser tuned on one bureau silently misparsed for another — wrong account numbers, missing negative items, garbled payment history.
**Why it happens:** Each bureau uses structurally different layouts. Experian uses clear labeled section headers ("ACCOUNT HISTORY", "NEGATIVE ITEMS"). Equifax has dense payment grids with implicit borders. TransUnion has the clearest date formatting with explicit "Date of First Delinquency" labels.
**How to avoid:** Three separate adapter classes. Add a validation pass after parsing: account numbers must be exactly 4 digits after masking, dates must parse, balances must be numeric. Log confidence scores per-field.
**Warning signs:** Empty `accounts` array for one bureau while others work; date fields as None.

### Pitfall 2: Convex `storage.getUrl()` Returns null for Missing Files
**What goes wrong:** `ctx.storage.getUrl(storageId)` returns `null` if the file doesn't exist. An unchecked null causes the fetch in FastAPI to fail silently.
**Why it happens:** Storage ID could be stale (file deleted or wrong ID type).
**How to avoid:** In the Convex action, null-check the URL before calling FastAPI. If null, set status to "failed" with a meaningful error message.
**Warning signs:** FastAPI receiving `null` as a URL; 404 or parse errors logged on FastAPI side.

### Pitfall 3: Convex Action Environment — No `"use node"` Needed for fetch
**What goes wrong:** Developers add `"use node"` to the action file, causing startup overhead and potentially breaking Convex's built-in `fetch`.
**Why it happens:** Confusion about when `"use node"` is required.
**How to avoid:** Convex actions have `fetch` built in (Cloudflare Workers-style runtime). Only add `"use node"` if you need Node.js-specific APIs (Buffer, fs, etc.). For this phase, standard `fetch` to call FastAPI is sufficient.
**Warning signs:** Increased cold start times; import errors for Node builtins when `"use node"` not present.

### Pitfall 4: Image-Only PDFs Return Empty String, Not Error
**What goes wrong:** PyMuPDF on an image-only PDF returns `""` not an exception. The parser succeeds with zero data and stores an empty `parsedData`.
**Why it happens:** PyMuPDF is well-behaved — it doesn't error on image PDFs, it just returns no text.
**How to avoid:** Implement the character threshold check (D-17: < 100 chars) at the top of every adapter's `parse()` method BEFORE attempting field extraction. Return a sentinel or raise a specific `ImageOnlyPDFError` that the router converts to a structured "image_only" status.
**Warning signs:** `parsedData` stored as `{"personal_info": {}, "accounts": [], ...}` with all empty arrays.

### Pitfall 5: FASTAPI_URL Missing From Convex Action Environment
**What goes wrong:** `process.env.FASTAPI_URL` is undefined in the Convex action, causing silent failures (fetch to `undefined/api/reports/parse`).
**Why it happens:** Convex actions run in Convex's cloud — they cannot read Next.js `.env.local` or Vercel environment variables. Convex environment variables are set separately via Convex dashboard or CLI.
**How to avoid:** Set `FASTAPI_URL` in the Convex environment via `npx convex env set FASTAPI_URL https://...`. Access via `process.env.FASTAPI_URL` in the action (Convex exposes its own env vars this way).
**Warning signs:** `fetch` to `undefinedapi/reports/parse`; TypeError in action logs.

### Pitfall 6: pdfplumber Requires Separate Install — Not in requirements.txt
**What goes wrong:** Railway Docker build fails because `import pdfplumber` raises ModuleNotFoundError.
**Why it happens:** pdfplumber is not yet in `backend/requirements.txt`.
**How to avoid:** Add `pdfplumber==0.11.9` to `requirements.txt` in Wave 0 alongside PyMuPDF.
**Warning signs:** Import error at FastAPI startup on Railway.

### Pitfall 7: DOFD vs. Charge-Off Date Confusion (from PITFALLS.md — MEDIUM risk)
**What goes wrong:** Parser extracts "date of charge-off" or "last activity date" and stores it as `date_of_first_delinquency`. Phase 3 AI then miscalculates the 7-year obsolescence window.
**Why it happens:** Bureaus label these dates inconsistently; Equifax in particular mixes "Delinquency Date" and "Charge-off Date."
**How to avoid:** Each adapter must explicitly look for DOFD label patterns. If DOFD is not found, leave the field `None` — do not substitute charge-off date. Document the label patterns per bureau in code comments.
**Warning signs:** `date_of_first_delinquency` populated for every account including current ones; dates that are after the charge-off date.

---

## Code Examples

### Image-Only Detection
```python
# Source: PyMuPDF docs + D-17
import pymupdf
from io import BytesIO

def extract_and_check(pdf_bytes: BytesIO) -> tuple[bool, str, list]:
    """Returns (is_image_only, full_text, blocks)."""
    doc = pymupdf.open(stream=pdf_bytes.getvalue(), filetype="pdf")
    full_text = ""
    all_blocks = []
    for page in doc:
        full_text += page.get_text()
        all_blocks.extend(page.get_text("blocks"))
    doc.close()
    is_image_only = len(full_text.strip()) < 100
    return is_image_only, full_text, all_blocks
```

### Bureau Auto-Detection Pattern
```python
# Source: D-16 — infer bureau from header text
BUREAU_MARKERS = {
    "experian": ["experian", "personal credit report"],
    "equifax": ["equifax", "credit file"],
    "transunion": ["transunion", "consumer disclosure"],
}

def detect_bureau(full_text: str) -> str | None:
    text_lower = full_text[:2000].lower()  # Check first 2000 chars
    for bureau, markers in BUREAU_MARKERS.items():
        if any(m in text_lower for m in markers):
            return bureau
    return None
```

### pdfplumber Table Extraction (Equifax fallback)
```python
# Source: pdfplumber docs — implicit border table extraction
import pdfplumber
from io import BytesIO

def extract_tables_pdfplumber(pdf_bytes: BytesIO) -> list[list]:
    tables = []
    with pdfplumber.open(pdf_bytes) as pdf:
        for page in pdf.pages:
            page_tables = page.extract_tables()
            tables.extend(page_tables)
    return tables
```

### Convex Schema Addition (credit_reports table)
```typescript
// Source: Convex docs + D-07
credit_reports: defineTable({
  userId: v.string(),
  bureau: v.union(v.literal("experian"), v.literal("equifax"), v.literal("transunion")),
  storageId: v.id("_storage"),
  uploadedAt: v.number(),
  parseStatus: v.union(
    v.literal("uploaded"),
    v.literal("parsing"),
    v.literal("done"),
    v.literal("failed"),
    v.literal("image_only"),
  ),
  parsedData: v.optional(v.any()),
  rawText: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  confidence: v.optional(v.number()),
}).index("by_user", ["userId"])
  .index("by_user_bureau", ["userId", "bureau"]),
```

### Frontend Upload Handler (Convex pattern)
```typescript
// Source: Convex file storage docs
const generateUploadUrl = useMutation(api.creditReports.generateUploadUrl);
const saveReport = useMutation(api.creditReports.saveReport);
const parseReport = useAction(api.creditReports.parseReport);

async function handleUpload(bureau: Bureau, file: File) {
  setStatus(prev => ({ ...prev, [bureau]: "uploading" }));
  const uploadUrl = await generateUploadUrl();
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  const { storageId } = await result.json();
  const reportId = await saveReport({ storageId, bureau });
  setStatus(prev => ({ ...prev, [bureau]: "parsing" }));
  await parseReport({ reportId });
  // Final status driven by reactive useQuery on credit_reports
}
```

### Pydantic ParsedReport Model
```python
# Source: D-18, D-19, D-20
from pydantic import BaseModel
from typing import Optional

class Tradeline(BaseModel):
    creditor_name: str
    account_number_last4: Optional[str]   # Only last 4 digits — never full number
    account_type: Optional[str]
    balance: Optional[float]
    status: Optional[str]
    payment_history: Optional[list[str]]
    date_opened: Optional[str]
    date_reported: Optional[str]
    date_of_first_delinquency: Optional[str]  # DOFD — None if not found

class NegativeItem(Tradeline):
    reason_negative: Optional[str]  # late_payment | collection | charge_off | ...

class ParsedReport(BaseModel):
    bureau: str
    personal_info: dict          # Extracted but stripped before AI (D-21)
    accounts: list[Tradeline]
    negative_items: list[NegativeItem]
    inquiries: list[dict]
    public_records: list[dict]
    raw_text: Optional[str]      # Stored for debugging (D-22)
    confidence: float            # 0.0–1.0 (D-25)
    parse_warnings: list[str]    # e.g., "DOFD not found for 3 accounts"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import fitz` | `import pymupdf` | PyMuPDF 1.24+ | Both still work; `pymupdf` is the canonical new name |
| PyMuPDF standalone | PyMuPDF4LLM add-on | 2024 | PyMuPDF4LLM adds markdown output mode — not needed here, plain block extraction is correct |
| Convex `useConvexAuth` + manual fetch | `useAction` hook | Convex 1.x | `useAction` is the idiomatic way to call Convex actions from React |
| react-dropzone 14.x | react-dropzone 15.0.0 | 2025 | v15 drops legacy IE support; API is backward-compatible |

**Deprecated/outdated:**
- `import fitz`: Still works, but `import pymupdf` is the canonical form in PyMuPDF >= 1.24. Both work; use `import pymupdf` in new code.
- STACK.md references Supabase for storage — superseded by Convex Storage per the project's initialization decision. Ignore Supabase references in STACK.md.

---

## Open Questions

1. **Bureau header pattern reliability**
   - What we know: Experian, Equifax, TransUnion each have distinct header patterns visible in the first ~2000 chars
   - What's unclear: The exact label strings without a real PDF in hand — exact Experian header might be "Experian Credit Report" or just "EXPERIAN"
   - Recommendation: Implement broad pattern matching (case-insensitive, partial match) and treat bureau parameter from the request as the authoritative override if provided. Per D-16, auto-detect is a fallback when bureau is not specified.

2. **Equifax payment grid format**
   - What we know: Equifax uses dense payment history grids; pdfplumber handles implicit-border tables
   - What's unclear: Whether pdfplumber `extract_tables()` correctly captures the grid without custom `table_settings`
   - Recommendation: Add a note in the EquifaxParser to try `extract_tables()` first; if it returns empty, fall back to regex on text blocks. This is Claude's Discretion territory — the planner should flag this as requiring hands-on testing with a real PDF. STATE.md already notes this: "Bureau-specific PDF format parsing requires hands-on testing with real PDFs."

3. **Convex action timeout for large PDFs**
   - What we know: Convex actions have a default timeout (currently 2 minutes per Convex docs)
   - What's unclear: Whether a multi-page credit report PDF that is slow to download or parse could hit this limit
   - Recommendation: Implement a 25-second httpx timeout in FastAPI (leaving buffer). If FastAPI returns before the Convex action times out, this is not a problem in practice.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | FastAPI/PyMuPDF | ✓ | 3.13.11 | — |
| PyMuPDF | PDF parsing | ✓ | 1.26.7 | — |
| pdfplumber | Equifax table fallback | ✗ | — | Add to requirements.txt (Wave 0) |
| httpx | PDF download in FastAPI | ✓ | 0.28.1 | — |
| Node.js | Next.js frontend | ✓ | 24.13.0 | — |
| react-dropzone | Upload UI | ✗ | — | Add to package.json (Wave 0) |
| Convex CLI | Schema deploy | ✓ | (via convex@1.34.1) | — |

**Missing dependencies with no fallback:**
- `pdfplumber` — required for Equifax table extraction; must be added to `requirements.txt`
- `react-dropzone` — required for upload UI; must be added to `package.json`

**Missing dependencies with fallback:**
- None.

---

## Sources

### Primary (HIGH confidence)
- [Convex File Storage — Upload Files](https://docs.convex.dev/file-storage/upload-files) — generateUploadUrl, three-step upload flow, storageId
- [Convex File Storage — Serve Files](https://docs.convex.dev/file-storage/serve-files) — `ctx.storage.getUrl()` in actions/queries
- [Convex File Storage — Store Files](https://docs.convex.dev/file-storage/store-files) — `ctx.storage.store()` for action-side storage
- [Convex Actions](https://docs.convex.dev/functions/actions) — `useAction`, `ctx.runMutation`, `ctx.runQuery`, external fetch
- PyMuPDF 1.26.7 — installed and verified on this machine; `page.get_text("blocks")`, `page.get_text()`
- httpx 0.28.1 — installed and verified; `AsyncClient`, streaming

### Secondary (MEDIUM confidence)
- [PyMuPDF text extraction recipes](https://pymupdf.readthedocs.io/en/latest/recipes-text.html) — block extraction patterns (403 at fetch time; patterns confirmed via WebSearch cross-reference)
- [pdfplumber GitHub](https://github.com/jsvine/pdfplumber) — table extraction algorithm, `extract_tables()` API
- [react-dropzone npm](https://www.npmjs.com/package/react-dropzone) — v15.0.0, `accept` prop for MIME type filtering

### Tertiary (LOW confidence)
- WebSearch results on Experian/Equifax/TransUnion PDF structure — general section structure confirmed; exact header label strings require validation with real PDFs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified installed or version-confirmed on this machine
- Architecture: HIGH — Convex upload flow verified against official docs; FastAPI router pattern established in Phase 1
- Pitfalls: HIGH — PITFALLS.md already exists from Phase 1 research; Convex-specific pitfalls confirmed via docs
- Bureau parsing patterns: MEDIUM — structural knowledge from docs/search; exact label strings require real PDF testing

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (Convex and PyMuPDF APIs are stable; react-dropzone v15 is recent but stable)
