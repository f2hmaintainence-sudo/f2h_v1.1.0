# FU-006 — Postpaid billing lifecycle: generation, status vocabulary, and outstanding enforcement

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-006` |
| **Related Test Case(s)** | OUT-GEN-001, OUT-GEN-002, OUT-PAY-001, OUT-PAY-002, OUT-PAY-003, OUT-REM-001, SUB-CRT-002, EDG-CRN-002, E2E-007, E2E-008 |
| **Status** | Documented — not implemented |
| **Raised** | 2026-08-29 |

## Current Behaviour

Postpaid billing has never produced a bill. `findEligiblePostpaidCustomers()` and
`checkCustomerPostpaidEnabled()` select `first_name` / `phone` from `customers`, where those
columns do not exist, so both the monthly cron and the manual admin trigger fail (ISS-001). The
eligibility query also lacks a `WHERE is_postpaid_enabled = true` filter.

Downstream, the status vocabulary has drifted: bills are written as `'pending'`, but the
subscription outstanding-bill guard filters on `('unpaid','due','overdue')`, so it can never fire
(ISS-017). Because no bill exists, the reminder cron, the outstandings ledger, PDF receipts and
settlement flows are all untestable today.

## Required Behaviour

A monthly billing run that reliably produces one correct bill per eligible postpaid customer, a
single agreed status vocabulary used by every consumer, and an outstanding-bill guard that actually
blocks new postpaid commitments.

## Exact Implementation Requirement

1. Fix the two repository queries to join `users` and filter on `is_postpaid_enabled = true`
   (see ISS-001 for the exact SQL).
2. Standardise `customer_bills.status` on `pending | partially_paid | paid | overdue | cancelled`,
   drive it from one shared constant, and add a `CHECK` constraint. Update the subscription guard
   to `status IN ('pending','partially_paid','overdue')`.
3. Make `handleMonthlyCron` surface failures — an admin notification and a health metric — so a
   silent zero-bill month cannot recur unnoticed.
4. Verify the aggregation rule end to end: only `status='delivered'` orders in the period are
   billed; paused, failed and cancelled days are excluded; `checkBillExists` makes a re-run
   idempotent (`action: 'skipped'`).
5. Compute period boundaries in `Asia/Kolkata` (the cron runs at 00:05 IST, inside the timezone
   divergence window — see ISS-032 / FU-007).
6. Fix the order-bill amount so bills record the charged total rather than the pre-discount
   subtotal (ISS-042), and add a wallet-vs-bill reconciliation report.

## Affected Modules / Files

- `apps/api/src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository.ts:12`, `:30`, `:107`
- `apps/api/src/panels/admin/customers-orders/customer-billing/services/customer-billing.service.ts:33`, `:51`, `:149`, `:313`, `:368`
- `apps/api/src/panels/customer/subscriptions/ModuleServices/subscriptions.service.ts:140-157`
- `apps/api/src/panels/admin/finance/**` (outstandings ledger, settlement)
- Tables: `customer_bills`, `customer_bill_items`, `orders`, `customers`, `users`

## Database / API Impact

Database: `CHECK` constraint on `customer_bills.status`; existing rows are all `paid`, so no
back-fill is expected — verify before applying.
API: `/admin/postpaid-bills/eligible-customers` starts returning 200; `/admin/postpaid-bills/generate`
starts producing bills. Postpaid subscription checkout will begin rejecting customers who have
outstanding bills — a behaviour change to communicate before release.

## Acceptance Criteria

- The monthly cron generates exactly one bill per eligible postpaid customer for the period.
- The bill total equals the sum of that period's `delivered` orders; paused and failed days are excluded.
- A re-run for the same customer and period returns `action: 'skipped'` and creates nothing.
- Only `is_postpaid_enabled = true` customers are billed.
- Postpaid subscription checkout is blocked while any bill with `due_amount > 0` is unsettled.
- Full, partial and FIFO multi-bill settlement all reconcile across DB, admin ledger and the customer app.

## Required Regression Tests

- OUT-GEN-001, OUT-GEN-002, OUT-PAY-001, OUT-PAY-002, OUT-PAY-003, OUT-REM-001
- SUB-CRT-002 Test A, EDG-CRN-002
- E2E-007, E2E-008
- Section 2.4 of `05-outstanding-bills.md` (cross-surface consistency matrix)
