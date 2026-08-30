# ISS-009 — IDOR — any authenticated customer can read any other customer's order, including full PII

| Field | Value |
|---|---|
| **Issue ID** | `ISS-009` |
| **Test Case ID(s)** | ADM-AUTH-003 (security), CUST-ORD-001 |
| **Module** | Customer API / Authorization |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

IDOR — any authenticated customer can read any other customer's order, including full PII

## Steps to Reproduce

1. Authenticate as customer `QA_CUST_PRE`.
2. `GET /api/v1/customer/orders/Ord1NP5SXYQ63LI` — an order belonging to a different customer (`F2HQFK7NH`).
3. `GET /api/v1/customer/orders/Ord1NP5SXYQ63LI/tracking`.
4. For contrast, `POST /api/v1/customer/orders/Ord1NP5SXYQ63LI/cancel`.

## Expected Result

Reading another customer's order returns 403/404 and discloses nothing.

## Actual Result

Both read endpoints return HTTP 200 with the other customer's complete record:

```json
{"status":true,"order":{"order_id":"Ord1NP5SXYQ63LI","customer_id":"F2HQFK7NH",
 "customer_name":"Rajesh khan",
 "address_line":"Flat 256, 5 Palamaner - Krishnagiri Road, ... Kuppam, Andhra Pradesh, 517425",
 "contact_number":"7680980647","payment_mode":"online","payment_status":"paid",
 "delivery_partner_id":"F2HVOD3GJ","total_amount":"1.00", ...},"items":[...]}
```

Disclosed: full name, complete delivery address, phone number, order value, payment mode and
status, assigned delivery partner and run. `/tracking` also returns 200.

`POST /:id/cancel` **is** correctly scoped (`400 Order not found`), which confirms the ownership
predicate exists elsewhere in the same controller and was simply omitted on the read paths.

## Root Cause

`GET /customer/orders/:id` and `GET /customer/orders/:id/tracking` look the order up by
`order_id` alone and never constrain it to the authenticated `customer_id` from the JWT. The
cancel handler builds its query with both predicates
(`order_id = :id AND customer_id = :customer_id`), so the omission is inconsistent within the
same controller rather than a missing concept.

Order ids are short (`Ord1NP5SXYQ63LI`), so this is enumerable at scale by any registered user.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/orders/controllers/customer.order.controller.ts` — the `@Get(':id')` and `@Get(':id/tracking')` handlers
- Contrast with the correctly-scoped `@Post(':id/cancel')` at `:497`
- Table: `orders`, `order_items`, `customer_addresses`

## Recommended Fix

Add the ownership predicate to every customer-scoped lookup, exactly as the cancel path does:

```ts
where: [
  { column: 'order_id',   operator: '=', value: orderId },
  { column: 'customer_id', operator: '=', value: req.user.user_id },
]
```

Return 404 (not 403) so order ids are not confirmed to exist. Then sweep the rest of
`src/panels/customer/**` for any other `:id` handler that resolves a record without binding it to
the caller, and add a shared guard/interceptor so new endpoints inherit the check.

## Regression Tests Required

- Negative authorization test on every customer `:id` endpoint (orders, tracking, bills, subscriptions, addresses, payments)
- Regression test: customer A requesting customer B's order id receives 404 and an empty body
- Add to the security review checklist for any new customer route
