# ISS-042 — Prepaid order bill records the pre-discount subtotal, not the amount charged

| Field | Value |
|---|---|
| **Issue ID** | `ISS-042` |
| **Test Case ID(s)** | CUST-ORD-001, OUT-GEN-001 |
| **Module** | Finance / Order Bill Amount |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Prepaid order bill records the pre-discount subtotal, not the amount charged

## Steps to Reproduce

1. Place a wallet-paid order where a promotion applies (subtotal ₹247, discount ₹76, charged ₹171).
2. Compare `orders`, `customer_wallet_transactions` and `customer_bills`.

## Expected Result

The bill's `total_amount` and `paid_amount` equal the amount actually charged (₹171).

## Actual Result

```
orders:      subtotal 247.00  discount_amount 76.00  total_amount 171.00
wallet txn:  debit 171.00
customer_bills (BILLGFYBYUXX9JJ, type=order, prepaid, status=paid):
             total_amount 247.00  paid_amount 247.00  due_amount 0.00
```
The bill overstates both billed and paid amounts by the ₹76 discount. It is marked `paid` for an amount that was never charged.

## Root Cause

The order-bill writer uses the cart subtotal rather than the discounted `orders.total_amount`, and copies the same figure into `paid_amount`. Since `due_amount` is derived as `total − paid`, the row still balances to zero and the error is invisible from the bill alone — it only surfaces when reconciled against the wallet ledger.

## Affected Files / API / Tables

- the order-bill creation path invoked from `POST /customer/checkout/payment`
- `apps/api/src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository.ts:107-133` (bill INSERT)
- Tables: `customer_bills`, `orders`, `customer_wallet_transactions`

## Recommended Fix

Populate the bill from the order's final figures: `subtotal = orders.subtotal`, `discount_amount = orders.discount_amount`, `total_amount = orders.total_amount`, and `paid_amount` from what was actually settled. Add a reconciliation check (or report) asserting, per customer, that `SUM(customer_bills.paid_amount)` for prepaid order bills matches the wallet debits.

## Regression Tests Required

- CUST-ORD-001 (bill matches the charge)
- Discounted-order bill test
- Wallet-vs-bill reconciliation report returns zero variance
- OUT-GEN-001 (monthly bill totals, once ISS-001 is fixed)
