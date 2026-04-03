# Phase 2: PDF Upload & Parsing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 02-pdf-upload-parsing
**Areas discussed:** Upload UX, PDF storage flow, Parser architecture, Parsed data schema
**Mode:** Auto (all decisions auto-selected as recommended defaults)

---

## Upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| Three drop zones per bureau | Distinct upload area for each bureau | ✓ |
| Single upload with auto-detect | One drop zone, detect bureau from content | |
| Tabbed upload | Tab per bureau with shared drop area | |

**User's choice:** [auto] Three drop zones (recommended — matches PROJECT.md spec)

---

## PDF Storage Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Convex Storage → FastAPI via URL | Upload to Convex, FastAPI fetches for parsing | ✓ |
| Direct to FastAPI | Upload directly to FastAPI, store parsed result in Convex | |
| Convex Storage only | Parse in TypeScript (no Python) | |

**User's choice:** [auto] Upload to Convex Storage, FastAPI fetches via URL (recommended)

---

## Parser Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter pattern | One parser per bureau, common interface | ✓ |
| Single parser with conditionals | One parser with bureau-specific branches | |
| AI-driven parsing | Send raw text to Claude for structure extraction | |

**User's choice:** [auto] Adapter pattern with common interface (recommended)

---

## Parsed Data Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized sections | personal_info, accounts, negative_items, inquiries, public_records | ✓ |
| Flat list | All items in a single list with type tags | |
| Bureau-specific schemas | Different schema per bureau | |

**User's choice:** [auto] Normalized JSON with standard sections (recommended)

---

## Claude's Discretion

- Regex patterns for bureau-specific parsing
- PyMuPDF extraction strategy
- Error handling and retry logic
- UI component choices for upload
- Multi-page report handling

## Deferred Ideas

None
