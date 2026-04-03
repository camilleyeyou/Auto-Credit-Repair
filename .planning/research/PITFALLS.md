# Pitfalls Research: CreditFix

**Domain:** AI-powered credit repair / FCRA dispute automation
**Date:** 2026-04-03
**Confidence:** HIGH

## Critical Pitfalls

### 1. Bureau PDF Format Divergence
**Risk:** HIGH | **Phase:** PDF Parsing (Phase 2)

Experian, Equifax, and TransUnion use structurally different PDF layouts. A parser tuned on one bureau will silently misparse the others — extracting wrong account numbers, missing negative items, or confusing payment history grids.

**Warning signs:**
- Parser works on one bureau but produces empty or garbled output for another
- Account numbers extracted with wrong digit counts
- Payment history dates misaligned

**Prevention:**
- Separate parser adapters per bureau with a common output schema
- Build a test suite with sample PDFs from all three bureaus (multiple vintages)
- Add a field validation pass: account numbers should be digits, dates should parse, balances should be numeric
- Log parsing confidence scores — flag low-confidence extractions for manual review

### 2. AI Hallucination of FCRA Citations
**Risk:** CRITICAL | **Phase:** AI Analysis (Phase 3)

LLMs fabricate legal citations. Claude might reference "FCRA § 1681c(d)(3)" — a section that doesn't exist. If the user mails a letter citing a fake statute section, it undermines her credibility and the dispute may be dismissed.

**Warning signs:**
- FCRA section numbers that don't match known sections
- Overly specific sub-section citations (§ 1681x(y)(z)(iv)) that seem invented
- Citations that contradict each other

**Prevention:**
- Maintain a **validated FCRA citation library** — a hardcoded set of real sections with descriptions
- After Claude returns dispute items, validate every citation against this library
- If a citation isn't in the library, either map it to the closest valid section or flag for review
- Never let the LLM generate citation numbers in free text — use tool_use with an enum of valid sections

**Valid FCRA sections for disputes:**
- § 611 (15 U.S.C. § 1681i) — Right to dispute; bureau must investigate within 30 days
- § 623 (15 U.S.C. § 1681s-2) — Furnisher obligations; must investigate when notified
- § 605 (15 U.S.C. § 1681c) — Obsolete information; most negatives fall off after 7 years
- § 609 (15 U.S.C. § 1681g) — Right to disclosure; consumer can request their file
- § 612 (15 U.S.C. § 1681j) — Free annual reports

### 3. PII Exposure to LLM APIs
**Risk:** CRITICAL | **Phase:** AI Analysis (Phase 3)

Credit reports contain SSNs, full account numbers, dates of birth, and addresses. Sending raw PDF text to Claude API means this PII is transmitted to an external service. Even though Anthropic has data handling policies, minimizing PII exposure is a security best practice.

**Warning signs:**
- Full 9-digit SSNs appearing in AI prompts
- Complete account numbers in API payloads
- No PII stripping step in the data pipeline

**Prevention:**
- Strip all SSNs from parsed data before Claude API calls
- Replace full account numbers with last-4 identifiers (e.g., "Account ending in 4532")
- Never include DOB in AI prompts unless absolutely necessary
- Log what data is sent to the API (without logging the actual PII) for audit purposes

### 4. Frivolous Dispute Triggering
**Risk:** HIGH | **Phase:** Letter Generation (Phase 5)

FCRA § 611(a)(3) allows bureaus to dismiss disputes as "frivolous or irrelevant" if they are substantially similar to a previous dispute or if the consumer doesn't provide sufficient information. Mass-disputing everything with identical boilerplate is a known trigger.

**Warning signs:**
- All dispute letters use identical language regardless of the item
- More than 5-7 items disputed simultaneously per bureau
- Re-disputing the same items within 30 days with no new information

**Prevention:**
- AI must generate item-specific dispute language — unique to each creditor and issue
- Recommend batching: dispute 3-5 items per bureau per round maximum
- Track previous disputes to prevent re-filing without new information
- Each letter should reference the specific account, specific issue, and specific FCRA basis

### 5. 30-Day Clock Miscalculation
**Risk:** MEDIUM-HIGH | **Phase:** Tracking (Phase 6)

The FCRA 30-day investigation window starts when the bureau **receives** the dispute, not when the user mails it. Developers often track from "date generated" or "date mailed." USPS certified mail typically takes 3-5 business days. The difference matters for enforcement.

**Warning signs:**
- Countdown starts from letter generation date
- No field to enter certified mail delivery confirmation
- Deadlines calculated from mailing date without transit buffer

**Prevention:**
- Primary anchor: certified mail delivery confirmation date (if entered)
- Fallback: mailing date + 5 business day buffer
- Show both "estimated receipt date" and "30-day deadline" in the tracker
- Make deadline calculation logic transparent to the user

### 6. CROA Compliance (If Project Scope Changes)
**Risk:** LOW (currently) / CRITICAL (if commercialized) | **Phase:** Pre-launch

The Credit Repair Organizations Act (15 U.S.C. § 1679) applies to anyone who provides "credit repair services" for payment. As a free personal tool, CreditFix is not subject to CROA. But if it ever charges money or serves multiple users commercially, CROA imposes:
- Mandatory 3-day cancellation right
- Prohibition on advance payment
- Required written disclosures
- Prohibition on misleading claims

**Warning signs:**
- Any plan to charge for the service
- Adding multi-user support without legal review
- Marketing language that promises credit score improvement

**Prevention:**
- Keep as single-user personal tool (current plan)
- If scope changes, get legal review before any commercial features
- Never use language like "guaranteed removal" or "fix your credit score"

## Moderate Pitfalls

### 7. Text-Layer vs. Scanned PDF Detection
**Risk:** MEDIUM | **Phase:** PDF Parsing (Phase 2)

PDFs from annualcreditreport.com are text-based, but users might scan physical letters or download from other sources. A text-extraction parser will return empty results for scanned/image PDFs.

**Prevention:**
- Check if PyMuPDF returns meaningful text (> threshold character count)
- If text extraction yields too little content, inform the user the PDF may be image-based
- Don't invest in OCR for v1 — just detect and inform. annualcreditreport.com PDFs are text-based.

### 8. Date of First Delinquency (DOFD) Confusion
**Risk:** MEDIUM | **Phase:** AI Analysis (Phase 3)

FCRA § 605(a) requires most negative items to be removed after 7 years from the Date of First Delinquency — NOT the charge-off date or last activity date. These are different dates. Confusing them leads to incorrectly identifying items as obsolete (or missing items that actually are obsolete).

**Prevention:**
- Parser should extract DOFD explicitly when available
- AI prompts should clarify: "Use Date of First Delinquency for 7-year calculation, not date of last activity"
- If DOFD is missing from the report, flag the item rather than guessing

### 9. No Audit Trail
**Risk:** MEDIUM | **Phase:** Throughout

If a bureau dispute goes to arbitration or court, having an audit trail of what was disputed and when is valuable. Without it, there's no evidence of the dispute process.

**Prevention:**
- dispute_timeline table captures every event with timestamps
- Never delete dispute records — only update status
- Store original letter content (not just file paths) in the database
- Log certified mail tracking numbers

### 10. Deletion ≠ Permanent (Re-insertion Risk)
**Risk:** MEDIUM | **Phase:** Tracking (Phase 6)

Under FCRA § 611(a)(5)(B), a bureau can re-insert a previously deleted item if the furnisher re-verifies it. The bureau must notify the consumer within 5 business days of re-insertion. Users may think a deletion is permanent.

**Prevention:**
- After a successful deletion, show a note: "This item was removed but could be re-inserted if the creditor re-verifies. Monitor your reports."
- Recommend the user download fresh reports 60-90 days after resolution to verify items stayed removed
- Track "resolved" items separately from "permanently resolved"

## Minor Pitfalls

### 11. Letter Formatting That Signals Automation
**Risk:** LOW | **Phase:** Letter Generation (Phase 5)

Bureau processors may flag letters that look mass-produced or automated. Identical formatting, font, or boilerplate across multiple letters suggests automated generation.

**Prevention:**
- Use professional but natural formatting — not overly templated
- AI should vary sentence structure across different letters
- Include personal details that show the letter is individualized

### 12. No Rate Limiting on AI Calls
**Risk:** LOW | **Phase:** AI Analysis (Phase 3)

A bug or UI issue could trigger multiple Claude API calls for the same report, running up costs.

**Prevention:**
- Add parse_status checks — don't re-analyze if already analyzed
- Idempotency: if dispute_items already exist for a report, don't re-create
- Add a simple rate limit or confirmation step before triggering analysis
