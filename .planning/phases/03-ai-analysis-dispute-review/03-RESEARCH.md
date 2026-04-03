# Phase 3: AI Analysis & Dispute Review - Research

**Researched:** 2026-04-03
**Domain:** Claude API (tool_use), FCRA citation validation, PII stripping, Convex schema extension, dispute review UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Claude API Integration**
- D-01: Claude API called exclusively from FastAPI (never from frontend) — API key security
- D-02: Use Claude tool_use (structured output) to get typed dispute items — no free-text parsing
- D-03: AI model: `claude-sonnet-4-20250514`
- D-04: System prompt instructs Claude to act as a credit report analyst, identify FCRA-disputable items, return structured JSON, use hedged language (never guarantee removal)
- D-05: Each returned item includes: creditor_name, account_number_last4, item_type, description, dispute_reason, fcra_section, confidence_score
- D-06: FastAPI endpoint: `POST /api/reports/{report_id}/analyze` — accepts report ID, fetches parsed data from Convex, calls Claude, returns dispute items

**PII Stripping**
- D-07: Before sending parsed data to Claude, strip: all SSNs, full addresses, DOB from personal_info
- D-08: Account numbers already only last 4 digits (from Phase 2 parsers) — safe to send
- D-09: Only send accounts, negative_items, inquiries, and public_records — NOT personal_info
- D-10: Log what categories of data are sent (not the data itself) for audit purposes

**FCRA Citation Library**
- D-11: Hardcoded Python dict/enum of valid FCRA sections with descriptions
- D-12: Valid sections: § 611 (right to dispute), § 623 (furnisher obligations), § 605 (obsolete info, 7-year rule), § 609 (right to disclosure), § 612 (free annual reports)
- D-13: After Claude returns items, validate every fcra_section against the library
- D-14: If Claude returns an invalid citation, map to closest valid section or flag with warning — never pass hallucinated citations to the UI
- D-15: Citation validation happens in FastAPI before returning to frontend

**Dispute Items Storage**
- D-16: New `dispute_items` table in Convex with fields: reportId, userId, bureau, itemType, creditorName, accountNumberLast4, description, disputeReason, fcraSection, aiConfidence, status, createdAt
- D-17: Status lifecycle: pending_review → approved | skipped (letter_generated, sent, resolved, denied added in later phases)
- D-18: Convex mutation to update status (approve/skip) with optimistic update for responsive UI
- D-19: Convex query to list dispute items by report, by bureau, or all for user

**Dispute Review UI**
- D-20: `/disputes` page showing all flagged items grouped by bureau
- D-21: Each item rendered as a card with: creditor name, item type, AI's dispute reason, FCRA section badge, confidence indicator
- D-22: Approve/Skip buttons on each card — approve changes status to "approved", skip to "skipped"
- D-23: "Generate Letters for Approved Items" CTA button at bottom (navigates to Phase 4 letters page)
- D-24: Filter by bureau tabs or dropdown
- D-25: After analyzing a report, automatically redirect to /disputes to review items

**Analysis Trigger**
- D-26: Analysis triggered manually by user via "Analyze" button on the upload page (after parsing completes)
- D-27: Or via a Convex action that chains: parse complete → user clicks analyze → FastAPI AI call → results stored
- D-28: Analysis status tracked per report: not_analyzed → analyzing → analyzed | analysis_failed

### Claude's Discretion
- Exact system prompt wording and examples
- Tool_use schema design (tool name, parameter structure)
- How to handle reports with zero disputable items (empty state UI)
- Exact card layout and styling choices
- Whether to show AI confidence as percentage, stars, or color coding

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | Claude API analyzes parsed credit report data and identifies disputable items | D-02, D-06: tool_use endpoint pattern documented; Anthropic SDK 0.88.0 confirmed |
| AI-02 | Each flagged item includes dispute reason and relevant FCRA section citation | D-05: item schema with fcra_section field; D-11/D-12: hardcoded citation library |
| AI-03 | FCRA citations validated against a hardcoded library of real statute sections | D-13 through D-15: post-Claude validation pass before returning to frontend |
| AI-04 | PII stripped from data before sending to Claude API | D-07 through D-10: strip personal_info; accounts contain last4 only |
| AI-05 | AI generates item-specific dispute reasoning, not generic boilerplate | D-04: system prompt instructs item-specific language; Pitfall 4: frivolous dispute prevention |
| DISP-01 | User can view all AI-flagged items grouped by bureau | D-19/D-20: listByUser query + /disputes page with bureau grouping |
| DISP-02 | User can approve or skip each flagged item individually | D-18/D-22: Convex mutation + Approve/Skip buttons per card |
| DISP-03 | Dispute items track status lifecycle (pending_review → approved → letter_generated → sent → resolved/denied) | D-16/D-17: dispute_items table with status field; Phase 4 extends lifecycle |
</phase_requirements>

---

## Summary

Phase 3 has two distinct halves: a **backend AI pipeline** (FastAPI calls Claude with tool_use, validates FCRA citations, stores results in Convex) and a **frontend review UI** (reactive Convex queries, approve/skip mutations, bureau-filtered card list). All prior phase patterns apply directly — the parseReport action in creditReports.ts is the exact template for the new analyzeReport action.

The most critical implementation detail is the Claude tool_use pattern: use `tool_choice={"type": "any"}` combined with a single tool definition whose `input_schema` constrains `fcra_section` to an `enum` of valid values. This is the primary defense against hallucinated FCRA citations (Pitfall 2). The secondary defense is a post-call validation pass in FastAPI that rejects or remaps any citation not in the hardcoded library. PII stripping (Pitfall 3) is addressed by never passing `personal_info` to Claude — only `accounts`, `negative_items`, `inquiries`, and `public_records` from `ParsedReport`.

The Convex side requires schema extension (new `dispute_items` table + `analysisStatus` on `credit_reports`), a new action following the `parseReport` pattern, and standard query/mutation helpers. The frontend follows the same protected-route + reactive-query pattern established in Phase 2.

**Primary recommendation:** Build the tool_use schema first with a strict fcra_section enum, then implement the FastAPI endpoint, then the Convex orchestration action, then the UI — in that order, because each layer depends on the contract established by the layer below it.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| anthropic | 0.88.0 (latest; 0.86.0 installed) | Claude API client — tool_use calls | Official Anthropic Python SDK; required for structured output |
| FastAPI | 0.122.0 | Hosts analyze endpoint | Already in project; async-native |
| Pydantic v2 | 2.12.5 | Request/response validation | Already in project; models for DisputeItem, AnalyzeRequest |
| httpx | 0.28.1 | Convex REST calls from FastAPI (fetch parsedData) | Already in project; used in reports.py |
| Convex | latest (via npm) | dispute_items table, action, mutations, queries | Already in project |

### Requires Adding
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| anthropic | 0.88.0 | NOT in requirements.txt — must be added | `pip install anthropic==0.88.0` |

**Installation:**
```bash
# Backend — add to requirements.txt
pip install anthropic==0.88.0
```

**Version verification:** anthropic 0.88.0 confirmed as latest via `pip3 index versions anthropic` on 2026-04-03.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
backend/
├── routers/
│   └── reports.py          # ADD: POST /api/reports/{report_id}/analyze
├── services/
│   └── ai_analyzer.py      # NEW: Claude tool_use call + FCRA validation
├── models/
│   ├── parsed_report.py    # EXISTING: input to AI
│   └── dispute_item.py     # NEW: DisputeItem, AnalyzeResponse Pydantic models

frontend/convex/
├── schema.ts               # EXTEND: dispute_items table + analysisStatus on credit_reports
├── creditReports.ts        # EXTEND: add analysisStatus fields, analyzeReport action
└── disputeItems.ts         # NEW: CRUD for dispute_items table

frontend/app/(protected)/
├── disputes/
│   └── page.tsx            # NEW: /disputes review page
└── layout.tsx              # EXTEND: add Disputes nav link

frontend/middleware.ts       # EXTEND: add /disputes(.*) to protected routes
```

### Pattern 1: Claude tool_use for Structured Dispute Output
**What:** Force Claude to return dispute items via a single tool definition with `tool_choice={"type": "any"}`. The tool's `input_schema` uses an `enum` on `fcra_section` to constrain valid values at the prompt level.
**When to use:** Any time you need guaranteed structured JSON from Claude — never parse free text.

```python
# Source: Anthropic official docs (verified 2026-04-03)
import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

FCRA_SECTION_ENUM = ["611", "623", "605", "609", "612"]

ANALYZE_TOOL = {
    "name": "report_dispute_items",
    "description": (
        "Return all credit report items that may be disputable under the FCRA. "
        "Only flag items where there is a genuine legal basis for dispute. "
        "Use hedged language — never guarantee removal. "
        "Only use the provided fcra_section values; do not invent section numbers."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "dispute_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "creditor_name":        {"type": "string"},
                        "account_number_last4": {"type": "string"},
                        "item_type":            {
                            "type": "string",
                            "enum": ["late_payment", "collection", "charge_off",
                                     "bankruptcy", "inquiry", "public_record", "other"]
                        },
                        "description":          {"type": "string"},
                        "dispute_reason":       {"type": "string"},
                        "fcra_section":         {
                            "type": "string",
                            "enum": FCRA_SECTION_ENUM
                        },
                        "confidence_score":     {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["creditor_name", "item_type", "description",
                                 "dispute_reason", "fcra_section", "confidence_score"],
                }
            }
        },
        "required": ["dispute_items"],
    },
}

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    system="You are a credit report analyst...",
    tools=[ANALYZE_TOOL],
    tool_choice={"type": "any"},   # Force tool use — no free-text fallback
    messages=[{"role": "user", "content": report_payload}],
)

# Extract tool_use block
tool_block = next(b for b in response.content if b.type == "tool_use")
dispute_items = tool_block.input["dispute_items"]
```

### Pattern 2: FCRA Citation Validation (Post-Call)
**What:** After Claude returns items, validate every `fcra_section` against the hardcoded library. Map or flag invalid citations before returning to the frontend.
**When to use:** Every analyze call — never skip this step even if the enum already constrains Claude.

```python
# Source: project decision D-11 through D-15
FCRA_LIBRARY = {
    "611": {
        "title": "Right to Dispute",
        "usc": "15 U.S.C. § 1681i",
        "description": "Consumer's right to dispute inaccurate information; bureau must investigate within 30 days.",
    },
    "623": {
        "title": "Furnisher Obligations",
        "usc": "15 U.S.C. § 1681s-2",
        "description": "Furnishers must investigate and correct inaccurate information when notified.",
    },
    "605": {
        "title": "Obsolete Information",
        "usc": "15 U.S.C. § 1681c",
        "description": "Most negative items must be removed after 7 years from Date of First Delinquency.",
    },
    "609": {
        "title": "Right to Disclosure",
        "usc": "15 U.S.C. § 1681g",
        "description": "Consumer's right to request their full credit file.",
    },
    "612": {
        "title": "Free Annual Reports",
        "usc": "15 U.S.C. § 1681j",
        "description": "Consumer's right to one free annual credit report per bureau.",
    },
}

def validate_fcra_section(section: str) -> tuple[str, bool]:
    """Returns (validated_section, was_valid). Maps unknown sections to '611'."""
    if section in FCRA_LIBRARY:
        return section, True
    # Fallback: map to § 611 (general right to dispute) and flag
    return "611", False
```

### Pattern 3: Convex analyzeReport Action (follows parseReport)
**What:** Convex action that fetches report data via internal query, calls FastAPI analyze endpoint, stores results via internal mutations. Mirrors `parseReport` from creditReports.ts.
**When to use:** Analysis trigger — called from upload page "Analyze" button.

```typescript
// Source: follows frontend/convex/creditReports.ts pattern (Phase 2)
export const analyzeReport = action({
  args: { reportId: v.id("credit_reports") },
  handler: async (ctx, args) => {
    // 1. Get report — throws if not found
    const report = await ctx.runQuery(internal.creditReports.getReport, {
      reportId: args.reportId,
    });

    // 2. Guard: only analyze parsed reports
    if (report.parseStatus !== "done") {
      throw new Error("Report must be fully parsed before analysis");
    }

    // 3. Mark as analyzing
    await ctx.runMutation(internal.creditReports.setAnalysisStatus, {
      reportId: args.reportId,
      status: "analyzing",
    });

    // 4. Call FastAPI analyze endpoint
    try {
      const fastapiUrl = process.env.FASTAPI_URL;
      if (!fastapiUrl) throw new Error("FASTAPI_URL not set");

      const response = await fetch(`${fastapiUrl}/api/reports/${args.reportId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        await ctx.runMutation(internal.creditReports.setAnalysisStatus, {
          reportId: args.reportId,
          status: "analysis_failed",
          errorMessage: `FastAPI error ${response.status}: ${errorText}`,
        });
        return;
      }

      const result = await response.json();

      // 5. Store dispute items
      await ctx.runMutation(internal.disputeItems.saveDisputeItems, {
        reportId: args.reportId,
        userId: report.userId,
        bureau: report.bureau,
        items: result.dispute_items,
      });

      // 6. Mark analyzed
      await ctx.runMutation(internal.creditReports.setAnalysisStatus, {
        reportId: args.reportId,
        status: "analyzed",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown analysis error";
      await ctx.runMutation(internal.creditReports.setAnalysisStatus, {
        reportId: args.reportId,
        status: "analysis_failed",
        errorMessage,
      });
    }
  },
});
```

### Pattern 4: Convex Schema Extension
**What:** Add `dispute_items` table and `analysisStatus` field to `credit_reports`.
**When to use:** Wave 0 of this phase — schema must be deployed before any other code runs.

```typescript
// Source: follows frontend/convex/schema.ts pattern (Phase 2)
// In schema.ts — extend credit_reports and add dispute_items

credit_reports: defineTable({
  // ... existing fields ...
  analysisStatus: v.optional(v.union(
    v.literal("not_analyzed"),
    v.literal("analyzing"),
    v.literal("analyzed"),
    v.literal("analysis_failed"),
  )),
  analysisErrorMessage: v.optional(v.string()),
})
  .index("by_user", ["userId"])
  .index("by_user_bureau", ["userId", "bureau"]),

dispute_items: defineTable({
  reportId:            v.id("credit_reports"),
  userId:              v.string(),
  bureau:              v.union(
    v.literal("experian"),
    v.literal("equifax"),
    v.literal("transunion"),
  ),
  itemType:            v.string(),
  creditorName:        v.string(),
  accountNumberLast4:  v.optional(v.string()),
  description:         v.string(),
  disputeReason:       v.string(),
  fcraSection:         v.string(),
  fcraSectionTitle:    v.string(),   // Denormalized from FCRA_LIBRARY for UI display
  aiConfidence:        v.number(),
  status:              v.union(
    v.literal("pending_review"),
    v.literal("approved"),
    v.literal("skipped"),
    v.literal("letter_generated"),
    v.literal("sent"),
    v.literal("resolved"),
    v.literal("denied"),
  ),
  createdAt:           v.number(),
})
  .index("by_report", ["reportId"])
  .index("by_user",   ["userId"])
  .index("by_user_bureau", ["userId", "bureau"]),
```

### Pattern 5: Idempotent Analysis (D-28, Pitfall 12)
**What:** Before calling Claude, check if dispute_items already exist for the report. If they do, skip re-analysis unless the user explicitly re-triggers.
**When to use:** In the FastAPI endpoint and Convex action to prevent duplicate items and accidental Claude API cost.

```python
# Source: project decisions D-28, PITFALLS.md Pitfall 12
# In FastAPI analyze endpoint:
async def analyze_report(report_id: str, convex_client: ConvexClient) -> AnalyzeResponse:
    # Idempotency check — fetch existing items from Convex
    existing = await convex_client.query("disputeItems:listByReport", {"reportId": report_id})
    if existing and len(existing) > 0:
        # Already analyzed — return existing items without calling Claude
        return AnalyzeResponse(dispute_items=existing, reused=True)
    # ... proceed with Claude call
```

### Anti-Patterns to Avoid
- **Sending personal_info to Claude:** The `ParsedReport.personal_info` dict contains SSN, DOB, full address. Never include this field in the Claude prompt. Only send `accounts`, `negative_items`, `inquiries`, `public_records`. (PITFALLS.md Pitfall 3, D-09)
- **Free-text FCRA citation parsing:** Do not ask Claude to generate FCRA section numbers in a text field — always use an `enum` in the `input_schema` and `tool_choice={"type": "any"}`. (PITFALLS.md Pitfall 2, D-02)
- **Calling Claude from Convex action directly:** Convex actions run in Deno/V8 environment; the Anthropic Python SDK requires Python. Claude must be called from FastAPI only. (D-01)
- **Storing dispute items without validation:** Always run the FCRA citation validation pass in FastAPI before returning to the frontend. (D-13 through D-15)
- **Re-analyzing without idempotency guard:** Each Claude call costs ~$0.003–$0.015 for a typical credit report. A UI bug triggering re-analysis 10x in a row is a real cost risk. (PITFALLS.md Pitfall 12)
- **Skipping DOFD for 7-year check:** When flagging items under § 605, use `date_of_first_delinquency` from the ParsedReport — not `date_reported` or `date_opened`. If DOFD is None, flag with a warning rather than silently skipping. (PITFALLS.md Pitfall 8)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI output | JSON regex parser on Claude free text | Claude `tool_use` with `input_schema` + `tool_choice="any"` | Free text is unpredictable; tool_use guarantees schema conformance |
| FCRA citation constraint | String similarity matching on hallucinated citations | Enum in tool `input_schema` + post-call FCRA_LIBRARY lookup | Enum prevents hallucination at source; library validates what slips through |
| Convex HTTP calls from Python | Custom REST client | httpx (already in project) | Already used in reports.py for PDF download pattern |
| Convex real-time UI updates | Polling interval | `useQuery` reactive query | Convex auto-pushes updates; polling wastes bandwidth and adds latency |
| Optimistic UI for approve/skip | Manual state management | Convex `useMutation` with optimistic update | Built-in Convex pattern; instant UI feedback before server confirmation |

**Key insight:** The tool_use + enum pattern eliminates the entire class of FCRA citation hallucination bugs at the prompt level. The validation pass is a second defense, not the first.

---

## Common Pitfalls

### Pitfall 1: FCRA Citation Hallucination (CRITICAL)
**What goes wrong:** Claude invents section numbers like "§ 1681c(d)(3)" or "§ 607" that don't exist or don't apply. User mails a letter citing a fake statute; bureau dismisses it.
**Why it happens:** LLMs generate plausible-sounding legal citations. Without constraints, Claude is free to fabricate subsections.
**How to avoid:** (1) Use `fcra_section` as an `enum` in `input_schema` — Claude can only pick from `["611", "623", "605", "609", "612"]`. (2) Post-call: validate every returned section against `FCRA_LIBRARY` dict. (3) Never display unvalidated citations in the UI.
**Warning signs:** fcra_section values with decimals ("611.1"), parenthetical subsections ("605(a)(1)"), or numbers outside the five valid values.

### Pitfall 2: PII in Claude Prompt
**What goes wrong:** ParsedReport.personal_info contains full name, SSN, DOB, full address. If sent to Claude, this PII leaves the system perimeter.
**Why it happens:** Developer sends `report.model_dump()` directly instead of cherry-picking safe fields.
**How to avoid:** Explicitly construct the prompt payload from only `accounts`, `negative_items`, `inquiries`, `public_records`. Log the category names sent (not the data).
**Warning signs:** Claude response references user's name, city, or contains partial SSN-like strings.

### Pitfall 3: analysisStatus Stuck in "analyzing"
**What goes wrong:** FastAPI call throws before reaching the `setAnalysisStatus("analyzed")` mutation. Report stays "analyzing" forever. User cannot re-trigger.
**Why it happens:** Exception caught in Convex action outer catch, but FastAPI internal error bypasses status update.
**How to avoid:** Wrap the entire FastAPI call block in try/except in the Convex action. The outer catch MUST call `setAnalysisStatus("analysis_failed")` with an error message. (Same pattern as parseReport in creditReports.ts.)
**Warning signs:** Analysis button disabled; no error shown; report stuck at "analyzing" after page refresh.

### Pitfall 4: Duplicate Dispute Items on Re-analyze
**What goes wrong:** User clicks "Analyze" twice. Two sets of dispute items created for the same report. UI shows duplicates.
**Why it happens:** No idempotency check before Claude call.
**How to avoid:** In FastAPI endpoint: query Convex for existing dispute_items with matching reportId before calling Claude. If items exist, return them without re-calling. In Convex action: check `report.analysisStatus === "analyzed"` before proceeding.
**Warning signs:** Dispute count doubles on re-click; duplicate creditor entries in review UI.

### Pitfall 5: FASTAPI_URL Not Set in Convex Environment
**What goes wrong:** `process.env.FASTAPI_URL` is undefined in Convex action. Error thrown inside try/catch, sets `analysis_failed`.
**Why it happens:** Same as Phase 2 parse pipeline — Convex env vars set separately from app code.
**How to avoid:** Guard `FASTAPI_URL` at top of action (same pattern as parseReport). After deploy: `npx convex env set FASTAPI_URL <railway-url>`.
**Warning signs:** `analysis_failed` immediately after click; errorMessage says "FASTAPI_URL not set".

### Pitfall 6: DOFD vs. Charge-Off Date for § 605 Items
**What goes wrong:** AI flags item as obsolete under § 605 using the wrong date. A charge-off from 3 years ago may have a DOFD from 10 years ago, making it genuinely obsolete — or vice versa.
**Why it happens:** System prompt doesn't explicitly instruct Claude on DOFD vs. date_reported distinction.
**How to avoid:** System prompt must explicitly state: "For § 605 obsolete item disputes, calculate from `date_of_first_delinquency`. If that field is null, note it as unverifiable rather than assuming the item is current."
**Warning signs:** § 605 disputes on accounts with missing DOFD; date math using date_opened or date_reported.

---

## Code Examples

### FastAPI Analyze Endpoint (complete skeleton)
```python
# Source: follows backend/routers/reports.py pattern (Phase 2)
# File: backend/routers/reports.py (add to existing router)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx, os, logging

from services.ai_analyzer import analyze_parsed_report

logger = logging.getLogger(__name__)

class AnalyzeRequest(BaseModel):
    pass  # report_id comes from path param; parsedData fetched server-side

class DisputeItemOut(BaseModel):
    creditor_name: str
    account_number_last4: Optional[str] = None
    item_type: str
    description: str
    dispute_reason: str
    fcra_section: str
    fcra_section_title: str
    fcra_section_usc: str
    ai_confidence: float
    citation_validated: bool

class AnalyzeResponse(BaseModel):
    dispute_items: list[DisputeItemOut]
    reused: bool = False  # True if returning cached results

@router.post("/{report_id}/analyze")
async def analyze_report(report_id: str) -> dict:
    """
    Fetch parsedData for report_id from Convex, call Claude tool_use,
    validate FCRA citations, return dispute items.
    Idempotency: checks Convex for existing items before calling Claude.
    """
    # Fetch parsed data from Convex via internal HTTP (or pass it in the request body)
    # ... (see integration notes below)
    pass
```

### Convex disputeItems.ts (complete skeleton)
```typescript
// Source: follows frontend/convex/creditReports.ts pattern (Phase 2)
// File: frontend/convex/disputeItems.ts (new file)

import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal: save all dispute items for a report (called from analyzeReport action)
export const saveDisputeItems = internalMutation({
  args: {
    reportId:  v.id("credit_reports"),
    userId:    v.string(),
    bureau:    v.union(v.literal("experian"), v.literal("equifax"), v.literal("transunion")),
    items:     v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const item of args.items) {
      await ctx.db.insert("dispute_items", {
        reportId:           args.reportId,
        userId:             args.userId,
        bureau:             args.bureau,
        itemType:           item.item_type,
        creditorName:       item.creditor_name,
        accountNumberLast4: item.account_number_last4 ?? undefined,
        description:        item.description,
        disputeReason:      item.dispute_reason,
        fcraSection:        item.fcra_section,
        fcraSectionTitle:   item.fcra_section_title,
        aiConfidence:       item.ai_confidence,
        status:             "pending_review",
        createdAt:          now,
      });
    }
  },
});

// Public: list dispute items for current user (optionally by bureau)
export const listByUser = query({
  args: { bureau: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    let q = ctx.db.query("dispute_items").withIndex("by_user", (q) =>
      q.eq("userId", identity.subject)
    );
    const items = await q.collect();
    if (args.bureau) return items.filter((i) => i.bureau === args.bureau);
    return items;
  },
});

// Public mutation: update status of a single dispute item
export const updateStatus = mutation({
  args: {
    itemId: v.id("dispute_items"),
    status: v.union(v.literal("approved"), v.literal("skipped")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.patch(args.itemId, { status: args.status });
  },
});
```

### System Prompt (recommended)
```python
# Source: project decisions D-04, D-05; PITFALLS.md Pitfall 4 (frivolous disputes)
SYSTEM_PROMPT = """You are a credit report analyst helping a consumer identify items on their
credit report that may be legally disputable under the Fair Credit Reporting Act (FCRA).

Rules you MUST follow:
1. Only flag items with a genuine, specific legal basis — do not flag every negative item.
2. Use hedged language: "may be disputable", "potentially inaccurate", "worth investigating".
   Never say "will be removed" or "guaranteed to be deleted."
3. For § 605 obsolete items: calculate only from date_of_first_delinquency.
   If that field is null, note the item as unverifiable rather than flagging it as obsolete.
4. Generate a unique, specific dispute_reason for each item — reference the creditor name,
   account type, and the specific issue. Do not reuse boilerplate language.
5. Use only the FCRA section numbers provided in the tool schema — no other sections exist
   for consumer dispute purposes.
6. If no items are genuinely disputable, return an empty dispute_items array. Do not invent
   disputes to fill a report."""
```

### PII Stripping Helper
```python
# Source: D-07 through D-10
from models.parsed_report import ParsedReport
import json

def build_claude_payload(report: ParsedReport) -> str:
    """
    Strip PII and return JSON payload safe to send to Claude.
    Sends: accounts, negative_items, inquiries, public_records.
    Never sends: personal_info (SSN, DOB, address).
    """
    # Log categories sent (not the data) — D-10
    logger.info(
        "Sending to Claude: accounts=%d, negative_items=%d, inquiries=%d, public_records=%d",
        len(report.accounts), len(report.negative_items),
        len(report.inquiries), len(report.public_records),
    )
    safe_payload = {
        "bureau": report.bureau,
        "accounts": [a.model_dump() for a in report.accounts],
        "negative_items": [n.model_dump() for n in report.negative_items],
        "inquiries": report.inquiries,
        "public_records": report.public_records,
        # personal_info deliberately excluded — D-09
    }
    return json.dumps(safe_payload, indent=2)
```

---

## Integration Architecture: How FastAPI Gets ParsedData

**Problem:** The FastAPI `POST /api/reports/{report_id}/analyze` endpoint needs the `parsedData` JSON from the Convex `credit_reports` record. There are two valid approaches:

**Option A (recommended): Pass parsedData in the request body**
The Convex `analyzeReport` action already has the parsed report data (from `getReport` internal query). Pass it in the POST body to FastAPI. This avoids a second Convex API call from Python.

```typescript
// In Convex action:
const report = await ctx.runQuery(internal.creditReports.getReport, { reportId: args.reportId });
const response = await fetch(`${fastapiUrl}/api/reports/${args.reportId}/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    bureau: report.bureau,
    parsed_data: report.parsedData,  // pass the data directly
  }),
});
```

**Option B:** FastAPI calls Convex REST API with a service key to fetch report data.
- Requires `CONVEX_DEPLOY_KEY` as a FastAPI env var
- More complex setup; not recommended for this single-user tool

**Decision:** Use Option A. The Convex action has the data; pass it in the request body. This is simpler and avoids service key management.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse JSON from Claude free text | `tool_use` with `input_schema` + `tool_choice` | Anthropic SDK ~0.20 (2024) | Eliminates JSON parsing errors; guarantees schema conformance |
| `tool_choice="auto"` (may not use tool) | `tool_choice={"type": "any"}` (forces tool use) | Anthropic SDK ~0.20 | Guarantees structured output every call |
| anthropic SDK 0.86.0 (installed) | 0.88.0 (latest as of 2026-04-03) | 2026 | Minor updates; upgrade recommended before phase starts |

**Deprecated/outdated:**
- `tool_choice="any"` as a string: the SDK now expects `{"type": "any"}` as a dict — the string form may work but is undocumented.

---

## Open Questions

1. **How does FastAPI authenticate the Convex-originated analyze request?**
   - What we know: Phase 2 parse endpoint has no auth on FastAPI side (Convex action just POSTs to Railway URL)
   - What's unclear: If the Railway URL becomes public knowledge, anyone could trigger analysis without auth
   - Recommendation: For this single-user tool, the obscurity of the Railway URL + CORS configuration is sufficient. Add a shared secret header (e.g., `X-Internal-Secret`) as a low-effort improvement if desired, matching the pattern used by some Convex + FastAPI setups.

2. **Zero disputable items empty state**
   - What we know: Claude is instructed to return empty array if nothing is genuinely disputable
   - What's unclear: UX when zero items returned — should status remain "analyzed" or something else?
   - Recommendation: Status = "analyzed" regardless; UI shows an explicit "No disputable items found" empty state with encouragement to check back after uploading a newer report.

3. **Re-analysis after new PDF upload**
   - What we know: Idempotency guard prevents re-analysis for existing reports
   - What's unclear: When user uploads a new PDF for the same bureau, should old dispute_items be cleared?
   - Recommendation: Each `credit_reports` row gets its own `dispute_items`. Old items are not deleted. The listByUser query should scope to the latest report per bureau, or the UI should filter by selected reportId.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| anthropic Python SDK | AI analysis | ✗ (not in requirements.txt) | — | None — must install before phase starts |
| ANTHROPIC_API_KEY env var | Claude API calls | Unknown | — | None — must be set in Railway before deploy |
| FASTAPI_URL Convex env var | analyzeReport action | Set (Phase 2) | — | Guard throws; sets analysis_failed |
| Convex project (live) | All Convex operations | Set (Phase 1) | — | — |

**Missing dependencies with no fallback:**
- `anthropic==0.88.0` must be added to `backend/requirements.txt` before any AI code runs
- `ANTHROPIC_API_KEY` must be set in Railway environment before deploy

**Missing dependencies with fallback:**
- None identified

---

## Project Constraints (from CLAUDE.md)

All directives extracted from CLAUDE.md that the planner must verify compliance with:

| Directive | Source | Impact on This Phase |
|-----------|--------|---------------------|
| Tech stack: Next.js 15 + Convex + FastAPI | CLAUDE.md Constraints | Claude API calls only from FastAPI (D-01 already aligned) |
| AI model: claude-sonnet-4-20250514 | CLAUDE.md Constraints | D-03 already locked; use this exact model string |
| Never store full SSNs or complete account numbers | CLAUDE.md Constraints | PII stripping (D-07 through D-10) already addresses this |
| Single developer — no over-engineering | CLAUDE.md Constraints | Option A for data passing (simpler); no service key management |
| Use GSD workflow entry points for all file changes | CLAUDE.md GSD Workflow | No direct file edits outside gsd:execute-phase |
| CORS: FRONTEND_URL env var, Railway backend | CLAUDE.md Stack | No new CORS changes needed for this phase |

---

## Sources

### Primary (HIGH confidence)
- Anthropic official docs (tool_use define-tools, handle-tool-calls) — fetched 2026-04-03 via WebFetch
- `pip3 index versions anthropic` — confirmed 0.88.0 latest, 0.86.0 installed, 2026-04-03
- `frontend/convex/schema.ts` — existing schema read directly
- `frontend/convex/creditReports.ts` — action pattern read directly
- `backend/routers/reports.py` — existing router read directly
- `backend/models/parsed_report.py` — ParsedReport model read directly
- `.planning/phases/03-ai-analysis-dispute-review/03-CONTEXT.md` — locked decisions
- `.planning/research/PITFALLS.md` — FCRA hallucination and PII pitfalls
- `CLAUDE.md` — project constraints

### Secondary (MEDIUM confidence)
- Convex schema validator types (v.union, v.literal, defineTable) — verified via Convex official docs fetched 2026-04-03

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — anthropic SDK version confirmed via pip; all other libraries already in project
- Architecture patterns: HIGH — tool_use pattern from official docs; Convex patterns from existing Phase 2 code
- FCRA citation library: HIGH — valid sections documented in PITFALLS.md and CONTEXT.md D-12
- Pitfalls: HIGH — sourced from project's own PITFALLS.md plus verified Anthropic docs patterns

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (anthropic SDK versions move fast — re-verify if more than 30 days pass)
