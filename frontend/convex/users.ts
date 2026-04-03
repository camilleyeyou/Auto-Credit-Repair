import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Returns the current authenticated user's full record including profile fields.
 * Returns null if unauthenticated.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Updates the current user's profile fields for dispute letter headers.
 * Per D-09: full name, street address, city, state, ZIP.
 * Per D-11: profile data is required before letter generation (Phase 4).
 */
export const updateProfile = mutation({
  args: {
    fullName: v.string(),
    streetAddress: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, {
      fullName: args.fullName,
      streetAddress: args.streetAddress,
      city: args.city,
      state: args.state,
      zip: args.zip,
    });
    return { success: true };
  },
});
