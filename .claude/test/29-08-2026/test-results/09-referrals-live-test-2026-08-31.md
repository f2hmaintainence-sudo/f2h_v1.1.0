# 09 — Referrals: Live Real-Time Test Execution Result

| Field | Value |
|---|---|
| **Test Plan** | `.claude/test/29-08-2026/test-plan/09-referrals.md` |
| **Executed** | 2026-08-31, 23:10–23:14 IST |
| **Environment** | **Live** application — API `pm2:api-f2hfresh` on `:5001`, PostgreSQL `f2h_fresh` |
| **Method** | Real-time execution against the live database. `ReferralRewardEngineService`, `FirstOrderDetectorService`, `ReferralService` and `ReferralRepository` were driven directly through a Nest application context, exactly as `delivery.order.service.ts:1285` / `:1684` and `OrderDeliveredListener` drive them in production. The public `GET /customer/referrals/validate/:code` endpoint was exercised over HTTP. |
| **Harnesses** | `apps/api/src/scripts/qa-referral-live-test.ts`, `apps/api/src/scripts/qa-referral-live-test-2.ts` |
| **DB evidence** | `database-results/referrals-live-test-2026-08-31.txt` |
| **Result** | **8 PASS · 1 PARTIAL · 6 FAIL** — the core payout engine works; referrer *resolution* is broken and exploitable |

---

## 1. Accounts under test

Both codes supplied for the run were checked as given, and then traced to the identities behind them.

| Role | Supplied identifier | Resolves to | State at test start |
|---|---|---|---|
| Existing customer (referrer) | `ashokroman007` | `F2HQFK7NH` — `ashokroman007@gmail.com` | `wallet_balance = 798.00`, `first_order_completed = true` |
| Delivery partner (referrer) | `ashoknanda130120@gmail.com` | `F2HFUGZ6H` — "Allen Roy", row in **both** `customers` and `delivery_partners` | customer `wallet_balance = 295.00`, `is_active = true` |

> **Neither supplied string is a working referral code.** The live referral code for a customer is
> their `customer_id` (`ReferralRepository.ensureCustomerReferralCode()` returns `targetId` as the
> code). `ashokroman007` and `ashoknanda130120@gmail.com` both return
> `{"valid":false,"message":"Invalid referral code"}`. The working codes are `F2HQFK7NH` and
> `F2HFUGZ6H`, which do validate. See **REF-CODE-001 / 002** and **ISS-045**.

---

## 2. Result matrix

| Test case | Title | Result |
|---|---|---|
| REF-CUST-001 | Existing user gets ₹100 wallet reward, new user gets ₹0 | ✅ **PASS** |
| REF-CUST-001b | Referrer receives the ₹100 push notification | ✅ **PASS** |
| REF-CUST-002 | No automatic first-order refund/cashback | ✅ **PASS** |
| REF-CUST-003 | Double-reward / duplicate delivery callback rejected | ✅ **PASS** |
| REF-CUST-003c | Two concurrent callbacks credit exactly once (`FOR UPDATE`) | ✅ **PASS** |
| REF-PART-001 | Delivery partner accrues ₹75 pending bonus, new user gets ₹0 | ✅ **PASS** |
| REF-CUST-007 | Referral code locked before first delivered order, active after | ✅ **PASS** |
| REF-CUST-004 | Self-referral prevention | ⚠️ **PARTIAL** — blocked by accident, API still returns success |
| REF-PART-002 | Delivery partner receives the ₹75 acquisition-bonus push | ❌ **FAIL** — ISS-046 |
| REF-CUST-005 | Signup-only referral (`users.referred_by`, no `referrals` row) rewards | ❌ **FAIL** — ISS-047 |
| REF-CUST-006 | `POST /customer/referrals/add` records caller as referee | ❌ **FAIL** — ISS-048 |
| REF-CODE-001 | Code lookup for the supplied customer code | ❌ **FAIL** — ISS-045 |
| REF-CODE-002 | Code lookup for the supplied partner code | ❌ **FAIL** — ISS-045 |
| EDG-REF-A | Referrer id owning no `customers` row | ❌ **FAIL** — ISS-049 |
| EDG-REF-B | Circular referral A→B and B→A | ❌ **FAIL** — ISS-050 |

---

## 3. What passed — the payout engine itself is now correct

`ReferralRewardEngineService.processReferralReward()` is the part of ISS-008 that has been
genuinely fixed. Every rule in §1 of the test plan holds:

### REF-CUST-001 — ✅ PASS

Referral seeded `F2HQFK7NH → QAREFBHIY719` (`pending`, 100.00 / 0.00), then the engine was invoked
with order `QAORDHIY719B1`:

```
engine  : {"status":true,"referrer_type":"customer","referrer_reward":100,
           "referee_reward":0,"message":"Rewards processed: ₹100 credited to referrer wallet."}
referrer: F2HQFK7NH wallet 798.00 -> 898.00
referee : QAREFBHIY719 wallet 0.00, first_order_completed = true
referrals: status='rewarded', 100.00 / 0.00, rewarded_at=2026-08-31T17:40:51.410Z
ledger  : amount=100.00 balance_after=898.00 type=credit reference_type=referral_bonus
          reference_id=QAORDHIY719B1
```

The ₹100/₹0 split is exactly as specified — the **referrer** is paid, the **new user** gets nothing.
`status` and `rewarded_at` are now written together (the old production rows at `referrals.id 3–8`
still show the reverse defect: `rewarded_at` set while `status='pending'`).

### REF-CUST-001b — ✅ PASS

```
🎉 Referral Bonus Received! | ₹100 credited to your wallet! Your friend Nandu278867
completed their 1st delivered order.
```

A `notifications` + `notification_recipients` pair is created for the referrer.

### REF-CUST-003 — ✅ PASS

Re-invoking on the same order, and again on a second order, both returned
`{"status":false,"message":"No eligible referral record found or reward already processed."}`.
Wallet held at `898.00`; `SELECT COUNT(*) … reference_type='referral_bonus'` for `F2HQFK7NH`
stayed at exactly one new row.

> The message text differs from the spec's
> `"Referral reward already processed previously."`. The engine has that exact string on the
> `status='rewarded'` branch, but the lock query filters rewarded rows out before it is reached, so
> the generic message is what callers actually see. Cosmetic only — behaviour is correct.

### REF-CUST-003c — ✅ PASS (concurrency)

Two `processReferralReward()` calls fired simultaneously on a fresh referral:

```
race     : [true, false]
wallet   : 898.00 -> 998.00   (exactly one ₹100 credit)
```

`SELECT ... FOR UPDATE` holds. No double-credit under concurrent delivery callbacks.

### REF-PART-001 — ✅ PASS

Referral seeded `F2HFUGZ6H → QAREFCHIY719` deliberately at **100.00**, to check the engine forces
the DP rate rather than trusting the stored amount:

```
engine  : {"status":true,"referrer_type":"delivery_partner","referrer_reward":75,"referee_reward":0}
bonus   : {"bonus_id":"DPBTKNAG34573","partner_id":"F2HFUGZ6H","refer_id":"QAREF6C6OPE",
           "order_id":"QAORDHIY719C1","amount":"75.00","status":"pending"}
referrals: 75.00 / 0.00, rewarded          <- overwritten from the seeded 100.00
referee : QAREFCHIY719 wallet 0.00
DP's own customer wallet: 295.00 -> 295.00 (correctly untouched)
```

`F2HFUGZ6H` exists in **both** `customers` and `delivery_partners`; the engine correctly took the
partner branch and paid to `delivery_partner_referral_bonuses`, not to the wallet. This is the
first non-zero row that table has ever held — it was empty before this run.

### REF-CUST-002 — ✅ PASS

No wallet credit of any kind was created for any of the four referees during first-order
processing. The hardcoded first-order cashback is gone from the current source.

> **Residue:** one historical row remains from the previous build —
> `WTtkmbls3644 | F2HQFK7NH | 50.00 | "Welcome Reward: First order completed using referral code"`
> (2026-08-31 07:08). It predates the fix; the code path no longer exists. It is, however, still
> being counted as referral earnings — see ISS-051.

### REF-CUST-007 — ✅ PASS

Referral code is `null` / `locked` until a first order is delivered, then becomes the customer's
own id with status `active`. `F2HQFK7NH` → `active` / `F2HQFK7NH`.

---

## 4. What failed

### ISS-045 — Referral code lookup resolves the wrong person, and invents people 🔴 Critical

`ReferralRepository.findByReferralCode()` tries the literal id, then falls back to
**matching the last 4 digits of the code against any user's phone number**, then to
**fabricating a brand-new user account** for anything starting with `F2H`.

Live probes against the public, unauthenticated `GET /api/v1/customer/referrals/validate/:code`:

| Code entered | Response | What actually happened |
|---|---|---|
| `ashokroman007` | `valid:false` | The identifier the business hands out does not work |
| `ashoknanda130120@gmail.com` | `valid:false` | Same for the partner |
| `F2HQFK7NH` | `valid:true`, "Ashok" | Correct |
| `0644` | `valid:true`, **"Allen"** | Matched `users.phone LIKE '%0644'` — an arbitrary 4-digit string silently resolves to a real person |
| `ASHOK0644` | `valid:true`, **"Allen"** | Same — the letters are discarded, only the digits matter |
| `F2H9169` | `valid:true`, "F2H Referrer" | **Created `users` + `customers` rows for `USER_F2H9169`** |

Consequences:

1. **Reward misattribution.** Any code whose last four digits collide with a phone number pays a
   stranger. The keyspace is 10,000 — trivially brute-forcible.
2. **Unauthenticated account creation.** A public GET writes to `users` and `customers`.
   `USER_F2H9169` was created at `2026-08-31 19:41:47` by a single `curl`.
3. **Phantom referrers already in production.** `USER_F2HQFK` and `USER_F2HQFK7` exist — truncated
   mistypings of `F2HQFK7NH`. A real customer who mistyped the code was attached to a ghost
   account instead of to Ashok. `referrals.id = 34` is live evidence: a `pending` ₹100 owed to
   `USER_F2HVOD3GJ-PARTNER`, an account that only exists because someone typed
   `F2HVOD3GJ-PARTNER` into the box.
4. **Hardcoded identity.** `referral.repository.ts:113-118` special-cases the literal string
   `F2HASH647` to the name "Ashok Roman" and the address `ashokroman007@gmail.com`.

### ISS-046 — Delivery partner is never told about the ₹75 bonus 🟠 High

`referral-reward-engine.service.ts:220` guards the notification with `if (!referrerIsDP)`. The
spec's sequence diagram requires `ENG->>REF: "🎉 ₹75 New Customer Acquisition Bonus Accrued!"`.
No `notifications` row was created for `F2HFUGZ6H`. The money accrues silently.

### ISS-047 — Signup-only referrals never pay out 🔴 Critical

Customer `QAREFDHIY719` was created with `users.referred_by = 'F2HQFK7NH'` and no `referrals` row —
the state a signup-time referral produces. On first delivery:

```
engine   : {"status":false,"message":"No eligible referral record found or reward already processed."}
referrals: no row created
wallet   : F2HQFK7NH 998.00 -> 998.00   (no credit)
```

The auto-create branch at `referral-reward-engine.service.ts:70` is dead code. It reads
`referee.referred_by`, but the referee query selects
`c.*, u.first_name, u.last_name, u.user_name, u.phone, u.email` — and `referred_by` lives on
**`users`**, not `customers` (confirmed against `information_schema`). The field is always
`undefined`, so the branch never runs. This is ISS-008 root cause #3, still unfixed.

### ISS-048 — `POST /customer/referrals/add` writes nothing and reports success 🔴 Critical

Caller `QAREFFHIY719` submitting Ashok's code `F2HQFK7NH`:

```
API response : {"status":true,"message":"Referral recorded successfully","data":null}
referrals    : no row
users.referred_by : NULL
apps/api/logs/app.log:99
  ERROR : Database Error {"table":"referrals","errorCode":"23502",
    "error":"null value in column \"referred_customer_id\" of relation \"referrals\"
             violates not-null constraint"}
```

`ReferralService.createReferral()` still sends `referrer_id: userId` — recording the *caller*, who
entered someone else's code, as the **referrer** — and never supplies `referred_customer_id`, which
is `NOT NULL`. Every insert fails; the failure is swallowed and HTTP 201 is returned. It also sets
`status: 'completed'` with `reward_amount: 100.00`, bypassing the first-delivered-order gate. This
is ISS-008 root cause #1, unchanged.

### REF-CUST-004 — ⚠️ PARTIAL — self-referral blocked only by accident

```
validate : {"status":true,"valid":false,"message":"Self-referral is not allowed"}
add      : {"status":true,"message":"Referral recorded successfully","data":null}
referrals: no row where referrer = referred
```

The *outcome* is correct — no self-referral row exists. But `createReferral()` never calls
`validateReferralCode()`; the row is absent only because the same `23502` from ISS-048 killed the
insert. Fixing ISS-048 without adding an explicit self-referral guard will open this hole.

### ISS-049 — A referrer with no `customers` row silently burns the reward 🟠 High

`findByReferralCode()` maps the codes `APP INVITE` / `INVITE` / `F2HREF` to a synthetic referrer id
`APP_INVITE_GENERAL`, which owns no `customers` row. Driving a referral from it:

```
engine        : {"status":true,"referrer_reward":100,"message":"Rewards processed: ₹100 credited to referrer wallet."}
customers row : DOES NOT EXIST — nothing was credited
ledger        : customer_id='APP_INVITE_GENERAL' amount=100.00 balance_after=100.00 referral_bonus
referral      : status='rewarded'
```

The `UPDATE customers … RETURNING wallet_balance` matches zero rows, but the code does not check
`rowCount`; it falls back to `Number(undefined ?? referrerRewardAmount)` for `balance_after` and
writes the ledger row anyway. `customer_wallet_transactions` has **no foreign key** on
`customer_id` (only a PK on `id`), so the orphan persists. The referral is marked `rewarded`, so it
can never be retried. Net effect: the ledger claims ₹100 was paid, no wallet moved, and the
referrer's reward is permanently lost.

### ISS-050 — Circular referrals mint money 🟠 High

Two accounts each holding the other's code, each completing a first order:

```
B's first order : {"status":true,"referrer_reward":100}   -> A credited ₹100
A's first order : {"status":true,"referrer_reward":100}   -> B credited ₹100
balances        : QAEDGXHJ1MLM 100.00, QAEDGYHJ1MLM 100.00
```

Two colluding signups extract ₹200 with no check. Nothing rejects a referral whose referrer is
itself referred by the referee.

### ISS-051 — Referral dashboard over-reports referrals and earnings 🟡 Medium

`GET /customer/referrals/dashboard` for `F2HQFK7NH` reports
`total_referrals = 5, total_earnings = 350`. The truth is **3 rewarded referrals worth ₹300**:

- `ReferralRepository.findByReferrerId()` filters
  `WHERE referrer_customer_id = $1 OR referred_customer_id = $1` — the row where this customer was
  the *referee* (`referrals.id = 1`) is counted as one of their own referrals.
- `getTotalEarnings()` sums every wallet credit whose `reference_type` or `remarks` matches
  `%referral%`, which sweeps in the ₹50 "Welcome Reward" the customer received *as a referee*.
- `getReferralDashboard()` then applies `Math.max(list.length, Math.ceil(earnings / 100))`, so a
  ₹75 partner bonus or a ₹50 legacy credit rounds the displayed count upward again.

---

## 5. Test data created (left in place, as requested)

Nothing was deleted or reverted. All rows below are QA data and can be removed once reviewed.

| Type | Identifiers |
|---|---|
| Customers + users | `QAREFBHIY719`, `QAREFB2HIY719`, `QAREFCHIY719`, `QAREFDHIY719`, `QAREFEHIY719`, `QAREFFHIY719`, `QAEDGAHJ11AN`, `QAEDGAHJ1MLM`, `QAEDGXHJ1MLM`, `QAEDGYHJ1MLM` |
| `referrals` | ids 36, 37, 38, 41, 42, 43, 44 |
| `delivery_partner_referral_bonuses` | `DPBTKNAG34573` (₹75, `pending`, partner `F2HFUGZ6H`) |
| Orphan ledger rows | 2 × `customer_id='APP_INVITE_GENERAL'` (ISS-049 evidence) |
| Phantom user | `USER_F2H9169` (ISS-045 evidence, created by one public GET) |

**Real accounts touched:**

| Account | Before | After | Cause |
|---|---|---|---|
| `F2HQFK7NH` (ashokroman007) | ₹798.00 | **₹998.00** | 2 × ₹100 referral credits — REF-CUST-001 and the concurrency case |
| `F2HFUGZ6H` (ashoknanda130120) | ₹295.00 | ₹295.00 | unchanged; received a ₹75 **pending** bonus in `delivery_partner_referral_bonuses` |

To undo:

```sql
UPDATE customers SET wallet_balance = 798.00 WHERE customer_id = 'F2HQFK7NH';
DELETE FROM customer_wallet_transactions
 WHERE reference_id IN ('QAORDHIY719B1','QAORDHIY719R1') OR customer_id = 'APP_INVITE_GENERAL';
DELETE FROM delivery_partner_referral_bonuses WHERE bonus_id = 'DPBTKNAG34573';
DELETE FROM referrals WHERE refer_id LIKE 'QAREF%' OR refer_id LIKE 'QAEDG%';
DELETE FROM customers WHERE customer_id LIKE 'QAREF%' OR customer_id LIKE 'QAEDG%' OR customer_id = 'USER_F2H9169';
DELETE FROM users WHERE user_id LIKE 'QAREF%' OR user_id LIKE 'QAEDG%' OR user_id = 'USER_F2H9169';
```

---

## 6. Verdict

The **reward engine** — the ₹100/₹0 customer split, the ₹75/₹0 partner split, transactional
idempotency and `FOR UPDATE` concurrency safety — is correct and is now proven working on live
data. That closes the payout half of ISS-008.

The **referrer-resolution half of ISS-008 is not fixed.** A referral only pays out when a correct
`referrals` row already exists, and the two paths that are supposed to create one both fail:
`POST /customer/referrals/add` throws `23502` and lies about it (ISS-048), and the signup-time
`users.referred_by` path is dead code (ISS-047). In production this shows as `referrals` rows that
sit `pending` forever, and `delivery_partner_referral_bonuses` having been empty until this test.

Ahead of the payout bugs in priority is **ISS-045**: the code lookup resolves strangers by phone
suffix and creates accounts from an unauthenticated GET. It should be reduced to an exact match on
an issued code before anything else here is touched.
