# Phase 1: Foundation - Research

**Researched:** 2026-04-03
**Domain:** Convex Auth (email/password) + Next.js 15 App Router + FastAPI scaffold + Vercel/Railway deployment
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project Structure**
- D-01: Single git repo with `frontend/` and `backend/` top-level directories
- D-02: `frontend/` — Next.js 15 App Router with TypeScript, Tailwind CSS, shadcn/ui
- D-03: `backend/` — FastAPI with Python 3.11+, requirements.txt for dependencies
- D-04: Convex initialized inside `frontend/` (Next.js is the Convex client)

**Authentication**
- D-05: Convex Auth with email/password provider — single user system
- D-06: Protected routes via Next.js middleware — redirect to login if unauthenticated
- D-07: Session persists across browser refresh via Convex Auth token management

**User Profile**
- D-08: Profile/settings page accessible from main navigation
- D-09: Profile fields: full name, street address, city, state, ZIP code
- D-10: Profile stored in Convex `users` or `profiles` table, linked to auth identity
- D-11: Profile data required before generating letters (Phase 4 dependency)

**Frontend-Backend Connection**
- D-12: FastAPI serves on a separate port/domain; frontend calls it for PDF parsing and AI operations
- D-13: CORS configured to allow frontend origin
- D-14: FastAPI health check endpoint (`GET /api/health`) for deployment verification
- D-15: Frontend API client (`lib/api.ts`) with base URL from environment variable

**Deployment**
- D-16: Deploy in Phase 1 to validate full stack works end-to-end
- D-17: Frontend → Vercel (zero-config Next.js deployment)
- D-18: Backend → Railway (Python/Docker)
- D-19: Environment variables configured in both platforms (Convex keys, API URLs)

### Claude's Discretion
- Exact Convex schema design (table names, field types)
- shadcn/ui component selection for auth and profile forms
- Exact middleware implementation for route protection
- Loading states and error handling patterns
- Navigation layout (sidebar vs top nav)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up and log in with email and password via Convex Auth | Convex Auth Password provider — `signIn("password", formData)` with `flow: "signUp"/"signIn"`. `convex/auth.ts` exports signIn/signOut. |
| AUTH-02 | User session persists across browser refresh | Convex Auth stores refresh token + access token. With `@convex-dev/auth/nextjs`, server-only HTTP cookies hold session state — survives refresh without re-login. |
| AUTH-03 | User can create and edit a profile with full name and mailing address | Custom fields added directly to `users` table in `convex/schema.ts` (spread `authTables`, extend with optional profile fields). Mutation reads `getAuthUserId`, patches record. |
</phase_requirements>

---

## Summary

Phase 1 establishes the full technical foundation: monorepo scaffold, Convex Auth email/password, profile storage, a minimal FastAPI stub, and live Vercel + Railway deployments.

Convex Auth (`@convex-dev/auth` v0.0.91) is the correct choice. It runs entirely inside the Convex backend — no external auth service needed. The Password provider supports sign-up/sign-in via a `flow` field in FormData, with no custom mutations required for the auth itself. Session persistence across browser refresh is handled automatically: with `@convex-dev/auth/nextjs`, tokens are stored in server-only cookies, so the auth state is available to Next.js server components on initial page load and survives refresh.

Profile data (full name, address) belongs in the `users` table defined by `authTables`. Convex Auth allows extending this table with optional fields — no separate `profiles` table needed. A single Convex mutation reads `getAuthUserId(ctx)`, then patches the user record with profile fields. The profile page uses `useQuery` (reactive, client component) to display saved values.

**Primary recommendation:** Use the official Convex Auth template (`get-convex/template-nextjs-convexauth-shadcn`) as the starting scaffold. It ships with Next.js 15, Convex Auth, shadcn/ui, and middleware pre-wired — eliminates most boilerplate for this phase.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.2 | Frontend framework (App Router) | Project constraint; zero-config on Vercel |
| convex | 1.34.1 | Database, real-time, functions | Project constraint; replaces Supabase |
| @convex-dev/auth | 0.0.91 | Auth library running on Convex backend | Native Convex auth; email/password support |
| @auth/core | 0.34.3 | Peer dep required by @convex-dev/auth | Must pin to this version — convex-auth depends on it |
| tailwindcss | 4.2.2 | Utility CSS | Project constraint |
| shadcn/ui | 4.1.2 (CLI) | Component library | Project constraint; Radix-based, copy-paste |
| typescript | 5.x | Language | Project constraint |
| fastapi | 0.122.0 | Python API framework | Project constraint; PDF/AI backend |
| uvicorn | 0.38.0 | ASGI server | Standard FastAPI server |
| python-dotenv | 1.0+ | Env management | Standard for FastAPI local dev |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @convex-dev/auth/nextjs | (bundled) | Server-side cookie auth for Next.js | Required for session persistence across refresh |
| convex/nextjs | (bundled in convex) | preloadQuery for SSR | Use in server components needing preloaded data |
| date-fns | 3.x | Date utilities | Deferred to later phases; not needed in Phase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @convex-dev/auth | Better Auth + Convex adapter | Better Auth is more mature outside Convex ecosystem but adds complexity; convex-auth is native |
| @convex-dev/auth | Clerk + Convex | Clerk is more stable/polished for Next.js but is an external service; unnecessary for single-user |
| shadcn/ui forms | react-hook-form + zod | shadcn Form component already wraps react-hook-form; can add zod validation layer as needed |

**Installation (frontend):**
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
npm install convex @convex-dev/auth @auth/core@0.34.3
npx @convex-dev/auth
npx shadcn@latest init
```

**Installation (backend):**
```bash
cd backend
python3 -m venv venv
pip install fastapi uvicorn python-dotenv
pip freeze > requirements.txt
```

**Version verification:** Confirmed via `npm view` on 2026-04-03.

---

## Architecture Patterns

### Recommended Project Structure

```
/                               # monorepo root
├── frontend/                   # Next.js 15 App Router
│   ├── app/
│   │   ├── layout.tsx          # ConvexAuthNextjsServerProvider wrapper
│   │   ├── page.tsx            # Home / redirect logic
│   │   ├── (auth)/
│   │   │   ├── signin/
│   │   │   │   └── page.tsx    # Sign-in + sign-up form
│   │   ├── (protected)/        # Route group requiring auth
│   │   │   ├── layout.tsx      # Nav layout (sidebar or top nav)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx    # Home screen post-login
│   │   │   └── profile/
│   │   │       └── page.tsx    # Profile edit page
│   ├── components/
│   │   └── ConvexClientProvider.tsx  # "use client" — ConvexAuthNextjsProvider
│   ├── lib/
│   │   └── api.ts              # FastAPI base URL client
│   ├── convex/
│   │   ├── schema.ts           # authTables + users extension
│   │   ├── auth.ts             # convexAuth({ providers: [Password] })
│   │   ├── users.ts            # currentUser query, updateProfile mutation
│   │   └── _generated/         # auto-generated by convex dev
│   ├── middleware.ts            # convexAuthNextjsMiddleware
│   └── .env.local              # CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL
├── backend/                    # FastAPI (Python 3.11+)
│   ├── main.py                 # FastAPI app, CORS, /api/health
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
└── .gitignore
```

### Pattern 1: Convex Auth Schema with Profile Fields

Extend `authTables` users table with optional profile fields directly in `convex/schema.ts`:

```typescript
// Source: https://labs.convex.dev/auth/setup/schema
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    // Fields expected by authTables (keep these)
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Profile fields for dispute letters
    fullName: v.optional(v.string()),
    streetAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
  }).index("email", ["email"]),
});
```

**Critical:** Keep all `authTables` fields present when extending — omitting any will cause auth to break. Use `v.optional()` for profile fields so they don't block sign-up.

### Pattern 2: Convex Auth Setup (convex/auth.ts)

```typescript
// Source: https://labs.convex.dev/auth/config/passwords
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
```

### Pattern 3: Sign-In / Sign-Up Form

```typescript
// Source: https://labs.convex.dev/auth/config/passwords
"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signIn" | "signUp">("signIn");

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      void signIn("password", new FormData(e.currentTarget));
    }}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <input name="flow" type="hidden" value={step} />
      <button type="submit">{step === "signIn" ? "Sign In" : "Sign Up"}</button>
      <button type="button" onClick={() =>
        setStep(s => s === "signIn" ? "signUp" : "signIn")
      }>
        {step === "signIn" ? "Need an account?" : "Already have one?"}
      </button>
    </form>
  );
}
```

### Pattern 4: Next.js Middleware (route protection)

```typescript
// Source: https://labs.convex.dev/auth/authz/nextjs
// frontend/middleware.ts
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/profile(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### Pattern 5: Root Layout with Server Provider

```typescript
// Source: https://labs.convex.dev/auth/authz/nextjs
// frontend/app/layout.tsx (server component)
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
```

```typescript
// frontend/components/ConvexClientProvider.tsx
"use client";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
```

**Critical:** Use `ConvexAuthNextjsProvider` (NOT plain `ConvexProvider`) inside `ConvexClientProvider` when using `@convex-dev/auth/nextjs`. The server wrapper `ConvexAuthNextjsServerProvider` handles cookie-based SSR token access.

### Pattern 6: Profile Query and Mutation

```typescript
// Source: https://docs.convex.dev/auth/functions-auth + @convex-dev/auth docs
// frontend/convex/users.ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.string(),
    streetAddress: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, args);
  },
});
```

### Pattern 7: FastAPI Minimal Scaffold

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="CreditFix API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "creditfix-api"}
```

### Pattern 8: FastAPI Dockerfile for Railway

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Railway will auto-detect the Dockerfile. Set `PORT=8000` in Railway env vars or use Railway's `$PORT` variable.

### Pattern 9: Frontend API Client

```typescript
// frontend/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000";

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}
```

### Anti-Patterns to Avoid

- **Using plain `ConvexProvider` instead of `ConvexAuthNextjsProvider`:** Sessions will not persist across browser refresh in Next.js App Router mode. The Next.js-specific provider manages cookie-based token storage.
- **Checking auth only in middleware:** Middleware is a UX layer, not a security layer. Always guard Convex queries/mutations with `getAuthUserId(ctx)` and throw if null.
- **Calling `signOut` without clearing client state:** Use `useAuthActions().signOut()` — it handles both the Convex session invalidation and client-side cleanup.
- **Storing full profile fields outside the `users` table:** Introducing a separate `profiles` table adds unnecessary joins for Phase 4 letter generation. Extend `users` directly.
- **Using `CONVEX_DEPLOYMENT` vs `NEXT_PUBLIC_CONVEX_URL`:** `CONVEX_DEPLOYMENT` is server-only (Convex CLI). `NEXT_PUBLIC_CONVEX_URL` is the client-side URL. Both are needed; `npx convex dev` writes both to `.env.local`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email/password auth | Custom JWT + bcrypt + session store | `@convex-dev/auth` Password provider | Refresh token rotation, secure cookie storage, session invalidation all handled |
| Session persistence across refresh | localStorage token manager | `@convex-dev/auth/nextjs` cookie provider | HTTP-only cookies, CSRF protection, SSR support |
| Route protection middleware | Custom token-checking middleware | `convexAuthNextjsMiddleware` + `convexAuth.isAuthenticated()` | Integrates with Convex token refresh cycle |
| Form components | Custom styled inputs | shadcn/ui Form, Input, Button, Label | Accessible, Radix-based, copy-paste into codebase |
| API client | axios + interceptors | Simple `fetch` wrapper in `lib/api.ts` | Single backend, single user — no need for request interceptor complexity |

**Key insight:** Convex Auth is purpose-built for the Convex backend. Custom auth implementations will fight the platform's session model. Use the native library.

---

## Common Pitfalls

### Pitfall 1: `isAuthenticated()` Always Returns False in Middleware

**What goes wrong:** After setting up `convexAuthNextjsMiddleware`, `convexAuth.isAuthenticated()` always returns `false`, causing authenticated users to be redirected to sign-in on every navigation.

**Why it happens:** If `convex/auth.ts` does not export the `isAuthenticated` endpoint (it was added in a later version of `@convex-dev/auth`), the middleware cannot verify session status. Previously it returned `false` silently; newer versions throw an error.

**How to avoid:** Ensure `convexAuth({ providers: [...] })` is spread properly — the `{ auth, signIn, signOut, store, isAuthenticated }` destructuring must include `isAuthenticated` and it must be exported from `convex/auth.ts` as a Convex function.

**Warning signs:** Middleware logs "No tokens to refresh, returning undefined"; users bounce between `/signin` and the protected page.

### Pitfall 2: Wrong Provider in ConvexClientProvider

**What goes wrong:** Using `ConvexProvider` from `convex/react` instead of `ConvexAuthNextjsProvider` from `@convex-dev/auth/nextjs`. Authentication state works in-session but is lost on browser refresh.

**Why it happens:** The standard Convex docs show `ConvexProvider`. The auth-specific Next.js provider is documented separately in the Convex Auth docs.

**How to avoid:** Use `ConvexAuthNextjsProvider` (client component) + `ConvexAuthNextjsServerProvider` (root server layout) together. Both are required.

**Warning signs:** User signs in, refreshes, is shown as unauthenticated. `useConvexAuth().isAuthenticated` is `false` after refresh.

### Pitfall 3: Overwriting authTables Fields in Schema

**What goes wrong:** When extending the `users` table definition for profile fields, the base `authTables` fields (like `email`, `emailVerificationTime`, `isAnonymous`) are accidentally omitted. Convex Auth throws cryptic errors during sign-up or sign-in.

**Why it happens:** Extending a table requires copying all existing fields from the `authTables` source, not just adding new ones.

**How to avoid:** Copy the full field list from the [Customizing Schema docs](https://labs.convex.dev/auth/setup/schema) and append your custom fields. Do not simplify — keep every base field even if unused.

**Warning signs:** Auth mutations fail with type validation errors; sign-up creates a user but sign-in fails.

### Pitfall 4: @auth/core Version Mismatch

**What goes wrong:** `@auth/core` is a peer dependency of `@convex-dev/auth`. If the wrong version is installed, sign-in throws cryptic `Cannot find module` or type errors.

**Why it happens:** `@convex-dev/auth` v0.0.91 requires `@auth/core@0.34.3`. Installing the latest `@auth/core` (which may be a higher version) causes incompatibilities.

**How to avoid:** Always install `@auth/core` at the exact version specified in `@convex-dev/auth`'s peer dependencies. Run `npm view @convex-dev/auth peerDependencies` to check.

**Warning signs:** TypeScript errors in `convex/auth.ts`; runtime errors when calling `signIn`.

### Pitfall 5: FastAPI CORS Blocking Vercel Preview URLs

**What goes wrong:** During development and in Vercel preview deployments, the frontend origin is a dynamic URL (`https://creditfix-xyz-git-branch.vercel.app`). Hardcoding only the production URL in FastAPI CORS blocks preview deploys.

**Why it happens:** `allow_origins` in `CORSMiddleware` is an exact-match list.

**How to avoid:** Use `FRONTEND_URL` environment variable in FastAPI. Set it to the production URL on Railway. For local dev, default to `http://localhost:3000`. Accept that preview deploy testing against Railway will require updating this env var.

**Warning signs:** Browser console shows CORS errors when calling FastAPI from the frontend; network tab shows OPTIONS preflight blocked.

### Pitfall 6: Convex Functions Not Deployed to Production

**What goes wrong:** Developer runs `npx convex dev` locally but never runs `npx convex deploy` for the production Convex project. The Vercel deployment uses the production Convex URL but functions are missing.

**Why it happens:** `convex dev` deploys to a dev deployment; `convex deploy` is needed for production. They are different Convex deployments with different URLs.

**How to avoid:** Run `npx convex deploy` before or during the Vercel deployment pipeline. Set `CONVEX_DEPLOY_KEY` in Vercel environment variables and add `npx convex deploy --cmd 'next build'` as the Vercel build command.

**Warning signs:** `useQuery` returns errors in production but works locally; Convex dashboard shows functions missing in production deployment.

---

## Code Examples

### Convex Dev Setup Sequence

```bash
# From frontend/ directory:
npx convex dev
# This will:
# 1. Prompt you to log in to Convex (browser opens)
# 2. Create or link a Convex project
# 3. Write CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL to .env.local
# 4. Watch and deploy convex/ functions on save
```

### Protecting a Client Component Route

```typescript
// frontend/app/(protected)/layout.tsx
"use client";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
```

Note: Middleware handles the redirect for server-rendered routes. This client-side guard is a belt-and-suspenders for client navigations.

### Profile Page (reading saved values)

```typescript
// frontend/app/(protected)/profile/page.tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ProfilePage() {
  const user = useQuery(api.users.currentUser);
  const updateProfile = useMutation(api.users.updateProfile);

  if (user === undefined) return <div>Loading...</div>;

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      await updateProfile({
        fullName: data.get("fullName") as string,
        streetAddress: data.get("streetAddress") as string,
        city: data.get("city") as string,
        state: data.get("state") as string,
        zip: data.get("zip") as string,
      });
    }}>
      <input name="fullName" defaultValue={user?.fullName ?? ""} />
      <input name="streetAddress" defaultValue={user?.streetAddress ?? ""} />
      <input name="city" defaultValue={user?.city ?? ""} />
      <input name="state" defaultValue={user?.state ?? ""} />
      <input name="zip" defaultValue={user?.zip ?? ""} />
      <button type="submit">Save Profile</button>
    </form>
  );
}
```

`useQuery` is reactive — when `updateProfile` mutation completes, the component re-renders with the new saved values automatically.

### Sign-Out Button

```typescript
"use client";
import { useAuthActions } from "@convex-dev/auth/react";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  return <button onClick={() => void signOut()}>Sign Out</button>;
}
```

### Vercel Build Command for Convex Deploy

In Vercel project settings, set Build Command to:
```bash
npx convex deploy --cmd 'next build'
```

Set these Vercel environment variables:
- `CONVEX_DEPLOY_KEY` — from Convex dashboard (Settings > Deploy Keys)
- `NEXT_PUBLIC_CONVEX_URL` — production Convex deployment URL
- `NEXT_PUBLIC_FASTAPI_URL` — Railway public URL (set after Railway deploy)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Auth + @supabase/ssr | Convex Auth + @convex-dev/auth | Project init (2026-04-03) | Eliminates Supabase entirely; STACK.md still references Supabase but project uses Convex |
| `ConvexProvider` (client-only) | `ConvexAuthNextjsServerProvider` + `ConvexAuthNextjsProvider` | @convex-dev/auth v0.0.x | Enables server-side cookie auth; required for Next.js refresh persistence |
| Separate `profiles` table | Extended `users` table from `authTables` | Best practice emerging 2025 | Fewer joins; profile data co-located with auth identity |

**Note on STACK.md:** The existing `.planning/research/STACK.md` and `.planning/research/ARCHITECTURE.md` files reference Supabase throughout. These are outdated. The project uses Convex for all DB/auth/storage. Ignore all Supabase references in those files for Phase 1 (and all phases).

---

## Open Questions

1. **`@auth/core` exact peer dependency version**
   - What we know: `@convex-dev/auth@0.0.91` requires `@auth/core`. The current `@auth/core` latest is 0.34.3.
   - What's unclear: Whether `@convex-dev/auth@0.0.91` pins to exactly `0.34.3` or allows a range.
   - Recommendation: Run `npm view @convex-dev/auth@0.0.91 peerDependencies` at project setup to confirm exact version before installing. The setup docs say `@auth/core@0.37.0` was used in older examples — verify at install time.

2. **Tailwind CSS v4 compatibility with shadcn/ui**
   - What we know: Tailwind 4.2.2 is now current. shadcn/ui has been updating for v4 compatibility. Some community reports of config differences.
   - What's unclear: Whether `npx shadcn@latest init` on a fresh Next.js 15 + Tailwind v4 project configures correctly without manual tweaks.
   - Recommendation: Follow shadcn/ui docs for Next.js 15 + Tailwind v4 setup. If issues arise, pin Tailwind to 3.x (still officially supported by shadcn).

3. **Convex Auth `isAuthenticated` export requirement**
   - What we know: Older versions of `@convex-dev/auth` had a bug where the middleware returned `false` if `isAuthenticated` wasn't exported. Fixed in recent versions.
   - What's unclear: Whether `@convex-dev/auth@0.0.91` requires explicit export or handles it automatically.
   - Recommendation: Explicitly destructure and export `isAuthenticated` from `convex/auth.ts`. Cost is zero; prevents the middleware pitfall.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js, npm | Yes | v24.13.0 | — |
| Python 3.11+ | FastAPI | Yes | 3.13.11 | — |
| npm | Package management | Yes | 11.6.2 | — |
| pip3 | Python deps | Yes | 25.0.1 | — |
| Docker | Railway deployment | Yes | 28.0.1 | — |
| Convex CLI | Convex deploy | Yes | 1.34.1 (via npx) | — |
| Railway CLI | Railway deployment | No | — | Deploy via Railway dashboard (GitHub integration) |
| Vercel CLI | Vercel deployment | Not checked | — | Deploy via Vercel dashboard (GitHub integration) |

**Missing dependencies with no fallback:**
- None that block execution — Railway and Vercel both support dashboard-based deployments without their CLIs.

**Notes:**
- Railway CLI not installed locally; use Railway dashboard to connect GitHub repo for deployment.
- Vercel CLI not checked; Vercel dashboard deployment is the standard path anyway.

---

## Project Constraints (from CLAUDE.md)

| Directive | Type | Detail |
|-----------|------|--------|
| Tech stack locked | Required | Next.js 15 + Convex + FastAPI only |
| AI model | Required | `claude-sonnet-4-20250514` for analysis/generation |
| PDF parsing | Required | PyMuPDF primary, pdfplumber fallback |
| Deployment targets | Required | Frontend → Vercel, Backend → Railway |
| Security — PII | Required | Never store full SSNs or complete account numbers; only last 4 digits |
| GSD workflow | Required | Use `/gsd:execute-phase` for planned work; no direct edits outside GSD |
| STACK.md note | Warning | Existing STACK.md references Supabase — project uses Convex; ignore Supabase entries |

---

## Sources

### Primary (HIGH confidence)
- `labs.convex.dev/auth/setup` — Convex Auth installation steps
- `labs.convex.dev/auth/config/passwords` — Password provider, signIn/signUp FormData pattern
- `labs.convex.dev/auth/authz/nextjs` — Next.js middleware, ConvexAuthNextjsServerProvider, cookie session
- `labs.convex.dev/auth/setup/schema` — authTables extension, custom fields pattern
- `docs.convex.dev/auth/functions-auth` — getAuthUserId, ctx.auth.getUserIdentity()
- `docs.convex.dev/auth/database-auth` — User profile storage linked to auth identity
- `docs.convex.dev/database/schemas` — defineSchema, defineTable, validators
- `github.com/get-convex/template-nextjs-convexauth-shadcn` — Official Next.js + Convex Auth + shadcn template
- `docs.railway.com/guides/fastapi` — FastAPI Railway deployment guide
- npm registry — Verified package versions: convex@1.34.1, @convex-dev/auth@0.0.91, next@16.2.2, @auth/core@0.34.3

### Secondary (MEDIUM confidence)
- `github.com/get-convex/convex-auth/issues/271` — Known middleware isAuthenticated issue documentation
- `ui.shadcn.com/docs/installation/next` — shadcn/ui Next.js setup
- Vercel docs on environment variables — NEXT_PUBLIC_ prefix rules

### Tertiary (LOW confidence — flag for validation)
- Community reports on Tailwind v4 + shadcn/ui compatibility — not verified against official docs; test at scaffold time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry on 2026-04-03
- Architecture: HIGH — patterns verified against official Convex Auth and Convex docs
- Pitfalls: HIGH — two confirmed GitHub issues referenced; others from official security docs

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (Convex Auth is beta software; check for updates before executing)
