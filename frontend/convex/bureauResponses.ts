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

/**
 * Public action: generate a demand letter for a dispute item with no response after 30+ days.
 * ESC-01 — calls FastAPI /api/letters/generate with letter_type="demand".
 * 
 * Args:
 * - disputeItemId: the dispute item that was sent but not responded to
 * - letterId: the original dispute letter (provides sentAt date for context)
 */
export const generateDemandLetter = action({
  args: {
    disputeItemId: v.id("dispute_items"),
    letterId:      v.id("dispute_letters"),
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

    // 4. Fetch user profile (letter header fields)
    const userProfile = await ctx.runQuery(internal.letters.getUserProfile, {
      userId: identity.subject,
    });
    if (
      !userProfile?.fullName ||
      !userProfile?.streetAddress ||
      !userProfile?.city ||
      !userProfile?.state ||
      !userProfile?.zip
    ) {
      throw new Error(
        "Profile incomplete — add your name and mailing address in Profile before generating letters",
      );
    }

    // 5. Fetch original letter for sentAt date
    const originalLetter = await ctx.runQuery(internal.letters.getLetterById, {
      id: args.letterId,
    });

    // 6. POST to FastAPI letter generation endpoint with letter_type="demand"
    const letterRequest = {
      bureau:               disputeItem.bureau,
      creditor_name:        disputeItem.creditorName,
      account_number_last4: disputeItem.accountNumberLast4 ?? undefined,
      dispute_reason:       disputeItem.disputeReason,
      fcra_section:         disputeItem.fcraSection,
      fcra_section_title:   disputeItem.fcraSectionTitle,
      full_name:            userProfile.fullName,
      street_address:       userProfile.streetAddress,
      city:                 userProfile.city,
      state:                userProfile.state,
      zip_code:             userProfile.zip,
      letter_type:          "demand" as const,
      original_sent_date:   originalLetter?.sentAt
        ? new Date(originalLetter.sentAt).toISOString()
        : undefined,
    };

    const response = await fetch(`${fastapiUrl}/api/letters/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(letterRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI error ${response.status}: ${errorText}`);
    }

    // 7. Decode PDF and store in Convex Storage
    const result = await response.json() as { letter_html: string; pdf_base64: string };
    const pdfBytes = Uint8Array.from(atob(result.pdf_base64), (c) => c.charCodeAt(0));
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);

    // 8. Save letter with letterType="demand"
    await ctx.runMutation(internal.letters.saveLetter, {
      disputeItemId: args.disputeItemId,
      userId:        identity.subject,
      bureau:        disputeItem.bureau,
      letterContent: result.letter_html,
      storageId,
      letterType:    "demand",
    });
  },
});

/**
 * Public action: generate an escalation letter for a dispute item that was verified/denied.
 * ESC-02 — calls FastAPI /api/letters/generate with letter_type="escalation".
 *
 * Args:
 * - disputeItemId: the dispute item with outcome "verified" (bureau denied removal)
 * - bureauResponseId: the bureau response record (provides outcome/reasonCode context)
 */
/**
 * Public action: generate a Method of Verification (MOV) letter for a dispute item
 * the bureau verified. Per FCRA § 611(a)(6)(B)(iii) and § 611(a)(7), the consumer
 * has the right to demand the bureau describe the procedure used to verify,
 * including names/addresses/phones of furnishers contacted, within 15 days.
 *
 * Args:
 * - disputeItemId: dispute item with outcome "verified"
 * - bureauResponseId: bureau response record (provides verification context)
 */
export const generateMovLetter = action({
  args: {
    disputeItemId:    v.id("dispute_items"),
    bureauResponseId: v.id("bureau_responses"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const fastapiUrl = process.env.FASTAPI_URL;
    if (!fastapiUrl) throw new Error("FASTAPI_URL not set");

    const disputeItem = await ctx.runQuery(internal.disputeItems.getItem, {
      id: args.disputeItemId,
    });
    if (!disputeItem) throw new Error("Dispute item not found");
    if (disputeItem.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this dispute item");
    }

    const userProfile = await ctx.runQuery(internal.letters.getUserProfile, {
      userId: identity.subject,
    });
    if (
      !userProfile?.fullName ||
      !userProfile?.streetAddress ||
      !userProfile?.city ||
      !userProfile?.state ||
      !userProfile?.zip
    ) {
      throw new Error(
        "Profile incomplete — add your name and mailing address in Profile before generating letters",
      );
    }

    const bureauResponse = await ctx.runQuery(internal.bureauResponses.getResponseById, {
      id: args.bureauResponseId,
    });
    if (!bureauResponse) throw new Error("Bureau response not found");

    const letterRequest = {
      bureau:                disputeItem.bureau,
      creditor_name:         disputeItem.creditorName,
      account_number_last4:  disputeItem.accountNumberLast4 ?? undefined,
      dispute_reason:        disputeItem.disputeReason,
      fcra_section:          disputeItem.fcraSection,
      fcra_section_title:    disputeItem.fcraSectionTitle,
      full_name:             userProfile.fullName,
      street_address:        userProfile.streetAddress,
      city:                  userProfile.city,
      state:                 userProfile.state,
      zip_code:              userProfile.zip,
      letter_type:           "mov" as const,
      original_sent_date:    bureauResponse.responseDate
        ? new Date(bureauResponse.responseDate).toISOString()
        : undefined,
      bureau_outcome_summary: bureauResponse.reasonCode ?? bureauResponse.outcome,
    };

    const response = await fetch(`${fastapiUrl}/api/letters/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(letterRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as { letter_html: string; pdf_base64: string };
    const pdfBytes = Uint8Array.from(atob(result.pdf_base64), (c) => c.charCodeAt(0));
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internal.letters.saveLetter, {
      disputeItemId: args.disputeItemId,
      userId:        identity.subject,
      bureau:        disputeItem.bureau,
      letterContent: result.letter_html,
      storageId,
      letterType:    "mov",
    });
  },
});

export const generateEscalationLetter = action({
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

    // 4. Fetch user profile (letter header fields)
    const userProfile = await ctx.runQuery(internal.letters.getUserProfile, {
      userId: identity.subject,
    });
    if (
      !userProfile?.fullName ||
      !userProfile?.streetAddress ||
      !userProfile?.city ||
      !userProfile?.state ||
      !userProfile?.zip
    ) {
      throw new Error(
        "Profile incomplete — add your name and mailing address in Profile before generating letters",
      );
    }

    // 5. Fetch bureau response (outcome context for escalation)
    const bureauResponse = await ctx.runQuery(internal.bureauResponses.getResponseById, {
      id: args.bureauResponseId,
    });
    if (!bureauResponse) throw new Error("Bureau response not found");

    // 6. POST to FastAPI letter generation endpoint with letter_type="escalation"
    const letterRequest = {
      bureau:                disputeItem.bureau,
      creditor_name:         disputeItem.creditorName,
      account_number_last4:  disputeItem.accountNumberLast4 ?? undefined,
      dispute_reason:        disputeItem.disputeReason,
      fcra_section:          disputeItem.fcraSection,
      fcra_section_title:    disputeItem.fcraSectionTitle,
      full_name:             userProfile.fullName,
      street_address:        userProfile.streetAddress,
      city:                  userProfile.city,
      state:                 userProfile.state,
      zip_code:              userProfile.zip,
      letter_type:           "escalation" as const,
      bureau_outcome_summary: bureauResponse.reasonCode ?? bureauResponse.outcome,
    };

    const response = await fetch(`${fastapiUrl}/api/letters/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(letterRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI error ${response.status}: ${errorText}`);
    }

    // 7. Decode PDF and store in Convex Storage
    const result = await response.json() as { letter_html: string; pdf_base64: string };
    const pdfBytes = Uint8Array.from(atob(result.pdf_base64), (c) => c.charCodeAt(0));
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);

    // 8. Save letter with letterType="escalation"
    await ctx.runMutation(internal.letters.saveLetter, {
      disputeItemId: args.disputeItemId,
      userId:        identity.subject,
      bureau:        disputeItem.bureau,
      letterContent: result.letter_html,
      storageId,
      letterType:    "escalation",
    });
  },
});
