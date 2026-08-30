# ISS-005 — Order cancellation reports success but the transaction rolls back — order stays active and no refund is paid

| Field | Value |
|---|---|
| **Issue ID** | `ISS-005` |
| **Test Case ID(s)** | CUST-ORD-003, RFD-ORD-001 |
| **Module** | Customer / Order Cancellation & Wallet Refund |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Order cancellation reports success but the transaction rolls back — order stays active and no refund is paid

## Steps to Reproduce

1. As a customer with a wallet balance, place a wallet-paid one-time order (`OrdG86R9EV88B6H`, ₹456).
2. `POST /api/v1/customer/orders/OrdG86R9EV88B6H/cancel` with `{"reason":"Ordered by mistake"}`.
3. Read back `orders`, `customers.wallet_balance`, `customer_wallet_transactions`, `refunds`.

## Expected Result

`orders.status = 'cancelled'`, wallet credited by ₹456, one `credit` row in
`customer_wallet_transactions` with `reference_type='refund'`, and a `processed` row in `refunds`.

## Actual Result

API returns HTTP 201 `{"status":true,"message":"Order cancelled successfully"}`, but the database
is completely unchanged:

```
order_id          | status | payment_status | total_amount
OrdG86R9EV88B6H   | placed | paid           | 456.00

wallet_balance = 213.00   (unchanged)
customer_wallet_transactions: no credit row
refunds: 0 rows
```

The customer is told the order is cancelled and refunded while the order remains live and will
still be dispatched and charged. Repeating the call reproduces it every time.

## Root Cause

Captured from `apps/api/logs/app.log` during the call:

```
ERROR : Database Error (shared conn) {"table":"customer_wallet_transactions","errorCode":"22001","error":"value too long for type character varying(20)"}
ERROR : Database Error (shared conn) {"table":"refunds","errorCode":"25P02","error":"current transaction is aborted..."}
ERROR : Database Error (shared conn) {"table":"notifications","errorCode":"25P02","...}
```

`customer_wallet_transactions.transaction_id` is `varchar(20)` and its column default was created
as a **quoted string literal instead of an expression**:

```
default_expr = '(''WTR_''::text || upper(substr((gen_random_uuid()), 1, 12)))'::character varying
```

That literal is 59 characters, so every INSERT that omits `transaction_id` fails with
`22001 value too long`. The checkout path works only because it supplies `transaction_id`
explicitly; the cancel path does not.

Once the first statement fails the whole transaction aborts, the earlier
`UPDATE orders SET status='cancelled'` is rolled back — but `DataService.insert/update` return
`{status:false}` instead of throwing, so the controller runs to completion and returns success
(see ISS-041).

## Affected Files / API / Tables

- Schema: `customer_wallet_transactions.transaction_id` column default (`varchar(20)`)
- `apps/api/src/panels/customer/orders/controllers/customer.order.controller.ts:583-640` (cancel transaction body)
- `apps/api/src/shared/database/Data.service.ts` (error-swallowing write helpers)

## Recommended Fix

1. Repair the column default:
```sql
ALTER TABLE customer_wallet_transactions
  ALTER COLUMN transaction_id SET DEFAULT ('WTR_' || upper(substr(gen_random_uuid()::text, 1, 12)));
```
(and widen to `varchar(32)` for headroom).
2. Have the cancel path generate and pass `transaction_id` explicitly, like checkout does.
3. Make the transaction fail loudly — see ISS-041 — so a rolled-back cancel returns 5xx rather
   than a success message.
Also note the pre-existing condition bug on the same lines:
`order.payment_mode === 'wallet' || order.payment_mode === 'upi' && refundAmount > 0`
binds `&&` tighter than `||`, so a wallet order with `refundAmount = 0` still enters the refund
branch. Parenthesise it.

## Regression Tests Required

- CUST-ORD-003 (cancel → status `cancelled`, wallet restored, ledger + `refunds` rows written)
- RFD-ORD-001 (single-transaction refund with `reference_type='order_refund'`)
- Negative test: a failed inner write must roll back **and** return an error to the client
- Regression test inserting into `customer_wallet_transactions` without `transaction_id`
