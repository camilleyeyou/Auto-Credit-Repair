# Phase 4: Letter Generation - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate professional, bureau-specific dispute letters for approved dispute items. Letters are pre-filled with user's personal info from profile, cite FCRA sections, reference specific accounts, include signature line and enclosure notes. Claude personalizes letter body per item. Letters download as print-ready PDFs via WeasyPrint. Tracking/sending is Phase 5 — this phase only generates and downloads.

</domain>

<decisions>
## Implementation Decisions

### Letter Template Design
- **D-01:** HTML/CSS template rendered by WeasyPrint to produce print-ready PDFs
- **D-02:** Letter format: standard business letter (date, sender address, bureau address, RE line, body, signature, enclosures)
- **D-03:** Bureau mailing addresses hardcoded: Experian (P.O. Box 4500, Allen, TX 75013), Equifax (P.O. Box 740256, Atlanta, GA 30374), TransUnion (P.O. Box 2000, Chester, PA 19016)
- **D-04:** User's name and address auto-populated from Convex profile (users table: fullName, streetAddress, city, state, zip)
- **D-05:** FCRA section cited in letter body with full section description
- **D-06:** Signature line: "Sincerely," followed by blank space for handwritten signature, then printed name
- **D-07:** Enclosure notes at bottom: "Enclosures: Copy of government-issued ID, Copy of relevant credit report page"
- **D-08:** Letter formatted for standard 8.5" x 11" paper with 1" margins

### PDF Generation Pipeline
- **D-09:** FastAPI endpoint `POST /api/letters/generate` — accepts dispute item data + user profile, returns generated letter content
- **D-10:** Claude called to personalize the letter body — item-specific language, not boilerplate
- **D-11:** WeasyPrint converts HTML letter to PDF on the FastAPI server
- **D-12:** Generated PDF stored in Convex Storage via upload URL
- **D-13:** `dispute_letters` table in Convex: disputeItemId, userId, bureau, letterContent (HTML), storageId (PDF), generatedAt
- **D-14:** Convex action orchestrates: fetch approved items + profile → call FastAPI → store results

### Claude Letter Personalization
- **D-15:** Claude receives: dispute item details (creditor, account last 4, dispute reason, FCRA section) + bureau name
- **D-16:** Claude generates the letter body paragraph only (not header/footer/address — those are templated)
- **D-17:** System prompt enforces: professional tone, firm but polite, cite specific FCRA section, reference specific account, request investigation and correction within 30 days, NEVER guarantee removal
- **D-18:** Each item produces unique letter text — two items must not have identical body paragraphs
- **D-19:** Claude model: claude-sonnet-4-20250514 (same as Phase 3)

### Letters Page UI
- **D-20:** `/letters` page showing generated letters grouped by bureau
- **D-21:** Each letter card shows: bureau, creditor name, FCRA section, generated date, download button
- **D-22:** "Preview" expands to show letter text inline (HTML rendered)
- **D-23:** "Download PDF" button triggers file download from Convex Storage
- **D-24:** "Generate Letters" button on /disputes page triggers batch generation for all approved items without existing letters
- **D-25:** After generation, redirect to /letters page

### Dispute Item Status Update
- **D-26:** When a letter is generated for a dispute item, update its status from "approved" to "letter_generated"
- **D-27:** Only generate letters for items with status "approved" — skip already-generated items

### Claude's Discretion
- Exact letter body wording and paragraph structure
- HTML/CSS styling details for the PDF template
- How to handle batch generation progress display
- Whether to show a letter preview before generating the PDF

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Bureau mailing addresses, letter requirements (FCRA citation, signature line, enclosures), hedged language mandate
- `.planning/REQUIREMENTS.md` — LTR-01 through LTR-06 acceptance criteria
- `.planning/research/STACK.md` — WeasyPrint recommendation for PDF generation
- `.planning/research/PITFALLS.md` — Pitfall 4 (frivolous dispute triggering — item-specific language)

### Phase 3 Code (dependencies)
- `frontend/convex/schema.ts` — Existing schema to extend with dispute_letters table
- `frontend/convex/disputeItems.ts` — Dispute item queries and status mutation
- `frontend/convex/creditReports.ts` — Action pattern to follow for letter generation
- `backend/services/ai_analyzer.py` — Claude API usage pattern to follow
- `backend/routers/reports.py` — Router pattern to follow

### Phase 1 Code (user profile)
- `frontend/convex/users.ts` — currentUser query (provides name/address for letters)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/convex/users.ts` — `currentUser` query returns fullName, streetAddress, city, state, zip
- `frontend/convex/disputeItems.ts` — `listByUser` query, `updateDisputeStatus` mutation
- `backend/services/ai_analyzer.py` — Claude API pattern (anthropic SDK, tool_use)
- `frontend/lib/api.ts` — typed `apiFetch<T>` for calling FastAPI

### Established Patterns
- Convex actions for external API calls (parseReport, analyzeReport patterns)
- FastAPI routers with Pydantic request/response models
- Convex Storage for file upload/download with signed URLs
- Nav + middleware updates for new pages (done in Phases 2, 3)

### Integration Points
- New `dispute_letters` table in Convex schema
- New FastAPI router `/api/letters/`
- New Convex action for letter generation
- New `/letters` page in frontend
- "Generate Letters" button on /disputes page
- Add /letters to nav and middleware

</code_context>

<specifics>
## Specific Ideas

- Letters should look professional when printed — proper business letter format, not a web page dump
- Each letter must feel individually crafted — if a bureau processor reads two letters from the same person, they shouldn't look copy-pasted
- Include a note about certified mail in the letter: "This letter is being sent via USPS Certified Mail"
- WeasyPrint requires system libraries (cairo, pango) — document any Docker/Railway setup needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-letter-generation*
*Context gathered: 2026-04-04*
