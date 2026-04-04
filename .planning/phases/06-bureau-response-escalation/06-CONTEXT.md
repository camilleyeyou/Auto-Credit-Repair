# Phase 6: Bureau Response & Escalation - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

User can upload bureau response PDFs or manually enter outcomes for sent disputes. AI parses response PDFs to extract outcome (verified/deleted/corrected). System generates second demand letters for ignored disputes (30+ days) and escalation letters for denied disputes. CFPB complaint narrative generated from dispute history. CFPB complaint status tracked. Email reminders are Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Response Upload & Parsing
- **D-01:** Reuse existing Convex Storage upload pattern — user uploads response PDF via same drop zone UX
- **D-02:** New `bureau_responses` table in Convex: disputeItemId, userId, storageId, bureau, outcome, reasonCodes, responseDate, parsedAt, rawExtraction
- **D-03:** Convex action calls FastAPI `POST /api/responses/parse` with PDF bytes + dispute context
- **D-04:** FastAPI uses PyMuPDF to extract text, then Claude tool_use to classify outcome
- **D-05:** Claude tool_use schema returns: outcome (enum: verified/deleted/corrected), reasonCodes, responseDate, summary
- **D-06:** Low-confidence parses flagged for human review — don't auto-update dispute status on uncertain results

### Manual Outcome Entry
- **D-07:** User can manually select outcome (verified/deleted/corrected) from a dropdown without uploading PDF
- **D-08:** Manual entry also records optional notes/reason text
- **D-09:** Both manual and parsed outcomes update dispute_items status: deleted→resolved, corrected→resolved, verified→denied

### Second Demand Letter (No Response 30+ Days)
- **D-10:** When a dispute is overdue (30+ days, no response), show "Generate Demand Letter" button on tracker
- **D-11:** Reuse existing letter generation pipeline (FastAPI + Claude + WeasyPrint) with a new "demand" prompt
- **D-12:** Demand letter cites FCRA § 611 failure to respond within 30 days, references original dispute
- **D-13:** New letterType field on dispute_letters: "initial" | "demand" | "escalation"
- **D-14:** Demand letter stored in dispute_letters with letterType="demand"

### Escalation Letter (Bureau Verified/Denied)
- **D-15:** When outcome is "verified" (bureau denied dispute), show "Generate Escalation Letter" button
- **D-16:** Escalation letter cites FCRA § 623 (furnisher obligations) and references bureau's response
- **D-17:** Can also generate a Method of Verification (MOV) demand under FCRA § 611(a)(7) — separate letter type
- **D-18:** Escalation letters stored with letterType="escalation"

### CFPB Complaint
- **D-19:** "File CFPB Complaint" button appears for verified/denied disputes after escalation letter
- **D-20:** Claude generates a complaint narrative from: dispute history, original letter, bureau response, escalation letter
- **D-21:** Narrative displayed for user to copy-paste into cfpb.gov/complaint portal — NOT auto-submitted
- **D-22:** App links directly to consumerfinance.gov/complaint with pre-filled guidance
- **D-23:** New `cfpb_complaints` table in Convex: disputeItemId, userId, narrative, filedAt, portalStatus (draft/filed/response_received/closed), companyResponseDate, closedDate
- **D-24:** User updates CFPB status manually (filed, response received, closed)

### UI Integration
- **D-25:** New `/responses` section on tracker page — or integrate response upload into existing dispute detail view
- **D-26:** Escalation actions (demand letter, escalation letter, CFPB) shown contextually based on dispute status
- **D-27:** Add "Record Response" button to each sent dispute on /tracker
- **D-28:** CFPB complaint section with timeline tracking on dispute detail or /tracker

### Claude's Discretion
- Exact Claude prompts for response parsing, demand letters, escalation letters, CFPB narratives
- UI layout for response upload vs manual entry toggle
- Whether to show escalation options inline on tracker or on a separate page
- CFPB complaint narrative formatting

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — FCRA regulatory basis, dispute lifecycle, hedged language mandate
- `.planning/REQUIREMENTS.md` — RESP-01 through RESP-04, ESC-01 through ESC-04
- `.planning/research/PITFALLS.md` — Entity type branching, response misclassification, UPL risk, email timing
- `.planning/research/ARCHITECTURE.md` — Bureau response data flow, new tables, FastAPI endpoints
- `.planning/research/FEATURES.md` — Feature dependency chain, CFPB process notes

### Existing Code (reuse patterns)
- `frontend/convex/creditReports.ts` — parseReport/analyzeReport action patterns (reuse for response parsing)
- `frontend/convex/letters.ts` — generateLetters action pattern (reuse for demand/escalation letters)
- `frontend/convex/schema.ts` — Schema to extend with bureau_responses, cfpb_complaints tables
- `backend/services/ai_analyzer.py` — Claude tool_use pattern to follow for response parsing
- `backend/services/letter_writer.py` — Letter generation to extend with demand/escalation prompts
- `backend/routers/reports.py` — Router pattern for new /api/responses/ endpoints
- `frontend/app/(protected)/tracker/page.tsx` — Tracker page to add response/escalation actions
- `frontend/app/(protected)/letters/page.tsx` — Letters page pattern for new letter types

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Convex Storage upload pattern (generateUploadUrl → saveReport → action)
- Claude tool_use structured output (ai_analyzer.py)
- Letter generation pipeline (letter_writer.py + WeasyPrint)
- Bureau-specific PDF parsing (pdf_parser/)
- Dispute status mutation pattern (disputeItems.ts)

### Established Patterns
- Convex actions for FastAPI HTTP calls
- Pydantic models for request/response
- FastAPI stateless — Convex passes all context
- Nav + middleware updates for new pages

### Integration Points
- Extend dispute_items schema with escalationStatus field
- New bureau_responses + cfpb_complaints tables
- New FastAPI endpoints for response parsing + escalation letter generation
- Extend tracker page with response/escalation actions
- Extend letters page to show demand/escalation letter types

</code_context>

<specifics>
## Specific Ideas

- Response upload should feel as smooth as the initial report upload — same drop zone pattern
- Escalation actions should be contextually obvious — user shouldn't have to figure out "what do I do next?"
- CFPB narrative should read as a coherent story: "I disputed X on [date], bureau responded with Y on [date], I escalated with Z..."
- Process info only for CFPB — never say "you should file" or "this will result in"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-bureau-response-escalation*
*Context gathered: 2026-04-04*
