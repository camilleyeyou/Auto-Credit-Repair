<!-- GSD:project-start source:PROJECT.md -->
## Project

**CreditFix**

A private, personal AI-powered credit repair tool built for a single user (a friend in the US). It reads credit report PDFs, uses Claude AI to identify legally disputable items under the FCRA, generates bureau-specific dispute letters as downloadable PDFs, and tracks the 30-day dispute response window with email + dashboard reminders. The user always prints and mails letters herself via certified USPS mail — the system never sends anything on her behalf.

**Core Value:** Anyone can dispute inaccurate credit report items for free under FCRA — this tool automates knowing *what* to dispute and *how* to write the letters, replacing $50-150/month credit repair services.

### Constraints

- **Tech stack**: Next.js 15 (App Router) + Convex (DB, Auth, Storage, real-time) + FastAPI (PDF parsing, Claude API) — decided during initialization
- **AI model**: claude-sonnet-4-20250514 for analysis and letter generation
- **PDF parsing**: PyMuPDF (fitz) primary, pdfplumber fallback
- **Deployment**: Frontend → Vercel, Backend → Railway
- **Single developer**: Built and maintained by one person
- **Security**: Never store full SSNs or complete account numbers; only last 4 digits of account numbers
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
## Version Verification Notes
- Versions listed are approximate minimums based on 2025 knowledge
- Verify exact latest versions via `pip install --upgrade` and `npm install` at project start
- PyMuPDF may require system-level dependencies (mupdf) on some platforms
- WeasyPrint requires system libraries (cairo, pango, gdk-pixbuf) — document in setup instructions
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
