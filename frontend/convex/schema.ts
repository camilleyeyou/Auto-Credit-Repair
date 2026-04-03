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
  })
    .index("by_user", ["userId"])
    .index("by_user_bureau", ["userId", "bureau"]),
});
