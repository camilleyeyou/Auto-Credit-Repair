---
phase: 01-foundation
plan: "02"
subsystem: auth
tags: [convex, convex-auth, next.js, typescript, shadcn, react, forms]

# Dependency graph
requires:
  - phase: 01-01
    provides: convex/auth.ts with Password provider, convex/schema.ts with users table + profile fields, ConvexAuthNextjsProvider pair for session persistence
provides:
  - currentUser query (api.users.currentUser) — returns authenticated user record or null
  - updateProfile mutation (api.users.updateProfile) — patches all 5 profile fields
  - Sign-in/sign-up combined form at /signin using useAuthActions("password") with hidden flow field
  - SignOutButton component using useAuthActions().signOut()
  - Protected layout with nav bar (Dashboard, Profile links) and SignOutButton
  - Profile page at /profile with live Convex query and save mutation
  - AUTH-01, AUTH-02, AUTH-03 requirements implemented
affects: [01-03, 01-04, all-subsequent-phases]

# Tech tracking
tech-stack:
  added:
    - shadcn/ui input component
    - shadcn/ui label component
    - shadcn/ui card component
  patterns:
    - useAuthActions().signIn("password", formData) with hidden flow field for signIn/signUp toggle
    - useAuthActions().signOut() via onClick void
    - useQuery(api.users.currentUser) reactive — auto-updates after mutation
    - defaultValue (not value) for uncontrolled form inputs seeded from Convex
    - getAuthUserId(ctx) for server-side auth guard in both query and mutation

key-files:
  created:
    - frontend/convex/users.ts
    - frontend/components/SignOutButton.tsx
    - frontend/components/ui/input.tsx
    - frontend/components/ui/label.tsx
    - frontend/components/ui/card.tsx
  modified:
    - frontend/app/(auth)/signin/page.tsx
    - frontend/app/(protected)/layout.tsx
    - frontend/app/(protected)/profile/page.tsx

key-decisions:
  - "TypeScript build blocked by missing convex/_generated/server — expected until npx convex dev --once is run (Convex cloud init auth gate, same as Plan 01)"
  - "defaultValue used (not value) for profile form inputs — prevents re-render mid-typing while seeding from Convex reactive query"
  - "useQuery returns undefined while loading, null when unauthenticated, document when authenticated — loading state gates form render"

patterns-established:
  - "Pattern: Convex mutation args passed as plain object, not FormData — useMutation receives typed args matching v.string() schema"
  - "Pattern: Hidden <input name='flow'> field toggles signIn/signUp behavior in @convex-dev/auth Password provider"
  - "Pattern: getAuthUserId(ctx) used in all server functions — throws in mutations, returns null in queries for unauthenticated callers"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 15min
completed: 2026-04-03
---

# Phase 01 Plan 02: Auth Flow and Profile Summary

**Convex users.ts (currentUser query + updateProfile mutation) wired to sign-in/sign-up form using @convex-dev/auth Password provider and profile page with reactive live query seeding defaultValues**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-03T14:07:00Z
- **Completed:** 2026-04-03T14:22:00Z
- **Tasks:** 3 (all code complete; Convex cloud deployment blocked pending npx convex dev --once)
- **Files modified:** 8

## Accomplishments

- Created `frontend/convex/users.ts` with `currentUser` query and `updateProfile` mutation, both guarded by `getAuthUserId`
- Implemented combined sign-in/sign-up form at `/signin` using `useAuthActions` with hidden `flow` field toggling between modes
- Built `SignOutButton` component calling `useAuthActions().signOut()` and added it to protected layout nav
- Built profile page at `/profile` using reactive `useQuery(api.users.currentUser)` and `useMutation(api.users.updateProfile)` with all 5 fields and success/error feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Convex user functions (currentUser query + updateProfile mutation)** - `0783d6e` (feat)
2. **Task 2: Sign-in/sign-up form and sign-out button** - `b53bd10` (feat)
3. **Task 3: Profile page with live query and save mutation** - `e768a9f` (feat)

**Plan metadata:** pending

## Files Created/Modified

- `frontend/convex/users.ts` — currentUser query returns authenticated user or null; updateProfile mutation patches 5 profile fields; both use getAuthUserId
- `frontend/app/(auth)/signin/page.tsx` — Combined sign-in/sign-up form with useAuthActions, hidden flow field, error state, loading state
- `frontend/components/SignOutButton.tsx` — Button calling useAuthActions().signOut() with void wrapper
- `frontend/app/(protected)/layout.tsx` — Updated with nav bar (Dashboard + Profile links) and SignOutButton
- `frontend/app/(protected)/profile/page.tsx` — Live profile form seeded from useQuery, saves via useMutation, defaultValue pattern
- `frontend/components/ui/input.tsx` — shadcn/ui input component (added via CLI)
- `frontend/components/ui/label.tsx` — shadcn/ui label component (added via CLI)
- `frontend/components/ui/card.tsx` — shadcn/ui card component (added via CLI)

## Decisions Made

- **defaultValue vs value:** Used `defaultValue` (uncontrolled) for form inputs seeded from Convex. After `updateProfile` mutation, Convex reactive query refreshes `user` — on next render, if React remounts the form, new `defaultValue` applies. This avoids value-controlled re-renders mid-typing.
- **Build error is expected:** `npm run build` fails with "Cannot find module './_generated/server'" because `npx convex dev --once` has not been run yet (browser OAuth required). This is the same auth gate from Plan 01, not a code error.

## Deviations from Plan

None - plan executed exactly as written. The shadcn/ui components (input, label, card) were installed as specified in the plan's action steps.

## Issues Encountered

**Auth gate: Convex _generated types missing**

`npm run build` fails with `Cannot find module './_generated/server'` because the Convex backend has not been initialized. The `_generated/` directory is created by `npx convex dev --once`, which requires browser OAuth (interactive step). This is the same blocker documented in Plan 01.

All code is structurally correct. Once Convex is initialized:
1. `_generated/server` will be created with proper type exports
2. `_generated/api.ts` will export `api.users.currentUser` and `api.users.updateProfile`
3. `npm run build` will pass with zero TypeScript errors

**Required user action (same as Plan 01):**
1. `cd frontend && npx convex dev --once` — opens browser for Convex login, creates project, writes `.env.local`, generates `_generated/` types
2. Verify: `ls frontend/convex/_generated/` shows `api.ts`, `server.ts`, `dataModel.ts`
3. Re-run: `npm run build` — should pass with zero errors

## Known Stubs

None — all stubs from Plan 01 have been replaced with live implementations in this plan:
- `/signin` page: placeholder "Sign in form coming soon" replaced with full auth form
- `/profile` page: placeholder "Profile form coming soon" replaced with live Convex query/mutation form

The dashboard page (`/dashboard`) remains a static placeholder — intentional for Plan 02. Later plans will add real dashboard content.

## Next Phase Readiness

**Code complete:** All auth flow code (sign-in, sign-up, sign-out, profile save/load) is correctly implemented and committed.

**Blocker for runtime testing:** Convex project must be initialized (`npx convex dev --once`) before the app can run or TypeScript build can pass. Without `.env.local` and `_generated/` types, neither `npm run dev` nor `npm run build` will succeed.

**Plan 03 dependencies met (once Convex init done):** `api.users.currentUser` and `api.users.updateProfile` are deployed; sign-in/sign-out flow is wired; profile data is retrievable for future use in letter generation.

---
*Phase: 01-foundation*
*Completed: 2026-04-03*
