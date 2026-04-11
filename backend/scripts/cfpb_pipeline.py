"""
CFPB Consumer Complaint Data Pipeline
======================================
Downloads the public CFPB complaint CSV, filters for credit-reporting
and debt-collection complaints with resolved outcomes, transforms each
record into a clean document, and pushes batches into Convex via HTTP API.

Usage:
    python scripts/cfpb_pipeline.py                           # full run
    python scripts/cfpb_pipeline.py --dry-run                 # parse only, no upload
    python scripts/cfpb_pipeline.py --limit 500               # upload first 500 records
    python scripts/cfpb_pipeline.py --csv path/to/complaints.csv  # use local file
"""

import argparse
import csv
import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

import httpx
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CFPB_CSV_URL = "https://files.consumerfinance.gov/ccdb/complaints.csv.zip"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Products we care about
TARGET_PRODUCTS = {
    "Credit reporting, credit repair services, or other personal consumer reports",
    "Debt collection",
}

# Company responses that indicate resolved/closed outcomes
RESOLVED_RESPONSES = {
    "Closed with explanation",
    "Closed with monetary relief",
    "Closed with non-monetary relief",
    "Closed with relief",
    "Closed",
}

# Convex HTTP endpoint batch size (stay under Convex's 8MB action limit)
BATCH_SIZE = 500

# CSV column names from CFPB dataset
COL_PRODUCT = "Product"
COL_SUB_PRODUCT = "Sub-product"
COL_ISSUE = "Issue"
COL_SUB_ISSUE = "Sub-issue"
COL_NARRATIVE = "Consumer complaint narrative"
COL_COMPANY = "Company"
COL_COMPANY_RESPONSE = "Company response to consumer"
COL_DATE_RECEIVED = "Date received"
COL_COMPLAINT_ID = "Complaint ID"


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------
def download_csv(dest_dir: Path) -> Path:
    """Download and extract the CFPB complaints CSV. Returns path to CSV."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    zip_path = dest_dir / "complaints.csv.zip"
    csv_path = dest_dir / "complaints.csv"

    if csv_path.exists():
        size_mb = csv_path.stat().st_size / (1024 * 1024)
        print(f"[download] Using cached CSV ({size_mb:.0f} MB): {csv_path}")
        return csv_path

    print(f"[download] Fetching {CFPB_CSV_URL} ...")
    urlretrieve(CFPB_CSV_URL, zip_path)
    print(f"[download] Extracting ...")

    with zipfile.ZipFile(zip_path, "r") as zf:
        # The zip contains a single CSV — extract it
        names = zf.namelist()
        csv_name = next((n for n in names if n.endswith(".csv")), names[0])
        zf.extract(csv_name, dest_dir)
        extracted = dest_dir / csv_name
        if extracted != csv_path:
            extracted.rename(csv_path)

    zip_path.unlink()
    size_mb = csv_path.stat().st_size / (1024 * 1024)
    print(f"[download] Saved {size_mb:.0f} MB → {csv_path}")
    return csv_path


# ---------------------------------------------------------------------------
# Parse & Filter
# ---------------------------------------------------------------------------
def detect_bureau(company_name: str) -> str | None:
    """Map company name to a credit bureau, if applicable."""
    lower = company_name.lower()
    if "experian" in lower:
        return "experian"
    if "equifax" in lower:
        return "equifax"
    if "transunion" in lower or "trans union" in lower:
        return "transunion"
    return None


def classify_complaint_type(product: str, sub_product: str, issue: str) -> str:
    """Derive a normalized complaint_type from CFPB fields."""
    lower_issue = issue.lower()

    if "incorrect information" in lower_issue or "inaccurate" in lower_issue:
        return "inaccurate_information"
    if "not mine" in lower_issue or "identity theft" in lower_issue or "fraud" in lower_issue:
        return "identity_theft_fraud"
    if "investigation" in lower_issue:
        return "investigation_failure"
    if "improper use" in lower_issue:
        return "improper_use_of_report"
    if "debt collection" in product.lower() or "debt" in lower_issue:
        return "debt_collection"
    if "credit report" in lower_issue or "credit monitoring" in lower_issue:
        return "credit_reporting_issue"

    return "other"


def parse_csv(csv_path: Path) -> list[dict]:
    """Read CSV, filter, and transform into clean documents."""
    records = []
    skipped = 0

    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            product = row.get(COL_PRODUCT, "").strip()
            response = row.get(COL_COMPANY_RESPONSE, "").strip()

            # Filter: target products only
            if product not in TARGET_PRODUCTS:
                skipped += 1
                continue

            # Filter: resolved/closed outcomes only
            if response not in RESOLVED_RESPONSES:
                skipped += 1
                continue

            company = row.get(COL_COMPANY, "").strip()
            sub_product = row.get(COL_SUB_PRODUCT, "").strip()
            issue = row.get(COL_ISSUE, "").strip()
            narrative = row.get(COL_NARRATIVE, "").strip()
            date_received = row.get(COL_DATE_RECEIVED, "").strip()
            complaint_id = row.get(COL_COMPLAINT_ID, "").strip()

            # Skip rows missing critical fields
            if not company or not issue:
                skipped += 1
                continue

            record = {
                "cfpbComplaintId": complaint_id,
                "creditorName": company,
                "bureau": detect_bureau(company),
                "complaintType": classify_complaint_type(product, sub_product, issue),
                "resolutionOutcome": response,
                "complaintNarrative": narrative if narrative else None,
                "dateReceived": date_received,  # "YYYY-MM-DD" string
                "product": product,
                "issue": issue,
                "subIssue": row.get(COL_SUB_ISSUE, "").strip() or None,
            }
            records.append(record)

    print(f"[parse] {len(records):,} records matched, {skipped:,} skipped")
    return records


# ---------------------------------------------------------------------------
# Upload to Convex
# ---------------------------------------------------------------------------
def upload_to_convex(records: list[dict], convex_url: str, limit: int | None = None):
    """Push records to Convex via the HTTP API endpoint."""
    if limit:
        records = records[:limit]

    total = len(records)
    uploaded = 0
    endpoint = f"{convex_url}/api/cfpb-ingest"

    print(f"[upload] Pushing {total:,} records to {endpoint} in batches of {BATCH_SIZE}")

    with httpx.Client(timeout=60.0) as client:
        for i in range(0, total, BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE

            resp = client.post(
                endpoint,
                json={"records": batch},
                headers={"Content-Type": "application/json"},
            )

            if resp.status_code != 200:
                print(f"[upload] ERROR batch {batch_num}: {resp.status_code} — {resp.text}")
                sys.exit(1)

            result = resp.json()
            inserted = result.get("inserted", len(batch))
            uploaded += inserted
            print(f"[upload] Batch {batch_num}/{total_batches}: +{inserted} ({uploaded:,}/{total:,})")

            # Small delay to avoid hammering Convex
            if i + BATCH_SIZE < total:
                time.sleep(0.5)

    print(f"[upload] Done — {uploaded:,} records inserted into Convex")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="CFPB complaint data pipeline → Convex")
    parser.add_argument("--csv", type=str, help="Path to local CSV (skip download)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, no upload")
    parser.add_argument("--limit", type=int, help="Max records to upload")
    parser.add_argument("--stats", action="store_true", help="Print stats and exit")
    args = parser.parse_args()

    # 1. Get CSV
    if args.csv:
        csv_path = Path(args.csv)
        if not csv_path.exists():
            print(f"File not found: {csv_path}")
            sys.exit(1)
    else:
        csv_path = download_csv(DATA_DIR)

    # 2. Parse & filter
    records = parse_csv(csv_path)

    if not records:
        print("[pipeline] No matching records found.")
        sys.exit(0)

    # 3. Stats summary
    from collections import Counter
    type_counts = Counter(r["complaintType"] for r in records)
    bureau_counts = Counter(r["bureau"] for r in records if r["bureau"])
    outcome_counts = Counter(r["resolutionOutcome"] for r in records)
    has_narrative = sum(1 for r in records if r["complaintNarrative"])

    print(f"\n{'='*50}")
    print(f"  CFPB Pipeline Summary")
    print(f"{'='*50}")
    print(f"  Total matched records : {len(records):>10,}")
    print(f"  With narratives       : {has_narrative:>10,}")
    print(f"\n  By complaint type:")
    for ct, count in type_counts.most_common():
        print(f"    {ct:<30s} {count:>8,}")
    print(f"\n  By bureau (where detected):")
    for bureau, count in bureau_counts.most_common():
        print(f"    {bureau:<30s} {count:>8,}")
    print(f"\n  By resolution outcome:")
    for outcome, count in outcome_counts.most_common():
        print(f"    {outcome:<30s} {count:>8,}")
    print(f"{'='*50}\n")

    if args.stats or args.dry_run:
        print("[pipeline] Dry run complete — no data uploaded.")
        return

    # 4. Upload to Convex
    # Load the Convex site URL from frontend .env.local
    env_path = Path(__file__).resolve().parent.parent.parent / "frontend" / ".env.local"
    load_dotenv(env_path)
    convex_site_url = os.getenv("NEXT_PUBLIC_CONVEX_SITE_URL")

    if not convex_site_url:
        print("[upload] ERROR: NEXT_PUBLIC_CONVEX_SITE_URL not set.")
        print(f"         Checked: {env_path}")
        sys.exit(1)

    upload_to_convex(records, convex_site_url, limit=args.limit)


if __name__ == "__main__":
    main()
