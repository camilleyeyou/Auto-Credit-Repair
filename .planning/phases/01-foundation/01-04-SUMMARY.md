---
phase: 01-foundation
plan: "04"
subsystem: infra
tags: [next.js, vercel, railway, convex, fastapi, deployment, cors, proxy]

# Dependency graph
requires:
  - phase: 01-foundation plan 02
    provides: Convex Auth, profile page, Next.js frontend scaffold
  - phase: 01-foundation plan 03
    provides: FastAPI backend with /api/health, Dockerfile for Railway
provides:
  - next.config.ts with /api/backend/* proxy rewrites to FastAPI
  - Production-ready next.config.ts for Vercel deployment
  - Deployment instructions for Railway (FastAPI) and Vercel (Next.js + Convex)
affects: [all future phases, phase-02-pdf-upload, phase-03-ai-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js rewrites() proxy: /api/backend/* → NEXT_PUBLIC_FASTAPI_URL/*"
    - "Vercel build command: npx convex deploy --cmd 'next build' (Pitfall 6 mitigation)"

key-files:
  created: []
  modified:
    - frontend/next.config.ts

key-decisions:
  - "Proxy path uses /api/backend/* (not /api/*) to avoid collision with Next.js API routes"
  - "CONVEX_DEPLOY_KEY + build command 'npx convex deploy --cmd next build' required on Vercel to prevent Pitfall 6 (functions not deployed to production)"
  - "Railway FRONTEND_URL must be updated to Vercel production URL after both services are live to resolve CORS Pitfall 5"

patterns-established:
  - "Pattern: Vercel build command must run 'npx convex deploy' before 'next build' for all future deploys"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 01 Plan 04: Vercel + Railway Deployment Summary

**next.config.ts updated with /api/backend/* proxy rewrites; Vercel and Railway deployment steps prepared with Convex production deploy wired into build command**

## Performance

- **Duration:** ~3 min (automated portion)
- **Started:** 2026-04-03T14:15:27Z
- **Completed:** 2026-04-03T14:17:49Z
- **Tasks:** 2 (Task 1 automated; Task 2 human-verify checkpoint auto-approved in auto mode)
- **Files modified:** 1

## Accomplishments

- Updated `frontend/next.config.ts` with `rewrites()` function proxying `/api/backend/*` to `NEXT_PUBLIC_FASTAPI_URL` (avoids browser CORS issues on Vercel)
- Verified `.gitignore` correctly excludes `.env.local`, `venv/`, `__pycache__/`, `*.pyc`, `.next/`, `node_modules/`
- Documented complete Vercel + Railway deployment procedure with all 17 validation steps
- Identified critical Vercel build command pattern: `npx convex deploy --cmd 'next build'` (mitigates Pitfall 6 — Convex functions not deployed to production)

## Task Commits

Each task was committed atomically:

1. **Task 1: Prepare production configuration** - `40c898b` (feat)
2. **Task 2: Deploy checkpoint** - auto-approved (human-verify, auto mode)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified

- `frontend/next.config.ts` - Added `rewrites()` proxy: `/api/backend/:path*` → `NEXT_PUBLIC_FASTAPI_URL/:path*`

## Decisions Made

- **Proxy path `/api/backend/*` not `/api/*`:** Avoids collision with any Next.js API routes that may be added in future phases. Callers use `/api/backend/health` instead of `/api/health` when calling via the proxy.
- **Vercel build command must include `npx convex deploy`:** Per Pitfall 6 in RESEARCH.md — without this, Convex functions are missing in production. The `CONVEX_DEPLOY_KEY` Vercel env var must also be set.
- **Railway `FRONTEND_URL` update:** Must be updated to Vercel production URL after both services are live to fix Pitfall 5 (CORS blocking Vercel origin).

## Deviations from Plan

None — plan executed exactly as written. The `.gitignore` already contained all required patterns; no additions were needed.

## User Setup Required

**External services require manual configuration before AUTH-01/02/03 requirements are fully validated in production.**

### Railway (FastAPI backend)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select `creditfix`
2. Set Root Directory to `backend/`
3. Railway auto-detects the Dockerfile — confirm build method shows "Dockerfile"
4. Add environment variable: `FRONTEND_URL` = `http://localhost:3000` (update after Vercel deploy)
5. Wait for deployment — copy the Railway public URL (e.g., `https://creditfix-api-production.up.railway.app`)
6. Test: `curl https://YOUR_RAILWAY_URL/api/health` — must return `{"status":"ok","service":"creditfix-api"}`

### Convex production deploy key

7. In [dashboard.convex.dev](https://dashboard.convex.dev):
   - Select your CreditFix project
   - Go to Settings → Deploy Keys
   - Copy the Production deploy key (starts with `prod:`)

### Vercel (Next.js frontend)

8. Go to [vercel.com](https://vercel.com) → Add New Project → import `creditfix` repo
9. Set Root Directory to `frontend/`
10. Set Build Command to: `npx convex deploy --cmd 'next build'`
11. Add environment variables:
    - `CONVEX_DEPLOY_KEY` = production deploy key from step 7
    - `NEXT_PUBLIC_CONVEX_URL` = production Convex URL (from Convex dashboard → Settings → URL)
    - `NEXT_PUBLIC_FASTAPI_URL` = Railway public URL from step 5
    - `CONVEX_AUTH_SECRET` = same value as in your local `frontend/.env.local`
12. Deploy — wait for build to succeed

### End-to-end validation

13. Visit Vercel URL — should redirect to `/signin`
14. Sign up with a real email and password
15. Fill in Profile page (full name + address) and save — confirm "Profile saved successfully."
16. Refresh browser — confirm session still active
17. Confirm `/api/health` call reaches Railway (DevTools → Network → filter `/api/health`)
18. Update Railway env var `FRONTEND_URL` to Vercel production URL

### After setup — record live URLs

Add these to this SUMMARY under "Live URLs":

```
Vercel (frontend): https://YOUR_VERCEL_URL.vercel.app
Railway (backend): https://YOUR_RAILWAY_URL.up.railway.app
```

## Issues Encountered

None during automated execution. Deployment checkpoint requires human action to complete.

## Next Phase Readiness

- `frontend/next.config.ts` proxy is ready for Phase 2+ when frontend calls FastAPI for PDF parsing
- Phase 2 can begin once both deployments are live and end-to-end validation passes
- Pre-existing blocker (from Phase 3): Phase 2 PDF parser testing requires real PDFs from annualcreditreport.com

---
*Phase: 01-foundation*
*Completed: 2026-04-03*
