# Domain Pitfalls — Escalation & Notifications

**Researched:** 2026-04-04

## Critical

### 1. Escalation Letters as Templates, Not Legal Instruments
CRA disputes vs furnisher disputes have different FCRA obligations (§1681i vs §1681s-2). Letters must branch on entity type, not just escalation level.
**Prevention:** State machine with entity_type axis. Statutory citations module maps (entity_type, escalation_level) to required FCRA sections.

### 2. Bureau Response Parser Assumes Clean Input
Bureau responses are inconsistent PDFs. "Verified as accurate" buried in boilerplate looks like "deleted."
**Prevention:** Human review queue for low-confidence parses. Classify as: deleted/corrected/verified_accurate/pending/no_response/unreadable. Store raw file permanently.

### 3. CFPB Guidance Presented as Legal Advice
Prescriptive language ("file now", "bureau must") creates UPL exposure.
**Prevention:** Process information only. Legal review of all CFPB copy. Contextual disclaimers on every guidance screen.

### 4. Email Reminders Use Send Date Instead of Receipt Date
FCRA 30-day clock starts at bureau receipt, not letter send date.
**Prevention:** Track estimated_receipt_date (sent + 3-5 business days). Check response status before firing reminders.

## Moderate

### 5. Email Infrastructure Missing Before First Send
No SPF/DKIM/DMARC, no unsubscribe, no bounce handling → deliverability collapse.
**Prevention:** Set up sending infrastructure before first email.

### 6. Response Parser Overwrites Manual Statuses
Running parser on existing records silently overwrites manually entered statuses.
**Prevention:** Parser output to staging field. Human review promotes to canonical status.

### 7. "No Response" State Never Expires
Disputes in "awaiting response" accumulate forever.
**Prevention:** Auto-transition to escalation_required when deadline passes with no response.

## Phase Mapping

| Pitfall | Phase |
|---------|-------|
| Entity type branching | Escalation letter generation |
| Response misclassification | Bureau response parsing |
| UPL in CFPB guidance | CFPB feature |
| Wrong clock start | Email reminders |
| Email infra setup | Email reminders (first task) |
