# Phase 7: Email Notifications - Research

**Researched:** 2026-04-05
**Domain:** Convex cron scheduling + Resend transactional email + Convex schema extension
**Confidence:** HIGH

## Summary

Phase 7 adds proactive email reminders for dispute deadlines using two already-decided tools: Resend (transactional email SDK) and Convex native scheduling (crons). The work decomposes into four clear areas: (1) schema extension on `users` and a new `reminder_log` table, (2) a new `notifications.ts` Node.js action file for Resend calls, (3) a new `crons.ts` file with a daily scan, and (4) a preferences UI section on the existing `/profile` page.

The most important constraint discovered in research is a project-level Convex AI guideline: **only `crons.interval` or `crons.cron` are permitted — never `crons.daily`, `crons.hourly`, or `crons.weekly`**. This overrides the published Convex docs which show `crons.daily()`. Use `crons.cron("0 8 * * *", ...)` for the 8 AM UTC daily scan. Separately, the Resend SDK requires `"use node"` at the top of the file, and that file must contain only actions (no queries or mutations in the same file).

The deadline anchor (`estimated_receipt_date = sentAt + 5 days buffer`) is already stored as `deadline` on `dispute_letters` (added in Phase 5 as `sentAt + 30 days`). The cron scan logic must compute day-offset relative to `sentAt`, not `deadline`, so that day-25 fires at `sentAt + 25 days` and day-31 fires at `sentAt + 31 days`.

**Primary recommendation:** Create `convex/notifications.ts` (Node.js action for Resend) + `convex/crons.ts` (daily scan logic inline using `crons.cron`) + schema extension. Keep everything in Convex; no FastAPI involvement.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Install `resend` npm package in frontend (Convex actions run Node.js)
- **D-02:** `RESEND_API_KEY` stored as Convex env var (via `npx convex env set`)
- **D-03:** Sending email address: configurable via `RESEND_FROM_EMAIL` Convex env var
- **D-04:** Convex action `sendReminderEmail` makes the Resend API call — never from mutations or frontend
- **D-05:** `convex/crons.ts` defines a daily cron job (runs at 8 AM UTC) that scans for due reminders
- **D-06:** Daily cron calls a mutation that queries disputes with approaching deadlines
- **D-07:** For each due reminder, cron triggers the `sendReminderEmail` action
- **D-08:** Day-25 reminder: fires when deadline is 5 days away AND no response recorded AND reminders enabled
- **D-09:** Day-31 nudge: fires when deadline has passed by 1 day AND no response recorded AND status is still "sent"
- **D-10:** Check response status before firing — suppress reminder if response already recorded
- **D-11:** Use `estimated_receipt_date` (sentAt + 5 days buffer) as deadline anchor, consistent with Phase 5
- **D-12:** Two email templates: "Deadline Approaching" (day 25) and "No Response Alert" (day 31)
- **D-13:** Templates include: dispute summary (creditor, bureau, dispute date), days remaining/overdue, action link to tracker page
- **D-14:** Plain HTML email (no React Email dependency needed for 2 simple templates — keep it lean)
- **D-15:** Subject lines: "CreditFix: Deadline approaching for [creditor] dispute" and "CreditFix: No response from [bureau] — time to escalate"
- **D-16:** Add email preferences to Convex `users` table: `emailRemindersEnabled` (boolean, default true), `reminderEmail` (string, defaults to auth email)
- **D-17:** Preferences UI: section on existing `/profile` page (not a new page)
- **D-18:** Toggle for enable/disable email reminders
- **D-19:** Optional custom email address field (defaults to login email)
- **D-20:** Reminder timing is fixed (day 25 and day 31) — not user-customizable in v1.1
- **D-21:** Daily cron checks `emailRemindersEnabled` before sending — respects opt-out
- **D-22:** Log each sent reminder in a `reminder_log` field or separate lightweight tracking (avoid a full table for now)
- **D-23:** Don't send duplicate reminders — track last reminder sent date per dispute to prevent double-sends on cron re-runs

### Claude's Discretion

- Exact email HTML styling
- Whether to batch reminders into a single daily digest vs individual emails per dispute
- Error handling for Resend API failures (retry logic)
- Loading states on preferences form

### Deferred Ideas (OUT OF SCOPE)

- Configurable reminder timing (day 15, 20, 25 etc.) — keep fixed for v1.1
- Daily digest mode (batch all reminders into one email) — individual emails for now
- SMS notifications — requires TCPA compliance, defer indefinitely
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | User receives email reminder at day 25 for approaching dispute deadlines | Covered by: cron daily scan, day-25 filter on sentAt, `sendReminderEmail` action with Resend SDK |
| NOTF-02 | User receives email nudge at day 31 if no bureau response is logged | Covered by: same cron scan with day-31 filter, `getResponseForItem` check before firing |
| NOTF-03 | User can configure email preferences (enable/disable, customize timing) | Covered by: users table schema extension, `updateEmailPrefs` mutation, preferences UI section on /profile |
</phase_requirements>

---

## Standard Stack

### Core — New Additions

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 6.10.0 (current) | Transactional email delivery from Convex action | Decided in D-01; best DX at this scale per STACK.md |
| `convex` | 1.34.1 (already installed) | Native cron scheduling via `cronJobs()` | No new infra needed; Convex replaces BullMQ/Redis |

### Already in Project

| Library | Version | Purpose |
|---------|---------|---------|
| `convex` | 1.34.1 | `internalMutation`, `internalAction`, `cronJobs()` |
| `@convex-dev/auth` | 0.0.91 | Auth identity for user email lookup |
| `next` | 16.2.2 | App Router for profile page UI |
| `react` | 19.2.4 | Profile form state |
| shadcn/ui components | already installed | `Switch`, `Input`, `Label`, `Card` already in project |

### Alternatives Considered (and Rejected)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| `resend` | SendGrid / SES | Worse DX for single-user scale (STACK.md decision) |
| Convex crons | Railway cron / external scheduler | New infra; Convex native is zero-overhead (STACK.md decision) |
| `crons.cron()` | `crons.daily()` | `crons.daily()` is explicitly forbidden by Convex AI guidelines (see Pitfall 1) |
| Plain HTML email | React Email | Only 2 templates; React Email adds dependency weight (D-14) |

**Installation (one new package):**
```bash
cd frontend && npm install resend
```

**Version verified:** `npm view resend version` → `6.10.0` (verified 2026-04-05)

---

## Architecture Patterns

### Recommended File Structure Changes

```
frontend/convex/
├── schema.ts          # MODIFY: add emailRemindersEnabled, reminderEmail to users table
│                      #         add reminder_log table
├── users.ts           # MODIFY: add updateEmailPrefs mutation, getEmailPrefs internalQuery
├── notifications.ts   # CREATE: "use node" at top; sendReminderEmail internalAction only
├── crons.ts           # CREATE: cronJobs() with daily 8 AM UTC scan; inline scanAndNotify internalMutation
└── (no changes to letters.ts, bureauResponses.ts — read via ctx.runQuery from cron)

frontend/app/(protected)/profile/
└── page.tsx           # MODIFY: add EmailPreferences section below existing profile form
```

### Pattern 1: Cron File Structure (Convex AI Guidelines-Compliant)

**What:** `crons.ts` defines the daily scan using `crons.cron()` with a traditional cron expression. The scan logic lives in an `internalMutation` or `internalAction` in the same file or a separate file called via `internal.*`.

**Critical rule from Convex AI guidelines:** Only `crons.interval` or `crons.cron` are permitted. Do NOT use `crons.daily`, `crons.hourly`, or `crons.weekly`.

**Example:**
```typescript
// convex/crons.ts
// Source: frontend/convex/_generated/ai/guidelines.md (project-local)
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Inline internal mutation — allowed per guidelines ("You can register Convex functions
// within crons.ts just like any other file")
export const scanDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    // ... scan logic (see Pattern 3)
  },
});

const crons = cronJobs();

// 8 AM UTC daily — standard cron syntax (minute hour dom month dow)
crons.cron(
  "daily-deadline-scan",
  "0 8 * * *",
  internal.crons.scanDeadlines,
  {},
);

export default crons;
```

### Pattern 2: Node.js Action File for Resend (Isolation Rule)

**What:** `notifications.ts` uses `"use node"` at the top. Because of the Convex isolation rule, this file must contain ONLY actions — no queries or mutations.

**Critical rule from Convex AI guidelines:** "Never add `'use node';` to a file that also exports queries or mutations."

**Example:**
```typescript
// convex/notifications.ts
// Source: frontend/convex/_generated/ai/guidelines.md (project-local)
"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

export const sendReminderEmail = internalAction({
  args: {
    toEmail: v.string(),
    creditorName: v.string(),
    bureau: v.string(),
    sentAt: v.number(),       // Unix ms
    reminderType: v.union(v.literal("day25"), v.literal("day31")),
    trackerUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "CreditFix <noreply@yourdomain.com>";

    const subject = args.reminderType === "day25"
      ? `CreditFix: Deadline approaching for ${args.creditorName} dispute`
      : `CreditFix: No response from ${args.bureau} — time to escalate`;

    const html = buildEmailHtml(args); // plain HTML template function

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [args.toEmail],
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      // Do not throw — log and continue (cron must not crash on one send failure)
    }

    return { emailId: data?.id ?? null, error: error ?? null };
  },
});
```

### Pattern 3: Scan Logic — What to Query

The daily scan in `scanDeadlines` must:
1. Fetch all `dispute_letters` with `sentAt` set and `letterType = "initial"` (or null — backward compat)
2. For each letter, compute `daysSinceSent = (now - sentAt) / (24 * 60 * 60 * 1000)`
3. Filter to day 25 window: `daysSinceSent >= 25 && daysSinceSent < 26`
4. Filter to day 31 window: `daysSinceSent >= 31 && daysSinceSent < 32`
5. Check `dispute_items.status === "sent"` (response not yet recorded)
6. Check `bureau_responses` — skip if any response recorded for the item
7. Load user record — check `emailRemindersEnabled === true`
8. Check `reminder_log` — skip if reminder already sent for this letter+type combo
9. Schedule `sendReminderEmail` via `ctx.scheduler.runAfter(0, internal.notifications.sendReminderEmail, args)`
10. Log the reminder in `reminder_log`

**Note on D-11 (estimated_receipt_date):** The CONTEXT.md says to use `estimated_receipt_date` as the deadline anchor. The existing `deadline` field on `dispute_letters` is `sentAt + 30 days` (set in Phase 5). The day-25 trigger means "5 days before the 30-day deadline" — equivalent to `sentAt + 25 days`. Day-31 means "1 day past the 30-day deadline" — equivalent to `sentAt + 31 days`. Compute both relative to `sentAt`, not the stored `deadline` field.

### Pattern 4: Schema Extension for `users` Table

```typescript
// convex/schema.ts addition to users table
users: defineTable({
  // ... existing fields unchanged ...
  // Phase 7: email notification preferences (D-16)
  emailRemindersEnabled: v.optional(v.boolean()),  // default true when absent
  reminderEmail: v.optional(v.string()),            // null → use auth email
}).index("email", ["email"]),
```

### Pattern 5: reminder_log Table (D-22, D-23)

Per D-22, avoid a full table "for now" — but D-23 requires de-duplication across cron runs. The safest approach that satisfies both: a lightweight `reminder_log` table with a unique index. This is not heavyweight — it stores one row per sent reminder (at most 2 rows per dispute letter).

```typescript
// convex/schema.ts — new table
reminder_log: defineTable({
  letterId:     v.id("dispute_letters"),
  userId:       v.string(),
  reminderType: v.union(v.literal("day25"), v.literal("day31")),
  sentAt:       v.number(),   // when the reminder was dispatched
}).index("by_letter_and_type", ["letterId", "reminderType"]),
```

Query for de-duplication:
```typescript
const existing = await ctx.db
  .query("reminder_log")
  .withIndex("by_letter_and_type", (q) =>
    q.eq("letterId", args.letterId).eq("reminderType", args.type)
  )
  .first();
if (existing) continue; // already sent
```

### Pattern 6: Profile Page Extension

The existing `ProfilePage` component uses a single `<form>` with `handleSubmit`. The email preferences section should be a **separate form** with its own `updateEmailPrefs` mutation call, so the two sections don't interfere. Place it below the existing profile card as a second `<Card>`.

```typescript
// Separate mutation in users.ts (no "use node" needed — no Node deps)
export const updateEmailPrefs = mutation({
  args: {
    emailRemindersEnabled: v.boolean(),
    reminderEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, {
      emailRemindersEnabled: args.emailRemindersEnabled,
      reminderEmail: args.reminderEmail ?? undefined,
    });
    return { success: true };
  },
});
```

The `reminderEmail` display in the form: show placeholder text "Defaults to your login email" when empty; only save a value if the user types one.

### Anti-Patterns to Avoid

- **Using `crons.daily()`:** Explicitly forbidden by Convex AI guidelines. Use `crons.cron("0 8 * * *", ...)` instead.
- **Putting `sendReminderEmail` in a file with mutations/queries:** `"use node"` files cannot co-export queries or mutations. Keep `notifications.ts` as actions-only.
- **Calling `ctx.db` from inside `notifications.ts`:** Actions have no `ctx.db`. Use `ctx.runQuery(internal.users.getEmailPrefs, ...)` to read data.
- **Using `filter()` in cron scan query:** Convex guidelines say "Do NOT use `filter` in queries." Add indexes to `dispute_letters` if needed, or collect by index then filter in JS.
- **Sending reminder from a mutation directly:** Mutations cannot make external HTTP calls. The correct flow is: mutation (scan + log) → `ctx.scheduler.runAfter(0, ...)` → action (send).
- **Storing `reminderEmail` as empty string:** Store as `undefined` / omit the field when no custom email is set; fall back to `user.email` from the auth record.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | SMTP transport / nodemailer | `resend` SDK | SPF/DKIM/DMARC handled by Resend; deliverability is non-trivial |
| Recurring schedules | setInterval, Railway cron, external webhook | `cronJobs()` in `crons.ts` | Convex native; zero new infra; handles at-most-once semantics |
| Duplicate send prevention | In-memory flags, Redis SETNX | `reminder_log` table with index | Convex DB is the source of truth; survives restarts |
| Email HTML rendering | Custom HTML template engine | Inline template function returning plain string | Only 2 templates; no template engine needed |

**Key insight:** The hardest part of email reminders is idempotency — ensuring a cron that runs every day doesn't re-send to the same user. The `reminder_log` table with a `by_letter_and_type` index solves this with a single query. Do not try to track this with timestamps or user fields on other tables.

---

## Common Pitfalls

### Pitfall 1: Using `crons.daily()` — Project Guideline Forbids It
**What goes wrong:** TypeScript compiles fine; Convex accepts `crons.daily()`. But the project's Convex AI guidelines (in `_generated/ai/guidelines.md`) explicitly state: "Only use the `crons.interval` or `crons.cron` methods. Do NOT use the `crons.hourly`, `crons.daily`, or `crons.weekly` helpers."
**Why it happens:** Published Convex docs show `crons.daily()` as a convenience helper. The project guidelines are more restrictive.
**How to avoid:** Use `crons.cron("0 8 * * *", ...)` — standard cron syntax, 8 AM UTC.
**Warning signs:** Any plan that uses `crons.daily(...)` violates this rule.

### Pitfall 2: `"use node"` File Contains Queries or Mutations
**What goes wrong:** Convex throws a runtime error — "queries and mutations must stay in the default Convex runtime."
**Why it happens:** The `resend` package is a Node.js module requiring `"use node"`, but queries/mutations must run in the Convex V8 runtime.
**How to avoid:** `notifications.ts` exports only `internalAction` functions. Move any data reads into separate `internalQuery` functions in other files (`users.ts`, `crons.ts`).
**Warning signs:** Any plan that puts `internalMutation` or `query` inside `notifications.ts`.

### Pitfall 3: Computing Day Offset from `deadline` Instead of `sentAt`
**What goes wrong:** Day-25 fires at wrong time. The stored `deadline = sentAt + 30 days`. Computing `25 days before deadline` gives `sentAt + 5 days` — which is wrong.
**Why it happens:** Confusion between "deadline" (the 30-day expiry) and "sentAt" (the mailing date).
**How to avoid:** Always compute `daysSinceSent = (now - letter.sentAt) / MS_PER_DAY`. Fire day-25 when `25 <= daysSinceSent < 26`, fire day-31 when `31 <= daysSinceSent < 32`.
**Warning signs:** Code that references `letter.deadline - now` for reminder thresholds.

### Pitfall 4: No Response Check Before Firing (PITFALLS.md #4)
**What goes wrong:** User already recorded bureau response but still gets an annoying nudge.
**Why it happens:** Scan queries `dispute_letters` without cross-checking `bureau_responses`.
**How to avoid:** For each candidate letter, query `bureau_responses` by `disputeItemId`. If any response exists (outcome != `no_response`), skip the reminder. Also check `dispute_items.status !== "sent"` as a fast pre-filter.
**Warning signs:** Cron scan that only checks `dispute_letters.sentAt` without looking at `bureau_responses`.

### Pitfall 5: `reminderEmail` Falls Back Incorrectly
**What goes wrong:** User has no `reminderEmail` set; code sends to empty string or crashes.
**Why it happens:** `user.reminderEmail` is `undefined`; `user.email` (the auth email) is also optional on the `users` table.
**How to avoid:** Fallback chain: `reminderEmail ?? user.email ?? null`. If both are null, log and skip — do not throw. The user can add their email in preferences.
**Warning signs:** Code that does `const email = user.reminderEmail` without a fallback.

### Pitfall 6: Cron Scan Uses `filter()` on Convex Query
**What goes wrong:** Convex guidelines say "Do NOT use `filter` in queries. Instead, define an index and use `withIndex`." A cron that does `.filter(q => q.neq(q.field("sentAt"), undefined))` will work but is an anti-pattern.
**Why it happens:** The existing `getSentLetters` query in letters.ts uses `.filter()` — but that's a public query. Internal scan logic for crons should use proper indexes.
**How to avoid:** The `dispute_letters` table already has `by_user` index. For the cron (which processes ALL users), query by `sentAt` presence via a dedicated index, OR collect all sent letters (small dataset for single-user app) and filter in JS. Given single-user scope, collecting and filtering in JS is acceptable.

### Pitfall 7: Email Infrastructure Not Configured (PITFALLS.md #5)
**What goes wrong:** Emails land in spam or bounce — Resend won't send from unverified domains in production.
**Why it happens:** `onboarding@resend.dev` only works for testing; production requires a verified custom domain with SPF/DKIM/DMARC records.
**How to avoid:** First task in Phase 7 must be Resend account setup + domain verification. The `RESEND_FROM_EMAIL` env var should use a verified domain address.
**Warning signs:** Plan that skips env var setup and domain verification as a prerequisite.

---

## Code Examples

### Example 1: Full `crons.ts` skeleton
```typescript
// convex/crons.ts
// Source: _generated/ai/guidelines.md (project-local) + Convex cron docs
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const scanDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Fetch all sent initial letters across all users
    // (single-user app — safe to collect all)
    const sentLetters = await ctx.db
      .query("dispute_letters")
      .withIndex("by_user", (q) => q.eq("userId", /* needs user scan */ ""))
      // NOTE: for multi-letter scan, use full table scan with .collect()
      // Single-user: acceptable. See architecture section for approach.
      .collect();

    for (const letter of sentLetters) {
      if (!letter.sentAt) continue;

      const daysSinceSent = (now - letter.sentAt) / MS_PER_DAY;
      const isDay25 = daysSinceSent >= 25 && daysSinceSent < 26;
      const isDay31 = daysSinceSent >= 31 && daysSinceSent < 32;
      if (!isDay25 && !isDay31) continue;

      const reminderType = isDay25 ? "day25" : "day31";

      // De-duplication check
      const alreadySent = await ctx.db
        .query("reminder_log")
        .withIndex("by_letter_and_type", (q) =>
          q.eq("letterId", letter._id).eq("reminderType", reminderType)
        )
        .first();
      if (alreadySent) continue;

      // Response check — suppress if response already recorded
      const item = await ctx.db.get(letter.disputeItemId);
      if (!item || item.status !== "sent") continue;

      const response = await ctx.db
        .query("bureau_responses")
        .withIndex("by_dispute_item", (q) => q.eq("disputeItemId", item._id))
        .first();
      if (response) continue;

      // User preferences check
      const user = await ctx.db.get(item.userId as any);
      if (!user || user.emailRemindersEnabled === false) continue;

      const toEmail = user.reminderEmail ?? user.email;
      if (!toEmail) continue;

      // Schedule email send (action — cannot call directly from mutation)
      await ctx.scheduler.runAfter(0, internal.notifications.sendReminderEmail, {
        toEmail,
        creditorName: item.creditorName,
        bureau: item.bureau,
        sentAt: letter.sentAt,
        reminderType,
        trackerUrl: `${process.env.CONVEX_SITE_URL ?? ""}/tracker`,
      });

      // Log the reminder
      await ctx.db.insert("reminder_log", {
        letterId: letter._id,
        userId: item.userId,
        reminderType,
        sentAt: now,
      });
    }
  },
});

const crons = cronJobs();

// 8 AM UTC daily — DO NOT use crons.daily() — forbidden by project guidelines
crons.cron(
  "daily-deadline-scan",
  "0 8 * * *",
  internal.crons.scanDeadlines,
  {},
);

export default crons;
```

### Example 2: `sendReminderEmail` action (Resend SDK)
```typescript
// convex/notifications.ts
// Source: https://resend.com/docs/send-with-nodejs
"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

export const sendReminderEmail = internalAction({
  args: {
    toEmail:      v.string(),
    creditorName: v.string(),
    bureau:       v.string(),
    sentAt:       v.number(),
    reminderType: v.union(v.literal("day25"), v.literal("day31")),
    trackerUrl:   v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "CreditFix <noreply@example.com>";

    const sentDate = new Date(args.sentAt).toLocaleDateString("en-US");
    const bureauProper = args.bureau.charAt(0).toUpperCase() + args.bureau.slice(1);

    const isDay25 = args.reminderType === "day25";
    const subject = isDay25
      ? `CreditFix: Deadline approaching for ${args.creditorName} dispute`
      : `CreditFix: No response from ${bureauProper} — time to escalate`;

    const html = isDay25
      ? buildApproachingHtml(args.creditorName, bureauProper, sentDate, args.trackerUrl)
      : buildOverdueHtml(args.creditorName, bureauProper, sentDate, args.trackerUrl);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [args.toEmail],
      subject,
      html,
    });

    if (error) {
      // Log but do not throw — individual send failure must not crash the cron
      console.error("Resend send error:", error.message);
    }

    return { emailId: data?.id ?? null };
  },
});

function buildApproachingHtml(
  creditor: string, bureau: string, sentDate: string, trackerUrl: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a;">Dispute Deadline Approaching</h2>
      <p>Your dispute letter for <strong>${creditor}</strong> (${bureau}) 
         was sent on ${sentDate}.</p>
      <p>The 30-day response window closes in <strong>5 days</strong>. 
         If no response is received, you may send a follow-up demand letter.</p>
      <p><a href="${trackerUrl}" style="color: #2563eb;">View your dispute tracker</a></p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">
        You are receiving this because email reminders are enabled on your CreditFix account. 
        You can disable them on your profile page.
      </p>
    </div>`;
}

function buildOverdueHtml(
  creditor: string, bureau: string, sentDate: string, trackerUrl: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #dc2626;">No Response Received</h2>
      <p>It has been 31 days since your dispute letter for <strong>${creditor}</strong> 
         (${bureau}) was sent on ${sentDate}.</p>
      <p>No bureau response has been recorded. Under FCRA § 611, bureaus must investigate 
         within 30 days. Consider your options:</p>
      <ul>
        <li>Send a demand letter (available in your tracker)</li>
        <li>File a CFPB complaint</li>
      </ul>
      <p><a href="${trackerUrl}" style="color: #2563eb;">View your dispute tracker</a></p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">
        You are receiving this because email reminders are enabled on your CreditFix account.
        You can disable them on your profile page.
      </p>
    </div>`;
}
```

### Example 3: Schema additions
```typescript
// In convex/schema.ts — users table extension (add to existing fields)
emailRemindersEnabled: v.optional(v.boolean()),
reminderEmail: v.optional(v.string()),

// New reminder_log table
reminder_log: defineTable({
  letterId:     v.id("dispute_letters"),
  userId:       v.string(),
  reminderType: v.union(v.literal("day25"), v.literal("day31")),
  sentAt:       v.number(),
})
  .index("by_letter_and_type", ["letterId", "reminderType"])
  .index("by_user", ["userId"]),
```

### Example 4: `updateEmailPrefs` mutation (in `users.ts`)
```typescript
// convex/users.ts addition
export const updateEmailPrefs = mutation({
  args: {
    emailRemindersEnabled: v.boolean(),
    reminderEmail:         v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, {
      emailRemindersEnabled: args.emailRemindersEnabled,
      reminderEmail: args.reminderEmail,
    });
    return { success: true };
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `crons.daily()` helper | `crons.cron("0 8 * * *", ...)` | Project guideline | Must use cron syntax — the helper is forbidden by this project's Convex AI guidelines |
| React Email templates | Plain HTML strings | D-14 decision | No `react-email` package needed; inline template functions suffice for 2 emails |
| Resend `^3.x` (STACK.md) | Resend `6.10.0` (current) | Training data was stale | Install `resend@6.10.0` — the `^3.x` reference in STACK.md is outdated |

**Deprecated/outdated:**
- `@react-email/components` and `react-email` listed in STACK.md as additions: NOT needed for this phase per D-14 (plain HTML chosen). Do not install.

---

## Open Questions

1. **Cron scan with `by_user` index requires a userId**
   - What we know: `dispute_letters.by_user` index requires a userId to query. There is no global "all sent letters" index.
   - What's unclear: For this single-user app, there is only one userId in the system. The cron could hardcode the lookup OR query the `users` table first to get all userIds.
   - Recommendation: Query the `users` table (`.collect()` — only 1 record) to get all userIds, then loop. This makes the scan correct if a second user is ever added.

2. **`CONVEX_SITE_URL` for tracker link in emails**
   - What we know: Emails need a link to the tracker page. The domain depends on deployment.
   - What's unclear: Which env var holds the frontend URL in Convex action context?
   - Recommendation: Use `process.env.CONVEX_SITE_URL` (already in auth.config.ts) as a base, or add a dedicated `FRONTEND_URL` Convex env var. Flag for the implementer to verify which is available.

3. **`letterType` filter in cron scan**
   - What we know: Phase 6 added `letterType` field (optional) — initial letters have no `letterType` or `letterType = "initial"`. Demand/escalation letters should NOT trigger the day-25/31 reminders.
   - What's unclear: Should the scan skip letters with `letterType = "demand"` or `"escalation"`?
   - Recommendation: Yes — filter to `letterType === "initial" || letterType === undefined` to avoid sending reminder emails for demand/escalation letters.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|---------|
| `resend` npm package | sendReminderEmail action | Not yet installed | — | Install via `npm install resend` |
| Resend API key | Email delivery | Not confirmed | — | Must create Resend account + get API key |
| Resend verified domain | Production delivery | Not confirmed | — | Use `onboarding@resend.dev` for dev/test only |
| `convex` (crons) | Scheduling | Already installed | 1.34.1 | — |
| Node.js 20+ | "use node" actions | Confirmed (platform) | darwin | — |

**Missing dependencies with no fallback:**
- Resend account + API key: must be created before any email can fire. First task in Phase 7 must be environment setup.
- Verified domain for `RESEND_FROM_EMAIL`: required for production deliverability. Unverified senders land in spam.

**Missing dependencies with fallback:**
- `resend` package not yet installed: `npm install resend` — straightforward, no conflicts.

---

## Sources

### Primary (HIGH confidence)
- `frontend/convex/_generated/ai/guidelines.md` — Project-local Convex AI guidelines. Authoritative for cron syntax rules (`crons.cron` only, never `crons.daily`), Node runtime isolation, action patterns.
- `frontend/convex/schema.ts` — Existing schema; confirms `users` table fields to extend, `dispute_letters.sentAt` field availability.
- `frontend/convex/letters.ts` — Confirmed `getSentLetters` query pattern and `deadline` field; confirmed `sentAt` is stored as Unix ms.
- `frontend/convex/bureauResponses.ts` — Confirmed `getResponseForItem` query; `by_dispute_item` index available.
- `frontend/convex/users.ts` — Confirmed `updateProfile` mutation pattern; `getAuthUserId` import pattern.
- `frontend/app/(protected)/profile/page.tsx` — Confirmed existing form structure for preferences UI extension.
- https://docs.convex.dev/scheduling/cron-jobs — Convex cron API: `cronJobs()`, `crons.cron()`, `crons.daily()` (but project guideline overrides — use `crons.cron()` only)
- https://resend.com/docs/send-with-nodejs — Resend SDK: `resend.emails.send({ from, to, subject, html })`, `{ data, error }` response pattern
- `npm view resend version` → 6.10.0 (verified 2026-04-05)

### Secondary (MEDIUM confidence)
- https://docs.convex.dev/functions/runtimes — `"use node"` file-level directive, isolation rule (actions only in Node files)
- https://docs.convex.dev/functions/internal-functions — `internalMutation` / `internalAction` + `internal.*` reference pattern

### Tertiary (LOW confidence)
- None — all critical claims verified with primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `resend` version verified via npm registry; Convex version confirmed from package.json
- Architecture: HIGH — cron syntax rule confirmed from project-local guidelines file; file isolation rule confirmed from Convex docs
- Pitfalls: HIGH — pitfalls 1-3 verified against project-local guidelines; pitfalls 4-7 verified against existing codebase patterns and PITFALLS.md

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (Resend SDK stable; Convex cron API stable)
