import { mutation, query, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
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

/**
 * Public action: generate a CFPB complaint narrative for a dispute item.
 * ESC-03 — calls FastAPI /api/complaints/generate with dispute and response context.
 *
 * Anti-pattern note: Claude API is NOT called directly from this action —
 * all AI calls live in FastAPI (D-01 architecture decision).
 *
 * Args:
 * - disputeItemId: the dispute item to complain about
 * - bureauResponseId: the bureau response with outcome context
 */
export const generateCfpbNarrative = action({
  args: {
    disputeItemId:    v.id("dispute_items"),
    bureauResponseId: v.id("bureau_responses"),
  },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // 2. FASTAPI_URL env guard
    const fastapiUrl = process.env.FASTAPI_URL;
    if (!fastapiUrl) throw new Error("FASTAPI_URL not set");

    // 3. Fetch dispute item
    const disputeItem = await ctx.runQuery(internal.disputeItems.getItem, {
      id: args.disputeItemId,
    });
    if (!disputeItem) throw new Error("Dispute item not found");
    if (disputeItem.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this dispute item");
    }

    // 4. Fetch bureau response (outcome and responseDate context)
    const bureauResponse = await ctx.runQuery(internal.bureauResponses.getResponseById, {
      id: args.bureauResponseId,
    });
    if (!bureauResponse) throw new Error("Bureau response not found");

    // 5. escalation_summary context — conservative default null when not explicitly provided.
    // The UI calling this action knows whether an escalation letter was sent.
    // Future enhancement: pass escalationLetterSentAt as optional arg to this action.
    const escalationSent = false; // conservative default

    // 6. POST to FastAPI complaints generation endpoint
    const complaintRequest = {
      bureau:                 disputeItem.bureau,
      creditor_name:          disputeItem.creditorName,
      original_dispute_reason: disputeItem.disputeReason,
      bureau_outcome:         bureauResponse.outcome,
      sent_date:              disputeItem.createdAt
        ? new Date(disputeItem.createdAt).toISOString()
        : null,
      bureau_response_date:   bureauResponse.responseDate
        ? new Date(bureauResponse.responseDate).toISOString()
        : null,
      escalation_summary:     escalationSent ? "Escalation letter sent" : null,
    };

    const response = await fetch(`${fastapiUrl}/api/complaints/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(complaintRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI error ${response.status}: ${errorText}`);
    }

    // 7. Parse narrative from response
    const data = await response.json() as { narrative: string };

    // 8. Save via saveCfpbComplaint internalMutation
    await ctx.runMutation(internal.cfpbComplaints.saveCfpbComplaint, {
      disputeItemId: args.disputeItemId,
      userId:        identity.subject,
      bureau:        disputeItem.bureau,
      narrative:     data.narrative,
    });
  },
});
