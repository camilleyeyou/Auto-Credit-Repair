---
phase: 04-letter-generation
verified: 2026-04-03T00:00:00Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "Dispute items updated to letter_generated status after generation are displayed correctly on the disputes page"
    status: partial
    reason: "The DisputeStatus TypeScript type in disputes/page.tsx is defined as only 'pending_review' | 'approved' | 'skipped' — it omits 'letter_generated'. After letters are generated, those items will show the 'Skipped' badge (the else-branch fallback at line 251) instead of a 'Letter Generated' badge. The status is correctly stored in the DB (setLetterGenerated mutation works); only the frontend display is wrong."
    artifacts:
      - path: "frontend/app/(protected)/disputes/page.tsx"
        issue: "Line 21: type DisputeStatus = 'pending_review' | 'approved' | 'skipped' — missing 'letter_generated' and 'sent' | 'resolved' | 'denied' values. Line 251: else-branch shows 'Skipped' for any non-pending_review, non-approved status."
    missing:
      - "Add 'letter_generated' (and any other downstream statuses) to the DisputeStatus type"
      - "Add a display branch or badge for items with status === 'letter_generated' (e.g., show a 'Letter Generated' badge)"
human_verification:
  - test: "Download a generated PDF and visually inspect it"
    expected: "PDF opens in a viewer, shows a standard business letter on 8.5x11 with 1-inch margins, serif font 12pt, correct bureau address, user's name/address in the sender block, FCRA section cited in the body, USPS Certified Mail line, Sincerely signature block with blank signature space and printed name, Enclosures line"
    why_human: "WeasyPrint rendering and PDF readability cannot be verified programmatically — requires opening the file in a viewer on real hardware"
  - test: "Generate letters for two different approved dispute items and compare body paragraphs"
    expected: "The body paragraphs are NOT identical — each reflects the specific account and dispute reason passed to Claude"
    why_human: "Requires a live Claude API call; uniqueness is a probabilistic claim that cannot be verified without executing the full pipeline"
---

# Phase 4: Letter Generation Verification Report

**Phase Goal:** User can download a print-ready, bureau-addressed dispute letter for every approved dispute item, pre-filled with their personal information
**Verified:** 2026-04-03
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | For each approved dispute item, a letter is generated addressed to the correct bureau mailing address | ✓ VERIFIED | `BUREAU_ADDRESSES` dict in `letter_writer.py` hardcodes Experian (P.O. Box 4500, Allen TX), Equifax (P.O. Box 740256, Atlanta GA), TransUnion (P.O. Box 2000, Chester PA); `render_letter_html()` inserts bureau address into the HTML template; address passed through `generateLetters` action to FastAPI correctly |
| 2 | Each letter is automatically filled with the user's name and mailing address from their profile | ✓ VERIFIED | `generateLetters` in `letters.ts` fetches user profile via `getUserProfile` internalQuery, guards against missing fields, and maps `fullName`/`streetAddress`/`city`/`state`/`zip` to FastAPI `LetterRequest`; `render_letter_html()` inserts all five fields into the sender block |
| 3 | Each letter cites the specific FCRA section, references the specific account, includes signature line with enclosure notes | ✓ VERIFIED | `render_letter_html()` includes: RE line with account last 4, body uses FCRA section passed from dispute item, `USPS Certified Mail` line, `Sincerely,` + signature space + `{full_name}`, `Enclosures: Copy of government-issued ID, Copy of relevant credit report page`; confirmed present in `letter_writer.py` lines 204–221 |
| 4 | The user can download a letter as a PDF that is formatted and readable when printed on standard paper | ? UNCERTAIN | Automated checks confirm: `@page { size: 8.5in 11in; margin: 1in; }` CSS rule in template, `html_to_pdf_bytes()` calls `HTML(string=...).write_pdf()` returning bytes, Dockerfile installs all required WeasyPrint system libraries (pango, cairo, gdk-pixbuf, harfbuzz, fonts-liberation) before pip install. PDF readability requires human inspection |
| 5 | Letter body language is personalized per dispute item — two different items do not produce identical text | ? UNCERTAIN | `generate_letter_body()` calls `claude-sonnet-4-20250514` with a system prompt that explicitly states "Make the language unique and specific to this account — not generic boilerplate" and includes creditor name, account last 4, and dispute reason in the user message. Verified correct model and prompt in `letter_writer.py` lines 61–100. Actual uniqueness requires live execution |

**Score:** 3/5 truths fully verified by code inspection; 2/5 require human verification; 1 gap found (display regression noted below as Warning — does not block the 5 success criteria above)

---

## Required Artifacts

### Plan 04-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/Dockerfile` | WeasyPrint system apt packages before COPY requirements.txt | ✓ VERIFIED | All 11 apt packages present (libpango-1.0-0, libpangoft2-1.0-0, libpangocairo-1.0-0, libharfbuzz0b, libharfbuzz-subset0, libffi-dev, libcairo2, libgdk-pixbuf2.0-0, libgobject-2.0-0, libjpeg-dev, libopenjp2-7-dev, fonts-liberation); block is before `COPY requirements.txt .` |
| `backend/requirements.txt` | weasyprint==68.1 entry | ✓ VERIFIED | Line 24: `weasyprint==68.1` |
| `backend/models/letter.py` | LetterRequest and LetterResponse Pydantic models | ✓ VERIFIED | Both models present with all required fields including user profile fields and FCRA fields |
| `backend/services/letter_writer.py` | `generate_letter_body()`, `render_letter_html()`, `html_to_pdf_bytes()` | ✓ VERIFIED | All three functions present, substantive, and wired; BUREAU_ADDRESSES dict present; `claude-sonnet-4-20250514` model used; `@page` CSS rule with `8.5in 11in`; `Sincerely,`; `Enclosures:`; `USPS Certified Mail`; `NEVER guarantee removal` safeguard |
| `backend/routers/letters.py` | POST /api/letters/generate and GET /api/letters/health | ✓ VERIFIED | Both endpoints implemented; health endpoint calls `HTML(string="<p>test</p>").write_pdf()` to smoke-test WeasyPrint; generate endpoint chains all three service functions |
| `backend/main.py` | letters router registered | ✓ VERIFIED | Lines 31-32: `from routers.letters import router as letters_router; app.include_router(letters_router)` |

### Plan 04-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/convex/schema.ts` | dispute_letters table with all indexes | ✓ VERIFIED | Table present with disputeItemId, userId, bureau (union literal), letterContent (string), storageId (_storage), generatedAt (number); all 3 indexes: by_user, by_dispute_item, by_user_bureau |
| `frontend/convex/letters.ts` | generateLetters, saveLetter, listByUser, getLetterDownloadUrl, getApprovedWithoutLetters | ✓ VERIFIED | All 5 functions present plus getUserProfile internalQuery; auth checks on all public functions; FASTAPI_URL guard; profile guard with exact error message; per-item try/catch; atob decode; ctx.storage.store; FCRA_USC map |
| `frontend/convex/disputeItems.ts` | setLetterGenerated internalMutation | ✓ VERIFIED | Lines 108-113: `setLetterGenerated` internalMutation patches status to "letter_generated" |

### Plan 04-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/app/(protected)/letters/page.tsx` | /letters page with bureau-grouped cards, download, preview | ✓ VERIFIED | "use client"; useQuery(api.letters.listByUser); bureau grouping; LetterCard child component with per-card useQuery(api.letters.getLetterDownloadUrl); dangerouslySetInnerHTML preview toggle; empty state with /disputes link; loading state; date-fns format() |
| `frontend/app/(protected)/disputes/page.tsx` | Generate Letters button | ✓ VERIFIED | useAction(api.letters.generateLetters); isGenerating state; approvedCount filtering; disabled when 0 approved; loading label; router.push("/letters") on success; error state display |
| `frontend/app/(protected)/layout.tsx` | Letters nav link | ✓ VERIFIED | Line 43: `<Link href="/letters" className="text-sm text-muted-foreground hover:text-foreground">Letters</Link>` — positioned after Disputes, before Profile |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/routers/letters.py` | `backend/services/letter_writer.py` | imports of `generate_letter_body`, `render_letter_html`, `html_to_pdf_bytes` | ✓ WIRED | All three functions imported and used in POST /generate handler |
| `backend/services/letter_writer.py` | Claude API (`claude-sonnet-4-20250514`) | `anthropic.Anthropic().messages.create()` | ✓ WIRED | Model string confirmed at line 95; client init at line 83 |
| `backend/services/letter_writer.py` | WeasyPrint | `HTML(string=html_string).write_pdf()` | ✓ WIRED | Line 250: lazy import + call in `html_to_pdf_bytes()` |
| `frontend/convex/letters.ts (generateLetters)` | FastAPI POST /api/letters/generate | `fetch(fastapiUrl + '/api/letters/generate', { method: 'POST' })` | ✓ WIRED | Lines 158-163; FASTAPI_URL guard present; Content-Type: application/json |
| `frontend/convex/letters.ts (generateLetters)` | Convex Storage | `ctx.storage.store(new Blob([pdfBytes], { type: 'application/pdf' }))` | ✓ WIRED | Lines 188-189 |
| `frontend/convex/letters.ts (generateLetters)` | `internal.letters.saveLetter` | `ctx.runMutation(internal.letters.saveLetter, { ... })` | ✓ WIRED | Lines 192-198 |
| `frontend/convex/letters.ts (generateLetters)` | `internal.disputeItems.setLetterGenerated` | `ctx.runMutation(internal.disputeItems.setLetterGenerated, { disputeId: item._id })` | ✓ WIRED | Lines 201-203 |
| `frontend/app/(protected)/letters/page.tsx` | `api.letters.listByUser` | `useQuery(api.letters.listByUser)` | ✓ WIRED | Line 117 |
| `frontend/app/(protected)/letters/page.tsx` | `api.letters.getLetterDownloadUrl` | `useQuery(api.letters.getLetterDownloadUrl, { letterId: letter._id })` | ✓ WIRED | Line 49 inside LetterCard |
| `frontend/app/(protected)/disputes/page.tsx` | `api.letters.generateLetters` | `useAction(api.letters.generateLetters)` | ✓ WIRED | Line 85; called at line 278 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `letters/page.tsx` | `letters` (DisputeLetter[]) | `useQuery(api.letters.listByUser)` → Convex `dispute_letters` table via `by_user` index | Yes — queries real DB table populated by `generateLetters` action | ✓ FLOWING |
| `letters/page.tsx` LetterCard | `downloadUrl` | `useQuery(api.letters.getLetterDownloadUrl)` → `ctx.storage.getUrl(letter.storageId)` | Yes — Convex Storage signed URL; null if storage object missing (handled gracefully in UI) | ✓ FLOWING |
| `disputes/page.tsx` | `approvedCount` | `typedItems.filter(i => i.status === "approved").length` from `useQuery(api.disputeItems.listByUser)` | Yes — real DB query | ✓ FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — cannot run FastAPI server or Convex locally without live ANTHROPIC_API_KEY and FASTAPI_URL environment; no static entry points to test. Checks performed by code inspection only.

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| LTR-01 | 04-01, 04-02, 04-03 | System generates dispute letters addressed to the correct bureau with proper mailing address | ✓ SATISFIED | `BUREAU_ADDRESSES` dict in `letter_writer.py`; bureau address inserted in `render_letter_html()`; Convex `generateLetters` passes item.bureau to FastAPI; all three bureau addresses verified present in code |
| LTR-02 | 04-01, 04-02, 04-03 | Letters auto-populate user's name and address from profile | ✓ SATISFIED | `getUserProfile` internalQuery fetches from Convex users table; profile guard throws descriptive error if any of 5 fields missing; all fields mapped to `LetterRequest` and inserted in sender block |
| LTR-03 | 04-01, 04-03 | Letters cite specific FCRA section and reference specific account/issue | ✓ SATISFIED | `fcra_section`, `fcra_section_title`, `fcra_section_usc` in LetterRequest; system prompt instructs Claude to cite them; RE line includes `account_number_last4`; `FCRA_USC` mapping converts section number to USC citation |
| LTR-04 | 04-01, 04-03 | Letters include signature line and enclosure notes (ID copy, report page) | ✓ SATISFIED | `render_letter_html()` includes `Sincerely,` + 3em signature space + `{full_name}` + `Enclosures: Copy of government-issued ID, Copy of relevant credit report page` |
| LTR-05 | 04-01, 04-02, 04-03 | Letters download as print-ready PDFs via WeasyPrint | ✓ SATISFIED (code path confirmed; print quality requires human) | `html_to_pdf_bytes()` calls `HTML(string=...).write_pdf()`; Dockerfile has all WeasyPrint system deps; Convex Storage stores PDF bytes; `getLetterDownloadUrl` returns signed URL; `<a href={url} download={filename}>` in UI |
| LTR-06 | 04-01, 04-03 | AI personalizes letter language per dispute item (unique wording, not templates) | ✓ SATISFIED (code path; uniqueness requires live execution) | System prompt rule 7: "Make the language unique and specific to this account — not generic boilerplate"; Claude called with creditor, account last 4, dispute reason, and FCRA basis; `NEVER guarantee removal` safeguard present |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/app/(protected)/disputes/page.tsx` | 21 | `type DisputeStatus = "pending_review" \| "approved" \| "skipped"` — omits `"letter_generated"` | ⚠️ Warning | After letters are generated, items with status `"letter_generated"` fall into the `else` branch (line 251) which renders a grey "Skipped" badge. The generate button logic (`approvedCount`) only counts `"approved"` items, so re-running generation correctly skips already-generated items — but the user has no visual indicator distinguishing "letter generated" from "skipped". Does not block download or letter quality, but is a UX gap. |
| `frontend/app/(protected)/disputes/page.tsx` | 251 | `{item.status === "approved" ? "Approved" : "Skipped"}` — binary else catches all non-approved, non-pending statuses | ⚠️ Warning | Same as above — `letter_generated`, `sent`, `resolved`, `denied` all display as "Skipped". |

---

## Human Verification Required

### 1. PDF Print Quality

**Test:** Generate a letter for at least one approved dispute item. Click "Download PDF" on the /letters page. Open the downloaded file in a PDF viewer (Preview, Acrobat, etc.).
**Expected:** Document displays as a formal business letter: date and user address in top-left, bureau address below, bold RE line, "Dear {Bureau} Dispute Center," salutation, 3-5 sentence body paragraph, "This letter is being sent via USPS Certified Mail." line, "Sincerely," followed by blank signature space and printed name, "Enclosures:" line. Layout should be readable on an 8.5x11 page with 1-inch margins.
**Why human:** PDF rendering quality and printability cannot be verified programmatically — requires a PDF viewer and human judgment on layout and readability.

### 2. Letter Body Uniqueness

**Test:** Approve two different dispute items (different creditors and/or dispute reasons). Click "Generate Letters". Download both PDFs and compare the body paragraphs.
**Expected:** The body paragraphs are NOT word-for-word identical. Each should reference the specific creditor name and dispute reason unique to that item.
**Why human:** Requires live Claude API call; uniqueness is non-deterministic and cannot be verified by static code inspection alone.

---

## Gaps Summary

**One functional gap** (Warning severity):

The `DisputeStatus` TypeScript type in `frontend/app/(protected)/disputes/page.tsx` (line 21) is defined as `"pending_review" | "approved" | "skipped"` — it excludes `"letter_generated"`. After the `generateLetters` action runs and patches dispute items to `status: "letter_generated"` in Convex, those items will display with a grey "Skipped" badge in the disputes page UI instead of a meaningful "Letter Generated" indicator. The status is correctly stored in the database and correctly prevents re-generation (via `getApprovedWithoutLetters` cross-query). Only the display label is wrong.

This does not block any of the 5 ROADMAP success criteria (the user can still download print-ready PDFs, letters are correctly addressed, auto-filled, FCRA-cited, and Claude-personalized). It is a UX regression that should be fixed but does not prevent the phase goal from being achieved.

**Two items require human verification:** PDF print quality (requires opening the file) and body uniqueness (requires live Claude API execution). Both code paths are fully wired.

---

_Verified: 2026-04-03_
_Verifier: Claude (gsd-verifier)_
