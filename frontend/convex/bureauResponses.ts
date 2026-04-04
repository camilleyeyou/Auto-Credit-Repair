import { action, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
