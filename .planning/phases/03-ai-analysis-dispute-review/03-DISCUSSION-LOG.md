# Phase 3: AI Analysis & Dispute Review - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-03
**Phase:** 03-ai-analysis-dispute-review
**Areas discussed:** Claude API integration, FCRA citation library, Dispute review UI, Status lifecycle
**Mode:** Auto (all decisions auto-selected as recommended defaults)

---

## Claude API Integration

| Option | Description | Selected |
|--------|-------------|----------|
| tool_use structured output | Claude returns typed JSON via tool_use | ✓ |
| Free-text with regex parsing | Parse AI prose for dispute items | |
| Multi-turn conversation | Interactive back-and-forth with Claude | |

**User's choice:** [auto] tool_use structured output (recommended — reliable JSON, no parsing)

---

## FCRA Citation Library

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded validation | Dict of valid sections, post-validate Claude output | ✓ |
| Enum constraint in tool_use | Restrict Claude to valid values only | |
| No validation | Trust Claude's citations | |

**User's choice:** [auto] Hardcoded validation with fallback mapping (recommended — defense in depth)

---

## Dispute Review UI

| Option | Description | Selected |
|--------|-------------|----------|
| Card-based grouped by bureau | Cards with approve/skip per item, bureau tabs | ✓ |
| Table/list view | Compact table with checkboxes | |
| Kanban board | Drag items between status columns | |

**User's choice:** [auto] Card-based grouped by bureau (recommended)

---

## Status Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Simple approve/skip | pending_review → approved | skipped | ✓ |
| Multi-stage review | pending → reviewed → approved | rejected | |

**User's choice:** [auto] Simple approve/skip (recommended — expanded in later phases)

## Claude's Discretion

- System prompt wording, tool_use schema design
- Empty state UI, card layout, confidence display format

## Deferred Ideas

None
