import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// FCRA USC mapping — mirrors backend/services/ai_analyzer.py FCRA_LIBRARY
const FCRA_USC: Record<string, string> = {
  "611": "15 U.S.C. § 1681i",
  "623": "15 U.S.C. § 1681s-2",
  "605": "15 U.S.C. § 1681c",
  "609": "15 U.S.C. § 1681g",
  "612": "15 U.S.C. § 1681j",
};

/**
 * Internal query: fetch the user profile document for letter header fields.
 * Uses identity.subject (Convex user ID) to look up the users table.
 */
export const getUserProfile = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId as Id<"users">);
  },
});

/**
 * Internal query: fetch a single dispute_letters record by ID.
 * Used by generateDemandLetter to retrieve the original letter's sentAt date.
 */
export const getLetterById = internalQuery({
  args: { id: v.id("dispute_letters") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

/**
 * Internal query: fetch all approved dispute items for the user that
 * do not yet have a corresponding dispute_letters record (D-27 idempotency).
 */
export const getApprovedWithoutLetters = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get all approved dispute items for this user
    const approvedItems = await ctx.db
      .query("dispute_items")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // For each item, check if a letter already exists
    const itemsWithoutLetters = [];
    for (const item of approvedItems) {
      const existingLetter = await ctx.db
        .query("dispute_letters")
        .withIndex("by_dispute_item", (q) => q.eq("disputeItemId", item._id))
        .first();
      if (!existingLetter) {
        itemsWithoutLetters.push(item);
      }
    }

    return itemsWithoutLetters;
  },
});

/**
 * Internal mutation: insert a new dispute_letters record after PDF generation.
 * Called by the generateLetters action after storing the PDF in Convex Storage.
 */
export const saveLetter = internalMutation({
  args: {
    disputeItemId: v.id("dispute_items"),
    userId:        v.string(),
    bureau:        v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
    letterContent: v.string(),
    storageId:     v.id("_storage"),
    letterType:    v.optional(v.union(
      v.literal("initial"),
      v.literal("demand"),
      v.literal("escalation"),
      v.literal("mov"),
      v.literal("validation"),
      v.literal("goodwill"),
      v.literal("pay_for_delete"),
      v.literal("identity_theft_block"),
    )),
    collectorName:    v.optional(v.string()),
    collectorAddress: v.optional(v.string()),
    offerAmount:      v.optional(v.string()),
    ftcReportNumber:  v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("dispute_letters", {
      disputeItemId:    args.disputeItemId,
      userId:           args.userId,
      bureau:           args.bureau,
      letterContent:    args.letterContent,
      storageId:        args.storageId,
      generatedAt:      Date.now(),
      letterType:       args.letterType,
      collectorName:    args.collectorName,
      collectorAddress: args.collectorAddress,
      offerAmount:      args.offerAmount,
      ftcReportNumber:  args.ftcReportNumber,
    });
  },
});

/**
 * Public action: batch-generate dispute letters for all approved items.
 * Mirrors analyzeReport pattern exactly (D-12 through D-16, D-26, D-27).
 *
 * Flow:
 * 1. Auth check
 * 2. Fetch approved items without letters (D-27 idempotency)
 * 3. Fetch user profile — guard against missing fields (D-11)
 * 4. Guard FASTAPI_URL env var
 * 5. For each item: try/catch — one failure does not abort batch (Pitfall 6)
 *    a. POST to FastAPI /api/letters/generate
 *    b. Decode base64 PDF, store in Convex Storage
 *    c. Insert dispute_letters record
 *    d. Update dispute item status to letter_generated (D-26)
 */
export const generateLetters = action({
  args: {},
  handler: async (ctx) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // 2. Fetch approved items without letters
    const approvedItems = await ctx.runQuery(
      internal.letters.getApprovedWithoutLetters,
      { userId: identity.subject },
    );

    if (approvedItems.length === 0) {
      return; // Nothing to generate
    }

    // 3. Fetch user profile
    const userProfile = await ctx.runQuery(internal.letters.getUserProfile, {
      userId: identity.subject,
    });

    // Profile guard: all fields required for letter header (D-11)
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

    // 4. FASTAPI_URL guard
    const fastapiUrl = process.env.FASTAPI_URL;
    if (!fastapiUrl) throw new Error("FASTAPI_URL not set");

    // 5. Loop over approved items — per-item try/catch (Pitfall 6)
    for (const item of approvedItems) {
      try {
        // 5a. Build LetterRequest body mapping Convex fields to FastAPI snake_case
        const letterRequest = {
          bureau:               item.bureau,
          creditor_name:        item.creditorName,
          account_number_last4: item.accountNumberLast4 ?? undefined,
          dispute_reason:       item.disputeReason,
          fcra_section:         item.fcraSection,
          fcra_section_title:   item.fcraSectionTitle,
          fcra_section_usc:     FCRA_USC[item.fcraSection] ?? "",
          full_name:            userProfile.fullName,
          street_address:       userProfile.streetAddress,
          city:                 userProfile.city,
          state:                userProfile.state,
          zip_code:             userProfile.zip,
        };

        // 5b. POST to FastAPI letter generation endpoint
        const response = await fetch(`${fastapiUrl}/api/letters/generate`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(letterRequest),
        });

        // 5c. Skip item on HTTP error — log and continue
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Letter generation failed for item",
            item._id,
            `FastAPI error ${response.status}: ${errorText}`,
          );
          continue;
        }

        // 5d. Parse response
        const result = await response.json() as {
          letter_html: string;
          pdf_base64: string;
        };

        // 5e. Decode base64 PDF bytes
        const pdfBytes = Uint8Array.from(
          atob(result.pdf_base64),
          (c) => c.charCodeAt(0),
        );

        // 5f. Store PDF in Convex Storage (never store bytes in document — Pitfall 4)
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const storageId = await ctx.storage.store(blob);

        // 5g. Insert dispute_letters record
        await ctx.runMutation(internal.letters.saveLetter, {
          disputeItemId: item._id,
          userId:        identity.subject,
          bureau:        item.bureau,
          letterContent: result.letter_html,
          storageId,
        });

        // 5h. Update dispute item status to letter_generated (D-26)
        await ctx.runMutation(internal.disputeItems.setLetterGenerated, {
          disputeId: item._id,
        });
      } catch (err) {
        // 5i. Per-item catch — log error and continue with next item (Pitfall 6)
        console.error("Letter generation failed for item", item._id, err);
      }
    }
    // No return value — frontend uses reactive listByUser query to see new letters
  },
});

/**
 * Public query: list all dispute_letters for the authenticated user.
 * Returns documents ordered by generatedAt descending (newest first).
 */
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db
      .query("dispute_letters")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

/**
 * Public query: return a signed Convex Storage URL for a letter PDF download.
 * Auth-guarded: verifies the requesting user owns the letter.
 */
export const getLetterDownloadUrl = query({
  args: { letterId: v.id("dispute_letters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const letter = await ctx.db.get(args.letterId);
    if (!letter) throw new Error("Letter not found");
    if (letter.userId !== identity.subject) {
      throw new Error("Unauthorized: you do not own this letter");
    }

    return await ctx.storage.getUrl(letter.storageId);
  },
});

/**
 * Public mutation: mark a dispute letter as sent.
 * Updates dispute_letters with sentAt, certifiedMailNumber, and calculated deadline.
 * Updates the corresponding dispute_items record status to "sent".
 * Both patches happen in the same mutation handler (D-22, Pitfall 3).
 */
export const markAsSent = mutation({
  args: {
    letterId:            v.id("dispute_letters"),
    sentAt:              v.number(),               // Unix ms from client — the mailing date
    certifiedMailNumber: v.optional(v.string()),   // USPS certified tracking number
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const letter = await ctx.db.get(args.letterId);
    if (!letter) throw new Error("Letter not found");
    if (letter.userId !== identity.subject) throw new Error("Unauthorized");

    // Guard: prevent double-marking (Open Question 3 from RESEARCH.md)
    if (letter.sentAt !== undefined) {
      throw new Error("Letter already marked as sent");
    }

    // D-06: deadline = sentAt + 30 calendar days in ms; NOT Date.now()
    const deadline = args.sentAt + 30 * 24 * 60 * 60 * 1000;

    // D-03: update dispute_letters tracking fields
    await ctx.db.patch(args.letterId, {
      sentAt:              args.sentAt,
      certifiedMailNumber: args.certifiedMailNumber,
      deadline,
    });

    // D-04: update dispute_items status to "sent" — same handler, same transaction
    await ctx.db.patch(letter.disputeItemId, { status: "sent" as const });
  },
});

/**
 * Public query: return all sent dispute letters with their joined dispute items.
 * Filters to letters where sentAt is set. Loop-joins to get dispute_items.
 * Sorted by deadline ascending (most urgent first — D-13).
 */
export const getSentLetters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const letters = await ctx.db
      .query("dispute_letters")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("sentAt"), undefined))
      .collect();

    // Loop-join: fetch dispute_item for each letter (established pattern from getApprovedWithoutLetters)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Array<{ letter: any; item: any }> = [];
    for (const letter of letters) {
      const item = await ctx.db.get(letter.disputeItemId);
      if (item) {
        results.push({ letter, item });
      }
    }

    // Sort by deadline ascending — most urgent first (D-13)
    results.sort((a, b) => {
      const da = a.letter.deadline ?? Infinity;
      const db = b.letter.deadline ?? Infinity;
      return da - db;
    });

    return results;
  },
});

/**
 * Public query: return aggregated dashboard statistics for the authenticated user.
 * Fetches all dispute_items and dispute_letters, computes counts in JS.
 * Overdue count excludes items already resolved or denied (Pitfall 6 from RESEARCH.md).
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const allItems = await ctx.db
      .query("dispute_items")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const allLetters = await ctx.db
      .query("dispute_letters")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const now = Date.now();

    // Build a map of disputeItemId -> status for fast overdue lookup
    const itemStatusMap = new Map(allItems.map((item) => [item._id, item.status]));

    const overdue = allLetters.filter((l) => {
      if (l.deadline === undefined || l.deadline >= now) return false;
      // Overdue only when the dispute item is still "sent" (waiting, no response)
      const itemStatus = itemStatusMap.get(l.disputeItemId);
      return itemStatus === "sent";
    }).length;

    return {
      totalDisputes:     allItems.length,
      lettersGenerated:  allLetters.length,
      lettersSent:       allLetters.filter((l) => l.sentAt !== undefined).length,
      responsesReceived: allItems.filter((i) => i.status === "resolved" || i.status === "denied").length,
      resolved:          allItems.filter((i) => i.status === "resolved").length,
      overdue,
    };
  },
});

/**
 * Public query: return letters with deadlines within the next 7 days.
 * Used for the Upcoming Deadlines section on the dashboard (D-25).
 * Sorted by deadline ascending (most urgent first).
 */
export const getUpcomingDeadlines = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Fetch all sent letters for this user
    const letters = await ctx.db
      .query("dispute_letters")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.neq(q.field("sentAt"), undefined))
      .collect();

    // Loop-join and filter to upcoming (not yet past, within 7 days)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Array<{ letter: any; item: any }> = [];
    for (const letter of letters) {
      if (
        letter.deadline !== undefined &&
        letter.deadline >= now &&
        letter.deadline <= now + sevenDaysMs
      ) {
        const item = await ctx.db.get(letter.disputeItemId);
        if (item) {
          results.push({ letter, item });
        }
      }
    }

    // Sort by deadline ascending — most urgent first
    results.sort((a, b) => (a.letter.deadline ?? 0) - (b.letter.deadline ?? 0));

    return results;
  },
});
