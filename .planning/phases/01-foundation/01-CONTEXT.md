# Phase 1: Foundation - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffold with Next.js 15 frontend, FastAPI backend, and Convex for database/auth/storage. User can sign up, log in, persist sessions, and save personal information (name, address) via a profile page. Vercel + Railway deployments live. This phase delivers the infrastructure everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- **D-01:** Single git repo with `frontend/` and `backend/` top-level directories
- **D-02:** `frontend/` — Next.js 15 App Router with TypeScript, Tailwind CSS, shadcn/ui
- **D-03:** `backend/` — FastAPI with Python 3.11+, requirements.txt for dependencies
- **D-04:** Convex initialized inside `frontend/` (Next.js is the Convex client)

### Authentication
- **D-05:** Convex Auth with email/password provider — single user system
- **D-06:** Protected routes via Next.js middleware — redirect to login if unauthenticated
- **D-07:** Session persists across browser refresh via Convex Auth token management

### User Profile
- **D-08:** Profile/settings page accessible from main navigation
- **D-09:** Profile fields: full name, street address, city, state, ZIP code (minimum needed for dispute letter headers)
- **D-10:** Profile stored in Convex `users` or `profiles` table, linked to auth identity
- **D-11:** Profile data required before generating letters (Phase 4 dependency)

### Frontend-Backend Connection
- **D-12:** FastAPI serves on a separate port/domain; frontend calls it for PDF parsing and AI operations
- **D-13:** CORS configured to allow frontend origin
- **D-14:** FastAPI health check endpoint (`GET /api/health`) for deployment verification
- **D-15:** Frontend API client (`lib/api.ts`) with base URL from environment variable

### Deployment
- **D-16:** Deploy in Phase 1 to validate full stack works end-to-end
- **D-17:** Frontend → Vercel (zero-config Next.js deployment)
- **D-18:** Backend → Railway (Python/Docker)
- **D-19:** Environment variables configured in both platforms (Convex keys, API URLs)

### Claude's Discretion
- Exact Convex schema design (table names, field types)
- shadcn/ui component selection for auth and profile forms
- Exact middleware implementation for route protection
- Loading states and error handling patterns
- Navigation layout (sidebar vs top nav)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in:

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, tech stack decisions
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-03 acceptance criteria
- `.planning/research/STACK.md` — Validated stack recommendations (note: references Supabase but project uses Convex)
- `.planning/research/ARCHITECTURE.md` — System architecture, component boundaries, data flows
- `.planning/research/PITFALLS.md` — Domain pitfalls including PII handling and security patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None — this phase establishes the patterns

### Integration Points
- Convex client in Next.js connects to Convex cloud
- Frontend API client connects to FastAPI on Railway
- Convex Auth provides JWT for user identity

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. This is infrastructure that enables all subsequent phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-03*
