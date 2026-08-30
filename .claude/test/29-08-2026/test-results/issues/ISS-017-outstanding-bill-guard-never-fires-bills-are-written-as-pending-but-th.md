# ISS-017 — Outstanding-bill guard never fires — bills are written as `pending` but the guard only checks `unpaid`/`due`/`overdue`

| Field | Value |
|---|---|
| **Issue ID** | `ISS-017` |
| **Test Case ID(s)** | SUB-CRT-002, OUT-PAY-003, E2E-008 |
| **Module** | Subscriptions / Outstanding Bill Gating |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Outstanding-bill guard never fires — bills are written as `pending` but the guard only checks `unpaid`/`due`/`overdue`

## Steps to Reproduce

1. Ensure a postpaid customer has an unpaid bill with `due_amount > 0` and `status = 'pending'`.
2. `POST /api/v1/customer/subscriptions/checkout` with `payment_type: "postpaid"`.
3. Observe whether `outstanding_bills_exist` is returned.

## Expected Result

Rejected with
`{"status":false,"error_code":"outstanding_bills_exist","message":"You have 1 unpaid bill(s)..."}`.

## Actual Result

The guard does not trigger, because the status value it looks for is never written.

Guard (`subscriptions.service.ts:140-157`):
```sql
SELECT COUNT(*)::int AS cnt, COALESCE(SUM(due_amount),0) AS total_due
FROM customer_bills
WHERE customer_id = $1 AND status IN ('unpaid','due','overdue') AND due_amount > 0
```
Bill creation (`customer-billing.service.ts:313`):
```ts
const status = paidAmount >= totalAmount ? 'paid' : 'pending';
```
`'pending'` is not in the guard's list, so `cnt` is always 0 and the check is a no-op. The rest of
the codebase treats `pending` as the unpaid state — the billing repository's own filter reads
`LOWER(pb.status) = 'pending' OR ... = 'unpaid' OR ... = 'partial'`.

The credit-limit branch of the same gate **does** work
(`{"status":false,"error_code":"credit_limit_exceeded","credit_limit":5000,"requested":6000}`),
so only the outstanding-bill half is dead.

This is currently masked by ISS-001 (no postpaid bill can be generated at all); once that is fixed
this defect becomes live and lets indebted customers keep adding postpaid subscriptions.

## Root Cause

`customer_bills.status` uses two incompatible vocabularies. The billing engine writes
`'pending'` for an unpaid bill (`customer-billing.service.ts:313`:
`const status = paidAmount >= totalAmount ? 'paid' : 'pending';`), while the subscription guard
filters on `status IN ('unpaid','due','overdue')`. `'pending'` appears in neither list, so `cnt`
is always 0 and the branch is unreachable.

The rest of the codebase agrees with the billing engine, not the guard — the billing repository's
own filter reads `LOWER(pb.status) = 'pending' OR ... = 'unpaid' OR ... = 'partial'`
(`customer-billing.repository.ts:252-254`). The guard is the outlier.

The credit-limit half of the same gate works because it reads numeric commitments rather than a
status string.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/subscriptions/ModuleServices/subscriptions.service.ts:140-157` (unpaid-bill guard)
- `apps/api/src/panels/admin/customers-orders/customer-billing/services/customer-billing.service.ts:313` (status assignment)
- `apps/api/src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository.ts:252-254` (the correct status list)
- Table: `customer_bills.status`

## Recommended Fix

Settle on one vocabulary for `customer_bills.status` and apply it everywhere. Recommended set:
`pending | partially_paid | paid | overdue | cancelled`. Then fix the guard to
`status IN ('pending','partially_paid','overdue','unpaid','due')` (keeping legacy values during
migration) and drive it from a shared constant rather than three hand-written lists. Consider a
`CHECK` constraint or enum on the column so a new value cannot silently diverge again.

## Regression Tests Required

- SUB-CRT-002 Test A (postpaid checkout blocked while a `pending` bill with `due_amount > 0` exists)
- SUB-CRT-002 Test B (credit-limit rejection still works — currently passing, must not regress)
- OUT-PAY-003 (settling the bill unblocks postpaid checkout)
- E2E-008 (multi-bill partial → full settlement)
