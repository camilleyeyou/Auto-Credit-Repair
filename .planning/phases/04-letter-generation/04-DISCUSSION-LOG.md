# Phase 4: Letter Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-04
**Phase:** 04-letter-generation
**Areas discussed:** Letter template design, PDF generation pipeline, Letters page UI, Claude letter personalization
**Mode:** Auto (all decisions auto-selected as recommended defaults)

---

## Letter Template Design

| Option | Description | Selected |
|--------|-------------|----------|
| HTML/CSS + WeasyPrint | Professional business letter template, WeasyPrint converts to PDF | ✓ |
| Plain text | Simple text file formatted for printing | |
| LaTeX | LaTeX template for high-quality typesetting | |

**User's choice:** [auto] HTML/CSS + WeasyPrint (recommended — per STACK.md research)

---

## PDF Generation Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| FastAPI generates, Convex stores | FastAPI renders PDF, uploads to Convex Storage | ✓ |
| Client-side PDF | Generate PDF in browser with jsPDF | |
| Convex action generates | TypeScript PDF library in Convex | |

**User's choice:** [auto] FastAPI generates + Convex stores (recommended — WeasyPrint is Python)

---

## Letters Page UI

| Option | Description | Selected |
|--------|-------------|----------|
| List with preview/download | Cards grouped by bureau, inline preview, download button | ✓ |
| Table view | Compact table with download links | |
| PDF viewer | Embedded PDF viewer per letter | |

**User's choice:** [auto] List with preview/download (recommended)

---

## Claude Letter Personalization

| Option | Description | Selected |
|--------|-------------|----------|
| Body paragraph only | Claude writes the dispute body, template handles header/footer | ✓ |
| Full letter | Claude writes entire letter including formatting | |
| Template with variables | No AI, just fill-in-the-blank | |

**User's choice:** [auto] Body paragraph only (recommended — consistent format, unique content)

## Claude's Discretion

- Exact letter wording, HTML/CSS styling, batch progress display

## Deferred Ideas

None
