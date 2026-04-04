# Architecture — Escalation & Notifications

**Researched:** 2026-04-04

## New Data Tables (Convex)

**`bureau_responses`:** disputeItemId, userId, storageId, bureau, responseType, outcome (verified/deleted/corrected), reasonCodes, responseDate, parsedAt, rawExtraction

**`escalation_events`:** disputeItemId, userId, eventType, triggeredBy, letterStorageId, cfpbCategory, metadata, createdAt

**Extend `dispute_items`:** add escalationStatus, lastBureauResponseAt

**Extend `dispute_letters`:** add letterType (initial/demand/escalation/mov)

## New FastAPI Endpoints

- `POST /api/responses/parse` — PDF bytes → Claude tool_use → structured BureauResponseResult
- `POST /api/letters/generate-escalation` — dispute history + response → escalation letter
- `POST /api/cfpb/generate-narrative` — dispute context → CFPB complaint text

## Data Flow: Bureau Response

```
User uploads response PDF → Convex Storage
  → Convex action: calls FastAPI /api/responses/parse
  → FastAPI: PyMuPDF extract → Claude tool_use → BureauResponseResult
  → Convex mutation: save to bureau_responses, update dispute status
  → UI updates reactively
```

## Data Flow: Email Reminders

```
Letter marked as sent → Convex mutation schedules reminders
  → ctx.scheduler.runAfter(25 days, sendReminder)
  → Scheduled function fires → checks if response received
  → If no response: Convex action calls Resend API
  → Dispute resolves → cancel pending scheduler jobs
```

## Build Order

1. Schema extensions + response intake data layer
2. FastAPI response parsing + escalation letter endpoints
3. Convex actions (orchestration layer)
4. Email infra (Resend + Convex crons/scheduler)
5. UI: response upload, escalation triggers, CFPB guidance
6. UI: email preferences, reminder settings

## Key Patterns

- Convex actions for all HTTP (FastAPI, Resend) — never from mutations
- FastAPI stateless — Convex passes all context in request body
- Store scheduler job IDs for cancellation on resolve
- CFPB = static link + generated narrative, no API integration
