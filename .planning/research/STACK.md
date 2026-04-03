# Stack Research: CreditFix

**Domain:** AI-powered credit repair / FCRA dispute automation
**Date:** 2026-04-03
**Confidence:** MEDIUM-HIGH (stack decisions pre-made by user; research validates and fills gaps)

## Recommended Stack

### Backend — FastAPI (Python 3.11+)

| Component | Library | Version | Rationale | Confidence |
|-----------|---------|---------|-----------|------------|
| Framework | FastAPI | 0.115+ | Async-native, Pydantic v2 integration, excellent for API-first apps | HIGH |
| Server | Uvicorn | 0.30+ | ASGI server, production-grade with gunicorn workers | HIGH |
| Validation | Pydantic | 2.x | Data modeling for credit report structures, API schemas | HIGH |
| PDF Parsing (primary) | PyMuPDF (fitz) | 1.24+ | Fast, reliable text extraction with positional data; handles multi-page well | HIGH |
| PDF Parsing (fallback) | pdfplumber | 0.11+ | Better table extraction; useful when PyMuPDF misses tabular data | HIGH |
| PDF Generation | WeasyPrint | 62+ | HTML/CSS to PDF; professional letter formatting with proper typography | HIGH |
| AI/LLM | anthropic | 0.39+ | Official Anthropic SDK; structured tool_use for reliable JSON output | HIGH |
| Database Client | supabase-py | 2.x | Official Supabase Python client; handles auth, storage, and queries | MEDIUM |
| Env Management | python-dotenv | 1.0+ | Standard .env file loading | HIGH |
| CORS | FastAPI built-in | — | CORSMiddleware for frontend communication | HIGH |

### Frontend — Next.js 15 (App Router)

| Component | Library | Version | Rationale | Confidence |
|-----------|---------|---------|-----------|------------|
| Framework | Next.js | 15.x | App Router, RSC, excellent DX; deployed to Vercel | HIGH |
| Language | TypeScript | 5.x | Strict mode; type safety for API response shapes | HIGH |
| Styling | Tailwind CSS | 3.x | Utility-first; fast UI development | HIGH |
| UI Components | shadcn/ui | latest | Copy-paste components built on Radix; no vendor lock-in | HIGH |
| Auth | @supabase/ssr | 0.5+ | Server-side Supabase auth for Next.js App Router | HIGH |
| File Upload | react-dropzone | 14+ | Mature drag-and-drop file upload with validation | HIGH |
| PDF Preview | react-pdf | 9+ | In-browser PDF preview for generated letters | MEDIUM |
| Charts/Timeline | recharts | 2.x | Lightweight charting for dashboard and timeline views | MEDIUM |
| Date Handling | date-fns | 3.x | Lightweight date manipulation for deadline calculations | HIGH |

### Infrastructure

| Component | Service | Rationale | Confidence |
|-----------|---------|-----------|------------|
| Database | Supabase (PostgreSQL) | All-in-one: DB + Auth + Storage + Edge Functions; generous free tier | HIGH |
| File Storage | Supabase Storage | PDF uploads stored with signed URLs; RLS for access control | HIGH |
| Auth | Supabase Auth | Email/password; single user; JWT-based | HIGH |
| Frontend Hosting | Vercel | Native Next.js support; zero-config deployment | HIGH |
| Backend Hosting | Railway | Python/Docker support; easy FastAPI deployment | HIGH |
| Email | Supabase Edge Functions + Resend | Deadline reminder emails at day 25; Resend for reliable delivery | MEDIUM |

## What NOT to Use

| Technology | Why Not |
|-----------|---------|
| LangChain / LlamaIndex | Overkill for single-model, single-prompt use case; adds unnecessary abstraction |
| SQLAlchemy | Supabase client handles queries; no need for ORM when using Supabase directly |
| Tesseract OCR | Credit report PDFs from annualcreditreport.com are text-based, not scanned images |
| Puppeteer/Playwright for PDF | WeasyPrint is simpler for letter PDF generation; no need for browser automation |
| Redis / task queues | Single user, low volume; async FastAPI routes handle everything without a queue |
| Clerk / Auth0 | Supabase Auth already included; no need for external auth provider |
| pgvector | No vector search needed; disputes are structured data, not semantic search |

## Key Stack Decisions

1. **WeasyPrint for letter PDFs** — Converts HTML/CSS templates to professional PDFs. Better than raw text for printable dispute letters. Allows proper formatting, headers, signature lines.

2. **Claude tool_use for structured output** — Use Anthropic's tool_use feature to get reliable JSON from AI analysis. Avoids parsing free-text responses. Critical for extracting dispute items with proper FCRA citations.

3. **Supabase RLS from day one** — Row-level security ensures all data is scoped to the authenticated user. Even though it's single-user now, RLS is the right security pattern for sensitive financial data.

4. **No task queue** — Single user, infrequent operations. PDF parsing and AI analysis can run in async FastAPI routes. If parsing takes 30+ seconds, use streaming responses or polling.

## Version Verification Notes

- Versions listed are approximate minimums based on 2025 knowledge
- Verify exact latest versions via `pip install --upgrade` and `npm install` at project start
- PyMuPDF may require system-level dependencies (mupdf) on some platforms
- WeasyPrint requires system libraries (cairo, pango, gdk-pixbuf) — document in setup instructions
