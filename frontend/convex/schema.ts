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
  })
    .index("by_user",         ["userId"])
    .index("by_dispute_item", ["disputeItemId"])
    .index("by_user_bureau",  ["userId", "bureau"]),
});
