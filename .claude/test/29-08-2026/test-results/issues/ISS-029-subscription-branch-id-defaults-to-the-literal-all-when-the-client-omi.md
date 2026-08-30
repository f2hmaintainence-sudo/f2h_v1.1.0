# ISS-029 — Subscription `branch_id` defaults to the literal `'ALL'` when the client omits it

| Field | Value |
|---|---|
| **Issue ID** | `ISS-029` |
| **Test Case ID(s)** | SUB-CRT-001, DSP-PLN-001, E2E-012 |
| **Module** | Subscriptions / Branch Assignment |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Subscription `branch_id` defaults to the literal `'ALL'` when the client omits it

## Steps to Reproduce

1. `POST /api/v1/customer/subscriptions/checkout` **without** `branch_id`.
2. `SELECT branch_id FROM subscriptions WHERE subscription_id = '<new>';`
3. `GET /api/v1/admin/orders/dispatch/pre-summary?date=2026-08-30&slot=morning`.

## Expected Result

The subscription inherits the branch of its delivery address (or of the customer), so its generated orders group under a real branch for routing and dispatch.

## Actual Result

`subscriptions.branch_id = 'ALL'` — not a real branch id. The pre-dispatch summary then reports the line under a phantom branch:
```json
{"branch_id":"ALL","product_variant_id":"VRT0NFGWE8WG","total_quantity":"2","subscription_count":"1"}
```
alongside genuine branches. Such a subscription's orders will not be picked up by branch-scoped run generation or warehouse dispatch planning.

## Root Cause

`SubscriptionsService.checkout` takes the branch straight from the request body with a literal fallback:

```ts
const branchId = body.branch_id || DEFAULT_BRANCH_ID;   // DEFAULT_BRANCH_ID = 'ALL'
```

It never derives the branch from `customer_addresses.branch_id` (which the address flow already resolves) or from `customers.branch_id`. Sending `branch_id` explicitly works, so correctness depends entirely on the mobile client always populating it.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/subscriptions/ModuleServices/subscriptions.service.ts:467`, `:521`, `:555`
- Tables: `subscriptions`, `customer_addresses`, `branches`

## Recommended Fix

Resolve the branch server-side from the subscription's `address_id` (falling back to `customers.branch_id`), and reject the checkout when no branch can be resolved. Remove the `'ALL'` sentinel, and add a foreign key from `subscriptions.branch_id` to `branches.branch_id` so a phantom value cannot be stored.

## Regression Tests Required

- SUB-CRT-001 (subscription carries the address's branch)
- DSP-PLN-001 (generated orders group under a real branch)
- E2E-012 (geofence → subscription → dispatch)
- Data audit for existing `branch_id = 'ALL'` rows
