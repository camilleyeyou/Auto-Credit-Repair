import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation: save AI-analyzed dispute items for a report.
 * Idempotent: deletes any existing items for the report before inserting new ones.
 * Called by the analyzeReport action (Plan 03-03).
 */
export const saveDisputeItems = internalMutation({
  args: {
    reportId: v.id("credit_reports"),
    userId: v.string(),
    bureau: v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
    items: v.array(
      v.object({
        itemType:           v.string(),
        creditorName:       v.string(),
        accountNumberLast4: v.optional(v.string()),
        description:        v.string(),
        disputeReason:      v.string(),
        fcraSection:        v.string(),
        fcraSectionTitle:   v.string(),
        aiConfidence:       v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Idempotency: remove existing items for this report before re-inserting
    const existing = await ctx.db
      .query("dispute_items")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // Insert each new item with server-side defaults
    for (const item of args.items) {
      await ctx.db.insert("dispute_items", {
        reportId:           args.reportId,
        userId:             args.userId,
        bureau:             args.bureau,
        itemType:           item.itemType,
        creditorName:       item.creditorName,
        accountNumberLast4: item.accountNumberLast4,
        description:        item.description,
        disputeReason:      item.disputeReason,
        fcraSection:        item.fcraSection,
        fcraSectionTitle:   item.fcraSectionTitle,
        aiConfidence:       item.aiConfidence,
        status:             "pending_review",
        createdAt:          Date.now(),
      });
    }
  },
});

/**
 * Public mutation: update the status of a single dispute item.
 * Accepts only "approved" or "skipped" — user review decisions (D-18, D-22).
 * Auth-guarded: only the item owner may change its status.
 */
export const updateDisputeStatus = mutation({
  args: {
    disputeId: v.id("dispute_items"),
    status: v.union(v.literal("approved"), v.literal("skipped")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.disputeId);
    if (!item) throw new Error("Dispute item not found");
    if (item.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this dispute item");
    }

    await ctx.db.patch(args.disputeId, { status: args.status });
  },
});

/**
 * Public query: list all dispute items for the authenticated user.
 * Returns items ordered by createdAt ascending (D-19, DISP-01).
 */
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db
      .query("dispute_items")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("asc")
      .collect();
  },
});

/**
 * Internal mutation: mark a dispute item as letter_generated.
 * Called by the generateLetters action after a letter is stored (D-26).
 */
export const setLetterGenerated = internalMutation({
  args: { disputeId: v.id("dispute_items") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.disputeId, { status: "letter_generated" });
  },
});

/**
 * Public query: list all dispute items for a specific credit report.
 * Auth-guarded: verifies the requesting user owns the report (D-19).
 */
export const listByReport = query({
  args: {
    reportId: v.id("credit_reports"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Ownership check: verify user owns the report
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Report not found");
    if (report.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this report");
    }

    return await ctx.db
      .query("dispute_items")
      .withIndex("by_report", (q) => q.eq("reportId", args.reportId))
      .order("asc")
      .collect();
  },
});

/**
 * Internal query: fetch a single dispute_items record by ID.
 * Used by generateDemandLetter, generateEscalationLetter, and generateCfpbNarrative actions.
 */
export const getItem = internalQuery({
  args: { id: v.id("dispute_items") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});
