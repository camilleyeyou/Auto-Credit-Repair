import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Shared argument validators — reused across saveResponse and recordResponseManual
const bureauValidator = v.union(
  v.literal("experian"),
  v.literal("equifax"),
  v.literal("transunion"),
);

const outcomeValidator = v.union(
  v.literal("verified"),
  v.literal("deleted"),
  v.literal("corrected"),
  v.literal("no_response"),
  v.literal("unknown"),
);

// Maps bureau response outcome to dispute_items status update
// "no_response" and "unknown" leave status unchanged (still "sent")
function outcomeToStatus(
  outcome: "verified" | "deleted" | "corrected" | "no_response" | "unknown",
): "resolved" | "denied" | null {
  if (outcome === "deleted" || outcome === "corrected") return "resolved";
  if (outcome === "verified") return "denied";
  return null; // no_response | unknown — leave unchanged
}

/**
 * Public mutation: generate a Convex Storage upload URL for a bureau response PDF.
 * Identical pattern to generateUploadUrl in creditReports.ts.
 * Called client-side before PUT-ing the PDF to Convex Storage.
 */
export const generateResponseUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Internal mutation: record a bureau response parsed from an uploaded PDF.
 * Called by the parseResponse action (Plan 02).
 * Inserts into bureau_responses and updates dispute_items.status based on outcome.
 */
export const saveResponse = internalMutation({
  args: {
    disputeItemId: v.id("dispute_items"),
    userId:        v.string(),
    bureau:        bureauValidator,
    outcome:       outcomeValidator,
    accountName:   v.optional(v.string()),
    responseDate:  v.optional(v.number()),
    reasonCode:    v.optional(v.string()),
    storageId:     v.optional(v.id("_storage")),
    entryMethod:   v.union(v.literal("pdf_upload"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const { disputeItemId, userId, bureau, outcome, accountName, responseDate, reasonCode, storageId, entryMethod } = args;

    await ctx.db.insert("bureau_responses", {
      disputeItemId,
      userId,
      bureau,
      outcome,
      accountName,
      responseDate,
      reasonCode,
      storageId,
      recordedAt: Date.now(),
      entryMethod,
    });

    const newStatus = outcomeToStatus(outcome);
    if (newStatus !== null) {
      await ctx.db.patch(disputeItemId, { status: newStatus });
    }
  },
});

/**
 * Public mutation: manually record a bureau response without PDF upload.
 * RESP-03 manual entry path — user fills out a form with the response details.
 * Inserts into bureau_responses and updates dispute_items.status based on outcome.
 */
export const recordResponseManual = mutation({
  args: {
    disputeItemId: v.id("dispute_items"),
    bureau:        bureauValidator,
    outcome:       v.union(
      v.literal("verified"),
      v.literal("deleted"),
      v.literal("corrected"),
      v.literal("no_response"),
    ),
    accountName:  v.optional(v.string()),
    responseDate: v.optional(v.number()),
    reasonCode:   v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const { disputeItemId, bureau, outcome, accountName, responseDate, reasonCode } = args;

    await ctx.db.insert("bureau_responses", {
      disputeItemId,
      userId,
      bureau,
      outcome,
      accountName,
      responseDate,
      reasonCode,
      storageId: undefined,
      recordedAt: Date.now(),
      entryMethod: "manual",
    });

    const newStatus = outcomeToStatus(outcome);
    if (newStatus !== null) {
      await ctx.db.patch(disputeItemId, { status: newStatus });
    }
  },
});

/**
 * Public query: return the most recent bureau_responses record for a dispute item.
 * Auth-guarded: verifies the requesting user owns the response record.
 * Returns null if no response has been recorded yet.
 */
export const getResponseForItem = query({
  args: { disputeItemId: v.id("dispute_items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const response = await ctx.db
      .query("bureau_responses")
      .withIndex("by_dispute_item", (q) =>
        q.eq("disputeItemId", args.disputeItemId),
      )
      .order("desc")
      .first();

    if (!response) return null;

    // Auth check: verify requesting user owns this record
    if (response.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this response record");
    }

    return response;
  },
});

/**
 * Public query: return all bureau_responses for the authenticated user.
 * Ordered by recordedAt descending (most recent first).
 * Used by the UI to show response history.
 */
export const getResponsesForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db
      .query("bureau_responses")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

/**
 * Internal query: fetch a single bureau_response by ID.
 * Used by generateEscalationLetter and generateCfpbNarrative actions.
 */
export const getResponseById = internalQuery({
  args: { id: v.id("bureau_responses") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

/**
 * Public action: parse an uploaded bureau response PDF and save the result.
 * RESP-01 PDF parsing path.
 *
 * Flow:
 * 1. Auth check
 * 2. Null-check Convex Storage URL (Pitfall 3)
 * 3. FASTAPI_URL env guard
 * 4. POST to FastAPI /api/responses/parse
 * 5. Throw on "unknown" outcome (surface to UI for manual entry)
 * 6. Save via saveResponse internalMutation
 */
export const parseResponse = action({
  args: {
    storageId:     v.id("_storage"),
    disputeItemId: v.id("dispute_items"),
    bureau:        v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // 2. Storage URL null check (Pitfall 3 — MUST null-check before using)
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (fileUrl === null) {
      throw new Error("Storage URL not found — file may be missing");
    }

    // 3. FASTAPI_URL env guard
    const fastapiUrl = process.env.FASTAPI_URL;
    if (!fastapiUrl) throw new Error("FASTAPI_URL not set");

    // 4. POST to FastAPI response parsing endpoint
    const response = await fetch(`${fastapiUrl}/api/responses/parse`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ pdf_url: fileUrl, bureau: args.bureau }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI error ${response.status}: ${errorText}`);
    }

    // 5. Parse response
    const parsed = await response.json() as {
      outcome:        string;
      account_name?:  string;
      response_date?: string;
      reason_code?:   string;
    };

    // Throw on "unknown" — surface to UI rather than storing a broken record (Pitfall 1)
    if (parsed.outcome === "unknown") {
      throw new Error(
        "Outcome could not be determined — please use manual entry",
      );
    }

    // 6. Save via saveResponse internalMutation
    await ctx.runMutation(internal.bureauResponses.saveResponse, {
      disputeItemId: args.disputeItemId,
      userId:        identity.subject,
      bureau:        args.bureau,
      outcome:       parsed.outcome as "verified" | "deleted" | "corrected" | "no_response" | "unknown",
      accountName:   parsed.account_name,
      responseDate:  parsed.response_date
        ? new Date(parsed.response_date).getTime()
        : undefined,
      reasonCode:    parsed.reason_code,
      storageId:     args.storageId,
      entryMethod:   "pdf_upload",
    });
  },
});
