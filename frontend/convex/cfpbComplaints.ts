import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Shared validators
const bureauValidator = v.union(
  v.literal("experian"),
  v.literal("equifax"),
  v.literal("transunion"),
);

const portalStatusValidator = v.union(
  v.literal("draft"),
  v.literal("filed"),
  v.literal("response_received"),
  v.literal("closed"),
);

/**
 * Internal mutation: create a CFPB complaint record after narrative generation.
 * Called by the generateCfpbNarrative action (Plan 02).
 * Sets initial portalStatus to "draft".
 */
export const saveCfpbComplaint = internalMutation({
  args: {
    disputeItemId: v.id("dispute_items"),
    userId:        v.string(),
    bureau:        bureauValidator,
    narrative:     v.string(),
  },
  handler: async (ctx, args) => {
    const { disputeItemId, userId, bureau, narrative } = args;

    await ctx.db.insert("cfpb_complaints", {
      disputeItemId,
      userId,
      bureau,
      narrative,
      generatedAt: Date.now(),
      portalStatus: "draft",
    });
  },
});

/**
 * Public query: return the most recent cfpb_complaints record for a dispute item.
 * Auth-guarded: verifies the requesting user owns the complaint record.
 * Returns null if no complaint has been generated yet.
 */
export const getCfpbComplaint = query({
  args: { disputeItemId: v.id("dispute_items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const complaint = await ctx.db
      .query("cfpb_complaints")
      .withIndex("by_dispute_item", (q) =>
        q.eq("disputeItemId", args.disputeItemId),
      )
      .order("desc")
      .first();

    if (!complaint) return null;

    // Auth check: verify requesting user owns this record
    if (complaint.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this complaint record");
    }

    return complaint;
  },
});

/**
 * Public mutation: update the CFPB portal filing status for a complaint.
 * ESC-04 manual tracking — user updates status after filing on consumerfinance.gov/complaint/.
 * Auth-guarded and ownership-verified before patching.
 */
export const updateCfpbStatus = mutation({
  args: {
    complaintId:         v.id("cfpb_complaints"),
    portalStatus:        portalStatusValidator,
    filedAt:             v.optional(v.number()),
    companyResponseDate: v.optional(v.number()),
    closedDate:          v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    if (complaint.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this complaint record");
    }

    const { complaintId, portalStatus, filedAt, companyResponseDate, closedDate } = args;

    await ctx.db.patch(complaintId, {
      portalStatus,
      filedAt,
      companyResponseDate,
      closedDate,
    });
  },
});

/**
 * Public query: return all cfpb_complaints for the authenticated user.
 * Ordered by generatedAt descending (most recent first).
 */
export const getCfpbComplaintsForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db
      .query("cfpb_complaints")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});
