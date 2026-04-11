import { internalMutation, query, httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Bureau validator (reused across this module)
// ---------------------------------------------------------------------------
const bureauValidator = v.optional(
  v.union(
    v.literal("experian"),
    v.literal("equifax"),
    v.literal("transunion"),
  ),
);

// ---------------------------------------------------------------------------
// Internal mutation: bulk-insert a batch of CFPB reference records.
// Called by the HTTP ingest endpoint action.
// ---------------------------------------------------------------------------
export const insertBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        cfpbComplaintId: v.string(),
        creditorName: v.string(),
        bureau: bureauValidator,
        complaintType: v.string(),
        resolutionOutcome: v.string(),
        complaintNarrative: v.optional(v.string()),
        dateReceived: v.string(),
        product: v.string(),
        issue: v.string(),
        subIssue: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const record of args.records) {
      // De-duplicate by cfpbComplaintId using index (not full table scan)
      const existing = await ctx.db
        .query("cfpb_reference_complaints")
        .withIndex("by_cfpb_id", (q) =>
          q.eq("cfpbComplaintId", record.cfpbComplaintId),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("cfpb_reference_complaints", {
          cfpbComplaintId: record.cfpbComplaintId,
          creditorName: record.creditorName,
          bureau: record.bureau ?? undefined,
          complaintType: record.complaintType,
          resolutionOutcome: record.resolutionOutcome,
          complaintNarrative: record.complaintNarrative ?? undefined,
          dateReceived: record.dateReceived,
          product: record.product,
          issue: record.issue,
          subIssue: record.subIssue ?? undefined,
        });
        inserted++;
      }
    }
    return { inserted };
  },
});

// ---------------------------------------------------------------------------
// HTTP action: receives POST /api/cfpb-ingest with { records: [...] }
// and delegates to the insertBatch internal mutation.
// ---------------------------------------------------------------------------
export const httpIngest = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const records = body.records;

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "Request body must contain a non-empty 'records' array" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (records.length > 500) {
      return new Response(
        JSON.stringify({ error: `Batch too large (${records.length}). Max 500 records per request.` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Clean records: the managed agent may send null for optional fields,
    // but Convex v.optional() expects the field to be absent, not null.
    const cleaned = records.map((r: any) => ({
      cfpbComplaintId: String(r.cfpbComplaintId ?? ""),
      creditorName: String(r.creditorName ?? ""),
      complaintType: String(r.complaintType ?? "other"),
      resolutionOutcome: String(r.resolutionOutcome ?? ""),
      dateReceived: String(r.dateReceived ?? ""),
      product: String(r.product ?? ""),
      issue: String(r.issue ?? ""),
      // Optional fields: omit if null/empty
      ...(r.bureau ? { bureau: r.bureau } : {}),
      ...(r.complaintNarrative ? { complaintNarrative: r.complaintNarrative } : {}),
      ...(r.subIssue ? { subIssue: r.subIssue } : {}),
    }));

    const result = await ctx.runMutation(
      internal.cfpbReferenceComplaints.insertBatch,
      { records: cleaned },
    );

    return new Response(
      JSON.stringify({ inserted: result.inserted, received: records.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// ---------------------------------------------------------------------------
// Public queries — used by the Claude agent during letter generation
// ---------------------------------------------------------------------------

/**
 * Full-text search complaints by creditor name.
 * Returns up to `limit` results (default 20).
 */
export const searchByCreditor = query({
  args: {
    creditorName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxResults = args.limit ?? 20;

    const results = await ctx.db
      .query("cfpb_reference_complaints")
      .withSearchIndex("search_creditor", (q) =>
        q.search("creditorName", args.creditorName),
      )
      .take(maxResults);

    return results;
  },
});

/**
 * Look up complaints by exact complaint type.
 * Useful for finding resolution patterns for a category of disputes.
 */
export const getByComplaintType = query({
  args: {
    complaintType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxResults = args.limit ?? 20;

    return await ctx.db
      .query("cfpb_reference_complaints")
      .withIndex("by_complaint_type", (q) =>
        q.eq("complaintType", args.complaintType),
      )
      .take(maxResults);
  },
});

/**
 * Search complaints by creditor name, filtered by complaint type.
 * The most targeted query — used when the agent knows both the creditor
 * and the type of issue being disputed.
 *
 * Falls back to creditor-only search if no results match both filters,
 * so the caller always gets something useful.
 */
export const searchByCreditorAndType = query({
  args: {
    creditorName: v.string(),
    complaintType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxResults = args.limit ?? 20;

    // Primary: search creditor name filtered by complaint type via narrative index
    const results = await ctx.db
      .query("cfpb_reference_complaints")
      .withSearchIndex("search_narrative", (q) =>
        q
          .search("complaintNarrative", args.creditorName)
          .eq("complaintType", args.complaintType)
          .eq("creditorName", args.creditorName),
      )
      .take(maxResults);

    // Fallback: many records have no narrative, so the search above may miss them.
    // Fall back to creditor name search without the narrative filter.
    if (results.length === 0) {
      return await ctx.db
        .query("cfpb_reference_complaints")
        .withSearchIndex("search_creditor", (q) =>
          q.search("creditorName", args.creditorName),
        )
        .take(maxResults);
    }

    return results;
  },
});

/**
 * Get complaints for a specific credit bureau.
 */
export const getByBureau = query({
  args: {
    bureau: v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxResults = args.limit ?? 20;

    return await ctx.db
      .query("cfpb_reference_complaints")
      .withIndex("by_bureau", (q) => q.eq("bureau", args.bureau))
      .take(maxResults);
  },
});

/**
 * Get aggregate stats: count of records by complaint type.
 * Samples up to 10,000 records to avoid hitting Convex query limits
 * on large datasets. Stats are approximate once the table exceeds 10k rows.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const sample = await ctx.db
      .query("cfpb_reference_complaints")
      .take(10_000);

    const byType: Record<string, number> = {};
    const byBureau: Record<string, number> = {};
    let withNarrative = 0;

    for (const doc of sample) {
      byType[doc.complaintType] = (byType[doc.complaintType] ?? 0) + 1;
      if (doc.bureau) {
        byBureau[doc.bureau] = (byBureau[doc.bureau] ?? 0) + 1;
      }
      if (doc.complaintNarrative) withNarrative++;
    }

    return {
      total: sample.length,
      withNarrative,
      byType,
      byBureau,
      isSample: sample.length === 10_000,
    };
  },
});
