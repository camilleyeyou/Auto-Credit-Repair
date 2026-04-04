---
phase: 03-ai-analysis-dispute-review
verified: 2026-04-04T08:06:45Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "After a report is parsed, the system automatically identifies disputable items and each item shows a specific FCRA section citation"
    status: partial
    reason: "The AI analysis pipeline exists and items include FCRA section citations (§ number + title), but the FastAPI analyze endpoint cannot fetch report data from Convex at runtime because creditReports:getReport is an internalQuery — inaccessible via the public Convex REST API."
    artifacts:
      - path: "backend/routers/reports.py"
        issue: "Lines 114-123 call POST /api/query with path 'creditReports:getReport'. This is an internalQuery and cannot be called via the Convex public HTTP API. The endpoint will fail at runtime with a 404 or 403 from Convex."
      - path: "frontend/convex/creditReports.ts"
        issue: "getReport is exported as internalQuery (line 50) — not accessible from outside Convex. FastAPI needs either a public query or the parsed data passed in the request body."
    missing:
      - "Either: expose a public getReport query in creditReports.ts for external callers"
      - "Or: change the Convex analyzeReport action to pass parsedData in the request body to FastAPI (POST body), eliminating the FastAPI → Convex callback dependency"
      - "Either: replace listByReport idempotency check in FastAPI with passing reused=false always (idempotency handled by Convex action's analysisStatus guard)"
---

# Phase 3: AI Analysis & Dispute Review Verification Report

**Phase Goal:** User can see every AI-identified disputable item with its FCRA basis, then approve or skip each one before any letter is created
**Verified:** 2026-04-04T08:06:45Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After a report is parsed, the system automatically identifies disputable items and each item shows a specific FCRA section citation | PARTIAL | AI pipeline fully built; FCRA citations present (§ number + title). Blocked at runtime by internalQuery call from FastAPI. |
| 2 | Every FCRA citation matches a section in the hardcoded validated citation library — no hallucinated statute numbers reach the UI | VERIFIED | FCRA_LIBRARY with 5 exact sections; dual defense: enum constraint in tool schema + validate_fcra_section() post-call pass on every item. Python behavioral check confirmed: validate_fcra_section("611") = ("611", True), validate_fcra_section("999") = ("611", False). |
| 3 | No SSNs or full account numbers are present in data sent to the Claude API | VERIFIED | build_prompt_payload() uses model_dump(include={"accounts","negative_items","inquiries","public_records","bureau"}) — personal_info explicitly excluded. Python behavioral check confirmed: personal_info not in payload keys. |
| 4 | User can view flagged items grouped by bureau and approve or skip each one individually | VERIFIED | disputes/page.tsx implements bureau tabs (All/Experian/Equifax/TransUnion), item cards with Approve/Skip buttons, optimistic update via withOptimisticUpdate. useQuery(api.disputeItems.listByUser) is wired. |
| 5 | Approved items enter a tracked lifecycle (pending_review → approved) visible in the dispute list | VERIFIED | saveDisputeItems inserts with status:"pending_review". updateDisputeStatus mutation patches to "approved" or "skipped". Schema defines full lifecycle: pending_review → approved → letter_generated → sent → resolved/denied. Optimistic update shows status badge immediately. |

**Score:** 4/5 truths verified (1 partial — pipeline blocked by internalQuery call)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/models/dispute_item.py` | DisputeItemOut, AnalyzeResponse Pydantic models | VERIFIED | Both models exist with all required fields including fcra_section, fcra_section_title, fcra_section_usc, citation_validated. |
| `backend/services/ai_analyzer.py` | FCRA_LIBRARY, PII stripper, Claude tool_use call | VERIFIED | 272 lines. FCRA_LIBRARY with 5 sections, validate_fcra_section(), build_prompt_payload() with explicit personal_info exclusion, analyze_parsed_report() with tool_choice={"type":"any"}. |
| `backend/routers/reports.py` | POST /api/reports/{report_id}/analyze endpoint | STUB/WIRED | Endpoint exists and is registered. Core logic is correct but calls creditReports:getReport (internalQuery) via public REST API — will fail at runtime. |
| `backend/requirements.txt` | anthropic==0.88.0 | VERIFIED | Line 23: anthropic==0.88.0 present. |
| `frontend/convex/schema.ts` | dispute_items table + analysisStatus on credit_reports | VERIFIED | dispute_items table with 7-status lifecycle, 3 indexes. credit_reports extended with analysisStatus (4 states) and analysisErrorMessage. |
| `frontend/convex/disputeItems.ts` | saveDisputeItems, updateDisputeStatus, listByUser, listByReport | VERIFIED | All 4 functions present: saveDisputeItems (internalMutation, idempotent), updateDisputeStatus (public, auth-guarded), listByUser (public), listByReport (public). |
| `frontend/convex/creditReports.ts` | setAnalysisStatus, analyzeReport action | VERIFIED | Both present. analyzeReport mirrors parseReport pattern, outer catch sets analysis_failed, idempotency guard on analysisStatus==="analyzed". |
| `frontend/app/(protected)/disputes/page.tsx` | Dispute review page with bureau tabs and item cards | VERIFIED | 279 lines. Bureau tabs, item cards with creditorName, fcraSection badge, confidence indicator, approve/skip buttons, optimistic update, empty/loading states, "Generate Letters" CTA. |
| `frontend/app/(protected)/upload/page.tsx` | Analyze button wired to analyzeReport action | VERIFIED | analyzeReport via useAction, analyze button states (idle/analyzing/analyzed/failed), redirects to /disputes on completion. |
| `frontend/app/(protected)/layout.tsx` | /disputes nav link | VERIFIED | Line 40: `<Link href="/disputes">Disputes</Link>` present. |
| `frontend/middleware.ts` | /disputes protected route | VERIFIED | Line 11: "/disputes(.*)" in isProtectedRoute matcher. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| backend/routers/reports.py | backend/services/ai_analyzer.py | `from services.ai_analyzer import analyze_parsed_report` | WIRED | Line 24 of reports.py: import present. analyze_report() calls analyze_parsed_report() at line 174. |
| backend/services/ai_analyzer.py | Claude API | `anthropic.Anthropic(api_key=...) + tool_choice={"type":"any"}` | WIRED | Lines 223-239: client.messages.create with model, tools, tool_choice. |
| backend/services/ai_analyzer.py | FCRA_LIBRARY | `validate_fcra_section called on every item` | WIRED | Lines 174-183 (definition), line 253 (call in loop). Every raw item validated before DisputeItemOut is constructed. |
| backend/routers/reports.py | frontend/convex/creditReports.ts (getReport) | `POST /api/query path="creditReports:getReport"` | NOT_WIRED | getReport is internalQuery — inaccessible via public Convex REST API. This call will fail at runtime. |
| backend/routers/reports.py | frontend/convex/disputeItems.ts (listByReport) | `POST /api/query path="disputeItems:listByReport"` | NOT_WIRED | listByReport is a public query but auth-guarded (requires user JWT). FastAPI calls with service API key — auth.getUserIdentity() will return null and throw "Not authenticated". |
| frontend/convex/creditReports.ts (analyzeReport) | backend/routers/reports.py (POST /{report_id}/analyze) | `fetch(FASTAPI_URL/api/reports/{reportId}/analyze)` | WIRED | Lines 264-268: fetch call present with FASTAPI_URL guard. |
| frontend/convex/creditReports.ts (analyzeReport) | frontend/convex/disputeItems.ts (saveDisputeItems) | `ctx.runMutation(internal.disputeItems.saveDisputeItems, ...)` | WIRED | Line 302: call present with correct camelCase field mapping. |
| frontend/convex/creditReports.ts (analyzeReport) | frontend/convex/creditReports.ts (setAnalysisStatus) | `ctx.runMutation(internal.creditReports.setAnalysisStatus, ...)` | WIRED | Called 3 times: analyzing (line 254), analyzed (line 309), analysis_failed (line 317). |
| frontend/app/(protected)/disputes/page.tsx | frontend/convex/disputeItems.ts (listByUser) | `useQuery(api.disputeItems.listByUser)` | WIRED | Line 82: useQuery present and data used in render. |
| frontend/app/(protected)/disputes/page.tsx | frontend/convex/disputeItems.ts (updateDisputeStatus) | `useMutation(api.disputeItems.updateDisputeStatus).withOptimisticUpdate` | WIRED | Lines 84-98: mutation with optimistic update. Called at lines 224 (approve) and 231 (skip). |
| frontend/app/(protected)/upload/page.tsx | frontend/convex/creditReports.ts (analyzeReport) | `useAction(api.creditReports.analyzeReport)` | WIRED | Line 52: useAction present. handleAnalyze() at line 118 calls analyzeReport then routes to /disputes. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| disputes/page.tsx | `items` (dispute items list) | `useQuery(api.disputeItems.listByUser)` → Convex DB query by_user index | Yes — real DB query via Convex index | FLOWING |
| disputes/page.tsx | `filteredItems` | Client-side filter of `items` by bureau | Derived from real data | FLOWING |
| disputes/page.tsx | status badge / approve/skip buttons | `item.status` field from Convex | Real Convex field, updated by updateDisputeStatus mutation | FLOWING |
| upload/page.tsx | `reports` (credit reports list) | `useQuery(api.creditReports.listByUser)` | Real DB query | FLOWING |
| upload/page.tsx | `report.analysisStatus` | Reactive from Convex, set by setAnalysisStatus mutation | Real DB field | FLOWING |
| backend: analyze_report endpoint | `report_data` | Convex REST API call to creditReports:getReport | BLOCKED — internalQuery not accessible | DISCONNECTED |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| FCRA_LIBRARY has exactly 5 sections | `python -c "from services.ai_analyzer import FCRA_LIBRARY; print(list(FCRA_LIBRARY.keys()))"` | `['611', '623', '605', '609', '612']` | PASS |
| validate_fcra_section returns known section | `python -c "from services.ai_analyzer import validate_fcra_section; print(validate_fcra_section('611'))"` | `('611', True)` | PASS |
| validate_fcra_section maps unknown to 611 | `python -c "from services.ai_analyzer import validate_fcra_section; print(validate_fcra_section('999'))"` | `('611', False)` | PASS |
| PII excluded from Claude prompt | `python -c "from services.ai_analyzer import build_prompt_payload; ..."` | `payload keys: ['bureau', 'accounts', 'negative_items', 'inquiries', 'public_records']; personal_info present: False` | PASS |
| dispute_item models import cleanly | `python -c "from models.dispute_item import DisputeItemOut, AnalyzeResponse; print('OK')"` | `OK` | PASS |
| FastAPI router import (analyze route) | `python -c "from routers.reports import router; ..."` | FAIL — ModuleNotFoundError for pymupdf (not installed in local venv) | SKIP — environment issue, not code issue |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-01 | Plans 02, 03, 04 | Claude API analyzes parsed credit report data and identifies disputable items | PARTIAL | analyze_parsed_report() in ai_analyzer.py is fully built. analyzeReport Convex action orchestrates correctly. But FastAPI endpoint cannot fetch report data from Convex at runtime (internalQuery issue). |
| AI-02 | Plans 02, 04 | Each flagged item includes dispute reason and relevant FCRA section citation | VERIFIED | DisputeItemOut has dispute_reason, fcra_section, fcra_section_title, fcra_section_usc. UI renders § {fcraSection} badge with fcraSectionTitle tooltip. |
| AI-03 | Plan 02 | FCRA citations validated against a hardcoded library of real statute sections | VERIFIED | FCRA_LIBRARY with 5 exact sections. Dual defense: enum constraint in tool schema + validate_fcra_section() post-call. Behavioral test confirmed. |
| AI-04 | Plan 02 | PII (SSNs, full account numbers) stripped from data before sending to Claude API | VERIFIED | build_prompt_payload() explicitly excludes personal_info. Only last 4 digits stored via account_number_last4 in models. Behavioral test confirmed. |
| AI-05 | Plan 02 | AI generates item-specific dispute reasoning, not generic boilerplate | VERIFIED | Tool description and system prompt explicitly require item-specific reasoning and prohibit generic boilerplate. ANALYZE_TOOL description: "Provide item-specific, individualized dispute reasoning." System prompt rule 3: "Provide item-specific, individualized dispute reasoning." |
| DISP-01 | Plans 01, 04 | User can view all AI-flagged items grouped by bureau | VERIFIED | disputes/page.tsx: bureau tabs (All/Experian/Equifax/TransUnion) filter items client-side. Items loaded via useQuery(api.disputeItems.listByUser). |
| DISP-02 | Plans 01, 04 | User can approve or skip each flagged item individually | VERIFIED | Approve/Skip buttons on each card call updateDisputeStatus. Optimistic update via withOptimisticUpdate shows status change immediately. Auth-guarded mutation. |
| DISP-03 | Plans 01, 03, 04 | Dispute items track status lifecycle (pending_review → approved → letter_generated → sent → resolved/denied) | VERIFIED | Schema defines all 7 statuses. saveDisputeItems inserts with pending_review. updateDisputeStatus accepts approved/skipped. Full lifecycle columns present for Phase 4+ use. |

**All 8 requirements accounted for (AI-01 through AI-05, DISP-01 through DISP-03).**
**No orphaned requirements found.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| backend/routers/reports.py | 116-121 | Calls `creditReports:getReport` (internalQuery) via public Convex REST API | Blocker | analyze endpoint will fail at runtime — Convex rejects external calls to internal queries |
| backend/routers/reports.py | 139-148 | Calls `disputeItems:listByReport` (auth-guarded public query) via service API key | Blocker | listByReport calls ctx.auth.getUserIdentity() which returns null for service-key calls; throws "Not authenticated" |
| frontend/app/(protected)/dashboard/page.tsx | 1-8 | Dashboard is a placeholder stub (only renders h1 + welcome text, no functional content) | Warning | Not in scope for Phase 3 but noted — dashboard doesn't render any dispute data |
| frontend/convex/creditReports.ts | 283 | `fcra_section_usc` received from FastAPI but not mapped to Convex items array (line 291-300) | Info | USC citation (e.g. "15 U.S.C. § 1681i") is dropped during snake_case→camelCase mapping. UI shows § number + title but not the full USC citation. Not a goal blocker but data is silently lost. |

---

## Human Verification Required

### 1. End-to-End Flow Verification (Blocked Until Gap Fixed)

**Test:** After fixing the internalQuery issue (see gap), run: log in, upload a credit report PDF, click "Analyze Report", wait for redirect to /disputes, verify items appear with FCRA badges.
**Expected:** Items appear with creditor names, "§ 611" / "§ 623" / "§ 605" badges showing the FCRA section, dispute reasons from Claude, confidence percentages. Bureau tabs filter correctly.
**Why human:** Requires live Convex + FastAPI + Anthropic API environment to test the full pipeline.

### 2. Optimistic Update Visual Behavior

**Test:** Click "Approve" on a dispute item. Watch the UI.
**Expected:** Approve/Skip buttons disappear immediately (before server confirmation) and an "Approved" green badge appears in their place.
**Why human:** Optimistic update behavior requires visual verification of instant vs. delayed update.

### 3. Status Persistence on Refresh

**Test:** Approve several items, then hard-refresh the page.
**Expected:** Approved/Skipped statuses persist — they are stored in Convex and reload from DB.
**Why human:** Requires live Convex to verify DB write + reactive re-read.

### 4. Bureau Tab Filtering

**Test:** Upload reports for two different bureaus, analyze both, go to /disputes. Click "Experian" tab.
**Expected:** Only items from the Experian report appear.
**Why human:** Requires multi-bureau data to test filtering logic in practice.

---

## Gaps Summary

**Root cause:** One architectural gap blocks the analyze pipeline at runtime.

The FastAPI `analyze_report` endpoint (`POST /api/reports/{report_id}/analyze`) attempts two Convex REST API calls that cannot succeed:

1. **`creditReports:getReport` is an `internalQuery`** — Convex does not expose internal queries via the public HTTP API (`/api/query`). Any external HTTP call to this path will be rejected. FastAPI calls this to retrieve `parsedData` from the report.

2. **`disputeItems:listByReport` requires authentication** — this public query calls `ctx.auth.getUserIdentity()` and throws if no user identity is present. FastAPI's service API key (`CONVEX_API_KEY`) does not provide a user identity.

The Convex `analyzeReport` action (in `creditReports.ts`) correctly uses `ctx.runQuery(internal.creditReports.getReport, ...)` for its own data access. The problem is that FastAPI was designed to also call Convex independently for its idempotency check and to load the report, but the Convex functions it targets are not accessible from outside Convex.

**Recommended fix (minimal change):** Change the Convex `analyzeReport` action to pass `parsedData` in the FastAPI request body (as JSON), removing the need for FastAPI to call Convex at all. FastAPI then only needs to run Claude and return items — it remains stateless as intended. The idempotency check can be removed from FastAPI entirely since the Convex action's `analysisStatus === "analyzed"` guard already handles it.

Everything else in Phase 3 is fully implemented and wired correctly. The disputes UI, data layer, FCRA validation, PII stripping, and status lifecycle are all verified. Only this single wiring gap prevents the AI pipeline from running end-to-end.

---

_Verified: 2026-04-04T08:06:45Z_
_Verifier: Claude (gsd-verifier)_
