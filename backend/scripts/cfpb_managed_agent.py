"""
CFPB Data Pipeline — Claude Managed Agent Version
====================================================
Instead of running the pipeline locally, this script creates a Claude
Managed Agent that autonomously:
  1. Downloads the CFPB complaints CSV
  2. Filters for credit-reporting + debt-collection with resolved outcomes
  3. Transforms records into clean documents
  4. Pushes batches to Convex via HTTP API

Usage:
    # First run — creates agent + environment (saves IDs to .cfpb_agent_config.json)
    python scripts/cfpb_managed_agent.py --setup

    # Run the pipeline
    python scripts/cfpb_managed_agent.py --run

    # Run with a record limit
    python scripts/cfpb_managed_agent.py --run --limit 1000

    # One-shot: setup + run
    python scripts/cfpb_managed_agent.py --setup --run
"""

import argparse
import json
import os
import sys
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CONFIG_PATH = Path(__file__).resolve().parent / ".cfpb_agent_config.json"

AGENT_SYSTEM_PROMPT = """\
You are a data pipeline agent for a credit repair application.
Your job is to download, parse, filter, and upload CFPB consumer complaint data.

## Task

1. Download the CFPB complaints CSV from:
   https://files.consumerfinance.gov/ccdb/complaints.csv.zip

2. Unzip it and parse the CSV.

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

4. Transform each matching row into this JSON structure:
   {
     "cfpbComplaintId": "<Complaint ID>",
     "creditorName": "<Company>",
     "bureau": "<detected bureau or null>",
     "complaintType": "<normalized type>",
     "resolutionOutcome": "<Company response to consumer>",
     "complaintNarrative": "<Consumer complaint narrative or null>",
     "dateReceived": "<Date received as YYYY-MM-DD>",
     "product": "<Product>",
     "issue": "<Issue>",
     "subIssue": "<Sub-issue or null>"
   }

   Bureau detection: if company name contains "experian" → "experian",
   "equifax" → "equifax", "transunion" or "trans union" → "transunion",
   otherwise null.

   Complaint type normalization from the Issue field:
   - Contains "incorrect information" or "inaccurate" → "inaccurate_information"
   - Contains "not mine", "identity theft", or "fraud" → "identity_theft_fraud"
   - Contains "investigation" → "investigation_failure"
   - Contains "improper use" → "improper_use_of_report"
   - Product contains "debt collection" or issue contains "debt" → "debt_collection"
   - Contains "credit report" or "credit monitoring" → "credit_reporting_issue"
   - Otherwise → "other"

5. Upload in batches of 500 via POST to: {convex_url}/api/cfpb-ingest
   Body: {{"records": [<batch of records>]}}
   Headers: Content-Type: application/json

6. Print a summary at the end:
   - Total records matched
   - Records with narratives
   - Breakdown by complaint type
   - Breakdown by bureau
   - Breakdown by resolution outcome
   - Total uploaded

## Important
- Use Python for CSV parsing (csv module from stdlib).
- Write the parsing script to /workspace/pipeline.py, then run it.
- Handle the large file efficiently — stream/iterate, don't load all into memory at once.
- If a batch upload fails, log the error and continue with the next batch.
- Small delay (0.5s) between batches to avoid rate limiting.
"""


def load_config() -> dict:
    """Load saved agent/environment IDs."""
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_config(config: dict):
    """Persist agent/environment IDs for reuse."""
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def setup_agent(client: Anthropic) -> dict:
    """Create the Managed Agent and Environment (one-time setup)."""
    config = load_config()

    # Create environment (if not already created)
    if "environment_id" not in config:
        print("[setup] Creating environment...")
        environment = client.beta.environments.create(
            name="cfpb-pipeline-env",
            config={
                "type": "cloud",
                "packages": {
                    "pip": ["httpx"],
                },
                "networking": {"type": "unrestricted"},
            },
        )
        config["environment_id"] = environment.id
        print(f"[setup] Environment ID: {environment.id}")
    else:
        print(f"[setup] Reusing environment: {config['environment_id']}")

    # Create agent (if not already created)
    if "agent_id" not in config:
        print("[setup] Creating agent...")
        agent = client.beta.agents.create(
            name="CFPB Pipeline Agent",
            model="claude-sonnet-4-6",
            system=AGENT_SYSTEM_PROMPT,
            tools=[
                {"type": "agent_toolset_20260401"},
            ],
        )
        config["agent_id"] = agent.id
        config["agent_version"] = agent.version
        print(f"[setup] Agent ID: {agent.id} (version {agent.version})")
    else:
        print(f"[setup] Reusing agent: {config['agent_id']}")

    save_config(config)

    # Print Convex env var instructions
    print(f"\n{'='*60}")
    print("  Set these in your Convex dashboard (Settings → Environment Variables):")
    print(f"{'='*60}")
    print(f"  CFPB_AGENT_ID          = {config['agent_id']}")
    print(f"  CFPB_ENVIRONMENT_ID    = {config['environment_id']}")
    print(f"  ANTHROPIC_API_KEY      = (your key — already set if running this)")
    print(f"{'='*60}")
    print("  The weekly cron in crons.ts will use these to auto-refresh data.\n")

    return config


def run_pipeline(client: Anthropic, config: dict, convex_url: str, limit: int | None = None):
    """Start a session and run the CFPB pipeline."""
    agent_id = config["agent_id"]
    environment_id = config["environment_id"]

    # Build the task message
    limit_instruction = ""
    if limit:
        limit_instruction = f"\n\nIMPORTANT: Only upload the first {limit} matching records (for testing)."

    task_message = (
        f"Run the CFPB data pipeline now.\n\n"
        f"Convex upload URL: {convex_url}/api/cfpb-ingest"
        f"{limit_instruction}"
    )

    # Create session
    print("[run] Creating session...")
    session = client.beta.sessions.create(
        agent=agent_id,
        environment_id=environment_id,
        title="CFPB Pipeline Run",
    )
    print(f"[run] Session ID: {session.id}")

    # Stream events
    print("[run] Sending task and streaming responses...\n")
    print("=" * 60)

    with client.beta.sessions.events.stream(session.id) as stream:
        # Send the task
        client.beta.sessions.events.send(
            session.id,
            events=[
                {
                    "type": "user.message",
                    "content": [
                        {"type": "text", "text": task_message},
                    ],
                },
            ],
        )

        # Process events
        for event in stream:
            match event.type:
                case "agent.message":
                    for block in event.content:
                        if hasattr(block, "text"):
                            print(block.text, end="")
                case "agent.tool_use":
                    tool_name = event.name if hasattr(event, "name") else "unknown"
                    print(f"\n  [tool: {tool_name}]")
                case "session.status_idle":
                    print("\n" + "=" * 60)
                    print("[run] Agent finished.")
                    break

    print(f"\n[run] Session completed: {session.id}")


def main():
    parser = argparse.ArgumentParser(description="CFPB pipeline via Claude Managed Agent")
    parser.add_argument("--setup", action="store_true", help="Create agent + environment")
    parser.add_argument("--run", action="store_true", help="Run the pipeline")
    parser.add_argument("--limit", type=int, help="Max records to upload")
    args = parser.parse_args()

    if not args.setup and not args.run:
        parser.print_help()
        sys.exit(0)

    # Load env
    env_path = Path(__file__).resolve().parent.parent.parent / "frontend" / ".env.local"
    load_dotenv(env_path)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set in environment or .env.local")
        sys.exit(1)

    client = Anthropic(api_key=api_key)

    config = load_config()

    if args.setup:
        config = setup_agent(client)

    if args.run:
        if "agent_id" not in config or "environment_id" not in config:
            print("ERROR: Run --setup first to create agent and environment.")
            sys.exit(1)

        convex_url = os.getenv("NEXT_PUBLIC_CONVEX_SITE_URL")
        if not convex_url:
            print("ERROR: NEXT_PUBLIC_CONVEX_SITE_URL not set.")
            sys.exit(1)

        run_pipeline(client, config, convex_url, limit=args.limit)


if __name__ == "__main__":
    main()
