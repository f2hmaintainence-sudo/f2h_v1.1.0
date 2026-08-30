# ISS-043 — Customer-supplied pause reason is discarded and replaced with a hard-coded string

| Field | Value |
|---|---|
| **Issue ID** | `ISS-043` |
| **Test Case ID(s)** | SUB-PAUS-001, CUST-SUB-002 |
| **Module** | Subscriptions / Pause |
| **Severity** | **Low** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Customer-supplied pause reason is discarded and replaced with a hard-coded string

## Steps to Reproduce

1. `POST /api/v1/customer/subscriptions/SUB_MTEB2QBM1FY0/pause` with `{"startDate":"2026-09-10","endDate":"2026-09-15","reason":"Vacation"}`.
2. `SELECT reason FROM subscription_pauses WHERE subscription_id = 'SUB_MTEB2QBM1FY0';`

## Expected Result

`reason = 'Vacation'` — the reason the customer chose, preserved for the admin pause-history audit.

## Actual Result

`reason = 'Customer vacation pause'` for every pause, regardless of what was submitted. The same literal is copied to `subscriptions.pause_reason`. The pause itself is created correctly (dates, status, `subscriptions.pause_from_date`/`pause_to_date`, and the `subscription_logs` entry are all right) — only the reason is lost.

## Root Cause

The pause handler ignores `body.reason` and writes a constant. The admin pause-history audit (ADM-SUB-002) therefore shows the same reason for every pause and cannot distinguish vacation from illness, travel, or a service complaint.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/subscriptions/controllers/subscriptions.controller.ts` (`@Post(':id/pause')`) and its service
- Tables: `subscription_pauses.reason`, `subscriptions.pause_reason`

## Recommended Fix

Persist the submitted reason, validated against the app's reason list with a free-text fallback, and use the constant only when nothing is supplied.

## Regression Tests Required

- SUB-PAUS-001 / CUST-SUB-002 (submitted reason stored)
- ADM-SUB-002 (pause history shows distinct reasons)
- Default applied when no reason is sent
