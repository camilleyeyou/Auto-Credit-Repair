import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    // Required by authTables — DO NOT remove any of these
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Profile fields for dispute letter headers (per D-09, D-10)
    fullName: v.optional(v.string()),
    streetAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    // Phase 7 — email notification preferences (D-16, D-18, D-19, D-21)
    emailRemindersEnabled: v.optional(v.boolean()),  // default true when absent (D-21)
    reminderEmail: v.optional(v.string()),            // undefined → use auth email (D-19)
  }).index("email", ["email"]),
  credit_reports: defineTable({
    userId: v.string(),
    bureau: v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion")
    ),
    storageId: v.id("_storage"),
    uploadedAt: v.number(),
    parseStatus: v.union(
      v.literal("uploaded"),
      v.literal("parsing"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("image_only"),
    ),
    parsedData: v.optional(v.any()),      // structured ParsedReport JSON (D-22)
    rawText: v.optional(v.string()),       // raw text for debugging (D-22)
    errorMessage: v.optional(v.string()),  // set on failed or image_only
    confidence: v.optional(v.number()),    // 0.0–1.0 parser confidence (D-25)
    analysisStatus: v.optional(v.union(
      v.literal("not_analyzed"),
      v.literal("analyzing"),
      v.literal("analyzed"),
      v.literal("analysis_failed"),
    )),
    analysisErrorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_bureau", ["userId", "bureau"]),
  dispute_items: defineTable({
    reportId:           v.id("credit_reports"),
    userId:             v.string(),
    bureau:             v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
    itemType:           v.string(),
    creditorName:       v.string(),
    accountNumberLast4: v.optional(v.string()),
    description:        v.string(),
    disputeReason:      v.string(),
    fcraSection:        v.string(),
    fcraSectionTitle:   v.string(),
    aiConfidence:       v.number(),
    status:             v.union(
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("skipped"),
      v.literal("letter_generated"),
      v.literal("sent"),
      v.literal("resolved"),
      v.literal("denied"),
    ),
    createdAt:          v.number(),
  })
    .index("by_report", ["reportId"])
    .index("by_user",   ["userId"])
    .index("by_user_bureau", ["userId", "bureau"]),
  dispute_letters: defineTable({
    disputeItemId: v.id("dispute_items"),
    userId:        v.string(),
    bureau:        v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
    letterContent: v.string(),        // HTML string (~2-5KB) — NOT the PDF bytes
    storageId:     v.id("_storage"),  // PDF stored in Convex Storage — never in document
    generatedAt:   v.number(),
    // Phase 5 tracking fields (D-21) — all optional so existing records remain valid
    sentAt:              v.optional(v.number()),   // Unix ms — mailing date
    certifiedMailNumber: v.optional(v.string()),   // USPS tracking number
    deadline:            v.optional(v.number()),   // sentAt + 30 days in ms
    // Phase 6 — letter type for escalation tracking (backward compat — optional)
    letterType: v.optional(v.union(
      v.literal("initial"),
      v.literal("demand"),
      v.literal("escalation"),
      v.literal("mov"),                  // Method of Verification — § 1681i(a)(6)(B)(iii)
      v.literal("validation"),           // FDCPA § 1692g debt validation
      v.literal("goodwill"),             // Goodwill removal request (to creditor)
      v.literal("pay_for_delete"),       // Settlement offer in exchange for tradeline deletion
      v.literal("identity_theft_block"), // FCRA § 605B / 15 U.S.C. § 1681c-2
    )),
    // Address fields for non-bureau letters (collector, creditor)
    collectorName:    v.optional(v.string()),
    collectorAddress: v.optional(v.string()),
    // Pay-for-delete: dollar offer amount the user is making
    offerAmount:      v.optional(v.string()),
    // Identity theft: FTC IdentityTheft.gov report number or police report number
    ftcReportNumber:  v.optional(v.string()),
  })
    .index("by_user",         ["userId"])
    .index("by_dispute_item", ["disputeItemId"])
    .index("by_user_bureau",  ["userId", "bureau"]),
  bureau_responses: defineTable({
    disputeItemId:  v.id("dispute_items"),
    userId:         v.string(),
    bureau:         v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
    outcome:        v.union(
      v.literal("verified"),
      v.literal("deleted"),
      v.literal("corrected"),
      v.literal("no_response"),
      v.literal("unknown"),
    ),
    accountName:    v.optional(v.string()),
    responseDate:   v.optional(v.number()),
    reasonCode:     v.optional(v.string()),
    storageId:      v.optional(v.id("_storage")),
    recordedAt:     v.number(),
    entryMethod:    v.union(v.literal("pdf_upload"), v.literal("manual")),
  })
    .index("by_dispute_item", ["disputeItemId"])
    .index("by_user",         ["userId"])
    .index("by_user_bureau",  ["userId", "bureau"]),
  cfpb_complaints: defineTable({
    disputeItemId:       v.id("dispute_items"),
    userId:              v.string(),
    bureau:              v.union(
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    ),
    narrative:           v.string(),
    generatedAt:         v.number(),
    portalStatus:        v.optional(v.union(
      v.literal("draft"),
      v.literal("filed"),
      v.literal("response_received"),
      v.literal("closed"),
    )),
    filedAt:             v.optional(v.number()),
    companyResponseDate: v.optional(v.number()),
    closedDate:          v.optional(v.number()),
  })
    .index("by_dispute_item", ["disputeItemId"])
    .index("by_user",         ["userId"]),
  // CFPB public complaint reference data (populated by backend/scripts/cfpb_pipeline.py)
  cfpb_reference_complaints: defineTable({
    cfpbComplaintId:    v.string(),           // original CFPB complaint ID
    creditorName:       v.string(),           // company name
    bureau:             v.optional(v.union(   // detected bureau, if applicable
      v.literal("experian"),
      v.literal("equifax"),
      v.literal("transunion"),
    )),
    complaintType:      v.string(),           // normalized type (e.g. "inaccurate_information")
    resolutionOutcome:  v.string(),           // e.g. "Closed with explanation"
    complaintNarrative: v.optional(v.string()), // consumer narrative (when available)
    dateReceived:       v.string(),           // "YYYY-MM-DD"
    product:            v.string(),           // original CFPB product field
    issue:              v.string(),           // original CFPB issue field
    subIssue:           v.optional(v.string()),
  })
    .index("by_cfpb_id", ["cfpbComplaintId"])
    .index("by_creditor", ["creditorName"])
    .index("by_complaint_type", ["complaintType"])
    .index("by_bureau", ["bureau"])
    .searchIndex("search_creditor", { searchField: "creditorName" })
    .searchIndex("search_narrative", {
      searchField: "complaintNarrative",
      filterFields: ["complaintType", "creditorName"],
    }),
  // Phase 7 — cron de-duplication log (D-22, D-23)
  reminder_log: defineTable({
    letterId:     v.id("dispute_letters"),
    userId:       v.string(),
    reminderType: v.union(v.literal("day25"), v.literal("day31")),
    sentAt:       v.number(),  // Unix ms — when reminder was dispatched
  }).index("by_letter_and_type", ["letterId", "reminderType"]),
});
