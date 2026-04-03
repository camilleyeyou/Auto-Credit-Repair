import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Generate a Convex storage upload URL for direct browser upload.
 * Called client-side before PUT-ing the PDF file to Convex storage.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save a newly uploaded credit report record to the database.
 * Sets initial parseStatus to "uploaded".
 * Returns the inserted document ID (used to call parseReport).
 */
export const saveReport = mutation({
  args: {
    storageId: v.id("_storage"),
    bureau: v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const reportId = await ctx.db.insert("credit_reports", {
      userId: identity.subject,
      bureau: args.bureau,
      storageId: args.storageId,
      uploadedAt: Date.now(),
      parseStatus: "uploaded",
    });
    return reportId;
  },
});

/**
 * Internal query: fetch a single credit report by ID.
 * Throws if the report is not found.
 */
export const getReport = internalQuery({
  args: { reportId: v.id("credit_reports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Report not found");
    return report;
  },
});

/**
 * Internal mutation: update the parseStatus of a report.
 * Optionally stores an error/warning message (for failed or image_only).
 */
export const setParseStatus = internalMutation({
  args: {
    reportId: v.id("credit_reports"),
    status: v.union(
      v.literal("parsing"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("image_only")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      parseStatus: args.status,
      ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
    });
  },
});

/**
 * Internal mutation: write parsed data back to the report record.
 * Sets parseStatus to "done" and stores structured data from FastAPI.
 */
export const saveParsedData = internalMutation({
  args: {
    reportId: v.id("credit_reports"),
    parsedData: v.any(),
    rawText: v.optional(v.string()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      parseStatus: "done",
      parsedData: args.parsedData,
      rawText: args.rawText,
      confidence: args.confidence,
    });
  },
});

/**
 * Public action: orchestrates the full upload-to-parse pipeline.
 * 1. Gets the report record (internal query)
 * 2. Resolves the storage URL (Pitfall 2: null check)
 * 3. Sets status to "parsing"
 * 4. POSTs to FastAPI /api/reports/parse (Pitfall 5: FASTAPI_URL env guard)
 * 5. Handles: FastAPI error, image-only PDF, successful parse, network failure
 *
 * No "use node" directive — Convex runtime fetch is sufficient (Pitfall 3).
 */
export const parseReport = action({
  args: { reportId: v.id("credit_reports") },
  handler: async (ctx, args) => {
    // Step 1: Get the report record
    const report = await ctx.runQuery(internal.creditReports.getReport, {
      reportId: args.reportId,
    });

    // Step 2: Resolve the Convex storage URL (Pitfall 2 — null check)
    const fileUrl = await ctx.storage.getUrl(report.storageId);
    if (fileUrl === null) {
      await ctx.runMutation(internal.creditReports.setParseStatus, {
        reportId: args.reportId,
        status: "failed",
        errorMessage: "Storage URL not found — file may be missing",
      });
      return;
    }

    // Step 3: Mark as parsing
    await ctx.runMutation(internal.creditReports.setParseStatus, {
      reportId: args.reportId,
      status: "parsing",
    });

    // Step 4–10: Call FastAPI and handle all outcomes
    try {
      // Pitfall 5: Guard for missing FASTAPI_URL env var
      const fastapiUrl = process.env.FASTAPI_URL;
      if (!fastapiUrl) {
        throw new Error("FASTAPI_URL environment variable not set in Convex");
      }

      // Step 5: POST to FastAPI parse endpoint
      const response = await fetch(fastapiUrl + "/api/reports/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bureau: report.bureau, pdf_url: fileUrl }),
      });

      // Step 6: Handle FastAPI HTTP error
      if (!response.ok) {
        const errorText = await response.text();
        await ctx.runMutation(internal.creditReports.setParseStatus, {
          reportId: args.reportId,
          status: "failed",
          errorMessage: `FastAPI error ${response.status}: ${errorText}`,
        });
        return;
      }

      // Step 7: Parse response JSON
      const parsed = await response.json();

      // Step 8: Handle image-only PDF (scanned document — D-17)
      if (parsed.parse_status === "image_only") {
        await ctx.runMutation(internal.creditReports.setParseStatus, {
          reportId: args.reportId,
          status: "image_only",
          errorMessage:
            "This PDF appears to be image-only (scanned). Please upload a text-based PDF from annualcreditreport.com.",
        });
        return;
      }

      // Step 9: Save parsed data (sets parseStatus to "done")
      await ctx.runMutation(internal.creditReports.saveParsedData, {
        reportId: args.reportId,
        parsedData: parsed,
        rawText: parsed.raw_text ?? undefined,
        confidence: parsed.confidence ?? undefined,
      });
    } catch (err) {
      // Step 10: Catch-all for network failures and thrown errors
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error during parsing";
      await ctx.runMutation(internal.creditReports.setParseStatus, {
        reportId: args.reportId,
        status: "failed",
        errorMessage,
      });
    }
  },
});

/**
 * List all credit reports for the currently authenticated user.
 * Returns documents in insertion order (most recent last — use uploadedAt for sorting UI-side).
 */
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.db
      .query("credit_reports")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});
