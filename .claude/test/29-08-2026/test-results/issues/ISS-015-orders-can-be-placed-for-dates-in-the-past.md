# ISS-015 — Orders can be placed for dates in the past

| Field | Value |
|---|---|
| **Issue ID** | `ISS-015` |
| **Test Case ID(s)** | EDG-CAL-003, CUST-ORD-002 |
| **Module** | Customer / Checkout Date Validation |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Orders can be placed for dates in the past

## Steps to Reproduce

1. As a customer, `POST /api/v1/customer/checkout/payment` with
   `onetime_details.delivery_date = "2026-08-20"` (9 days before today, 2026-08-29) and
   `delivery_slot = "Morning"`.
2. Read back the order.
3. For contrast, place one for today's evening slot (past the 13:00 cutoff).

## Expected Result

The past-dated order is rejected with a 400, exactly as the same-day cutoff rule is enforced.

## Actual Result

The past-dated order is **accepted**:
`{"success":true,"message":"Checkout processed successfully","id":"#F2H-OrdMV8IZG86FJFQ","total_amount":76}`
and is persisted with `scheduled_date = 2026-08-20`.

The same-day cutoff **is** correctly enforced:
`{"message":"Evening delivery slot for today (2026-08-29) closed at 13:00. Please select tomorrow or a later date.","statusCode":400}`

So the validator covers "too late today" but not "before today".

## Root Cause

The slot-cutoff validator compares the requested slot's cutoff time against the current time for
*today's* date only. There is no lower bound asserting
`delivery_date >= <today in Asia/Kolkata>`, so any earlier date passes straight through.

Impact is not cosmetic: a back-dated order lands inside an already-closed billing period, so it
will be picked up by a postpaid bill re-run for that month, distorts delivered-revenue reporting
for a closed day, and will never be routed because run generation for that date has already run.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/cartAndCheckout/ModuleServices/cartAndCheckout.service.ts` (slot/cutoff validation in the checkout path)
- `apps/api/src/panels/customer/cartAndCheckout/dto/cart.dto.ts` (`OnetimeDetailsDto.delivery_date`, currently only `@Matches(DATE_PATTERN)`)
- Table: `orders` (`scheduled_date`)

## Recommended Fix

Add an explicit lower bound in the same validator that already owns the cutoff rule, computed in
`Asia/Kolkata`:

```ts
if (deliveryDate < istToday) {
  throw new BadRequestException(`Delivery date ${deliveryDate} is in the past.`);
}
```
Also cap the upper bound to a sensible horizon (e.g. +30 days). Audit `orders` for existing
back-dated rows before closing.

## Regression Tests Required

- CUST-ORD-002 (valid future date accepted)
- Negative test: yesterday's date rejected
- Boundary test: today's morning slot before/after its cutoff
- EDG-CAL-003 (all comparisons evaluated in `Asia/Kolkata`, not server local time)
