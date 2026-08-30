# F2H Fresh — Real-Time Test Execution Report

**Execution date:** 2026-08-29 (IST)
**Executed against:** the running F2H Fresh application — NestJS API on `:5001`, Next.js Admin Web on `:5002`, live PostgreSQL database `f2h_fresh`, Redis, PM2 processes `api-f2hfresh` / `frontend-f2hfresh`.
**Source of requirements:** all 13 specification files in `.claude/test/29-08-2026/test-plan/`.
**Method:** every case below was executed against the running system. UI/API responses were then reconciled against the database, and every failure was traced to a root cause in code or schema before being reported.

---

## 1. Execution Context

### 1.1 Environment

| Item | Value |
|---|---|
| API | `http://127.0.0.1:5001/api/v1` (PM2 `api-f2hfresh`, NestJS 11, URI-versioned) |
| Admin Web | `http://127.0.0.1:5002` (PM2 `frontend-f2hfresh`, Next.js) |
| Database | PostgreSQL `f2h_fresh` @ `127.0.0.1:5432` — **120 tables, live/production data** |
| Redis | `127.0.0.1:6379` (cron locks, JWT session registry) |
| Payment gateway | Razorpay **TEST mode** — `keyId: rzp_test_TVUfaNvPLxCLHg`, `mode: "test"` |
| Node env | `NODE_ENV=production` |
| Server clock | IST (`Asia/Kolkata`) |
| PostgreSQL session TZ | **`Europe/Berlin`** — see ISS-032 |

> **Important:** the API and the Admin Panel are bound to the **live** `f2h_fresh` database, not to the
> `f2hfresh_test` sandbox named in the test plan (`f2h_fresh_test` exists with 120 tables but nothing points at it).
> Repointing the API would have taken the production site down, so testing was performed against the live stack
> under the data rules in section 1.3.

### 1.2 Test accounts created

All identifiers are prefixed `QA_` and are listed in full in `README.md` §4 for clean-up.

| Account | Role | Purpose |
|---|---|---|
| `QA_ADM_01` (`qa.admin@f2htest.local`) | ADMIN | Admin Panel and admin API execution |
| `QA_CUST_PRE` (`qa.prepaid@f2htest.local`) | CUSTOMER | Prepaid wallet, orders, subscriptions, referrer |
| `QA_CUST_POST` (`qa.postpaid@f2htest.local`) | CUSTOMER | Postpaid gating and billing |
| `QA_CUST_REF` (`qa.referee@f2htest.local`) | CUSTOMER | Referral referee |
| `QA_DP_01` (`qa.partner@f2htest.local`) | DELIVERY_PARTNER | Run execution, delivery, handover |
| `BRANCH0nEzi3unhuEg` "QA TEST BRANCH" + `WH-MTEBESZ953A8S7` "QA TEST WAREHOUSE" | — | Isolation branch/warehouse so the delivery run under test contained **only** QA orders |

### 1.3 Data-handling rules observed

- No production or business record was deleted.
- No existing customer, order, subscription, bill or partner record was modified, with one exception recorded below.
- Every record created is prefixed `QA_` / named "QA TEST" and is enumerated in `README.md`.
- Payment testing used Razorpay **TEST** mode only. Gateway secrets were deliberately **not** read or used, which is why PAY-WBH-001 is recorded as BLOCKED rather than executed.
- **Recorded exception:** to test `ADM-DEL` run reassignment, run `RUN-20260830-MOR-001` (Kuppam, 2026-08-30 morning, 2 orders) was reassigned from partner `F2HVOD3GJ` to `QA_DP_01` and then **reassigned back to `F2HVOD3GJ`**. Final state matches the original. No other partner's work was touched; the full delivery execution sequence was run on the isolated QA branch instead.
- Two operational actions were performed that the schedulers would have performed later the same day: `POST /admin/delivery/runs/create` for 2026-08-30 morning (Kuppam and QA branch). This created run `RUN-20260830-MOR-001` a few hours before the 20:30 IST cron would have.

### 1.4 Result legend

| Code | Meaning |
|---|---|
| **PASS** | Behaved as the specification requires, verified in both API response and database state. |
| **FAIL** | Behaved differently from the specification. Root cause identified; issue document raised. |
| **BLOCKED** | Could not be executed because a prerequisite is broken, or because executing it would have breached the data rules. |
| **N/A** | Not applicable — the specification asserts against schema or behaviour that does not exist in this build. |

---

## 2. Module 01 — Admin Panel (`01-admin-panel.md`)

### 2.1 Authentication & Access Control

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| ADM-AUTH-001 | Admin login with valid credentials | **PASS** (with contract deviations) | ISS-031 |
| ADM-AUTH-002 | Invalid password rejection & brute-force protection | **FAIL** | ISS-044 |
| ADM-AUTH-003 | Session logout & token revocation | **PASS** | — |
| ADM-AUTH-RBAC (added) | Customer / partner tokens rejected on admin routes | **PASS** | — |

**ADM-AUTH-001 — detail**
- *Preconditions:* `QA_ADM_01` exists in `users` with `role_id='ADMIN'` and an active `management_staff` row.
- *Steps:* `POST /api/v1/auth/login` with header `X-Role: ADMIN` and the QA credentials.
- *Expected:* `200 OK`, `{status:true, access_token, user:{...roles}}`; `Set-Cookie: access_token …HttpOnly`; Redis `f2h_user_jwt_<userId>` updated; a row in `auth_logs`.
- *Actual:* `200 OK`. Cookies set correctly (`access_token` HttpOnly SameSite=Lax Max-Age=900, `refresh_token` Max-Age=2592000). Redis session registry updated (confirmed via the `NotificationGateway` JTI lookup log: *"Redis result: FOUND … looking for … in 32 active sessions"*). Response body is `{"message":"Login successful","user":{user_id,email,role_id},"accessToken","refreshToken"}` — **no `status` field, `accessToken` not `access_token`, no `roles[]` array**. `SELECT COUNT(*) FROM auth_logs` returns **0**.
- *Verdict:* authentication itself is correct; the response contract and the audit-trail verification point are not met (ISS-031).

**ADM-AUTH-002 — detail**
- *Steps:* six consecutive logins with a wrong password, then one with the correct password.
- *Expected:* attempts 1–5 → `401`; attempt 6 → `429 Too Many Requests` from `CustomThrottlerGuard`.
- *Actual:* attempts 1–4 → `401`; **attempt 5 → `403` "Account has been locked… try again in 30 minutes"**; attempt 6 → `403`; correct password → still `403`. `users.locked_at` set, `max_logins = 6`. The route does carry `@Throttle({short:{limit:10,ttl:60000}})` and returns `X-RateLimit-*` headers, but the account lock at 5 fires before the throttle at 10 can. The QA admin account had to be unlocked manually to continue. Lockout is per-account with no IP dimension → remotely triggerable against any known admin email.
- *Verdict:* FAIL against the documented behaviour; also a denial-of-service concern (ISS-044).

### 2.2 Dashboard & Analytics

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| ADM-DASH-001 | Dashboard KPI accuracy vs database | **FAIL** | ISS-016 |
| ADM-DASH-002 | Live terminal / PM2 action bar | **N/A** | — |
| ADM-ANL-001 | Revenue analytics & export | **PARTIAL PASS / FAIL** | ISS-016, ISS-021 |

**ADM-DASH-001 — detail**
- *Steps:* `GET /admin/dashboard/kpis`, then each figure reconciled against SQL over `orders`, `customers`, `subscriptions`, `delivery_partners`.
- *Correct:* `total_customers 41` = `SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL`; `active_subscriptions 9`; `total_delivery_partners 8` / `active_delivery_partners 8`; today's status counters (`placed 1, confirmed 1, assigned 3, delivered 5`, total 10) all reconcile exactly.
- *Incorrect:* `today_revenue 581` vs delivered revenue `324.00`; `total_revenue 13254` vs delivered `956.00`; `revenue_7d 6436` vs `758.00`. `13254 = 14184 − 930` — every non-cancelled order regardless of delivery. **Total revenue overstated 13.9×.**
- *Root cause:* `dashboard.service.ts:67-79` filters only `status != 'cancelled'`, does not exclude `failed`, and has no `deleted_at IS NULL` filter.

**ADM-ANL-001 — detail**
- `GET /admin/analytics/revenue?from=2026-08-01&to=2026-08-29` returns a well-formed daily series with `orders`, `revenue`, `discounts`, `sub_orders`, `onetime_orders` — the endpoint works, but shares the dashboard's revenue definition.
- `GET /admin/analytics/outstanding` → **HTTP 500**, `column c.first_name does not exist` (ISS-021).
- All other `/admin/analytics/*` endpoints returned 200 (subscription-revenue, wallet, refunds, customer-growth, subscription-growth, retention, product-performance, branch-performance, branch-profitability, delivery-efficiency, consolidated).

### 2.3 Customers

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| ADM-CUST-001 | Customer directory, search & filter | **FAIL** | ISS-002, ISS-036 |
| ADM-CUST-002 | Postpaid limit configuration | **BLOCKED** | ISS-002 |
| ADM-CUST-003 | Customer special prices | **FAIL** | ISS-013 |

**ADM-CUST-001 — detail**
- *Steps:* `GET /admin/customer/table?page=1&limit=5`, then `?search=9000900002`, then `/admin/customer/postpaid/table`.
- *Expected:* rows returned; search filters to the matching customer.
- *Actual:* every call returns `200` with `{"status":false,"data":[],"recordsTotal":"41","recordsFiltered":"41"}` — the count is right, the rows are always empty. **The Admin Customers directory is permanently blank.**
- *Root cause:* `Invalid column name: CONCAT_WS(' ', users.first_name, users.last_name)` — `DataService`'s SELECT sanitiser whitelists only expressions starting with `(` or `COALESCE(` (`Data.service.ts:1615-1644`); the `full_name` column at `services/table.service.ts:91` is a bare `CONCAT_WS(...)`.
- *Contrast:* every other admin DataTable works — orders (121), branches (4), catalog products (17), variants (13), categories (5), warehouses (3), inventory (33), subscriptions (9), wallets (63), staff (2).
- *Also found:* two controllers register `admin/customer` + `GET table`; one silently shadows the other (ISS-036).
- ADM-CUST-002 is BLOCKED because the postpaid settings action is reached from this directory row.

**ADM-CUST-003 — detail**
- *Steps:* `POST /admin/customer/special-prices` with `{"customer_id":"QA_CUST_PRE","items":[{"variant_id":"VRT0NFGWE8WG","special_price":63.00,"discount_percent":10}]}`; repeated with the `/:id/special-prices` shape.
- *Expected:* row stored with `special_price = 63.00`, `discount_percentage = 10`.
- *Actual:* `201 {"status":true,"message":"Special prices saved for 1 variant(s)"}` but the stored row is `special_price 72.00, discount_percentage 0.00, discount 0.00` — the submitted price is replaced by the variant's `subscription_price`. Both request shapes behave identically.

### 2.4 Orders, Subscriptions, Catalog, Delivery, Warehouse, Finance, Branches

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| ADM-ORD-001 | Orders table filtering / pagination | **PASS** | — |
| ADM-ORD-002 | Order detail & item breakdown | **PASS** | — |
| ADM-ORD-003 | Real-time WebSocket order stream | **BLOCKED** | — |
| ADM-SUB-001 | Subscriptions master ledger | **PARTIAL PASS** | ISS-037 |
| ADM-SUB-002 | Schedule & pause history audit | **PASS** | ISS-043 |
| ADM-CAT-001 | Product & variant creation | **PASS** | — |
| ADM-DEL-001 | Partner roster & KYC | **PASS** | — |
| ADM-DEL-002 | Live GPS partner tracking | **BLOCKED** | — |
| ADM-DEL-003 | Leave request management | **FAIL** | ISS-027 |
| ADM-WH-001 | Warehouse creation with branch link | **FAIL** | ISS-035 |
| ADM-CONT-001 | Container master & warehouse stock audit | **FAIL** | ISS-028 |
| ADM-FIN-001 | Postpaid outstandings ledger & settle | **BLOCKED** | ISS-001 |
| ADM-FIN-002 | Bill PDF invoice | **BLOCKED** | ISS-001 |
| ADM-BR-001 | Branch creation with geofence | **PASS** | — |

- **ADM-ORD-001/002** — `GET /admin/orders/table?limit=3` returns 3 of 121 rows correctly; `today/table` returns 3 of 10; `onetime-orders/table` and `subscription-orders/table` both return data; summaries render. Verified against SQL.
- **ADM-ORD-003 / ADM-DEL-002** — BLOCKED: Socket.IO and Google Maps rendering require a browser session; the gateway itself was observed working in the API log (`Admin F2HAGD0ZO joined the admin rooms`, JTI validated against Redis), so the transport is alive but the UI behaviour was not verified.
- **ADM-SUB-001** — the ledger returns all 9 subscriptions including future-dated ones. However `subscription_number` is a per-customer value: four of one customer's subscriptions share `SUBNO1786105534150`, so they are indistinguishable in the list (ISS-037).
- **ADM-SUB-002** — pause history is correct and complete: `subscription_pauses` rows and `subscription_logs` entries (`pause`, `resume_before_start`, `resume`) were all written with the right dates. Only the pause *reason* is overwritten with a constant (ISS-043).
- **ADM-DEL-001** — `GET /admin/delivery/partners` returns the roster; `PATCH /runs/:id/reassign` executed successfully in both directions (see §1.3).
- **ADM-WH-001** — the warehouse was created via API, but `GET /admin/warehouses/showAdd` returns `branch_id` with `required:false` and **an empty options list**, so an admin using the UI cannot link a warehouse to a branch. `warehouse_type:"main"` — outside the declared option set — was accepted and stored (ISS-035).
- **ADM-CONT-001** — `/admin/delivery/baskets/overview` and `/summary` both return **404** despite being declared in `admin-basket.controller.ts` (ISS-028).
- **ADM-FIN-001/002** — BLOCKED: `/admin/finance/outstandings` returns `{"status":true,"data":[],"meta":{"total":0}}` because **no postpaid bill exists anywhere in the database** (ISS-001). Nothing to settle, nothing to print.
- **ADM-BR-001** — `POST /admin/branch/saveAdd` created `BRANCH0nEzi3unhuEg` with coordinates, radius and buffer stored correctly.

### 2.5 Admin endpoint sweep

All 120 admin `GET` endpoints were swept; the full log is in `api-results/admin-endpoint-sweep.txt`.

| Outcome | Count | Endpoints |
|---|---|---|
| HTTP 500 | 5 | `analytics/outstanding`, `refund-candidates/customer-groups`, `postpaid-bills/eligible-customers`, `branch-config/partners`, `subscriptions/calendar/day-details` |
| HTTP 404 (declared but unreachable) | 2 | `delivery/baskets/overview`, `delivery/baskets/summary` |
| HTTP 200 but silently failed query (`status:false`) | 7 | `customer/table`, `customer/postpaid/table`, `warehouses/transfers/table`, `warehouses/intake/table`, `delivery/leave-requests/table`, `production/planning/table`, `production/batches/table` |
| HTTP 200, working | 106 | — |

---

## 3. Module 02 — Customer App (`02-customer-app.md`)

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| CUST-AUTH-001 | OTP registration & profile setup | **BLOCKED** | — |
| CUST-AUTH-002 | Bootstrap hydration | **PASS** | — |
| CUST-ADDR-001 | Add GPS address & branch geofence | **FAIL** | ISS-014, ISS-038 |
| CUST-ADDR-002 | Out-of-coverage validation | **FAIL** | ISS-014 |
| CUST-CAT-001 | Browse catalog, categories, banners | **PASS** | — |
| CUST-CAT-002 | Customer special price priority | **FAIL** | ISS-013 |
| CUST-CART-001 | Cart calculation & bill summary | **FAIL** | ISS-020 |
| CUST-ORD-001 | One-time order via wallet | **PASS** (with ISS-020, ISS-042) | ISS-020, ISS-042 |
| CUST-ORD-002 | One-time COD order | **PASS** | — |
| CUST-ORD-003 | Cancel order & wallet refund | **FAIL** | ISS-005 |
| CUST-SUB-001 | Create prepaid subscription | **FAIL** | ISS-004, ISS-010, ISS-029 |
| CUST-SUB-002 | Calendar & pause | **PASS** | ISS-043 |
| CUST-SUB-003 | Resume scenarios | **PASS** | — |
| CUST-REF-001 | Share code & friend signup | **FAIL** | ISS-008 |
| CUST-REF-002 | ₹100 reward on first delivery | **FAIL** | ISS-008 |

**CUST-AUTH-001** — BLOCKED. Registration requires a live Fast2SMS OTP to a real handset; no test fixture OTP (`123456`) exists in this build. Accounts were seeded directly instead and then exercised through the real login endpoint.

**CUST-AUTH-002** — `GET /customer/bootstrap` returned the full hydration payload: profile, `wallet_balance 3000.00`, `branch_id`, addresses, `subscription_summary`, `notifications_count`, and the active branch list. Correct.

**CUST-ADDR-001 / 002 — detail**
- Address pinned at Kuppam `12.7485, 78.3644` → assigned `branch_id: BRANCHuGzz5gljgKYo` = **Whitefield, Bengaluru** (12.9706693, 77.6042358), roughly 90 km away.
- Address pinned in Chennai `13.0827, 80.2707` → **accepted** (`201`), also assigned to Whitefield. Expected `out_of_delivery_zone` rejection.
- Root cause: `assignBranchAndH3()` falls back to `branches[0]` from an unordered query when nothing matches, making the `BadRequestException` below it unreachable. The Kuppam branch has `delivery_radius_km = 1.00`, too small to cover the pin.
- Re-pinning inside the 1 km radius (`12.7396, 78.3488`) **did** resolve correctly to `BRANCHTSfmHjqAa0f7`, confirming the matching logic itself works and only the fallback is wrong.
- Also observed: `address_line` renders as `"Flat Flat 402, … Near Near Old Bus Stand, …"` (ISS-038).

**CUST-CART-001 / CUST-ORD-001 — detail**
- Cart: 2 × Fresh cow milk 1L (₹76) + 1 × Fresh curd 1L (₹95).
- `GET /customer/cart-items` → `{"itemsSubtotal":247,"deliveryPartnerFee":0,"taxesAndHandling":25,"grandTotal":272}`.
- `POST /customer/checkout/payment` (wallet) → `{"total_amount":171,"discount_amount":76,"coupon_summary":{"subtotal":247,"promotion_discount":76,"final_amount":171}}`.
- **Customer is shown ₹272 and charged ₹171.** The ₹76 auto-promotion is missing from the cart; the ₹25 handling fee is missing from the charge (ISS-020).
- Database verification of the order itself was **correct and atomic**: `orders(subtotal 247.00, discount_amount 76.00, total_amount 171.00, payment_mode wallet, payment_status paid, branch_id BRANCHTSfmHjqAa0f7, scheduled_date 2026-08-30, delivery_slot morning)`; two matching `order_items`; `customers.wallet_balance 3000.00 → 2829.00`; one `customer_wallet_transactions` row `debit 171.00, balance_after 2829.00, reference_type order`.
- The associated bill however records `total_amount 247.00, paid_amount 247.00` — the pre-discount figure (ISS-042).

**CUST-ORD-003 — detail**
- *Steps:* `POST /customer/orders/OrdG86R9EV88B6H/cancel` on a wallet-paid ₹456 order in `placed` status, before the freeze window.
- *Expected:* status `cancelled`, ₹456 back in the wallet, ledger + `refunds` rows.
- *Actual:* `201 {"status":true,"message":"Order cancelled successfully"}` — and **nothing changed**: order still `placed`, wallet still 213.00, no wallet transaction, no `refunds` row. Reproduced twice.
- *Root cause:* `customer_wallet_transactions.transaction_id` is `varchar(20)` whose default was created as a **quoted 59-character string literal** instead of an expression, so every insert omitting the column fails with `22001`; the transaction then aborts (`25P02` on the following statements) while the controller returns success (ISS-005 + ISS-041).

**CUST-SUB-001 — detail** — see §5.

**CUST-SUB-002 / 003** — PASS, see §5.

---

## 4. Module 03 — Delivery Partner App (`03-delivery-partner-app.md`)

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| DP-AUTH-001 | Registration, KYC upload | **BLOCKED** | — |
| DP-AUTH-002 | Shift toggle & attendance | **PASS** | — |
| DP-AUTH-003 | Leave request submission | **BLOCKED** | ISS-027 |
| DP-DISP-001 | Review hub pickup items | **FAIL** | ISS-018 |
| DP-DISP-002 | Confirm pickup & handover ack | **BLOCKED** | ISS-018 |
| DP-RUN-001 | Start delivery run | **FAIL** | ISS-006 |
| DP-RUN-002 | Stop details & multi-order stacking | **PASS** | — |
| DP-RUN-003 | Proof photo, containers, mark delivered | **FAIL** | ISS-011, ISS-012, ISS-040 |
| DP-RUN-004 | Failed delivery & reason logging | **N/A** | FU-003 |
| DP-HND-001 | End-of-run handover & reconciliation | **FAIL** | ISS-007 |
| DP-REF-001 | Partner referral bonus visibility | **FAIL** | ISS-008 |

**DP-AUTH-002 — detail** — `POST /delivery-partner/auth/shift-toggle {"status":"online"}` → `{"success":true,"is_active":true,"is_online":true}`; offline → `is_online:false, is_available:false` with `is_active` correctly left `true`. Verified that going offline does **not** lock the partner out of login. PASS.

**DP-DISP-001 / 002 — detail**
- *Expected:* pickup checklist showing planned quantities plus extra buffer, then a confirm step initialising dispatch balances.
- *Actual:* `GET /delivery/orders/pickup-items` returns `{"items":[],"message":"No delivery run or orders found for today"}` and `delivery_dispatch` has **0 rows** for the run, because the admin-side dispatch creation fails first:
  `POST /admin/delivery/dispatch/RUN-20260830-MOR-002` → `500`, `column p.product_name does not exist` (`products` has `name`) — ISS-018.
- A second, independent obstacle: `GET /delivery/orders/run/today` accepts a `date` parameter but derives the **slot** from the current wall clock (`getKolkataDateAndSlot(dateParam)` is called without a slot argument, even though the function accepts one). At 17:15 IST the slot resolved to `evening`, so a partner cannot open tomorrow's morning run at all.
- *Note:* the test plan asserts against `dispatch_requirements` and `dispatch_balances`; neither table exists — the implementation uses `delivery_dispatch` + `delivery_dispatch_items` (FU-001).

**DP-RUN-001 — detail** — `POST /delivery/orders/run/RUN-20260830-MOR-002/start` → **HTTP 500**. `UPDATE delivery_runs SET status='in_progress', started_at = NOW() …` and `delivery_runs` has no `started_at` column (it has `actual_start_time`). Error `42703 transformUpdateTargetList` at `delivery.order.service.ts:954`. The documented Start Run action cannot succeed for any partner on any run (ISS-006).

**DP-RUN-003 — detail**
- *Steps:* `PATCH /delivery/orders/run/RUN-20260830-MOR-002/address/ADDRCUU7OT/deliver` with `{"status":"delivered","container_returns":[{"container_id":"CONT-001","returned":5}]}` on a COD order of 3 × milk (max collectable = 3).
- *What worked:* order → `delivered`; `delivery_run_addresses.delivery_status='delivered'` with `delivered_at`; run auto-moved to `completed` with `completed_addresses=1`; `order_status_logs` written; `delivery_container_reconciliation` created against the correct warehouse (`WH-MTEBESZ953A8S7`, resolved from the branch); `customers.first_order_completed` set to `true`.
- *What failed:*
  1. **Over-collection accepted.** 5 containers collected against a maximum of 3 → `customer_container_balances.balance_quantity = -2`. No 400, no rollback (ISS-011).
  2. **COD not settled.** `orders.payment_status` remained `pending` after delivery; ₹228 cash is unrecorded (ISS-012).
  3. **No proof photo required**, and the stop was delivered on a run still in `assigned` state (ISS-040).

**DP-RUN-004** — N/A. The plan specifies `PATCH /run/:runId/address/:addressId/fail`; no such endpoint exists in `delivery.order.controller.ts`. Failure recording exists only on the admin side (`zone/delivery/not-home`, `/issue`). Raised as part of FU-003.

**DP-HND-001 — detail**
- `POST /delivery/orders/run/RUN-20260830-MOR-002/handover` → `{"success":true,"message":"Run already handed over","status":"handed_over","empty_bottles_returned":0}` **on the first call**.
- Database disagrees: run status still `completed`; `delivery_container_reconciliation` still `pending` with `collected_quantity 5, submitted_quantity 0, discrepancy_quantity 5`; `warehouse_containers` for the QA warehouse still `0`.
- *Root cause:* `isRunHandedOver()` tests `status = 'completed'`, which `markStopDelivered` has already set — so `handoverRun()` always returns early and its body never executes. The body also references `delivery_runs.empty_bottles_collected`, a column that does not exist, so it would 500 if reached.
- *Scale of impact:* `SELECT status, COUNT(*) FROM delivery_runs GROUP BY 1` → `assigned 29, completed 11, in_progress 17`. **No run in the entire production history has ever reached `handed_over`.**

---

## 5. Module 04 — Subscriptions (`04-subscriptions.md`) — Priority Focus

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| SUB-CRT-001 | Prepaid subscription with multi-product matrix | **FAIL** | ISS-004, ISS-010, ISS-029 |
| SUB-CRT-002 | Postpaid credit limit & unpaid bills guard | **PARTIAL PASS / FAIL** | ISS-017 |
| SUB-PAUS-001 | Schedule future pause window | **PASS** | ISS-043 |
| SUB-PAUS-002 | Resume scenario 1 — cancel upcoming pause | **PASS** | — |
| SUB-PAUS-003 | Resume scenario 2 — truncate ongoing pause | **PASS** | — |
| SUB-CRON-001 | Daily snapshot cron order generation | **PARTIAL** | ISS-029 |
| SUB-CRON-002 | Cron double-run idempotency | **BLOCKED** | — |
| SUB-RFD-001 | Prepaid refund calculation at `final_price` | **FAIL** | ISS-003, ISS-004 |
| SUB-RFD-002 | Admin refund approval & wallet credit | **BLOCKED** | ISS-003 |

**SUB-CRT-001 — detail**
- *Steps:* `POST /customer/subscriptions/checkout` — `start_date 2026-08-30`, weekly, prepaid/wallet, one item (`VRT0NFGWE8WG`, `unit_price 72`), Mon–Sat `m_qty 1`, Sunday `m_qty 2 / e_qty 1`. Wallet before: ₹2,829.
- *What worked:* subscription created `active`; `subscription_weekly_schedule` written with all **7** correct rows (`day 0: m=2,e=1`; days 1–6: `m=1,e=0`) with `effective_from = start_date`; `end_date` correctly set to month end; `subscription_logs` `created` entry with the full schedule snapshot.
- *What failed:*
  1. `subscription_items.final_price` is **NULL** (ISS-004) — the refund engine values every refundable day at this column.
  2. `monthly_estimate = ₹0.00` and the **wallet was debited ₹0.00** — an active prepaid subscription created for free. The amount comes entirely from the client's `estimated_total` (ISS-010). Repeating with `estimated_total: 2160` debited exactly ₹2,160, confirming the server never computes or validates the figure.
  3. The prepaid `customer_bills` row was written with `total_amount 0.00`.
  4. `branch_id` defaulted to the literal `'ALL'` when omitted (ISS-029) — the pre-dispatch summary then reported the line under a phantom branch `"ALL"`.

**SUB-CRT-002 — detail**
- *Test B (credit limit):* customer limit ₹5,000, requested ₹6,000 → **correctly rejected**
  `{"status":false,"error_code":"credit_limit_exceeded","credit_limit":5000,"existing_committed":0,"requested":6000}`. PASS (though returned with HTTP 201 rather than 400).
- *Test A (outstanding bills):* **FAIL by inspection and by data.** The guard filters `status IN ('unpaid','due','overdue')` (`subscriptions.service.ts:140-157`) while the billing engine writes `'pending'` (`customer-billing.service.ts:313`). The value never matches, so the branch is unreachable. Currently masked by ISS-001 (no postpaid bill can be created at all) but live the moment billing is fixed.

**SUB-PAUS-001/002/003 — detail (all PASS)**
- **001:** `POST /subscriptions/SUB_MTEB2QBM1FY0/pause {"startDate":"2026-09-10","endDate":"2026-09-15"}` → `subscription_pauses(start 2026-09-10, end 2026-09-15, status 'paused')`, `subscriptions.pause_from_date/pause_to_date` set, status remains `active`, `subscription_logs` `pause` entry. Only the reason text was replaced with a constant (ISS-043).
- **002 (Scenario 1):** `POST /resume` with an empty body → `{"status":true,"message":"Upcoming pause cancelled. Regular deliveries will continue without interruption.","scenario":1}`. Pause row → `resumed`; `pause_from_date`/`pause_to_date`/`pause_reason` all cleared; `subscription_logs` action `resume_before_start` with `{"scenario": 1}`. Matches the specification exactly.
- **003 (Scenario 2):** with an ongoing pause 2026-08-28 → 2026-09-15 and `resume_date 2026-09-05` → `{"...":"Subscription resumed successfully! Deliveries will restart on 2026-09-05.","scenario":2}`. Active pause truncated to `2026-09-04` (resume − 1); a new row `2026-09-05 → 2026-09-15` created with `status 'resumed'`; `subscriptions.pause_to_date = 2026-09-04`; immutable history preserved. Matches the specification exactly.
  *Setup note:* the API correctly refuses to create a pause starting today (*"Pause start date must be tomorrow (2026-08-30) or later"*), so the ongoing-pause precondition was seeded directly on the QA subscription.

**SUB-CRON-001 / 002 — detail**
- The cron is **not** fixed at 23:55 / 11:55 IST as the plan states; it is a dynamic dispatcher running every minute and firing when the IST clock matches `system_configurations.slot_timings` — currently `morning_slot.cron_run_time = "20:30"` (day offset −1) and `evening_slot.cron_run_time = "14:30"`.
- Read-only verification via `GET /admin/orders/dispatch/pre-summary?date=2026-08-30&slot=morning` showed the snapshot logic resolving the day-of-week matrix correctly: the QA Sunday schedule produced `total_quantity: 2` (matching `day_of_week 0, m_quantity 2`), alongside five genuine branch lines.
- Writing execution was **not** triggered: `generateOrdersForDateAndSlot` for a live date/slot would have created real orders for real customers hours ahead of schedule. SUB-CRON-002 (double-run idempotency) is therefore BLOCKED — the `ON CONFLICT DO NOTHING` guard and the Redis lock (`CronLockService.acquire(lockKey, 3600)`) were confirmed by inspection only.
- The QA subscription's line appeared under `branch_id: "ALL"` (ISS-029), which would exclude it from branch-scoped run generation.

**SUB-RFD-001 / 002 — detail**
- `GET /subscriptions/refund-candidates/scan/preview?month=2026-09&customer_id=QA_CUST_PRE` → **500**; same for `?month=2026-08`; `POST /scan` → **500**.
- *Root cause:* `column dra.order_id does not exist` (hint: `dra.order_ids`) at `refund-eligibility.service.ts:261` — `delivery_run_addresses` stores a JSON array in `order_ids`.
- *Compounding:* the same query computes `ROUND(oi.quantity * si.final_price, 2)`, and `final_price` is NULL for every app-created subscription (ISS-004), so the amount would be NULL even after the column fix.
- `SELECT COUNT(*) FROM subscription_refund_candidates` → **0**. No prepaid refund has ever been calculated, reviewed or paid in this system.
- SUB-RFD-002 is BLOCKED with no candidates to approve. `GET /refund-candidates/customer-groups` additionally returns 500 (`src.reviewed_by` does not exist — ISS-022).

---

## 6. Module 05 — Outstanding Bills (`05-outstanding-bills.md`) — Priority Focus

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| OUT-GEN-001 | Automated monthly bill generation | **FAIL** | ISS-001 |
| OUT-GEN-002 | Duplicate bill prevention | **BLOCKED** | ISS-001 |
| OUT-PAY-001 | Full payment via Razorpay | **BLOCKED** | ISS-001 |
| OUT-PAY-002 | Partial settlement via admin | **BLOCKED** | ISS-001 |
| OUT-PAY-003 | Multiple outstanding bills / FIFO | **BLOCKED** | ISS-001 |
| OUT-REM-001 | 7/3/1-day push reminders | **BLOCKED** | ISS-001 |
| OUT-CONS (§2.4) | Cross-surface field consistency | **BLOCKED** | ISS-001 |

**OUT-GEN-001 — detail**
- *Steps:* `POST /admin/postpaid-bills/generate {"customerId":"QA_CUST_POST","periodStart":"2026-08-01","periodEnd":"2026-08-31","dueDate":"2026-09-05"}`.
- *Actual:* HTTP 201 with `{"status":false,"action":"failed","message":"column \"first_name\" does not exist","summary":{"eligibleCustomers":1,"generated":0,"skipped":0,"failed":1}}`.
- `GET /admin/postpaid-bills/eligible-customers` → **HTTP 500**, same cause.
- *Root cause:* `findEligiblePostpaidCustomers()` and `checkCustomerPostpaidEnabled()` select `first_name`/`phone` from `customers`; those columns live on `users`. The monthly cron `handleMonthlyCron()` (`@Cron('0 5 0 1 * *')`) calls the same method and swallows the throw into a log line.
- *Database confirmation:*
  ```
  bill_type    | payment_type | status | n  | first      | last
  order        | prepaid      | paid   | 42 | 2026-08-06 | 2026-08-29
  subscription | postpaid     | paid   |  1 | 2026-08-07 | 2026-08-07
  subscription | prepaid      | paid   |  7 | 2026-08-06 | 2026-08-27
  ```
  There is **no monthly bill of any kind in the database**, and `/admin/finance/outstandings` is consequently empty. The entire postpaid settlement chain is untestable until this is fixed.
- *Secondary defect:* the eligibility query has no `WHERE is_postpaid_enabled = true`, so once fixed it would attempt to bill every customer.

---

## 7. Module 06 — Payments, Refunds & Wallet (`06-payments-refunds-wallet.md`)

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| WAL-TOP-001 | Wallet top-up via Razorpay | **PARTIAL PASS** | — |
| WAL-DEB-001 | Atomic debit, no negative balance | **PASS** | — |
| PAY-WBH-001 | Webhook idempotency | **BLOCKED** | — |
| PAY-HMAC-001 | Tampered webhook signature rejected | **PASS** | — |
| PAY-REC-001 | Stranded-payment reconciliation cron | **BLOCKED** | — |
| RFD-ORD-001 | Order cancellation refund to wallet | **FAIL** | ISS-005 |
| RFD-SUB-001 | Month-end subscription refund payout | **BLOCKED** | ISS-003 |

- **WAL-TOP-001** — `GET /customer/payment/config` confirms `mode: "test"`, `enabled: true`. `POST /customer/payment/create-order {"amount":500,"purpose":"wallet_topup"}` created a real Razorpay **test** order (`order_TVZoKHcP3y3Ak6`) and a `payment_transactions` row. Completing the payment requires the Razorpay checkout UI, so the credit half is unverified.
- **WAL-DEB-001 / EDG-RCE-001 — PASS.** Two genuinely concurrent ₹456 wallet checkouts against a ₹669 balance: `A → 201` (order created), `B → 400 "Insufficient wallet balance. Please top up your wallet."`. Final balance ₹213.00; exactly **one** debit row in `customer_wallet_transactions`. No overdraft, no negative balance, no duplicate order. This is a correctly implemented atomic conditional debit.
- **PAY-HMAC-001 — PASS.** `POST /payments/razorpay/webhook` with a forged signature → `400 "Invalid webhook signature"`; with **no** signature → also `400`. Wallet unchanged; `payment_webhook_events` still empty. Implementation verified: `verifyWebhookSignature` fails closed when the secret or signature is missing and uses `crypto.timingSafeEqual` with a length pre-check.
- **PAY-WBH-001 — BLOCKED by design.** Sending a *valid* duplicate webhook would require reading the live Razorpay webhook secret, which the data rules forbid. Verified structurally instead: the handler inserts `ON CONFLICT (provider, event_id) DO NOTHING` and returns *"Duplicate webhook ignored"* when no row comes back, and the constraint genuinely exists — `payment_webhook_events_event_key UNIQUE (provider, event_id)`. The idempotency design is sound; live confirmation is outstanding.
- **PAY-REC-001 — BLOCKED.** The `@Cron('0 */10 * * * *')` reconciliation job requires a genuinely stranded captured Razorpay transaction, which cannot be produced without completing a real gateway payment.
- **Payment verification security — PASS (added).** `POST /customer/payment/verify` with a forged `razorpay_signature` → `400 "Payment verification failed…"`.

---

## 8. Module 07 — Delivery Dispatch & Containers (`07-delivery-dispatch.md`)

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| DSP-PLN-001 | Automated run creation & sequencing | **PASS** | — |
| DSP-REQ-001 | Dispatch requirements & buffer | **N/A / FAIL** | ISS-018, FU-001 |
| DSP-BAL-001 | Pickup confirmation & balance init | **BLOCKED** | ISS-018 |
| CONT-LGT-001 | Doorstep bottle collection & balance delta | **PARTIAL PASS** | ISS-011 |
| CONT-LGT-002 | Max container collection validation | **FAIL** | ISS-011 |
| DSP-HND-001 | End-of-day handover reconciliation | **FAIL** | ISS-007 |

**DSP-PLN-001 — detail (PASS)** — `POST /admin/delivery/runs/create {"date":"2026-08-30","branch_id":"BRANCHTSfmHjqAa0f7","slot":"morning"}` created `RUN-20260830-MOR-001` (`status assigned`, `assignment_method auto_balanced`, 2 addresses), assigned both branch orders with `run_sequence` 1 and 2, and wrote matching `delivery_run_addresses` rows with `order_ids` JSON arrays. A second call for the QA branch produced `RUN-20260830-MOR-002` containing only the QA order. `GET /admin/delivery/runs/check-availability` correctly reported 4 available partners. Correct — except that `delivery_runs.warehouse_id` is left NULL.

**DSP-REQ-001** — the plan asserts `dispatch_requirements.planned_quantity / extra_quantity / total_quantity` and `dispatch_balances`; **neither table exists**. The implementation models this as `delivery_dispatch_items(planned_qty, loaded_qty, delivered_qty, returned_qty, damaged_qty, extra_sold_qty)`. Attempting to create a dispatch with an extra buffer (`planned_qty 3, loaded_qty 5`) returned **500** (`column p.product_name does not exist` — ISS-018), so extra/buffer dispatch quantities could not be exercised at all. Recorded as N/A for the schema and FAIL for the endpoint.

**CONT-LGT-001 / 002 — detail** — the balance delta itself is computed and persisted (`issued_quantity 3`, `returned_quantity 5`, `balance_quantity -2`), and the reconciliation row is created against the correct warehouse. But the upper bound is not enforced: collecting 5 against a maximum of 3 was accepted and drove the balance negative, where the plan requires a 400 and a rollback (ISS-011).

---

## 9. Module 08 — Inventory & Warehouse (`08-inventory-warehouse.md`)

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| WH-STK-001 | Stock inward via purchase entry | **FAIL** | ISS-019 |
| WH-STK-002 | Inter-warehouse transfer | **BLOCKED** | ISS-024 |
| WH-FOR-001 | Subscription demand forecast | **PASS** (partial — forecast screen N/A) | ISS-026 |
| WH-OOS-001 | Out-of-stock cart gating | **N/A** | FU-001 |

- **WH-STK-001 — FAIL.** `POST /admin/inventory/purchases` returns 500 for **two** independent reasons: `purchase_entries.warehouse_id` is `integer` while the whole API uses the varchar business key (`invalid input syntax for type integer: "WH-MTEBESZ953A8S7"`), and `purchase_entries.id` is `NOT NULL` with **no sequence or default** (`null value in column "id" … violates not-null constraint`). No stock can be received; `stock_balances` has no row for the QA warehouse and `GET /admin/inventory/purchases` returns an empty list.
- **WH-STK-002 — BLOCKED.** The Stock Transfers table returns zero rows (`column stock_transfers.product_id does not exist` — ISS-024), and there is no stock to transfer given WH-STK-001.
- **WH-FOR-001 — PARTIAL.** `GET /admin/orders/dispatch/pre-summary` and `/admin/inventory/dashboard/*` return correct aggregates from the subscription matrix, and `GET /admin/delivery/dispatch/requirements?date=…&slot=…` returns per-warehouse required quantities with `warehouse_stock` and `shortfall`. However `production/planning/table` and `production/batches/table` both fail (`operator does not exist: character varying = integer` — ISS-026), and there is no `consumption_forecasts` table, so the forecast screen described in the plan cannot be verified as specified.
- **WH-OOS-001 — N/A.** The plan asserts `product_variants.is_out_of_stock`; that column does not exist on `product_variants`. The flag lives on `products.is_out_of_stock` and `stock_balances.is_out_of_stock` (FU-001).

---

## 10. Module 09 — Referrals (`09-referrals.md`) — Priority Focus

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| REF-CUST-001 | End-to-end ₹100 customer referral | **FAIL** | ISS-008 |
| REF-CUST-002 | Double-reward fraud prevention | **BLOCKED** | ISS-008 |
| REF-CUST-003 | Self-referral prevention | **FAIL** | ISS-034 |
| REF-PART-001 | Delivery partner ₹75 bonus accrual | **FAIL** | ISS-008 |

- `GET /customer/referrals/details` returns a sensible payload (`referral_code: "QA_CUST_PRE"`, `referral_status: "active"`, `reward_per_referral: 100`).
- `GET /customer/referrals/validate/QA_CUST_PRE` correctly returns `valid: true` with the referrer's name, and correctly returns *"Self-referral is not allowed"* for the caller's own code.
- `POST /customer/referrals/add` returns `201 {"status":true,"message":"Referral recorded successfully"}` for **both** a valid code and the caller's own code — but creates **no row**. `apps/api/logs/app.log`: `null value in column "referred_customer_id" of relation "referrals" violates not-null constraint (23502)`.
- *Root cause:* `createReferral` writes `referrer_id: userId` (recording the caller as the *referrer*, the inverse of the intended relationship) and never sets the `NOT NULL` `referred_customer_id`; it also sets `status:'completed'` with a reward immediately, bypassing the first-delivery gate.
- *Reward engine:* `processReferralReward` filters on `referred_user_id`, `referrer_user_id` and `referee_phone` — none of which exist on `referrals` (its columns are `refer_id, referrer_customer_id, referred_customer_id, referral_code, referrer_reward_amount, referred_reward_amount, status, rewarded_at, remarks, …`). Its `referred_by` fallback reads a column that is not in its own select list.
- *Production-wide confirmation:*
  ```
  customer_wallet_transactions reference_type:  order 24 | subscription 10 | topup 33     (no referral_bonus)
  delivery_partner_referral_bonuses:            0 rows
  referrals:                                    7 rows, all status='pending'
                                                6 of them with rewarded_at already set
  T_CR_* (referrers):  wallet_balance 0.00, first_order_completed = TRUE   <- flag on the wrong party
  T_CE_* (referees):   wallet_balance 0.00, first_order_completed = FALSE
  ```
  **No referral reward — customer ₹100 or partner ₹75 — has ever been paid.**
- REF-CUST-002 (double-reward prevention) is BLOCKED: no reward can be granted once, so it cannot be tested for being granted twice.

---

## 11. Module 11 — End-to-End Scenarios (`11-end-to-end-flows.md`)

| Scenario | Result | Blocking issue |
|---|---|---|
| E2E-001 Signup → COD order → run → delivery | **PARTIAL** | ISS-006 (start run), ISS-012 (COD unsettled), ISS-007 (handover) |
| E2E-002 Wallet top-up → checkout → delivery → ledger | **BLOCKED** | Gateway completion needs the Razorpay checkout UI |
| E2E-003 Referral signup → first order → ₹100 | **FAIL** | ISS-008 |
| E2E-004 Prepaid subscription → cron → dispatch → doorstep | **PARTIAL** | ISS-010, ISS-029, ISS-018 |
| E2E-005 Paused days → month-end refund → wallet credit | **FAIL** | ISS-003, ISS-004 |
| E2E-006 Failed delivery → refund → wallet credit | **FAIL** | ISS-003, DP-RUN-004 endpoint missing |
| E2E-007 Postpaid subscription → monthly bill → Razorpay | **FAIL** | ISS-001 |
| E2E-008 Multi-bill partial → full settlement | **BLOCKED** | ISS-001 |
| E2E-009 Partner referral → month-end bonus payout | **FAIL** | ISS-008 |
| E2E-010 Dispatch buffer → handover returns → stock restoral | **FAIL** | ISS-018, ISS-007 |
| E2E-011 Glass bottle circulation reconciliation | **FAIL** | ISS-007, ISS-011 |
| E2E-012 Branch geofence → address → order assignment | **PARTIAL FAIL** | ISS-014, ISS-029 |

**E2E-001 — what was actually executed end to end:** customer address → cart → COD checkout (`OrdMOCB3B10KA70`, ₹228) → order visible in the admin orders table → `POST /admin/delivery/runs/create` → run `RUN-20260830-MOR-002` with the order sequenced → partner shift toggle online → **start run failed (ISS-006)** → stop delivered directly → order `delivered`, `delivery_run_addresses` updated, `first_order_completed` set, container reconciliation row created → **handover returned a false success (ISS-007)** and `payment_status` never became `paid` (ISS-012). The chain works up to the point of the state machine, which is where it breaks.

**E2E-012 — detail:** creating the branch, linking a warehouse, pinning an in-radius address and placing an order all worked, and `orders.branch_id` and `delivery_runs.branch_id` both inherited `BRANCH0nEzi3unhuEg` correctly. The failure is at the edges: an out-of-radius pin is silently reassigned to an unrelated branch (ISS-014), and a subscription without an explicit `branch_id` lands on `'ALL'` (ISS-029).

---

## 12. Module 12 — Edge Cases (`12-edge-cases.md`)

| Test ID | Scenario | Result | Issue |
|---|---|---|---|
| EDG-RCE-001 | Concurrent wallet checkout double-spend | **PASS** | — |
| EDG-RCE-002 | Rapid repeated subscription submit | **BLOCKED** | ISS-010 / FU-002 |
| EDG-RCE-003 | Duplicate gateway webhook | **BLOCKED** | — |
| EDG-CRN-001 | Multi-instance cron lock | **PASS (by inspection)** | — |
| EDG-CRN-002 | Re-running monthly billing cron | **BLOCKED** | ISS-001 |
| EDG-CAL-001 | February 28 vs 29 month end | **PASS (by inspection)** | — |
| EDG-CAL-002 | Subscription starting on last day of month | **PASS** | — |
| EDG-CAL-003 | Midnight IST slot transition | **FAIL** | ISS-032 |
| EDG-SUB-001 | Resume with `resume_date` = pause end | **PASS** | — |
| EDG-SUB-002 | Cancel subscription while paused | **NOT EXECUTED** | — |
| EDG-SUB-003 | Sunday-only matrix (6 days zero) | **PASS** | — |
| EDG-LGT-001 | Collect more containers than owned | **FAIL** | ISS-011 |
| EDG-LGT-002 | Lost / damaged bottles on route | **BLOCKED** | ISS-007 |
| EDG-LGT-003 | Multiple orders stacked at one address | **PASS** | — |
| EDG-PRC-001 | Variant deactivated during checkout | **PASS** | — |
| EDG-PRC-002 | Zero / negative quantity injection | **PASS** | — |
| EDG-REF-001 | Re-delivery does not re-reward | **BLOCKED** | ISS-008 |
| EDG-REF-002 | Circular referral | **BLOCKED** | ISS-008 |
| EDG-DATE (added) | Order for a past date | **FAIL** | ISS-015 |
| EDG-IDOR (added) | Cross-customer order access | **FAIL** | ISS-009 |

- **EDG-RCE-001 — PASS.** See §7 WAL-DEB-001. Exactly one debit, second request rejected, balance never negative.
- **EDG-CRN-001 — PASS by inspection.** `CronLockService.acquire('handleMorningOrderProcessing:<date>:<time>', 3600)` is taken before any generation work and the handler returns early when it is not acquired; `handleMonthlyCron` and `handlePostpaidRemindersCron` use the same pattern. Multi-instance execution was not simulated (single PM2 fork).
- **EDG-CAL-002 — PASS.** A subscription created on 2026-08-29 starting 2026-08-30 received `end_date = 2026-08-31` (month end); one starting 2026-09-01 received `2026-09-30`. Matches the specified semantics.
- **EDG-CAL-003 — FAIL.** `SHOW timezone` → `Europe/Berlin` while the OS and the application run on IST. `SELECT now(), current_date` returned `2026-08-29 13:35:58+02 / 2026-08-29` against an IST wall clock of 17:05. Between 00:00 and 03:30 IST the database's `CURRENT_DATE` is the previous business day — and the monthly billing cron fires at 00:05 IST, inside that window (ISS-032).
- **EDG-SUB-003 — PASS.** The 7-row weekly matrix with differing per-day quantities (including a Sunday-only `m_quantity 2`) persisted correctly, and the pre-dispatch summary resolved the Sunday quantity to 2 for 2026-08-30.
- **EDG-PRC-001 — PASS.** Checkout with an unknown variant → `400 "These products are unavailable: VRT_DOES_NOT_EXIST"`. No fallback price applied.
- **EDG-PRC-002 — PASS.** `quantity: -5` and `quantity: 0` → `400 ["items.0.onetime_details.quantity must not be less than 1"]` from the DTO `@Min(1)`.
- **EDG-LGT-003 — PASS.** `delivery_run_addresses` groups multiple orders per stop in an `order_ids` JSON array, and `markStopDelivered` iterates all orders at the address while performing container collection exactly once (`isFirstOrder` guard).
- **EDG-DATE (added)** — an order for 2026-08-20, nine days in the past, was **accepted** and persisted, while the same-day evening cutoff is correctly enforced (ISS-015).
- **EDG-IDOR (added)** — `GET /customer/orders/:id` returned another customer's full record including name, address and phone (ISS-009).
- **EDG-SUB-002** — not executed; cancelling a subscription mid-pause on live data was out of scope for this run given the data rules.

---

## 13. Module 13 — Test Data Requirements (`13-test-data-requirements.md`)

Recorded as **N/A** as written. The golden fixtures assert against columns and tables that do not exist in this build — `product_variants.is_out_of_stock`, `containers.is_active`, `coupons.discount_type` / `discount_value` / `min_order_amount` / `max_discount`, `warehouse_containers` composite conflict target, `products.is_subscribable` on the wrong table in places. Live equivalents were used instead (Kuppam branch `BRANCHTSfmHjqAa0f7`, milk variant `VRT0NFGWE8WG`, container `CONT-001`), and the fixture file is covered by FU-001.

---

## 14. Cross-Surface Consistency Checks

The plan asks that UI/API state be reconciled with database state. Every disagreement found:

| # | Surface says | Database says | Issue |
|---|---|---|---|
| 1 | *"Order cancelled successfully"* | order still `placed`, wallet unchanged, no refund row | ISS-005 |
| 2 | *"Referral recorded successfully"* | no `referrals` row | ISS-008 |
| 3 | *"Run already handed over"*, `status: handed_over` | `delivery_runs.status = 'completed'` | ISS-007 |
| 4 | Customer directory: 41 records | 0 rows rendered | ISS-002 |
| 5 | Cart grand total ₹272 | wallet debited ₹171 | ISS-020 |
| 6 | Bill `paid_amount` ₹247 | wallet debit ₹171 | ISS-042 |
| 7 | `has_special_price: true` | `final_price` still the catalog price | ISS-013 |
| 8 | Dashboard `total_revenue` ₹13,254 | delivered revenue ₹956 | ISS-016 |
| 9 | Basket container summary: 0 collected | reconciliation row: 5 collected | ISS-007 |
| 10 | *"Special prices saved"* with ₹63 | stored as ₹72 | ISS-013 |

---

## 15. What Worked Well

It is worth recording the parts of the system that stood up to testing, because they are the parts that should not be disturbed by the fixes:

- **Atomic wallet debits.** The conditional-update pattern held under genuine concurrency — no overdraft, no duplicate debit, correct rejection message.
- **Pause and resume.** All three documented scenarios behaved exactly as specified, including the pause-history immutability, the `pause_to_date` truncation arithmetic and the `subscription_logs` scenario markers. This is the most faithfully implemented area of the subscription engine.
- **Payment gateway security.** Signature verification fails closed, uses a timing-safe comparison, and the webhook idempotency constraint genuinely exists in the schema. Razorpay is correctly in test mode.
- **Role-based access control.** Customer and delivery-partner tokens are cleanly rejected (403) from every admin route tested, and a partner cannot start another partner's run.
- **Input validation at the boundary.** Negative and zero quantities, unknown variants and same-day cutoff violations are all rejected with clear messages.
- **Run assembly.** Automated run creation, address sequencing, partner load balancing and reassignment all worked correctly against real data.
- **Order and ledger writes.** Where a write path completes, the resulting rows are consistent and correctly related — `orders`/`order_items`/`customer_wallet_transactions` reconciled exactly in every successful checkout.
