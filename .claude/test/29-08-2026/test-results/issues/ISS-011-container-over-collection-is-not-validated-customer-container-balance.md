# ISS-011 — Container over-collection is not validated — customer container balance goes negative

| Field | Value |
|---|---|
| **Issue ID** | `ISS-011` |
| **Test Case ID(s)** | CONT-LGT-002, EDG-LGT-001 |
| **Module** | Delivery / Container Collection Validation |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Container over-collection is not validated — customer container balance goes negative

## Steps to Reproduce

1. Customer `QA_CUST_PRE` starts with no container balance; order `OrdMOCB3B10KA70` delivers
   3 × `VRT0NFGWE8WG` (linked to returnable container `CONT-001`). Maximum collectable = 3.
2. `PATCH /api/v1/delivery/orders/run/RUN-20260830-MOR-002/address/ADDRCUU7OT/deliver`
   with `{"status":"delivered","container_returns":[{"container_id":"CONT-001","returned":5}]}`.
3. Read back `customer_container_balances` and `delivery_container_reconciliation`.

## Expected Result

HTTP 400 — *"Cannot collect 5 containers. Customer only has 0 outstanding containers
(plus 3 delivered in this order)."* — and the whole mutation is rolled back.

## Actual Result

HTTP 200 `{"success":true,"message":"Stop marked as delivered successfully"}`. The balance is
driven negative:

```
customer_id  | container_id | issued_quantity | returned_quantity | balance_quantity
QA_CUST_PRE  | CONT-001     | 3               | 5                 | -2
```

and the run reconciliation records `collected_quantity = 5`, `discrepancy_quantity = 5`.

## Root Cause

`markStopDelivered` → `handleContainerReturn` writes the submitted `returned` / `damaged` / `lost`
figures straight into `customer_container_balances` with no upper-bound check against
`balance_quantity + <containers issued in this order>`. There is no `CHECK (balance_quantity >= 0)`
constraint on the table either, so the database accepts the negative value.

Because collected empties feed `delivery_container_reconciliation` and (once ISS-007 is fixed)
warehouse container stock, an unvalidated figure inflates warehouse asset counts.

## Affected Files / API / Tables

- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:464+` (`handleContainerReturn`)
- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:990-1085` (`markStopDelivered`)
- Tables: `customer_container_balances`, `delivery_container_reconciliation`

## Recommended Fix

Inside the delivery transaction, lock and validate before writing:

```sql
SELECT balance_quantity FROM customer_container_balances
 WHERE customer_id = $1 AND container_id = $2 FOR UPDATE
```
then reject when `returned + damaged + lost > balance_quantity + issued_in_this_order`
with a 400 carrying the allowed maximum. Add
`ALTER TABLE customer_container_balances ADD CONSTRAINT chk_balance_non_negative CHECK (balance_quantity >= 0);`
as a backstop, and repair the existing negative row.

## Regression Tests Required

- CONT-LGT-001 (issue 2, return 1 → balance moves 3 → 4)
- CONT-LGT-002 / EDG-LGT-001 (over-collection rejected with 400, transaction rolled back)
- EDG-LGT-002 (damaged bottles recorded separately and reflected in reconciliation)
- Constraint test: no code path can drive `balance_quantity` below zero
