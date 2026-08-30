# ISS-001 — Postpaid monthly billing engine is completely non-functional — no bill can ever be generated

| Field | Value |
|---|---|
| **Issue ID** | `ISS-001` |
| **Test Case ID(s)** | OUT-GEN-001, OUT-GEN-002, E2E-007, E2E-008, EDG-CRN-002 |
| **Module** | Billing / Postpaid Monthly Bill Generation |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Postpaid monthly billing engine is completely non-functional — no bill can ever be generated

## Steps to Reproduce

1. Authenticate as ADMIN.
2. `POST /api/v1/admin/postpaid-bills/generate` with
   `{"customerId":"QA_CUST_POST","periodStart":"2026-08-01","periodEnd":"2026-08-31","dueDate":"2026-09-05"}`.
3. Also `GET /api/v1/admin/postpaid-bills/eligible-customers`.
4. Inspect `customer_bills` for any row produced by the monthly engine.

## Expected Result

A bill row is created in `customer_bills` with `payment_type='postpaid'`, `status='pending'`,
`due_amount = total_amount`, plus one `customer_bill_items` row per delivered order.
`GET /admin/postpaid-bills/eligible-customers` returns the postpaid-enabled customer list.

## Actual Result

- `POST /admin/postpaid-bills/generate` → HTTP 201 with body
  `{"status":false,"action":"failed","customerId":"QA_CUST_POST","message":"column \"first_name\" does not exist","summary":{"eligibleCustomers":1,"generated":0,"skipped":0,"failed":1}}`
- `GET /admin/postpaid-bills/eligible-customers` → HTTP 500 `{"statusCode":500,"message":"Internal server error"}`
- `SELECT bill_type, count(*) FROM customer_bills GROUP BY 1` returns only `order` (42) and
  `subscription` (8) rows. **Zero** monthly postpaid bills exist in the entire production database.

## Root Cause

`CustomerBillingRepository.findEligiblePostpaidCustomers()` and
`CustomerBillingRepository.checkCustomerPostpaidEnabled()` both run:

```sql
SELECT customer_id, first_name, phone, is_postpaid_enabled FROM public.customers ...
```

`customers` has no `first_name` and no `phone` column — those live on `users`
(`users.user_id = customers.customer_id`). PostgreSQL raises `42703 column "first_name" does not exist`.

The monthly cron `handleMonthlyCron()` (`@Cron('0 5 0 1 * *')`) calls `runMonthlyBatchBilling({})`,
which calls the same repository method. The throw is caught and only logged
(`this.logger.error(...)`), so the cron silently produces nothing every month.

Secondary defect in the same query: it does **not** filter `WHERE is_postpaid_enabled = true`,
so once the column error is fixed it would attempt to bill every customer in the system.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository.ts:12-19` (`findEligiblePostpaidCustomers`)
- `apps/api/src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository.ts:30-38` (`checkCustomerPostpaidEnabled`)
- `apps/api/src/panels/admin/customers-orders/customer-billing/services/customer-billing.service.ts:33` (`handleMonthlyCron`), `:149`, `:368`
- Tables: `customers`, `users`, `customer_bills`, `customer_bill_items`

## Recommended Fix

Join `users` for the name/phone columns and filter on the postpaid flag:

```sql
SELECT c.customer_id, u.first_name, u.phone, c.is_postpaid_enabled
FROM public.customers c
JOIN public.users u ON u.user_id = c.customer_id
WHERE c.is_postpaid_enabled = true AND c.deleted_at IS NULL
ORDER BY u.first_name ASC, c.customer_id ASC
```

Apply the same join to `checkCustomerPostpaidEnabled`. Additionally, make `handleMonthlyCron`
surface failures (alert/notification) instead of only writing to the log, so a silent month of
zero billing cannot recur unnoticed.

## Regression Tests Required

- OUT-GEN-001 (bill aggregates only `delivered` orders for the period)
- OUT-GEN-002 (re-run is idempotent, returns `action:'skipped'`)
- EDG-CRN-002 (manual re-trigger on the 1st skips existing bills)
- Regression test asserting only `is_postpaid_enabled = true` customers are billed
- E2E-007 end-to-end postpaid subscription → bill → Razorpay settlement
