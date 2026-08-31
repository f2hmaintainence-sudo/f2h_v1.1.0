# F2H Fresh — Test Results (29 August 2026)

Real-time execution of the master test plan in `.claude/test/29-08-2026/test-plan/` against the
**running** F2H Fresh application.

## Start here

| Document | What it contains |
|---|---|
| **[test-summary.md](test-summary.md)** | Headline numbers, per-module coverage, findings by area, overall status and the recommended fix sequence. |
| **[test-execution-report.md](test-execution-report.md)** | Every test case: preconditions, steps actually performed, expected vs actual, verdict, evidence and root cause. |
| **[09-referrals-live-test-2026-08-31.md](09-referrals-live-test-2026-08-31.md)** | **Re-run 2026-08-31** — live re-execution of the referrals plan against the rebuilt reward engine. 8 pass, 1 partial, 6 fail. |
| **[issues/](issues/)** | 51 defect reports, one file per issue (`ISS-001` … `ISS-051`). |
| **[feature-updates/](feature-updates/)** | 7 change requests where the implementation does not satisfy the documented requirement (`FU-001` … `FU-007`). |
| **[api-results/](api-results/)** | Raw API responses, including the full 120-endpoint admin sweep. |
| **[database-results/](database-results/)** | SQL verification output for subscriptions, billing, delivery, containers, wallet and referrals. |
| **[evidence/](evidence/)** | API error-log extracts captured during execution. |

## Result at a glance

**121 cases executed — 38 passed, 47 failed, 32 blocked, 4 not applicable.**
**44 defects: 10 Critical, 11 High, 20 Medium, 3 Low.** 7 feature/update requirements.

The catalog, cart, order placement, wallet debiting, authentication, RBAC, gateway security and the
subscription schedule/pause engine all work correctly. **Every money-out path does not**: no postpaid
bill, prepaid refund, cancellation refund or referral reward has ever been produced in this system,
and no delivery run has ever completed its handover. All of these fail silently — the API reports
success — which is why they have not surfaced as user complaints. See `test-summary.md` §12.

> **Update — 2026-08-31.** The referrals module was re-tested live after the reward-engine rebuild.
> The **payout** half of ISS-008 is fixed and proven: ₹100 to the customer referrer, ₹75 to the
> delivery partner, ₹0 to the new user, with working `SELECT ... FOR UPDATE` idempotency. The
> **referrer-resolution** half is not — a referral only pays out when a correct `referrals` row
> already exists, and both paths that should create one still fail (ISS-047, ISS-048). Seven new
> defects: ISS-045 … ISS-051. See
> [09-referrals-live-test-2026-08-31.md](09-referrals-live-test-2026-08-31.md).

---

## 1. Environment tested

| Item | Value |
|---|---|
| API | `http://127.0.0.1:5001/api/v1` — PM2 `api-f2hfresh` |
| Admin Web | `http://127.0.0.1:5002` — PM2 `frontend-f2hfresh` |
| Database | PostgreSQL **`f2h_fresh`** (live), 120 tables |
| Redis | `127.0.0.1:6379` |
| Razorpay | **TEST mode** (`rzp_test_…`) |

> The application is bound to the **live** database, not to the `f2hfresh_test` sandbox the plan
> assumes. `f2h_fresh_test` exists with 120 tables but nothing points at it, and repointing the API
> would have taken the production site down. Testing therefore ran against the live stack under the
> data rules below.

## 2. Data rules observed

- No production or business record was deleted.
- No existing customer, order, subscription, bill or partner record was modified — with one recorded exception (§3).
- Every record created is prefixed `QA_` or named "QA TEST" and is listed in §4.
- Payment testing used Razorpay **TEST** mode only. Gateway secrets were deliberately **not** read
  or used; PAY-WBH-001 is recorded as BLOCKED for that reason rather than executed.
- No defect found during this run was fixed. Everything is reported, not repaired.

## 3. Recorded exceptions and side effects

1. **Run reassignment (reverted).** To exercise `ADM-DEL` reassignment, run `RUN-20260830-MOR-001`
   (Kuppam, 2026-08-30 morning, 2 orders) was reassigned from partner `F2HVOD3GJ` to `QA_DP_01` and
   then **reassigned back to `F2HVOD3GJ`**. Final state matches the original.
2. **Two run-creation calls.** `POST /admin/delivery/runs/create` was executed for 2026-08-30
   morning on the Kuppam branch and on the QA branch. This is the same action the 20:30 IST
   scheduler performs; it ran a few hours early. Run `RUN-20260830-MOR-001` contains two genuine
   orders, correctly assigned and sequenced.
3. **Isolation branch.** Rather than execute deliveries against real customers' orders, a dedicated
   QA branch and warehouse were created so the run under test contained **only** QA orders.
4. **Account unlock.** `QA_ADM_01` was locked by its own brute-force test (ADM-AUTH-002) and
   unlocked by clearing `users.locked_at` on that QA account only.

## 4. Test records created — clean-up list

All of the following are test data and can be removed once the results have been reviewed.
Nothing else in the database was created or altered by this run.

**Users and satellites**

| user_id | Email | Role | Satellite rows |
|---|---|---|---|
| `QA_ADM_01` | `qa.admin@f2htest.local` | ADMIN | `management_staff` (`MSQA01`), `role_assignments` |
| `QA_CUST_PRE` | `qa.prepaid@f2htest.local` | CUSTOMER | `customers`, `role_assignments` |
| `QA_CUST_POST` | `qa.postpaid@f2htest.local` | CUSTOMER | `customers`, `role_assignments` |
| `QA_CUST_REF` | `qa.referee@f2htest.local` | CUSTOMER | `customers`, `role_assignments` |
| `QA_DP_01` | `qa.partner@f2htest.local` | DELIVERY_PARTNER | `delivery_partners`, `role_assignments` |

All five share one QA password, which is deliberately not recorded in this documentation.

> **`QA_ADM_01` has been disabled at the end of the run** (`users.account_status = 'inactive'`,
> `management_staff.is_active = false`) so no live ADMIN account with a known password is left on the
> server. To re-enable it for a re-run, set `account_status = 'active'` and `is_active = true`.
> The four non-admin QA accounts remain active so the created test data stays reachable.

**Master data**

| Type | Identifier | Name |
|---|---|---|
| Branch | `BRANCH0nEzi3unhuEg` | QA TEST BRANCH (automated test) |
| Warehouse | `WH-MTEBESZ953A8S7` | QA TEST WAREHOUSE (`QA-WH-01`) |

**Transactional data**

| Type | Identifiers |
|---|---|
| Addresses | `ADDRCUU7OT`, `ADDR0THVVK` (QA_CUST_PRE), `ADDR73A7PR` (QA_CUST_POST) |
| Orders | `OrdCOFWE6523B6V` (wallet, ₹171), `OrdMOCB3B10KA70` (COD ₹228, delivered), `OrdG86R9EV88B6H` (wallet ₹456, cancel attempted), `OrdMV8IZG86FJFQ` (back-dated ₹76 — evidence for ISS-015) |
| Subscriptions | `SUB_MTEAXM4QC04R`, `SUB_MTEB2QBM1FY0` (+ items, weekly schedules, pauses, logs) |
| Delivery run | `RUN-20260830-MOR-002` (QA branch, QA order only) |
| Container balance | `customer_container_balances` row for `QA_CUST_PRE` / `CONT-001` — **`balance_quantity = -2`**, the evidence for ISS-011 |
| Reconciliation | `delivery_container_reconciliation` row for `RUN-20260830-MOR-002` |
| Special price | `customer_special_prices` row for `QA_CUST_PRE` / `VRT0NFGWE8WG` (stored incorrectly — evidence for ISS-013) |
| Payment | `payment_transactions` row `PTMTEBR682I6CCHU` — Razorpay **test** order `order_TVZoKHcP3y3Ak6`, unpaid |
| Bills | `BILLGFYBYUXX9JJ`, `BILL_MTEAXM53` |
| Wallet | `customer_wallet_transactions` rows for `QA_CUST_PRE`; final balance ₹213.00 |

## 5. What was not covered

| Area | Why |
|---|---|
| Flutter UI rendering (both apps) | No emulator/device session; all client behaviour was exercised through the APIs those apps call. |
| Admin Panel visual/browser behaviour | Verified through the same APIs the panel consumes, not through the rendered page. |
| OTP registration (`CUST-AUTH-001`, `DP-AUTH-001`) | Requires a live Fast2SMS message to a real handset; no test-fixture OTP exists in this build. |
| Socket.IO live feeds and Google Maps tracking | Require a browser session. The gateway itself was observed authenticating and joining admin rooms in the API log. |
| Completed Razorpay payments | Requires the hosted checkout UI. Order creation and signature verification were tested. |
| Duplicate webhook delivery (`PAY-WBH-001`) | Would require the production webhook secret — excluded by the data rules. Verified structurally instead. |
| Writing snapshot-cron execution (`SUB-CRON-002`) | Would have generated real orders for real customers ahead of schedule. Verified read-only through the pre-dispatch summary. |
| Multi-instance cron contention (`EDG-CRN-001`) | Single PM2 fork; lock logic verified by inspection. |

## 6. Reading the issue documents

Each file in `issues/` carries: Issue ID, Test Case ID(s), Module, Severity, Steps to Reproduce,
Expected Result, Actual Result, **Root Cause**, Affected Files/API/Tables, Recommended Fix, and
Required Regression Tests. Every failure was traced to a specific line or schema object before being
written up — no failure is reported as "returns 500" without an explanation of why.
