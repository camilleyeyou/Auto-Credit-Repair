---
phase: 01-foundation
plan: "01"
subsystem: auth
tags: [next.js, convex, convex-auth, tailwind, shadcn, typescript, middleware]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.2 App Router frontend scaffold with TypeScript and Tailwind v4
  - Convex auth infrastructure (convex/auth.ts, convex/schema.ts) with Password provider
  - Route protection middleware (middleware.ts) redirecting unauthenticated users to /signin
  - ConvexAuthNextjsServerProvider + ConvexAuthNextjsProvider pair for session persistence
  - Users table with authTables fields plus 5 profile fields (fullName, streetAddress, city, state, zip)
  - Protected route group shell at app/(protected) with client-side auth guard
  - Placeholder pages for dashboard, profile, and signin routes
  - shadcn/ui initialized with New York style defaults
affects: [01-02, 01-03, 01-04, all-subsequent-phases]

# Tech tracking
tech-stack:
  added:
    - next@16.2.2
    - convex@1.34.1
    - "@convex-dev/auth@0.0.91"
    - "@auth/core@0.37.0"
    - tailwindcss@4.2.2 (via create-next-app)
    - shadcn/ui CLI 4.x
  patterns:
    - ConvexAuthNextjsServerProvider wraps html in root layout (server component)
    - ConvexAuthNextjsProvider used inside ConvexClientProvider (NOT plain ConvexProvider)
    - convexAuthNextjsMiddleware with createRouteMatcher for route protection
    - authTables spread with custom profile fields extension in schema.ts
    - isAuthenticated explicitly exported from convex/auth.ts for middleware use

key-files:
  created:
    - frontend/convex/schema.ts
    - frontend/convex/auth.ts
    - frontend/convex/auth.config.ts
    - frontend/middleware.ts
    - frontend/app/layout.tsx
    - frontend/app/page.tsx
    - frontend/components/ConvexClientProvider.tsx
    - frontend/app/(auth)/signin/page.tsx
    - frontend/app/(protected)/layout.tsx
    - frontend/app/(protected)/dashboard/page.tsx
    - frontend/app/(protected)/profile/page.tsx
    - frontend/.env.local.example
    - frontend/package.json
    - .gitignore
  modified: []

key-decisions:
  - "@auth/core pinned to 0.37.0 (actual peer dep of @convex-dev/auth@0.0.91) not 0.34.3 as noted in research"
  - "Tailwind v4 used — no tailwind.config.ts file (v4 uses CSS-native config)"
  - "auth.config.ts created manually since npx @convex-dev/auth requires active Convex deployment"
  - "Convex project initialization requires human action (browser OAuth) — deferred to post-commit user setup"

patterns-established:
  - "Pattern: Use ConvexAuthNextjsProvider (not ConvexProvider) for session persistence across refresh"
  - "Pattern: Explicit isAuthenticated export from convex/auth.ts required by middleware"
  - "Pattern: authTables spread with all base fields preserved when extending users table"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 10min
completed: 2026-04-03
---

# Phase 01 Plan 01: Foundation Scaffold Summary

**Next.js 16.2.2 + Convex Auth infrastructure wired with Password provider, cookie-based session persistence via ConvexAuthNextjsProvider pair, and middleware route protection for /dashboard and /profile**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-03T13:54:05Z
- **Completed:** 2026-04-03T14:04:17Z
- **Tasks:** 3 (all code complete; Convex cloud init requires human action)
- **Files modified:** 31

## Accomplishments

- Scaffolded Next.js 16.2.2 monorepo with TypeScript, Tailwind v4, shadcn/ui
- Installed and wired all Convex auth dependencies at exact pinned versions
- Created complete Convex schema with authTables extension plus 5 profile fields
- Implemented route protection middleware redirecting /dashboard and /profile when unauthenticated
- Established correct provider pair (ConvexAuthNextjsServerProvider + ConvexAuthNextjsProvider) to prevent session loss on refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo and install frontend dependencies** - `5034b2d` (feat)
   - Tasks 2 and 3 files were created together in the same commit since all files are new

**Plan metadata:** pending

## Files Created/Modified

- `frontend/package.json` - next@16.2.2, convex@1.34.1, @convex-dev/auth@0.0.91, @auth/core@0.37.0
- `frontend/app/layout.tsx` - Root layout wrapping in ConvexAuthNextjsServerProvider + ConvexClientProvider
- `frontend/app/page.tsx` - Home page redirecting to /dashboard
- `frontend/components/ConvexClientProvider.tsx` - Client provider using ConvexAuthNextjsProvider (not ConvexProvider)
- `frontend/convex/schema.ts` - authTables spread with profile fields (fullName, streetAddress, city, state, zip)
- `frontend/convex/auth.ts` - convexAuth with Password provider, exports isAuthenticated
- `frontend/convex/auth.config.ts` - Auth config stub (populated after Convex init)
- `frontend/middleware.ts` - convexAuthNextjsMiddleware protecting /dashboard and /profile routes
- `frontend/app/(auth)/signin/page.tsx` - Placeholder sign-in page (form in Plan 02)
- `frontend/app/(protected)/layout.tsx` - Client-side auth guard using useConvexAuth
- `frontend/app/(protected)/dashboard/page.tsx` - Placeholder dashboard
- `frontend/app/(protected)/profile/page.tsx` - Placeholder profile page
- `frontend/.env.local.example` - Template with 4 required environment variable names
- `.gitignore` - Root gitignore for node_modules, .next, .env.local, etc.

## Decisions Made

- **@auth/core version:** Research noted 0.34.3 but actual peer dependency of @convex-dev/auth@0.0.91 is ^0.37.0. Installed 0.37.0 (Rule 1 deviation — correct peer dep).
- **Tailwind v4:** No tailwind.config.ts file — v4 uses CSS-native configuration via postcss.config.mjs.
- **auth.config.ts:** Created minimal stub manually since `npx @convex-dev/auth` requires an active Convex deployment to run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @auth/core version corrected from 0.34.3 to 0.37.0**
- **Found during:** Task 1 (dependency installation)
- **Issue:** Research.md said @auth/core@0.34.3 but `npm view @convex-dev/auth@0.0.91 peerDependencies` returned `^0.37.0`
- **Fix:** Installed @auth/core@0.37.0 to match actual peer dependency requirement
- **Files modified:** frontend/package.json, frontend/package-lock.json
- **Verification:** `npm install` completed with no peer dependency warnings
- **Committed in:** 5034b2d

---

**Total deviations:** 1 auto-fixed (1 bug/version correction)
**Impact on plan:** Version correction prevents runtime module resolution errors. No scope creep.

## Issues Encountered

**Authentication gate: Convex project initialization**

`npx convex dev --once` requires interactive browser OAuth (Convex login). This cannot be automated. All code is complete and correct; the app cannot start until `.env.local` is populated with `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`.

**Required user action:**
1. `cd frontend && npx convex dev --once` — opens browser for Convex login, creates project, writes `.env.local`
2. After `.env.local` exists: `npx @convex-dev/auth` — sets `CONVEX_AUTH_SECRET` in the deployment
3. Verify: `grep -c "CONVEX" frontend/.env.local` returns 3 or more

## Known Stubs

- `frontend/app/(auth)/signin/page.tsx` — Placeholder text "Sign in form coming soon." — intentional. Plan 02 will implement the actual sign-in form.
- `frontend/app/(protected)/dashboard/page.tsx` — Static "Welcome to CreditFix." — intentional. Subsequent plans will add real content.
- `frontend/app/(protected)/profile/page.tsx` — Static "Profile form coming soon." — intentional. Plan 02 will add the profile form.
- `frontend/convex/auth.config.ts` — Minimal stub `{ providers: [] }` — will be overwritten by `npx @convex-dev/auth` after Convex init.

These stubs are expected scaffolding for Plan 01. Plan 02 will implement the sign-in form and profile functionality.

## Next Phase Readiness

**Ready:** All code files for auth infrastructure are in place. TypeScript compiles with zero errors. Route protection middleware is configured correctly.

**Blocker for dev server:** Convex project must be initialized first (`npx convex dev --once`). Without `.env.local`, `npm run dev` will fail because `NEXT_PUBLIC_CONVEX_URL` is undefined.

**Plan 02 dependencies met:** ConvexAuthNextjsProvider pair, isAuthenticated export, authTables with profile fields — all in place.

---
*Phase: 01-foundation*
*Completed: 2026-04-03*
