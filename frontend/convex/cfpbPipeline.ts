"use node";
// IMPORTANT: "use node" required for Anthropic SDK + fetch calls.
// This file must export ONLY actions (Convex AI guidelines Pitfall 2).

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Agent + environment IDs are created once and stored as env vars.
// See backend/scripts/cfpb_managed_agent.py --setup to create them,
// then set CFPB_AGENT_ID and CFPB_ENVIRONMENT_ID in your Convex dashboard.
// ---------------------------------------------------------------------------

const TASK_PROMPT = (convexSiteUrl: string, limit?: number) => {
  const limitLine = limit
    ? `\n\nIMPORTANT: Only upload the first ${limit} matching records (for testing).`
    : "";

  return `Run the CFPB data pipeline now.

## Steps

1. Download https://files.consumerfinance.gov/ccdb/complaints.csv.zip
2. Unzip and parse the CSV with Python (use the csv stdlib module).
3. Filter for ONLY these records:
   - Product is one of:
     * "Credit reporting, credit repair services, or other personal consumer reports"
     * "Debt collection"
   - "Company response to consumer" is one of:
     * "Closed with explanation"
     * "Closed with monetary relief"
     * "Closed with non-monetary relief"
     * "Closed with relief"
     * "Closed"
   - Skip rows missing Company or Issue fields.

4. Transform each row into JSON:
   {
     "cfpbComplaintId": "<Complaint ID>",
     "creditorName": "<Company>",
     "bureau": "<detected or null>",
     "complaintType": "<normalized>",
     "resolutionOutcome": "<Company response to consumer>",
     "complaintNarrative": "<narrative or null>",
     "dateReceived": "<YYYY-MM-DD>",
     "product": "<Product>",
     "issue": "<Issue>",
     "subIssue": "<Sub-issue or null>"
   }

   Bureau detection (case-insensitive company name):
   - contains "experian" → "experian"
   - contains "equifax" → "equifax"
   - contains "transunion" or "trans union" → "transunion"
   - otherwise → null

   Complaint type from Issue field (case-insensitive):
   - "incorrect information" or "inaccurate" → "inaccurate_information"
   - "not mine", "identity theft", "fraud" → "identity_theft_fraud"
   - "investigation" → "investigation_failure"
   - "improper use" → "improper_use_of_report"
   - product has "debt collection" or issue has "debt" → "debt_collection"
   - "credit report" or "credit monitoring" → "credit_reporting_issue"
   - otherwise → "other"

5. Upload in batches of 500 via POST to: ${convexSiteUrl}/api/cfpb-ingest
   Body: {"records": [<batch>]}
   Headers: Content-Type: application/json
   Add 0.5s delay between batches.
   If a batch fails, log the error and continue.

6. Print a final summary: total matched, with narratives, by type, by bureau, by outcome, total uploaded.${limitLine}`;
};

/**
 * Internal action: trigger a Claude Managed Agent session to run the
 * CFPB data pipeline. Called by the weekly cron or manually via dashboard.
 */
export const runCfpbPipeline = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    // Required env vars — fail gracefully with clear logs instead of raw throws
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const agentId = process.env.CFPB_AGENT_ID;
    const environmentId = process.env.CFPB_ENVIRONMENT_ID;
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

    const missing = [
      !apiKey && "ANTHROPIC_API_KEY",
      !agentId && "CFPB_AGENT_ID",
      !environmentId && "CFPB_ENVIRONMENT_ID",
      !convexSiteUrl && "NEXT_PUBLIC_CONVEX_SITE_URL",
    ].filter(Boolean);

    if (missing.length > 0) {
      console.error(`[cfpb-pipeline] Skipping run — missing env vars: ${missing.join(", ")}`);
      return { sessionId: null, summary: `Skipped: missing ${missing.join(", ")}`, error: true };
    }

    try {
      // Initialize Anthropic client
      // Cast beta to any — the SDK runtime supports managed agents but the
      // bundled TypeScript definitions may lag behind.
      const client = new Anthropic({ apiKey: apiKey! });
      const beta = client.beta as any;

      // Create session
      console.log("[cfpb-pipeline] Creating managed agent session...");
      const resolvedSession = await beta.sessions.create({
        agent: agentId,
        environment_id: environmentId,
        title: `CFPB Pipeline — ${new Date().toISOString().slice(0, 10)}`,
      });
      console.log(`[cfpb-pipeline] Session ID: ${resolvedSession.id}`);

      // Open stream and send task
      const stream = beta.sessions.events.stream(resolvedSession.id);

      await beta.sessions.events.send(resolvedSession.id, {
        events: [
          {
            type: "user.message",
            content: [
              {
                type: "text",
                text: TASK_PROMPT(convexSiteUrl!, args.limit),
              },
            ],
          },
        ],
      });

      // Consume the stream — log key events
      let agentOutput = "";
      for await (const event of await stream) {
        if (event.type === "agent.message") {
          for (const block of (event as any).content ?? []) {
            if (block.text) {
              agentOutput += block.text;
            }
          }
        } else if (event.type === "agent.tool_use") {
          console.log(`[cfpb-pipeline] Tool: ${(event as any).name ?? "unknown"}`);
        } else if (event.type === "session.status_idle") {
          console.log("[cfpb-pipeline] Agent finished.");
          break;
        }
      }

      // Log the tail end of agent output (summary)
      const lines = agentOutput.split("\n").filter((l) => l.trim());
      const summary = lines.slice(-20).join("\n");
      console.log(`[cfpb-pipeline] Summary:\n${summary}`);

      return { sessionId: resolvedSession.id, summary, error: false };
    } catch (err: any) {
      // Log but don't throw — prevents cron from surfacing raw Anthropic errors
      const message = err?.message ?? "Unknown error";
      console.error(`[cfpb-pipeline] Pipeline failed: ${message}`);
      return { sessionId: null, summary: `Failed: ${message}`, error: true };
    }
  },
});
