# ISS-037 — `subscription_number` is a per-customer value reused across all of that customer's subscriptions

| Field | Value |
|---|---|
| **Issue ID** | `ISS-037` |
| **Test Case ID(s)** | ADM-SUB-001 |
| **Module** | Subscriptions / Identifiers |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`subscription_number` is a per-customer value reused across all of that customer's subscriptions

## Steps to Reproduce

1. Create two subscriptions for the same customer.
2. `SELECT subscription_id, subscription_number, customer_id FROM subscriptions ORDER BY created_at;`

## Expected Result

Each subscription carries a distinct human-readable number, so the admin ledger can identify a specific subscription.

## Actual Result

Both new subscriptions share one number, and the pattern repeats in existing production data:
```
SUB_MTEAXM4QC04R | SUBNO1788003188810 | QA_CUST_PRE
SUB_MTEB2QBM1FY0 | SUBNO1788003188810 | QA_CUST_PRE
SUB_MSIYKVBR1E89 | SUBNO1786105534150 | F2HQFK7NH
SUB_MSOHIKRCCLNA | SUBNO1786105534150 | F2HQFK7NH
SUB_MSQ1G384N1EH | SUBNO1786105534150 | F2HQFK7NH
SUB_MT5K2OFEZD6U | SUBNO1786105534150 | F2HQFK7NH
```
Four of that customer's subscriptions are indistinguishable by number in the admin list.

## Root Cause

The number is allocated per customer and cached on `customers.subscription_number`, then copied onto every subscription that customer creates. It is a *customer* subscription reference, but it is stored and displayed as if it identified a subscription.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/subscriptions/ModuleServices/subscriptions.service.ts` (subscription INSERT)
- Tables: `subscriptions.subscription_number`, `customers.subscription_number`

## Recommended Fix

Decide which entity the number identifies. If it is per subscription, generate a fresh value per row and add a unique index. If it is genuinely a customer-level reference, rename it (`customer_subscription_ref`) and give `subscriptions` its own sequential display number (e.g. `SUB-2026-000123`) for the admin ledger.

## Regression Tests Required

- ADM-SUB-001 (each subscription is uniquely identifiable in the ledger and searchable by its number)
- Uniqueness constraint test after migration
