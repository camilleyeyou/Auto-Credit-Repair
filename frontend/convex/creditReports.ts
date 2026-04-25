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
 * Internal mutation: update the analysisStatus of a report.
 * Called by analyzeReport action to track AI pipeline progress.
 */
export const setAnalysisStatus = internalMutation({
  args: {
    reportId: v.id("credit_reports"),
    status: v.union(
      v.literal("not_analyzed"),
      v.literal("analyzing"),
      v.literal("analyzed"),
      v.literal("analysis_failed"),
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      analysisStatus: args.status,
      analysisErrorMessage: args.errorMessage,
    });
  },
});

/**
 * Public action: orchestrates the full AI analysis pipeline.
 * 1. Gets the parsed report (internal query)
 * 2. Guards: only analyze reports with parseStatus === "done"
 * 3. Guards: skip if analysisStatus is already "analyzed" (idempotency — per D-28, Pitfall 4)
 * 4. Marks report as "analyzing"
 * 5. Calls FastAPI POST /api/reports/{reportId}/analyze
 * 6. Stores returned dispute items via saveDisputeItems
 * 7. Marks report as "analyzed"
 * Outer catch sets "analysis_failed" with errorMessage — report never stuck.
 */
export const analyzeReport = action({
  args: { reportId: v.id("credit_reports") },
  handler: async (ctx, args) => {
    // 1. Fetch report
    const report = await ctx.runQuery(internal.creditReports.getReport, {
      reportId: args.reportId,
    });
    if (!report) {
      throw new Error(`Report ${args.reportId} not found`);
    }

    // 2. Guard: only analyze fully parsed reports
    if (report.parseStatus !== "done") {
      throw new Error("Report must be fully parsed before analysis");
    }

    // 3. Idempotency guard: skip if already analyzed
    if (report.analysisStatus === "analyzed") {
      return; // Already done — no re-analysis
    }

    // 4. Mark as analyzing
    await ctx.runMutation(internal.creditReports.setAnalysisStatus, {
      reportId: args.reportId,
      status: "analyzing",
    });

    // 5-7. Call FastAPI, store results, mark done — outer catch sets analysis_failed
    try {
      const fastapiUrl = process.env.FASTAPI_URL;
      if (!fastapiUrl) throw new Error("FASTAPI_URL not set");

      const response = await fetch(
        `${fastapiUrl}/api/reports/${args.reportId}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsed_data: report.parsedData }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FastAPI error ${response.status}: ${errorText}`);
      }

      const result = await response.json() as {
        dispute_items: Array<{
          creditor_name: string;
          account_number_last4?: string;
          item_type: string;
          description: string;
          dispute_reason: string;
          fcra_section: string;
          fcra_section_title: string;
          fcra_section_usc: string;
          ai_confidence: number;
          citation_validated: boolean;
        }>;
        reused: boolean;
      };

      // Map snake_case FastAPI response to camelCase Convex schema fields.
      // Strip null values from optional fields — Convex v.optional() rejects null
      // (only accepts undefined/absent). Pydantic serializes Optional[str] as null.
      const itemsForConvex = result.dispute_items.map((item) => ({
        itemType: item.item_type,
        creditorName: item.creditor_name,
        ...(item.account_number_last4
          ? { accountNumberLast4: item.account_number_last4 }
          : {}),
        description: item.description,
        disputeReason: item.dispute_reason,
        fcraSection: item.fcra_section,
        fcraSectionTitle: item.fcra_section_title,
        aiConfidence: item.ai_confidence,
      }));

      await ctx.runMutation(internal.disputeItems.saveDisputeItems, {
        reportId: args.reportId,
        userId: report.userId,
        bureau: report.bureau,
        items: itemsForConvex,
      });

      await ctx.runMutation(internal.creditReports.setAnalysisStatus, {
        reportId: args.reportId,
        status: "analyzed",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown analysis error";
      await ctx.runMutation(internal.creditReports.setAnalysisStatus, {
        reportId: args.reportId,
        status: "analysis_failed",
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
