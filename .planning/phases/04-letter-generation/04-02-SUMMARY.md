---
phase: "04"
plan: "02"
subsystem: convex
tags: [convex, schema, letter-generation, dispute-letters, storage, fastapi-integration]
dependency_graph:
  requires:
    - POST /api/letters/generate        # FastAPI endpoint from Plan 04-01
    - frontend/convex/schema.ts         # existing tables extended
    - frontend/convex/disputeItems.ts   # setLetterGenerated added
  provides:
    - dispute_letters table in schema.ts
    - frontend/convex/letters.ts        # generateLetters action, saveLetter, listByUser, getLetterDownloadUrl, getApprovedWithoutLetters
    - internal.disputeItems.setLetterGenerated
  affects:
    - frontend/convex/schema.ts         # dispute_letters table added
    - frontend/convex/disputeItems.ts   # setLetterGenerated mutation added
tech_stack:
  added: []
  patterns:
    - Convex internalQuery + internalMutation for internal orchestration helpers
    - Convex Storage store/getUrl for PDF blob storage (never PDF bytes in document)
    - Per-item try/catch in action loop to prevent batch abortion (Pitfall 6)
    - Profile completeness guard before batch generation (D-11)
    - D-27 idempotency via getApprovedWithoutLetters (skip items with existing letters)
key_files:
  created:
    - frontend/convex/letters.ts
  modified:
    - frontend/convex/schema.ts
    - frontend/convex/disputeItems.ts
decisions:
  - "generateLetters follows analyzeReport action pattern exactly: auth check, env guard, outer try/catch absent (per-item catch instead), reactive query for results"
  - "getUserProfile internalQuery uses identity.subject cast to Id<users> — consistent with existing currentUser pattern in users.ts"
  - "getApprovedWithoutLetters cross-queries dispute_letters by_dispute_item index to implement idempotency (D-27) without a dedicated status flag"
  - "listByUser returns dispute_letters ordered desc by generatedAt so newest letters appear first in the /letters page"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-04T09:28:00Z"
  tasks: 2
  files: 3
---

# Phase 4 Plan 2: Convex Letter Generation Data Layer Summary

**One-liner:** dispute_letters Convex table with three indexes added to schema.ts; letters.ts implements generateLetters batch action (auth + profile guard + FASTAPI_URL guard + per-item try/catch), saveLetter internal mutation, listByUser query, getLetterDownloadUrl signed URL query, getApprovedWithoutLetters idempotency query, and getUserProfile helper; setLetterGenerated internal mutation added to disputeItems.ts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add dispute_letters table to Convex schema | c2366ef | frontend/convex/schema.ts |
| 2 | Convex letters.ts — generateLetters action and CRUD | e6917a0 | frontend/convex/letters.ts, frontend/convex/disputeItems.ts |

## What Was Built

### Task 1: dispute_letters schema table

Added `dispute_letters` defineTable to `frontend/convex/schema.ts` after the `dispute_items` table. Fields: `disputeItemId` (Id<"dispute_items">), `userId` (string), `bureau` (union literal), `letterContent` (string — HTML, ~2-5KB), `storageId` (Id<"_storage"> — PDF bytes stored in Convex Storage, never in the document per Pitfall 4), `generatedAt` (number). Three indexes: `by_user`, `by_dispute_item`, `by_user_bureau`. No existing table definitions changed.

### Task 2: letters.ts and setLetterGenerated

**frontend/convex/letters.ts** — Full letter generation data layer:

- **getUserProfile** (internalQuery): Fetches user document by userId cast to `Id<"users">`. Returns full users record including profile fields needed for letter headers.

- **getApprovedWithoutLetters** (internalQuery): Queries `dispute_items` by_user index filtered to `status === "approved"`, then cross-queries `dispute_letters` by_dispute_item for each item. Returns only items with no existing letter — implements D-27 idempotency so re-runs skip already-generated letters.

- **saveLetter** (internalMutation): Inserts a `dispute_letters` record with all fields. Called by generateLetters after each successful PDF storage.

- **generateLetters** (public action): Full batch orchestration:
  1. Auth check via `ctx.auth.getUserIdentity()`
  2. Fetches approved items without letters (idempotency — D-27)
  3. Fetches user profile; throws `"Profile incomplete — add your name and mailing address in Profile before generating letters"` if any of fullName/streetAddress/city/state/zip is missing (D-11)
  4. Guards FASTAPI_URL env var
  5. Loops over items with per-item try/catch (Pitfall 6 — one failure does not abort batch)
     - Maps Convex camelCase fields to FastAPI snake_case LetterRequest
     - Computes `fcra_section_usc` from FCRA_USC constant map (mirrors backend FCRA_LIBRARY)
     - POSTs to `${fastapiUrl}/api/letters/generate`
     - Decodes base64 PDF via `atob()` + `Uint8Array.from()`
     - Stores PDF in Convex Storage via `ctx.storage.store(blob)`
     - Inserts dispute_letters record via `internal.letters.saveLetter`
     - Updates dispute item status to `letter_generated` via `internal.disputeItems.setLetterGenerated` (D-26)
     - On catch: `console.error()` and continues

- **listByUser** (public query): Returns all `dispute_letters` for authenticated user ordered `desc` by generatedAt.

- **getLetterDownloadUrl** (public query): Fetches letter by letterId, verifies ownership (`letter.userId === identity.subject`), returns `ctx.storage.getUrl(letter.storageId)`.

**frontend/convex/disputeItems.ts** — Added `setLetterGenerated` (internalMutation): patches `dispute_items` record to `status: "letter_generated"`. Called by generateLetters action after each letter is stored (D-26).

## Decisions Made

1. **generateLetters mirrors analyzeReport pattern** — No outer try/catch wrapping the loop. Per-item try/catch inside the loop means failures are isolated per item, consistent with batch processing expectations and Pitfall 6.

2. **getUserProfile internalQuery casts string to Id<"users">** — `identity.subject` is the Convex user ID string. The cast `args.userId as Id<"users">` is consistent with how `currentUser` in users.ts works via `getAuthUserId`. No `users` index by userId needed — `ctx.db.get()` by document ID is O(1).

3. **Idempotency via cross-query in getApprovedWithoutLetters** — Rather than adding a separate boolean field to dispute_items, we check the dispute_letters table for an existing record. This keeps schema minimal and naturally handles idempotency as defined in D-27.

4. **listByUser ordered desc** — Newest letters appear first in the /letters page UI, which is the expected presentation order.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All functions are fully implemented:
- `generateLetters` calls real FastAPI endpoint and real Convex Storage
- `getLetterDownloadUrl` returns real signed storage URL
- `listByUser` queries the real `dispute_letters` table

The /letters frontend page is not yet built (that is Plan 03's work) — this is by design, not a stub.

## Self-Check: PASSED

All created/modified files verified on disk:
- FOUND: frontend/convex/schema.ts (modified)
- FOUND: frontend/convex/letters.ts (created)
- FOUND: frontend/convex/disputeItems.ts (modified)

All commits verified:
- FOUND commit: c2366ef (feat(04-02): add dispute_letters table to Convex schema)
- FOUND commit: e6917a0 (feat(04-02): add letters.ts Convex data layer and setLetterGenerated mutation)
