# Phase 3: AI Analysis & Dispute Review - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Claude API analyzes parsed credit report data to identify legally disputable items under FCRA. Each item includes a specific FCRA section citation validated against a hardcoded library. PII is stripped before sending to Claude. User reviews flagged items grouped by bureau and approves or skips each one. Approved items enter a tracked lifecycle. Letter generation is Phase 4 — this phase only identifies and approves.

</domain>

<decisions>
## Implementation Decisions

### Claude API Integration
- **D-01:** Claude API called exclusively from FastAPI (never from frontend) — API key security
- **D-02:** Use Claude tool_use (structured output) to get typed dispute items — no free-text parsing
- **D-03:** AI model: `claude-sonnet-4-20250514` as specified in PROJECT.md
- **D-04:** System prompt instructs Claude to act as a credit report analyst, identify FCRA-disputable items, return structured JSON, use hedged language (never guarantee removal)
- **D-05:** Each returned item includes: creditor_name, account_number_last4, item_type, description, dispute_reason, fcra_section, confidence_score
- **D-06:** FastAPI endpoint: `POST /api/reports/{report_id}/analyze` — accepts report ID, fetches parsed data from Convex, calls Claude, returns dispute items

### PII Stripping
- **D-07:** Before sending parsed data to Claude, strip: all SSNs, full addresses, DOB from personal_info
- **D-08:** Account numbers already only last 4 digits (from Phase 2 parsers) — safe to send
- **D-09:** Only send accounts, negative_items, inquiries, and public_records — NOT personal_info
- **D-10:** Log what categories of data are sent (not the data itself) for audit purposes

### FCRA Citation Library
- **D-11:** Hardcoded Python dict/enum of valid FCRA sections with descriptions
- **D-12:** Valid sections: § 611 (right to dispute), § 623 (furnisher obligations), § 605 (obsolete info, 7-year rule), § 609 (right to disclosure), § 612 (free annual reports)
- **D-13:** After Claude returns items, validate every fcra_section against the library
- **D-14:** If Claude returns an invalid citation, map to closest valid section or flag with warning — never pass hallucinated citations to the UI
- **D-15:** Citation validation happens in FastAPI before returning to frontend

### Dispute Items Storage
- **D-16:** New `dispute_items` table in Convex with fields: reportId, userId, bureau, itemType, creditorName, accountNumberLast4, description, disputeReason, fcraSection, aiConfidence, status, createdAt
- **D-17:** Status lifecycle: pending_review → approved | skipped (letter_generated, sent, resolved, denied added in later phases)
- **D-18:** Convex mutation to update status (approve/skip) with optimistic update for responsive UI
- **D-19:** Convex query to list dispute items by report, by bureau, or all for user

### Dispute Review UI
- **D-20:** `/disputes` page showing all flagged items grouped by bureau
- **D-21:** Each item rendered as a card with: creditor name, item type, AI's dispute reason, FCRA section badge, confidence indicator
- **D-22:** Approve/Skip buttons on each card — approve changes status to "approved", skip to "skipped"
- **D-23:** "Generate Letters for Approved Items" CTA button at bottom (navigates to Phase 4 letters page)
- **D-24:** Filter by bureau tabs or dropdown
- **D-25:** After analyzing a report, automatically redirect to /disputes to review items

### Analysis Trigger
- **D-26:** Analysis triggered manually by user via "Analyze" button on the upload page (after parsing completes)
- **D-27:** Or via a Convex action that chains: parse complete → user clicks analyze → FastAPI AI call → results stored
- **D-28:** Analysis status tracked per report: not_analyzed → analyzing → analyzed | analysis_failed

### Claude's Discretion
- Exact system prompt wording and examples
- Tool_use schema design (tool name, parameter structure)
- How to handle reports with zero disputable items (empty state UI)
- Exact card layout and styling choices
- Whether to show AI confidence as percentage, stars, or color coding

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, FCRA regulatory basis, hedged language requirement, security constraints
- `.planning/REQUIREMENTS.md` — AI-01 through AI-05, DISP-01 through DISP-03 acceptance criteria
- `.planning/research/PITFALLS.md` — Pitfall 2 (AI hallucination of FCRA citations), Pitfall 3 (PII exposure to LLM APIs), Pitfall 4 (frivolous dispute triggering)

### Phase 2 Code (dependencies)
- `frontend/convex/schema.ts` — Existing schema to extend with dispute_items table
- `frontend/convex/creditReports.ts` — parseReport action pattern to follow for analyze action
- `backend/models/parsed_report.py` — ParsedReport, Tradeline, NegativeItem models (input to AI)
- `backend/routers/reports.py` — Existing reports router to add analyze endpoint to
- `backend/main.py` — FastAPI app structure

### Phase 1 Code (patterns)
- `frontend/app/(protected)/layout.tsx` — Nav layout to add /disputes link
- `frontend/middleware.ts` — Protected routes to add /disputes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/lib/api.ts` — typed `apiFetch<T>` for calling FastAPI analyze endpoint
- `frontend/convex/creditReports.ts` — Convex action pattern (calls FastAPI from server-side)
- `backend/models/parsed_report.py` — ParsedReport model (input to AI analyzer)
- `backend/routers/reports.py` — existing router to extend

### Established Patterns
- Convex actions for external API calls (parseReport pattern from Phase 2)
- FastAPI routers mounted in main.py
- Pydantic models for request/response shapes
- Protected routes via middleware + nav layout links

### Integration Points
- New `dispute_items` table in Convex schema
- New FastAPI endpoint `POST /api/reports/{report_id}/analyze`
- New Convex action to orchestrate: fetch parsed data → call FastAPI → store results
- New `/disputes` page in frontend
- Add /disputes to nav and middleware

</code_context>

<specifics>
## Specific Ideas

- Claude must never guarantee removal — always use hedged language like "may be disputable" or "potentially inaccurate"
- Each dispute item should clearly show WHY it's flagged (not just that it is)
- FCRA section should be displayed as a badge with the section number and a brief description on hover/click
- The analyze endpoint should be idempotent — re-analyzing shouldn't create duplicate dispute items

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-ai-analysis-dispute-review*
*Context gathered: 2026-04-03*
