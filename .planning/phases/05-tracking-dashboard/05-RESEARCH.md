# Phase 5: Tracking & Dashboard - Research

**Researched:** 2026-04-03
**Domain:** Convex schema extension, deadline calculation, Next.js modal/tracker UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mark as Sent Flow**
- D-01: "Mark as Sent" button on each letter card in /letters page
- D-02: Clicking opens a modal/dialog to enter: send date (date picker, defaults to today) and certified mail tracking number (optional text input)
- D-03: On submit: update `dispute_letters` record with sentAt and certifiedMailNumber fields
- D-04: Update corresponding `dispute_items` status from "letter_generated" to "sent"
- D-05: Calculate 30-day deadline: sentAt + 30 days, stored as `deadline` field on `dispute_letters`

**Deadline Calculation**
- D-06: Deadline = sentAt + 30 calendar days (FCRA 30-day investigation window)
- D-07: Days remaining = deadline - today; negative = overdue
- D-08: Overdue threshold: disputes past 30 days with no response flagged on tracker AND dashboard
- D-09: No automatic status change — user manually records responses or marks resolved/denied

**Tracker Page UI (/tracker)**
- D-10: `/tracker` page showing all disputes that have been sent (status >= "sent")
- D-11: Each dispute shown as a card with: creditor name, bureau badge, status color, days remaining/overdue, certified mail number
- D-12: Color coding: sent/waiting (blue), approaching deadline (amber, <= 5 days), overdue (red), resolved (green), denied (red outline)
- D-13: Sort by deadline (most urgent first)
- D-14: Filter tabs: All, Active (sent/waiting), Overdue, Resolved

**Dashboard Page UI (/dashboard)**
- D-15: Replace placeholder dashboard with real summary content
- D-16: Summary cards row: Total Disputes, Letters Generated, Letters Sent, Responses Received, Resolved
- D-17: Upcoming Deadlines section: list of disputes approaching 30-day deadline (next 7 days), sorted by urgency
- D-18: Overdue Alerts section: disputes past deadline with no response, highlighted in red
- D-19: Quick Action buttons: "Upload New Report", "Review Pending Items", "Download Letters"
- D-20: Recent Activity feed: last 5 status changes across all disputes

**Data Layer Changes**
- D-21: Add to `dispute_letters` table: sentAt (optional number), certifiedMailNumber (optional string), deadline (optional number)
- D-22: Convex mutation: `markAsSent` — sets sentAt, certifiedMailNumber, deadline; updates dispute_items status to "sent"
- D-23: Convex query: `getSentLetters` — returns letters with sentAt set, includes deadline calculations
- D-24: Convex query: `getDashboardStats` — aggregates counts across disputes, letters, statuses
- D-25: Convex query: `getUpcomingDeadlines` — letters where deadline is within 7 days from now

**Navigation**
- D-26: Add /tracker to nav and middleware
- D-27: Dashboard is already in nav at /dashboard — just update the page content

### Claude's Discretion
- Exact card layout and styling for tracker
- Dashboard card visual design (icons, colors, sizing)
- Modal/dialog component choice for Mark as Sent
- Whether to use recharts or simple HTML for any dashboard visualizations
- Loading states and empty states

### Deferred Ideas (OUT OF SCOPE)
- Email reminders at day 25 (v2 — NOTF-01, NOTF-02)
- Second demand letter for ignored disputes (v2 — ESC-01)
- Escalation letters for denied disputes (v2 — ESC-02)
- CFPB complaint suggestion (v2 — ESC-03)
- Bureau response upload for next-round guidance (v2 — ESC-04)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRK-01 | User can mark a letter as sent with send date and certified mail tracking number | Modal with date input + text input; `markAsSent` mutation on `dispute_letters`; updates `dispute_items` status to "sent" |
| TRK-02 | System calculates 30-day response deadline from send date | `deadline = sentAt + 30 * 24 * 60 * 60 * 1000`; stored in `dispute_letters`; displayed in tracker |
| TRK-03 | Tracker page shows visual timeline with color-coded dispute statuses | New `/tracker` page with filter tabs and color-coded cards; join letters with dispute_items |
| TRK-04 | Overdue disputes (past 30 days, no response) highlighted on dashboard and tracker | `deadline < Date.now()` with status "sent" = overdue; red highlight in both surfaces |
| DASH-01 | Dashboard shows summary cards (total disputes, letters sent, responses received, resolved) | `getDashboardStats` query aggregating counts across dispute_items and dispute_letters |
| DASH-02 | Dashboard shows upcoming deadlines for active disputes | `getUpcomingDeadlines` query filtering letters where deadline is within 7 days |
| DASH-03 | Dashboard has quick action buttons (Upload Report, Review Items, Download Letters) | Link buttons to /upload, /disputes, /letters |
</phase_requirements>

---

## Summary

Phase 5 is a pure frontend + Convex data layer phase. No FastAPI work is needed — all new functionality lives in schema extensions, new Convex mutations/queries, and two new/updated UI pages. The work splits into three clear layers: (1) schema + data, (2) mark-as-sent modal in the letters page, (3) the tracker page and dashboard replacement.

The most important technical decision is schema extension. Three optional fields must be added to `dispute_letters` (`sentAt`, `certifiedMailNumber`, `deadline`) and the Convex schema must be updated before any mutations or queries can be written. The Convex dev server performs schema validation at deploy time, so the schema change is the dependency anchor for all other work.

Deadline calculation is purely arithmetic: `sentAt + 30 * 24 * 60 * 60 * 1000` in milliseconds. This is calculated at write time in the `markAsSent` mutation and stored as a number — not recomputed on every read. Days remaining is a simple read-time subtraction and must treat negative values as overdue. The FCRA window technically starts at bureau receipt, but CONTEXT.md D-06 locks the calculation to sentAt (the mailing date) — do not deviate from this decision.

**Primary recommendation:** Implement in strict dependency order: schema first, mutations/queries second, letters page modal third, tracker page fourth, dashboard last. Each layer depends on the previous one.

---

## Standard Stack

### Core (already installed — no new dependencies required)
| Library | Version Installed | Purpose | Why Used |
|---------|-------------------|---------|----------|
| convex | ^1.34.1 | Schema, mutations, queries, real-time | Project-wide data layer |
| next | 16.2.2 | App Router, pages, routing | Project-wide frontend framework |
| @base-ui/react | 1.3.0 | Dialog/modal for Mark as Sent | Already installed; accessible composable primitives |
| lucide-react | 1.7.0 | Icons for dashboard cards | Already installed |
| tailwindcss | ^4 | Styling | Project-wide styling |

### Missing Dependency: date-fns
**IMPORTANT FINDING:** `date-fns` is imported in `frontend/app/(protected)/letters/page.tsx` (`import { format } from "date-fns"`) but is NOT listed in `package.json` and is NOT present in `node_modules`. The letters page currently uses it only for display formatting.

For Phase 5, date arithmetic (30-day deadline, days remaining) must be done reliably. Two options exist:

| Option | Approach | Verdict |
|--------|----------|---------|
| Install date-fns | `npm install date-fns` | RECOMMENDED — resolves existing missing import, clean date helpers |
| Vanilla JS | `new Date(sentAt + 30*24*60*60*1000)`, `Math.floor((deadline - Date.now()) / 86400000)` | Viable for simple arithmetic; no install needed |

**Recommendation:** Install date-fns to fix the existing missing import and use `addDays`, `differenceInCalendarDays`, and `format` from it. The project's CLAUDE.md originally listed it as part of the stack.

```bash
cd frontend && npm install date-fns
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @base-ui/react Dialog | shadcn/ui Dialog | shadcn not installed; @base-ui is already present — use it |
| @base-ui/react Dialog | HTML `<dialog>` element | Native dialog lacks backdrop animation, accessibility is manual |
| date-fns | dayjs | dayjs not installed; unnecessary new dependency |
| date-fns | vanilla Date arithmetic | Viable but verbose for formatting; date-fns already partially depended upon |

---

## Architecture Patterns

### Schema Extension Pattern (Convex)

Convex schema changes require adding optional fields — existing records without the new fields remain valid. The schema change is deployed automatically when `npx convex dev` picks up the change.

```typescript
// frontend/convex/schema.ts — extend dispute_letters table
dispute_letters: defineTable({
  disputeItemId: v.id("dispute_items"),
  userId:        v.string(),
  bureau:        v.union(...),
  letterContent: v.string(),
  storageId:     v.id("_storage"),
  generatedAt:   v.number(),
  // Phase 5 additions (D-21)
  sentAt:              v.optional(v.number()),   // Unix ms timestamp
  certifiedMailNumber: v.optional(v.string()),
  deadline:            v.optional(v.number()),   // sentAt + 30 days in ms
})
```

All three fields are `v.optional(...)` — existing records remain valid without migration.

### markAsSent Mutation Pattern

Follows the established `updateDisputeStatus` pattern: auth check, ownership verification, patch the record, then patch the related record.

```typescript
// frontend/convex/letters.ts
export const markAsSent = mutation({
  args: {
    letterId:            v.id("dispute_letters"),
    sentAt:              v.number(),   // Unix ms from client
    certifiedMailNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const letter = await ctx.db.get(args.letterId);
    if (!letter) throw new Error("Letter not found");
    if (letter.userId !== identity.subject) throw new Error("Unauthorized");

    const deadline = args.sentAt + 30 * 24 * 60 * 60 * 1000; // D-06

    // D-03: update dispute_letters
    await ctx.db.patch(args.letterId, {
      sentAt:              args.sentAt,
      certifiedMailNumber: args.certifiedMailNumber,
      deadline,
    });

    // D-04: update dispute_items status to "sent"
    await ctx.db.patch(letter.disputeItemId, { status: "sent" });
  },
});
```

### getDashboardStats Query Pattern

Aggregates across dispute_items. Convex queries are server-side JavaScript — counts are done with `.collect()` and then `.filter()`. Convex does not have SQL COUNT — everything is in-memory JS after fetching.

```typescript
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const allItems = await ctx.db
      .query("dispute_items")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const allLetters = await ctx.db
      .query("dispute_letters")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const now = Date.now();

    return {
      totalDisputes:       allItems.length,
      lettersGenerated:    allLetters.length,
      lettersSent:         allLetters.filter(l => l.sentAt !== undefined).length,
      responsesReceived:   allItems.filter(i => i.status === "resolved" || i.status === "denied").length,
      resolved:            allItems.filter(i => i.status === "resolved").length,
      overdue:             allLetters.filter(l => l.deadline !== undefined && l.deadline < now && /* item still sent */ true).length,
    };
  },
});
```

### Tracker Data Shape

The tracker page needs a joined view: letter data (sentAt, deadline, certifiedMailNumber) combined with dispute item data (creditorName, bureau, status). Convex does not have SQL JOINs — this join happens client-side or in a dedicated query.

**Pattern: Single query returning joined shape**

```typescript
export const getSentLetters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const letters = await ctx.db
      .query("dispute_letters")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("sentAt"), undefined))
      .collect();

    // Client-side join: fetch dispute_items for each letter
    const results = [];
    for (const letter of letters) {
      const item = await ctx.db.get(letter.disputeItemId);
      if (item) {
        results.push({ letter, item });
      }
    }
    return results;
  },
});
```

This is the established project pattern — `getApprovedWithoutLetters` in letters.ts already does this style of loop join.

### @base-ui/react Dialog Pattern

The project already uses `@base-ui/react` (v1.3.0 installed). Use `Dialog` for the Mark as Sent modal.

```tsx
import { Dialog } from "@base-ui/react/dialog";

// Controlled open state
const [open, setOpen] = useState(false);

<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger>
    <button>Mark as Sent</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 bg-black/30" />
    <Dialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
      <Dialog.Title>Mark Letter as Sent</Dialog.Title>
      {/* form content */}
      <Dialog.Close>Cancel</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

The `Dialog.Root` accepts `open` / `onOpenChange` for controlled mode, which is needed to close the dialog after successful mutation.

### Days Remaining Calculation

Done client-side at render time (not stored):

```typescript
// Without date-fns
function daysRemaining(deadline: number): number {
  return Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24));
}
// Negative = overdue, 0 = due today

// With date-fns (preferred after installing)
import { differenceInCalendarDays } from "date-fns";
const days = differenceInCalendarDays(new Date(deadline), new Date());
```

### Color Coding Logic (D-12)

```typescript
function getStatusColor(item: DisputeItem, letter: DisputeLetter): string {
  if (item.status === "resolved") return "green";
  if (item.status === "denied") return "red-outline";
  const days = daysRemaining(letter.deadline!);
  if (days < 0) return "red";       // overdue
  if (days <= 5) return "amber";    // approaching
  return "blue";                    // sent/waiting
}
```

### Recommended Project Structure for New Files

```
frontend/
├── app/(protected)/
│   ├── tracker/
│   │   └── page.tsx          # NEW — tracker page (D-10 through D-14)
│   ├── dashboard/
│   │   └── page.tsx          # REPLACE — real dashboard content (D-15 through D-20)
│   └── letters/
│       └── page.tsx          # MODIFY — add Mark as Sent button + modal (D-01 through D-05)
├── convex/
│   ├── schema.ts             # MODIFY — add sentAt/certifiedMailNumber/deadline to dispute_letters
│   └── letters.ts            # MODIFY — add markAsSent, getSentLetters, getDashboardStats, getUpcomingDeadlines
```

No new directories needed outside of `tracker/`.

### Anti-Patterns to Avoid

- **Computing deadline at read time:** Do NOT compute `sentAt + 30 days` on every query. Store `deadline` on write (D-05) so queries can filter against it directly.
- **Mutating dispute_items status directly from the UI:** Always go through a Convex mutation (auth guard + ownership check). Never patch via the Convex dashboard or direct client patch.
- **Two separate mutations for mark-as-sent:** The `markAsSent` mutation MUST update both `dispute_letters` AND `dispute_items` in the same mutation handler to avoid race conditions where a letter shows as "sent" but the item still shows "letter_generated".
- **Tracking deadline from letter generation date:** Deadline is from `sentAt` (the mailing date), NOT from `generatedAt`. See Pitfall 5 below.
- **Using `getSentLetters` for dashboard stats:** The dashboard stats query needs ALL letters and ALL items regardless of sent status — use `getDashboardStats` separately.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal/Dialog for Mark as Sent | Custom `<div>` overlay with z-index hacks | `@base-ui/react Dialog` | Already installed; handles focus trapping, Escape key, scroll lock, accessibility |
| Date arithmetic for 30 days | Custom day-counting logic with edge cases | `addDays(new Date(sentAt), 30).getTime()` from date-fns | DST edge cases, month boundary arithmetic; date-fns handles correctly |
| Days remaining countdown | Rolling timer with setInterval | Static `differenceInCalendarDays` at render time | User doesn't need second-by-second countdown; daily granularity sufficient; reactive query will re-render when stale |
| Optimistic update for Mark as Sent | Manual cache manipulation | `useMutation(...).withOptimisticUpdate(...)` | Established pattern in disputes page; Convex provides the API |

**Key insight:** This phase adds zero new server infrastructure. All complexity is in UI state management and Convex data queries. Don't over-engineer.

---

## Common Pitfalls

### Pitfall 1: Deadline Calculated from Wrong Anchor (from PITFALLS.md #5)
**What goes wrong:** Deadline calculated from `generatedAt` instead of `sentAt`, or from today's date when modal opens instead of the user-entered send date.
**Why it happens:** It's easy to grab the nearest timestamp. The letter was generated before it was sent.
**How to avoid:** The `markAsSent` mutation receives `sentAt` from the client (the date the user enters in the modal, defaulting to today). The deadline is `sentAt + 30 days`. Never use `Date.now()` as the deadline anchor inside the mutation — use the passed `sentAt` argument.
**Warning signs:** Deadline shows a date 30 days from letter generation, not from mailing.

### Pitfall 2: Schema Change Breaks Existing Letters Queries
**What goes wrong:** Adding non-optional fields to `dispute_letters` causes existing records (which have no `sentAt`) to fail validation.
**Why it happens:** Convex validates all records against the schema. If new fields are `v.string()` (not `v.optional(v.string())`), existing records without those fields become invalid.
**How to avoid:** All three new fields MUST be `v.optional(...)`: `v.optional(v.number())` for sentAt and deadline, `v.optional(v.string())` for certifiedMailNumber.
**Warning signs:** Convex dev server throws validation errors after schema deploy; existing letters queries return errors.

### Pitfall 3: Two-Record Update Race Condition
**What goes wrong:** `markAsSent` updates `dispute_letters` then separately updates `dispute_items`. If the second patch fails, the letter shows "sent" but the dispute item still shows "letter_generated".
**Why it happens:** Two separate `ctx.db.patch` calls are not automatically transactional in Convex mutations — but actually, Convex mutations ARE fully serializable/transactional. However, putting both patches in one mutation is still the correct pattern.
**How to avoid:** Both `ctx.db.patch` calls for `dispute_letters` and `dispute_items` in the SAME `markAsSent` mutation handler. This is already the plan (D-22) — just follow it.
**Warning signs:** Status mismatch between /letters page and /tracker page.

### Pitfall 4: Tracker Page Queries Letters Without Joining Items
**What goes wrong:** The tracker page only queries `dispute_letters` and shows bureau + dates but lacks creditor name, which lives on `dispute_items`.
**Why it happens:** The letters table stores only `disputeItemId`, not the creditor name.
**How to avoid:** `getSentLetters` must return a joined shape: `{ letter, item }`. The loop-join pattern (already used in `getApprovedWithoutLetters`) is the correct approach. Each letter fetches its dispute item.
**Warning signs:** Tracker cards show bureau and date but "Unknown Creditor" or missing name.

### Pitfall 5: date-fns Import Already Broken in letters/page.tsx
**What goes wrong:** `letters/page.tsx` already imports `format` from `date-fns` but date-fns is NOT in package.json and NOT in node_modules. This will cause a build error.
**Why it happens:** The dependency was used in Phase 4 implementation but never added to package.json.
**How to avoid:** The first task of this phase must install date-fns: `npm install date-fns`. Do not defer this.
**Warning signs:** `next build` fails with "Cannot find module 'date-fns'"; local `next dev` may silently fail or use stale build cache.

### Pitfall 6: Overdue Detection Logic Includes Resolved/Denied Items
**What goes wrong:** The "Overdue" count on the dashboard includes items already marked resolved or denied, inflating the number.
**Why it happens:** Naive filter: `deadline < Date.now()` catches all past-deadline letters regardless of whether the dispute was resolved.
**How to avoid:** Overdue = `deadline < Date.now() AND item.status === "sent"` (still waiting, no response). Resolved and denied disputes should NOT appear in overdue counts even if their deadline has passed.
**Warning signs:** Dashboard shows overdue count higher than user expects; resolved disputes reappear in overdue list.

### Pitfall 7: Filter Tab "Overdue" vs. Color-Code Mismatch
**What goes wrong:** Tracker filter tab "Overdue" includes denied disputes; color coding shows denied as "red outline" not solid red. These are two different red states.
**Why it happens:** Both overdue and denied share red but mean different things.
**How to avoid:** "Overdue" filter tab = sent disputes past 30 days with no response (status: "sent", deadline < now). "Denied" disputes appear in "Resolved" tab or their own section. Color: overdue = red background; denied = red border/outline. Keep these visually and logically distinct.

---

## Code Examples

### Deadline Calculation (write time, inside markAsSent)
```typescript
// Source: CONTEXT.md D-06; arithmetic only
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const deadline = args.sentAt + THIRTY_DAYS_MS;
```

### Days Remaining (read time, client-side)
```typescript
// Without date-fns (safe if date-fns install is deferred to later task)
function daysRemaining(deadline: number): number {
  return Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24));
}
// Positive = days left; 0 = due today; negative = overdue

// With date-fns (preferred after install)
import { differenceInCalendarDays } from "date-fns";
const days = differenceInCalendarDays(deadline, Date.now());
```

### Status Color Classes (tracker cards, per D-12)
```typescript
function getUrgencyClasses(days: number, status: string): string {
  if (status === "resolved") return "border-green-200 bg-green-50";
  if (status === "denied")   return "border-red-300 bg-white";       // red outline
  if (days < 0)              return "border-red-200 bg-red-50";      // overdue
  if (days <= 5)             return "border-amber-200 bg-amber-50";  // approaching
  return "border-blue-200 bg-blue-50";                               // sent/waiting
}
```

### @base-ui/react Dialog Import
```typescript
// Source: node_modules/@base-ui/react/dialog/index.parts.d.ts (verified)
import { Dialog } from "@base-ui/react/dialog";

// Parts: Dialog.Root, Dialog.Trigger, Dialog.Portal, Dialog.Backdrop,
//        Dialog.Popup, Dialog.Title, Dialog.Description, Dialog.Close
```

### Date Input HTML — Default to Today
```tsx
// HTML date input value must be YYYY-MM-DD string
const today = new Date().toISOString().split("T")[0]; // "2026-04-03"
<input type="date" defaultValue={today} />
```

### Existing Patterns to Reuse (verified in codebase)
```typescript
// Auth guard pattern — all mutations/queries use this
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

// Ownership check pattern — letters.ts getLetterDownloadUrl
const letter = await ctx.db.get(args.letterId);
if (!letter) throw new Error("Letter not found");
if (letter.userId !== identity.subject) throw new Error("Unauthorized");

// optimistic update pattern — disputes/page.tsx
const markAsSentMutation = useMutation(api.letters.markAsSent).withOptimisticUpdate(
  (localStore, args) => {
    // update local letter record immediately
  }
);

// Filter tab pattern — disputes/page.tsx activeBureau state
const [activeFilter, setActiveFilter] = useState<"all" | "active" | "overdue" | "resolved">("all");
```

### Nav Link Addition Pattern (layout.tsx)
```tsx
// Current nav — add Tracker link after Letters (verified from layout.tsx)
<Link href="/tracker" className="text-sm text-muted-foreground hover:text-foreground">
  Tracker
</Link>
```

### Middleware Pattern (middleware.ts)
```typescript
// Add /tracker to protected routes matcher — same pattern as existing routes
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/upload(.*)",
  "/disputes(.*)",
  "/letters(.*)",
  "/profile(.*)",
  "/tracker(.*)",    // ADD THIS
]);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Supabase for DB/Auth | Convex (migrated in Phase 1) | All queries use `ctx.db`, not SQL |
| Jinja2 templates | Python f-strings (Phase 4 decision) | No template engine dependency |
| Separate status mutation per status | Reuse `updateDisputeStatus` + new `setLetterGenerated` | Follow same per-status mutation pattern |

---

## Open Questions

1. **How to handle letters already marked sent (if any exist before this phase)?**
   - What we know: `dispute_items` has a "sent" status in the schema from Phase 1 design, but `dispute_letters` has no `sentAt` field yet — no existing record can be "sent" until this phase
   - What's unclear: Whether any test data in the database might have status="sent" from manual dev testing
   - Recommendation: The `markAsSent` guard should check that the letter is currently in "letter_generated" status before allowing mark-as-sent, to prevent double-marking

2. **Should `getDashboardStats` be a single query or multiple queries?**
   - What we know: Convex queries fetch all records for a user and filter in JS; for a single user with ~50 dispute items this is trivially fast
   - What's unclear: Whether the dashboard page needs real-time reactivity on stats or can be slightly stale
   - Recommendation: Single `getDashboardStats` query using `useQuery` — real-time reactivity is a Convex strength, use it; no need to split

3. **Mark as Sent for letters already showing as "sent" status?**
   - What we know: Once marked sent, the button should change (hide or show "Sent" badge)
   - What's unclear: Whether re-marking with a different date should be allowed
   - Recommendation: Hide the "Mark as Sent" button and show the sent date + tracking number instead; no re-marking in v1

---

## Environment Availability

> Phase 5 has no new external dependencies beyond what previous phases use. All tools are the same Next.js + Convex stack.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js build | Assumed present (prior phases ran) | — | — |
| Convex dev | Schema deploy | Assumed running (prior phases used it) | 1.34.1 | — |
| date-fns | Date formatting, days remaining | NOT INSTALLED | — | Vanilla JS date arithmetic (verbose but viable) |
| @base-ui/react | Mark as Sent modal | INSTALLED | 1.3.0 | — |
| lucide-react | Dashboard icons | INSTALLED | 1.7.0 | Emoji or text-only icons |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- `date-fns`: Not in node_modules. The letters page already imports it (build will fail). Must install via `npm install date-fns` as first task. Fallback is vanilla arithmetic if install fails for any reason.

---

## Sources

### Primary (HIGH confidence)
- `frontend/convex/schema.ts` — Existing `dispute_letters` schema (directly read)
- `frontend/convex/letters.ts` — Existing letter mutations/query patterns (directly read)
- `frontend/convex/disputeItems.ts` — Status update mutation pattern (directly read)
- `frontend/app/(protected)/letters/page.tsx` — LetterCard pattern + date-fns usage (directly read)
- `frontend/app/(protected)/disputes/page.tsx` — Status badge, filter tab, optimistic update patterns (directly read)
- `frontend/app/(protected)/layout.tsx` — Existing nav links (directly read)
- `frontend/middleware.ts` — Protected route matcher pattern (directly read)
- `frontend/package.json` — Confirmed installed dependencies (directly read)
- `node_modules/@base-ui/react/dialog/index.parts.d.ts` — Dialog API exports (directly verified)
- `.planning/phases/05-tracking-dashboard/05-CONTEXT.md` — All locked decisions (directly read)
- `.planning/research/PITFALLS.md` — Pitfall 5: 30-day clock miscalculation (directly read)

### Secondary (MEDIUM confidence)
- CLAUDE.md stack section — date-fns listed as "Date Handling" library (directly read; explains why letters page imports it)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against node_modules
- Architecture patterns: HIGH — all patterns derived from existing codebase files, not assumptions
- Pitfalls: HIGH — Pitfall 5 (30-day clock) from project PITFALLS.md; others derived from code inspection

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable stack, no fast-moving dependencies)
