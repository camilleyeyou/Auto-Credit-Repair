import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Daily deadline scan — finds disputes with approaching or overdue deadlines
 * and schedules reminder emails via the notifications action.
 *
 * Logic (per D-08, D-09, D-10, D-21, D-23):
 * 1. Fetch all sent initial dispute letters
 * 2. Compute daysSinceSent from sentAt (NOT deadline — Pitfall 3)
 * 3. Day-25 window: [25, 26), Day-31 window: [31, 32)
 * 4. Skip if dispute_items.status !== "sent"
 * 5. Skip if bureau response already recorded
 * 6. Skip if user emailRemindersEnabled === false
 * 7. Skip if reminder_log already has entry (de-duplication)
 * 8. Insert log + schedule send action
 */
export const scanDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const trackerUrl =
      (process.env.FRONTEND_URL ?? "https://creditfix.app") + "/tracker";

    const allLetters = await ctx.db
      .query("dispute_letters")
      .collect();

    for (const letter of allLetters) {
      try {
        if (letter.sentAt === undefined) continue;

        // Only trigger on initial letters (not demand/escalation)
        if (
          letter.letterType === "demand" ||
          letter.letterType === "escalation"
        ) continue;

        const daysSinceSent = (now - letter.sentAt) / MS_PER_DAY;

        let reminderType: "day25" | "day31" | null = null;
        if (daysSinceSent >= 25 && daysSinceSent < 26) {
          reminderType = "day25";
        } else if (daysSinceSent >= 31 && daysSinceSent < 32) {
          reminderType = "day31";
        }
        if (!reminderType) continue;

        // Check dispute item status
        const disputeItem = await ctx.db.get(letter.disputeItemId);
        if (!disputeItem || disputeItem.status !== "sent") continue;

        // Check for recorded bureau response — suppress if exists
        const existingResponse = await ctx.db
          .query("bureau_responses")
          .withIndex("by_dispute_item", (q) =>
            q.eq("disputeItemId", letter.disputeItemId)
          )
          .first();
        if (existingResponse) continue;

        // Load user preferences
        const user = await ctx.runQuery(internal.users.getEmailPrefs, {
          userId: letter.userId,
        });
        if (!user) continue;

        // Respect opt-out (undefined = enabled by default)
        if (user.emailRemindersEnabled === false) continue;

        // Resolve email address
        const toEmail = user.reminderEmail || user.email;
        if (!toEmail) continue;

        // De-duplication check
        const existingLog = await ctx.db
          .query("reminder_log")
          .withIndex("by_letter_and_type", (q) =>
            q.eq("letterId", letter._id).eq("reminderType", reminderType!)
          )
          .first();
        if (existingLog) continue;

        // Insert log row first (prevents double-send if scheduler fails)
        await ctx.db.insert("reminder_log", {
          letterId:     letter._id,
          userId:       letter.userId,
          reminderType,
          sentAt:       now,
        });

        // Schedule the email send
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.sendReminderEmail,
          {
            toEmail,
            creditorName: disputeItem.creditorName,
            bureau:       letter.bureau,
            sentAt:       letter.sentAt,
            reminderType,
            trackerUrl,
          },
        );
      } catch (err) {
        console.error("scanDeadlines: error processing letter", letter._id, err);
      }
    }
  },
});

// Register the daily cron job.
// CRITICAL: use crons.cron() — crons.daily() is forbidden by Convex AI guidelines.
const crons = cronJobs();

crons.cron(
  "daily-deadline-scan",
  "0 8 * * *",
  internal.crons.scanDeadlines,
  {},
);

export default crons;
