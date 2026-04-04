# Feature Landscape — Escalation & Notifications

**Researched:** 2026-04-04

## Table Stakes

| Feature | Complexity | Dependencies |
|---------|------------|-------------|
| Response received intake + outcome classification (verified/deleted/modified) | Med | Existing dispute records |
| 30-day deadline email reminders | Low-Med | Resend + Convex scheduler |
| Second-round escalation letter generation | Med | Existing AI letter gen + outcome data |
| CFPB complaint draft generation | Med | Dispute context + response outcome |
| No-response escalation nudge (day 31) | Low | Email infra + response state check |

## Differentiators

| Feature | Complexity | Notes |
|---------|------------|-------|
| Automated bureau response PDF parsing | High | Bureau formats inconsistent; needs fallback to manual |
| Method of Verification (MOV) demand letter | Med | FCRA §611(a)(7) right most users don't know |
| CFPB complaint auto-draft (full narrative) | Med | High perceived value |
| Escalation path recommender | Med-High | Rule-based first, LLM later |

## Anti-Features

| Feature | Why Not |
|---------|---------|
| Automated CFPB submission | No API; scraping violates ToS |
| Credit score guarantees | CROA §404 violation |
| Auto dispute submission to bureaus | No public API; legally risky |

## Dependency Chain

```
Response intake + outcome classification (FOUNDATION)
  ├── Escalation letter gen (reuses AI letter gen)
  ├── CFPB complaint draft
  └── Escalation path recommender

Email reminder system (INDEPENDENT)
  ├── Day 25 deadline alerts
  └── No-response nudge at day 31

Bureau response PDF parsing
  └── feeds → Response outcome classification
```
