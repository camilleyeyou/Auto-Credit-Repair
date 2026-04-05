"use node";
// IMPORTANT: This file must export ONLY internalActions.
// "use node" files cannot co-export queries or mutations (Convex AI guidelines Pitfall 2).

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

function buildEmailHtml(args: {
  creditorName: string;
  bureau: string;
  sentAt: number;
  reminderType: "day25" | "day31";
  trackerUrl: string;
}): string {
  const sentDate = new Date(args.sentAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const bureauLabel =
    args.bureau === "experian" ? "Experian" :
    args.bureau === "equifax" ? "Equifax" :
    args.bureau === "transunion" ? "TransUnion" : args.bureau;

  if (args.reminderType === "day25") {
    return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #1d4ed8;">Dispute Deadline Approaching</h2>
  <p>Your dispute with <strong>${bureauLabel}</strong> regarding <strong>${args.creditorName}</strong> is approaching its 30-day response deadline.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Bureau</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${bureauLabel}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Account</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${args.creditorName}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Letter Sent</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${sentDate}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Days Remaining</td><td style="padding: 8px; border: 1px solid #e5e7eb; color: #d97706; font-weight: bold;">~5 days</td></tr>
  </table>
  <p>The bureau has until <strong>30 days from your send date</strong> to respond. If they don't, you can send a demand letter.</p>
  <p><a href="${args.trackerUrl}" style="display: inline-block; background: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Dispute Tracker</a></p>
  <p style="color: #6b7280; font-size: 13px;">To stop these reminders, update your email preferences in your CreditFix profile.</p>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #dc2626;">No Response from ${bureauLabel}</h2>
  <p><strong>${bureauLabel}</strong> has not responded to your dispute regarding <strong>${args.creditorName}</strong>. The 30-day response window has passed.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Bureau</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${bureauLabel}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Account</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${args.creditorName}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Letter Sent</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${sentDate}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Status</td><td style="padding: 8px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">Overdue — No Response</td></tr>
  </table>
  <p><strong>Next steps you can take in CreditFix:</strong></p>
  <ul>
    <li>Generate a <strong>Demand Letter</strong> — a stronger follow-up citing the bureau's failure to respond within the FCRA-required window</li>
    <li>File a <strong>CFPB Complaint</strong> — escalate to the Consumer Financial Protection Bureau</li>
  </ul>
  <p><a href="${args.trackerUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Take Action Now</a></p>
  <p style="color: #6b7280; font-size: 13px;">To stop these reminders, update your email preferences in your CreditFix profile.</p>
</body>
</html>`;
}

export const sendReminderEmail = internalAction({
  args: {
    toEmail:      v.string(),
    creditorName: v.string(),
    bureau:       v.string(),
    sentAt:       v.number(),
    reminderType: v.union(v.literal("day25"), v.literal("day31")),
    trackerUrl:   v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ?? "CreditFix <noreply@creditfix.app>";

    const bureauLabel =
      args.bureau === "experian" ? "Experian" :
      args.bureau === "equifax" ? "Equifax" :
      args.bureau === "transunion" ? "TransUnion" : args.bureau;

    const subject =
      args.reminderType === "day25"
        ? `CreditFix: Deadline approaching for ${args.creditorName} dispute`
        : `CreditFix: No response from ${bureauLabel} — time to escalate`;

    const html = buildEmailHtml(args);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to:   [args.toEmail],
      subject,
      html,
    });

    if (error) {
      console.error("Resend send error for", args.toEmail, ":", error);
    }

    return { emailId: data?.id ?? null, error: error ?? null };
  },
});
