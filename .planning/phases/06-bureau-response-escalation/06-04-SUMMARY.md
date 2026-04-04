---
phase: 06-bureau-response-escalation
plan: "04"
subsystem: frontend-ui
tags: [next.js, convex, bureau-response, escalation, cfpb, letter-badges, tracker]
dependency_graph:
  requires:
    - "06-01 — bureau_responses schema, generateResponseUploadUrl, recordResponseManual mutations"
    - "06-02 — FastAPI /api/responses/parse, /api/letters/generate, /api/complaints/generate"
    - "06-03 — parseResponse, generateDemandLetter, generateEscalationLetter, generateCfpbNarrative actions"
  provides:
    - "RecordResponseDialog component — PDF upload + manual entry for recording bureau responses"
    - "Tracker page extensions — Record Response, demand letter, escalation letter, CFPB section"
    - "Letters page letterType badges — Initial / Demand / Escalation"
  affects:
    - "End user — complete Phase 6 surface is now accessible"
tech_stack:
  added: []
  patterns:
    - "Convex Storage upload pattern: generateResponseUploadUrl → PUT → storageId → action"
    - "useAction for Convex actions in UI (parseResponse, generateDemandLetter, generateEscalationLetter, generateCfpbNarrative)"
    - "useMemo response/CFPB lookup maps keyed by disputeItemId for O(1) card lookup"
    - "@base-ui/react/dialog Dialog.Root open-controlled (RecordResponseDialog mirrors MarkAsSentDialog)"
key_files:
  created:
    - frontend/components/RecordResponseDialog.tsx
  modified:
    - frontend/app/(protected)/tracker/page.tsx
    - frontend/app/(protected)/letters/page.tsx
decisions:
  - "RecordResponseDialog controlled externally with open=true always (parent renders/unmounts it) rather than Dialog.Trigger — cleaner per-card state"
  - "CFPB section shown only for outcome=verified (denied) disputes — conservative trigger aligned with plan spec"
  - "cfpb.portalStatus defaults to draft in the status dropdown display — matches schema initial value"
  - "Letter type badge uses IIFE in JSX to keep logic inline without an extra helper function"
metrics:
  duration: "~5 min"
  completed: "2026-04-04"
  tasks_completed: 4
  files_created: 1
  files_modified: 2
---

# Phase 06 Plan 04: Bureau Response & Escalation UI Summary

**One-liner:** RecordResponseDialog (PDF upload + manual entry), tracker extensions (Record Response, demand/escalation letters, CFPB narrative + status), and letterType badges (Initial/Demand/Escalation) on the letters page complete the Phase 6 user-facing surface.

## What Was Built

### Task 1: RecordResponseDialog component

Created `frontend/components/RecordResponseDialog.tsx`:
- Props: `disputeItemId`, `bureau`, `onClose`
- Two-tab UI mirroring MarkAsSentDialog pattern using `@base-ui/react/dialog`
- **Upload tab:** `generateResponseUploadUrl` → PUT file to storage URL → extract `storageId` from JSON response → `parseResponse` action. Surfaces unknown-outcome parse errors with suggestion to use manual tab.
- **Manual tab:** outcome select (4 options with readable labels) + optional notes textarea → `recordResponseManual` mutation
- Success and error state with conditional green/red text

### Task 2: Extended tracker page

Extended `frontend/app/(protected)/tracker/page.tsx` (all existing functionality preserved):
- Added `getResponsesForUser` and `getCfpbComplaintsForUser` queries
- Built `responseByDisputeId` and `cfpbByDisputeId` useMemo maps for O(1) per-card lookup
- Added `openResponseDialogId`, `generatingDemand`, `generatingEscalation`, `generatingCfpb`, `expandedCfpb` state
- Per-card action error map to show inline errors without disrupting other cards
- **Contextual actions per card:**
  - Always: "Record Response" button (hidden after response recorded)
  - After response: outcome badge (green Resolved / red Denied / gray No Response)
  - Overdue + no response: "Generate Demand Letter" button (orange)
  - Denied (outcome=verified): "Generate Escalation Letter" button (red)
  - Denied: CFPB section with "Generate CFPB Narrative", narrative textarea, status dropdown, consumerfinance.gov link

### Task 3: letterType badges on letters page

Minimal addition to `frontend/app/(protected)/letters/page.tsx`:
- Added `letterType` field to `DisputeLetter` interface
- Added `LETTER_TYPE_LABEL` constant with badge configs for Initial (blue), Demand (orange), Escalation (red)
- Badge rendered inline in each `LetterCard` header below bureau/date
- Undefined letterType defaults to "Initial" badge — fully backward compatible

### Task 4: Human verification (auto-approved)

Auto-approved in --auto mode. TypeScript compilation clean across all three files.

## Verification

TypeScript compilation passes with no errors:
```
cd frontend && npx tsc --noEmit
# Exit: 0
```

All acceptance criteria grep checks pass:
- `RecordResponseDialog` present in component and both consuming pages
- `generateResponseUploadUrl`, `parseResponse`, `recordResponseManual` in dialog
- `generateDemandLetter`, `generateEscalationLetter`, `generateCfpbNarrative`, `updateCfpbStatus`, `getResponsesForUser` in tracker
- `consumerfinance.gov` link in tracker
- `letterType`, `LETTER_TYPE_LABEL`, badge labels in letters page

## Deviations from Plan

None — plan executed exactly as written. All Convex function signatures matched plan spec. RecordResponseDialog controlled via open=true+unmount pattern (parent renders/removes component) rather than Dialog.Trigger, which is cleaner for per-card state management.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f6d2230 | feat(06-04): add RecordResponseDialog component |
| 2 | 06673c2 | feat(06-04): extend tracker page with response recording and escalation actions |
| 3 | 1c07812 | feat(06-04): add letterType badges to letters page |

## Known Stubs

None — all actions call real Convex actions/mutations from Plans 01-03. No hardcoded/placeholder data flows to UI rendering. CFPB narrative content comes from real FastAPI generateCfpbNarrative action.

## Self-Check: PASSED
