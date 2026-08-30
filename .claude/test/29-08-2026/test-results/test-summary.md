# F2H Fresh — Test Summary

**Execution date:** 2026-08-29 (IST)
**Scope:** all 13 specifications in `.claude/test/29-08-2026/test-plan/`, executed against the running application (API `:5001`, Admin Web `:5002`, live `f2h_fresh` database, Redis, Razorpay test mode).
**Detail:** `test-execution-report.md` · **Defects:** `issues/` · **Change requests:** `feature-updates/`

---

## 1. Headline Numbers

| Metric | Count |
|---|---:|
| **Total test cases executed** | **121** |
| Passed | **38** |
| Failed | **47** |
| Blocked | **32** |
| Not applicable | **4** |

| Defect severity | Count |
|---|---:|
| **Critical** | **10** |
| **High** | **11** |
| **Medium** | **20** |
| **Low** | **3** |
| **Total defects raised** | **44** |
| **Feature / update requirements** | **7** |

Pass rate across executable cases (excluding Blocked and N/A): **38 / 85 = 45%**.

### 1.1 Coverage by module

| Module | Cases | Pass | Fail | Blocked | N/A |
|---|---:|---:|---:|---:|---:|
| 01 Admin Panel | 24 | 10 | 8 | 5 | 1 |
| 02 Customer App | 15 | 6 | 8 | 1 | 0 |
| 03 Delivery Partner App | 11 | 2 | 5 | 3 | 1 |
| 04 Subscriptions | 9 | 4 | 3 | 2 | 0 |
| 05 Outstanding Bills | 7 | 0 | 1 | 6 | 0 |
| 06 Payments / Wallet | 8 | 4 | 1 | 3 | 0 |
| 07 Dispatch & Containers | 6 | 2 | 3 | 1 | 0 |
| 08 Inventory & Warehouse | 4 | 1 | 1 | 1 | 1 |
| 09 Referrals | 4 | 0 | 3 | 1 | 0 |
| 11 End-to-End Scenarios | 12 | 0 | 10 | 2 | 0 |
| 12 Edge Cases | 20 | 9 | 4 | 7 | 0 |
| 13 Test Data Fixtures | 1 | 0 | 0 | 0 | 1 |
| **Total** | **121** | **38** | **47** | **32** | **4** |

The 32 blocked cases are almost entirely downstream of the ten Critical defects — most of Module 05 is blocked because no postpaid bill can be created, and much of Module 09 is blocked because no referral row can be created.

---

## 2. Critical Defects

| ID | Title | Area |
|---|---|---|
| ISS-001 | Postpaid monthly billing engine is completely non-functional | Billing |
| ISS-002 | Admin Customers directory returns zero rows for every request | Admin |
| ISS-003 | Prepaid refund scan returns 500 — no refund candidate ever produced | Subscriptions |
| ISS-004 | `subscription_items.final_price` never written — refunds cannot be valued | Subscriptions |
| ISS-005 | Order cancellation reports success but rolls back — no refund paid | Customer / Wallet |
| ISS-006 | `POST /run/:runId/start` always 500s — a run can never be started | Delivery |
| ISS-007 | End-of-run handover is dead code — 0 of 57 runs ever handed over | Logistics |
| ISS-008 | Customer ₹100 and partner ₹75 referral rewards entirely non-functional | Referrals |
| ISS-009 | IDOR — any customer can read any other customer's order and PII | Security |
| ISS-010 | Subscription price and prepaid charge taken from the client — free subscriptions possible | Subscriptions / Finance |

---

## 3. Main Subscription Findings

**The subscription lifecycle works. The money attached to it does not.**

*What is correct:*
- Creation writes `subscriptions`, `subscription_items` and all seven `subscription_weekly_schedule` rows accurately, including per-day differing morning/evening quantities and a Sunday-only matrix (EDG-SUB-003).
- `end_date` month-end arithmetic matches the specification, including the last-day-of-month case (EDG-CAL-002).
- **All three pause/resume scenarios pass exactly as specified** — future pause, cancel-before-start (scenario 1), and mid-window truncation (scenario 2) with `pause_to_date = resume_date − 1`, a new `resumed` history row, immutable pause history and correct `subscription_logs` entries. This is the strongest-implemented area of the engine.
- The snapshot cron resolves the day-of-week matrix correctly (verified read-only through the pre-dispatch summary), and uses a Redis lock per date+slot.

*What is broken:*
- **`subscription_items.final_price` is never written** (ISS-004). Five of ten rows in production are NULL, including every one created through the current customer app. The refund engine values each refundable day at this column, so refunds evaluate to NULL even after other fixes.
- **The prepaid charge is whatever the client says it is** (ISS-010). Omitting `estimated_total` produced an active prepaid subscription with a **₹0.00 wallet debit and a ₹0.00 "paid" bill**. `unit_price` is likewise stored verbatim from the request. The postpaid credit-limit check is evaluated against the same client-controlled number.
- **`branch_id` silently becomes the literal `'ALL'`** when the client omits it (ISS-029), placing the subscription outside branch-scoped run generation and warehouse dispatch.
- The cron schedule is config-driven (20:30 / 14:30 IST from `system_configurations.slot_timings`), not the fixed 23:55 / 11:55 the plan documents — a documentation gap rather than a defect.
- `subscription_number` is a per-customer value reused across all of that customer's subscriptions (ISS-037), so four of one customer's subscriptions are indistinguishable in the admin ledger.

---

## 4. Outstanding-Bill Findings

**No monthly postpaid bill has ever been generated in this system.**

- `SELECT bill_type, payment_type, status, COUNT(*) FROM customer_bills GROUP BY 1,2,3` returns only `order/prepaid/paid` (42), `subscription/prepaid/paid` (7) and `subscription/postpaid/paid` (1). There is no monthly bill of any kind.
- Root cause (ISS-001): `findEligiblePostpaidCustomers()` and `checkCustomerPostpaidEnabled()` select `first_name` and `phone` from `customers`, where those columns do not exist — they live on `users`. Both the `@Cron('0 5 0 1 * *')` monthly job and the manual admin trigger fail with `42703`, and the cron swallows the error into a log line. Confirmed live: `POST /admin/postpaid-bills/generate` returned `{"status":false,"action":"failed","message":"column \"first_name\" does not exist"}`.
- The same query has no `WHERE is_postpaid_enabled = true` filter, so a naive fix would attempt to bill every customer.
- Consequently the entire settlement chain — outstandings ledger, partial/full settlement, FIFO across multiple bills, PDF receipts, 7/3/1-day reminders, cross-surface consistency — is **untestable**, which accounts for 6 of the 7 blocked cases in Module 05.
- A second, currently-masked defect will surface the moment billing works: the postpaid **outstanding-bill guard never fires** (ISS-017). Bills are written with `status = 'pending'` while the guard filters `status IN ('unpaid','due','overdue')`. Indebted customers will be able to keep opening new postpaid subscriptions.
- The credit-limit half of the same gate **does** work correctly (rejected ₹6,000 against a ₹5,000 limit).

---

## 5. Payment & Refund Findings

*Strong:*
- **Wallet concurrency is correct.** Two genuinely simultaneous ₹456 debits against a ₹669 balance produced one success and one `400 "Insufficient wallet balance"`, with exactly one ledger row and a final balance of ₹213. No overdraft, no negative balance.
- **Gateway security is correct.** Forged and missing webhook signatures are both rejected with 400 and no database change; verification fails closed when the secret is absent and uses a timing-safe comparison. Forged `verifyPayment` signatures are rejected. Razorpay is correctly in **test** mode.
- **Webhook idempotency is structurally sound** — `ON CONFLICT (provider, event_id) DO NOTHING` backed by a real `UNIQUE (provider, event_id)` constraint. Live duplicate-delivery testing was deliberately not performed, because it would have required reading the production webhook secret.

*Broken:*
- **Order cancellation refunds nothing** (ISS-005). The API returns *"Order cancelled successfully"* while the order stays `placed`, the wallet is untouched and no `refunds` row exists. Root cause: `customer_wallet_transactions.transaction_id` (`varchar(20)`) has a column default stored as a **59-character quoted string literal** instead of an expression, so every insert omitting it fails with `22001`; the transaction aborts and the controller still returns success.
- **No prepaid subscription refund has ever been calculated** (ISS-003). `subscription_refund_candidates` has 0 rows; the scan endpoint 500s on `dra.order_id` (the column is `order_ids`).
- **COD cash is never recorded** (ISS-012). Delivered COD orders remain `payment_status = 'pending'`, and there is no cash figure available for the hub handover.
- **Prepaid order bills overstate the charge** (ISS-042) — a bill recorded `total_amount 247.00 / paid_amount 247.00` for an order that debited ₹171.
- **Cart and checkout disagree** (ISS-020) — ₹272 shown, ₹171 charged, because promotions are missing from the preview and the handling fee is missing from the charge.

---

## 6. Delivery & Dispatch Findings

**The delivery state machine is incomplete, and its end — the handover — has never executed in production.**

- `POST /run/:runId/start` **always** returns 500: it updates `delivery_runs.started_at`, a column that does not exist (the real one is `actual_start_time`) — ISS-006.
- A stop can nonetheless be delivered on a never-started run, **without a proof photo**, and the run then jumps `assigned → completed` directly (ISS-040).
- Because `isRunHandedOver()` tests for `status = 'completed'` — the state `markStopDelivered` has just set — `handoverRun()` always short-circuits and returns *"Run already handed over"* on the **first** call while the database still says `completed` (ISS-007). Its unreachable body also references `delivery_runs.empty_bottles_collected`, another non-existent column.
- Measured impact: `assigned 29 | completed 11 | in_progress 17` — **not one of 57 runs has ever reached `handed_over`**. Collected empties are never submitted, `warehouse_containers` is never incremented, and reconciliation rows stay `pending` with standing discrepancies.
- **Container over-collection is unvalidated** (ISS-011): collecting 5 bottles against a maximum of 3 was accepted and drove `customer_container_balances.balance_quantity` to **−2**, with no rejection and no rollback.
- **Dispatch creation fails** (ISS-018): `POST /admin/delivery/dispatch/:runId` returns 500 on `column p.product_name does not exist` (`products.name`), so no dispatch record, no pickup list, and no way to exercise extra/buffer load quantities.
- The partner app cannot open a run for a slot other than the one implied by the current clock — `run/today` accepts a `date` but never passes a `slot`, even though the underlying helper supports one.
- *Working well:* automated run creation, geographic sequencing, partner load balancing and run reassignment all behaved correctly against real data, and multi-order stops are grouped and delivered correctly in one action.

---

## 7. Admin Panel Findings

- **The Customers directory is permanently empty** (ISS-002). Every call returns `recordsTotal: 41` with `data: []`, because `DataService`'s SELECT sanitiser rejects the `CONCAT_WS(...)` display-name expression. Postpaid settings, wallet adjustment and blocking are all reached from this list, so they are blocked with it.
- **Reported revenue is overstated 13.9×** (ISS-016). `total_revenue` of ₹13,254 counts every non-cancelled order; actual delivered revenue is ₹956. `failed` orders and soft-deleted rows are also included.
- **Customer special prices are silently discarded** (ISS-013). A submitted ₹63 was stored as ₹72 (the variant's subscription price) and the customer was still quoted and charged ₹76, while the API reported `has_special_price: true`.
- Of 120 admin GET endpoints swept: **5 return 500**, **2 return 404 despite being declared**, and **7 return a 200 with a silently-failed query**. The remaining 106 work.
- Every 500 and every silent failure traced to the same root cause class — SQL referencing a column or table that does not exist in the live schema.
- Two controllers register the identical route `admin/customer` + `GET table`; one silently shadows the other (ISS-036).
- The warehouse form's Branch dropdown is empty and optional, so a UI-created warehouse is always an orphan (ISS-035).
- *Working well:* orders, catalog, inventory, branches, warehouses, subscriptions, wallets and staff tables all return correct data; RBAC cleanly rejects customer and partner tokens with 403; branch creation with geofence works; run reassignment works.

---

## 8. Customer App Findings

- **Out-of-coverage addresses are accepted** and silently attached to an arbitrary branch (ISS-014). A Kuppam pin and a **Chennai** pin were both assigned to *Whitefield, Bengaluru*, because `assignBranchAndH3()` falls back to `branches[0]` from an unordered query, making the out-of-zone rejection unreachable.
- **Orders can be placed for past dates** (ISS-015) — an order for 2026-08-20 was accepted nine days later, while the same-day cutoff rule is correctly enforced.
- **Any customer can read any other customer's order** (ISS-009), including name, full address, phone and payment status. The cancel endpoint is correctly scoped, which shows the ownership check exists and was simply omitted on the read paths.
- **Cancellation silently does nothing** (ISS-005) while telling the customer their money is back.
- **Referral signup silently does nothing** (ISS-008) while telling the customer it succeeded.
- Cart totals do not match what is charged (ISS-020).
- *Working well:* bootstrap hydration, catalog browsing, cart persistence, wallet and COD checkout (both write correct, fully reconciled `orders` / `order_items` / ledger rows), all pause and resume scenarios, DTO validation (negative/zero quantity, unknown variant), and the delivery-slot cutoff rule.

---

## 9. Delivery Partner App Findings

- Shift toggle works correctly and, importantly, does **not** lock the partner out of login when going offline.
- Stop details, multi-order stacking at one address, and single-action delivery of all orders at a stop all work.
- Everything around the edges of a delivery is broken: the run cannot be started (ISS-006), the pickup list is empty because dispatch creation fails (ISS-018), the handover is dead code (ISS-007), container collection is unvalidated (ISS-011), COD cash is not recorded (ISS-012), and there is **no failed-delivery endpoint at all** — the documented `PATCH /run/:runId/address/:addressId/fail` does not exist (DP-RUN-004, FU-003).
- The partner earnings screen shows no referral bonuses because `delivery_partner_referral_bonuses` has never received a row (ISS-008).

---

## 10. Cross-Cutting Root Causes

Three underlying weaknesses explain the great majority of the 44 defects. They are addressed together in **FU-007**.

1. **Silent failure in the data-access layer.** `DataService` catches driver errors and returns `{status:false}` rather than throwing. Callers rarely check it, so an aborted transaction still returns a success payload. This is why the three most user-visible defects — cancellation, referral signup and the customer directory — all present as *"it worked"* rather than as an error, and why they have survived in production.
2. **Schema drift with no guard rail.** Nine separate production defects are application SQL referencing a column or table that does not exist: ISS-001, ISS-003, ISS-006, ISS-007, ISS-018, ISS-019, ISS-021, ISS-022, ISS-023. Nothing catches these before a user hits them.
3. **Client-supplied money.** Subscription pricing, the prepaid wallet debit and the postpaid credit check all trust figures sent by the client (ISS-010), and the same divergence between "what we show" and "what we charge" appears again in the cart (ISS-020), special prices (ISS-013) and order bills (ISS-042).

---

## 11. Feature / Update Requirements

| ID | Title |
|---|---|
| FU-001 | Reconcile the test plan's data model with the implemented schema (dispatch, vendors, forecasts) |
| FU-002 | Server-side subscription pricing engine (monthly estimate, unit price, final price) |
| FU-003 | Delivery-run state machine with an enforced handover stage |
| FU-004 | Single pricing source of truth across catalog, cart, checkout and special prices |
| FU-005 | Referral engine rebuild — correct roles, real columns, ₹100 / ₹75 payout paths |
| FU-006 | Postpaid billing lifecycle: generation, status vocabulary, outstanding enforcement |
| FU-007 | Platform hardening: fail-loud data access, timezone alignment, schema-drift prevention |

---

## 12. Overall Application Status

**Not production-ready for the revenue-critical paths. Solid in the paths that were built carefully.**

The catalog, cart, order placement, wallet debiting, authentication, RBAC, gateway security and the subscription schedule/pause engine are all implemented well and behaved correctly under test — including the concurrency and security cases that most commonly fail.

However, **every money-out path in the platform is currently non-functional**:

- No postpaid bill has ever been generated (ISS-001).
- No prepaid subscription refund has ever been calculated (ISS-003 + ISS-004).
- No order cancellation refund has ever been paid (ISS-005).
- No referral reward — customer ₹100 or partner ₹75 — has ever been paid (ISS-008).
- No delivery run has ever been handed over, so no container or stock reconciliation has ever completed (ISS-007).
- COD cash collection is never recorded (ISS-012).

These are not intermittent faults. Each was confirmed against the full production history: the relevant tables are empty, and the code paths that would populate them fail deterministically. The common thread is that the failures are **silent** — the API reports success, so the gaps have not surfaced as user complaints.

Alongside these, three defects need attention independently of the billing work: the IDOR exposing customer PII (ISS-009), the client-controlled subscription pricing that allows a ₹0 prepaid subscription (ISS-010), and the revenue figure the business is currently reading off the dashboard, which is overstated roughly fourteen-fold (ISS-016).

### Recommended sequence

1. **Security first** — ISS-009 (IDOR) and ISS-010 (client-supplied pricing). Both are small, isolated changes with immediate exposure.
2. **Stop the silent failures** — FU-007 step 1. Making writes throw converts an unknown number of latent defects into visible ones, and should precede the functional fixes so their regressions are actually detectable.
3. **Restore the money-out paths** — ISS-001/FU-006 (billing), ISS-003 + ISS-004 (refunds), ISS-005 (cancellation), ISS-008/FU-005 (referrals).
4. **Close the delivery loop** — ISS-006, ISS-007, ISS-018, ISS-011, ISS-012 as one piece of work under FU-003.
5. **Then the remaining Medium and Low items**, and add the schema-drift CI gate (FU-007 step 2) so this class of defect cannot return.

Re-run this full suite after each stage; the 32 blocked cases become executable as their prerequisites are repaired, and they are where the next layer of defects will be found.
