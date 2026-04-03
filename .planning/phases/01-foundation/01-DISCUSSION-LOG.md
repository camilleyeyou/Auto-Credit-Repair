# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 01-foundation
**Areas discussed:** Project structure, Auth flow, Profile form, Deployment setup
**Mode:** Auto (all decisions auto-selected as recommended defaults)

---

## Project Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single repo (frontend/ + backend/) | Standard monorepo with clear separation | ✓ |
| Separate repos | Independent repos for frontend and backend | |
| Monorepo with turborepo | Shared tooling across packages | |

**User's choice:** [auto] Single repo with frontend/ and backend/ directories (recommended default)
**Notes:** Simplest setup for single developer; no need for monorepo tooling overhead.

---

## Auth Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Convex Auth (email/password) | Built-in auth, middleware protection | ✓ |
| NextAuth + Convex | External auth provider wrapping Convex | |
| Custom JWT | Roll your own auth tokens | |

**User's choice:** [auto] Convex Auth with email/password, protected routes via middleware (recommended default)
**Notes:** Convex Auth is native to the platform; simplest integration path.

---

## Profile Form

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (name + address) | Just what's needed for letter headers | ✓ |
| Extended (name + address + phone + DOB) | More PII fields for potential future use | |

**User's choice:** [auto] Full name, street address, city, state, ZIP (recommended default)
**Notes:** Minimum viable profile — only fields that appear on dispute letter headers.

---

## Deployment Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy in Phase 1 | Validates full stack end-to-end early | ✓ |
| Defer deployment | Focus on local dev, deploy later | |

**User's choice:** [auto] Deploy in Phase 1 (recommended default)
**Notes:** Early deployment catches integration issues between Vercel, Railway, and Convex cloud.

---

## Claude's Discretion

- Convex schema design (table names, field types)
- shadcn/ui component selection
- Middleware implementation details
- Loading states and error handling
- Navigation layout

## Deferred Ideas

None
