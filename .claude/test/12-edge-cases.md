# 12 — Edge Cases, Race Conditions & Boundary Test Specification

> **Scope:** High-Stress Concurrency, Boundary Values, Gateway Webhook Retries & Failure Modes  
> **Priority:** `P0 — Edge Case Resilience & Fault Tolerance`

---

## 1. Concurrency, Race Conditions & Anti-Double Spend

#### EDG-RCE-001: Concurrent Wallet Checkout Race Condition (Double Spend)
- **Scenario:** Customer with ₹500 balance fires two concurrent requests of ₹400 each at the exact same millisecond.
- **Expected Result:** Exactly one checkout succeeds (debited to ₹100). The second checkout returns `400 Bad Request` (*"Insufficient wallet balance"*). Final balance = `₹100.00` (Never negative).
- **Verification:** Atomic `UPDATE customers SET wallet_balance = wallet_balance - $1 WHERE customer_id = $2 AND wallet_balance >= $1 RETURNING wallet_balance`. Exactly one debit row in `customer_wallet_transactions`.

#### EDG-RCE-002: Concurrent Subscription Checkout & Wallet Debit
- **Scenario:** Customer clicks "Confirm Subscription" 5 times rapidly on poor mobile connection.
- **Expected Result:** API handles request idempotently via unique token/transaction lock. Exactly one subscription created, wallet debited once.

#### EDG-RCE-003: Double Payment Gateway Webhook Delivery
- **Scenario:** Razorpay delivers duplicate `payment.captured` webhooks concurrently.
- **Expected Result:** Handled idempotently via `INSERT INTO payment_webhook_events ON CONFLICT (provider, event_id) DO NOTHING`. Customer wallet or bill settled exactly once.

---

## 2. Cron & Schedulers Concurrency & Idempotency

#### EDG-CRN-001: Distributed Multi-Instance Cron Execution
- **Scenario:** Two API PM2 instances both trigger `subscription-snapshot.cron` at 23:55 IST.
- **Expected Result:** First instance acquires Redis lock `order_processing:2026-09-02:morning`. Second instance fails lock acquisition and logs *"Skipped; lock already held"*. Zero duplicate orders generated.

#### EDG-CRN-002: Re-Running Monthly Billing Cron
- **Scenario:** Monthly billing cron runs at 00:05 and is manually re-triggered at 08:00 on the 1st.
- **Expected Result:** `checkBillExists` detects existing bill for the period; skips customer with `action: 'skipped'`.

---

## 3. Boundary Dates, Calendars & Month Transitions

#### EDG-CAL-001: February Month-End Boundary (28 vs 29 Days)
- **Scenario:** Subscription created starting Feb 01 in leap year (2028) vs non-leap year (2026).
- **Expected Result:** `calcMonthEndDate('2026-02-01')` returns `2026-02-28`. `calcMonthEndDate('2028-02-01')` returns `2028-02-29`.

#### EDG-CAL-002: Subscription Starting on the Last Day of Month
- **Scenario:** Subscription created on Aug 31 with monthly billing cycle.
- **Expected Result:** Start date = `2026-08-31`, End date = `2026-08-31` (1 day for August). Renewal generates Sep 01–30.

#### EDG-CAL-003: Midnight IST Slot Transition (23:55 vs 00:05 IST)
- **Scenario:** Order generated at 23:55 IST targeting tomorrow's morning slot.
- **Expected Result:** Dates calculated strictly in `Asia/Kolkata` timezone (`Intl.DateTimeFormat`). No day-shift bugs due to server UTC clock.

---

## 4. Subscriptions Edge States

#### EDG-SUB-001: Resume Subscription with Requested Date Equal to Pause End Date (Scenario 3)
- **Scenario:** Customer paused until Sep 20. Resumes on Sep 15 specifying `resume_date = '2026-09-20'`.
- **Expected Result:** Scenario 3 executed cleanly. Pause end date truncated to Sep 19. Deliveries restart on Sep 20.

#### EDG-SUB-002: Customer Cancels Subscription While Paused
- **Scenario:** Customer cancels standing subscription while in the middle of a 10-day pause.
- **Expected Result:** Subscription transitions to `cancelled`. `subscription_pauses` record closed. Unconsumed prepaid active days and paused days remain auditable for month-end refund review.

#### EDG-SUB-003: Sunday-Only Subscription Matrix (6 Days Zero Quantity)
- **Scenario:** Customer configures `m_quantity = 0` Monday–Saturday and `m_quantity = 2` Sunday.
- **Expected Result:** Weekly matrix saves valid Sunday entry. Daily snapshot cron runs Mon–Sat generating 0 orders; runs Sunday generating 1 order with 2 units.

---

## 5. Logistics, Containers & Handover Discrepancies

#### EDG-LGT-001: Attempting to Collect More Containers Than Owned
- **Scenario:** Customer possesses 1 bottle. Driver attempts to collect 5 bottles.
- **Expected Result:** API throws `400 Bad Request`: *"Cannot collect 5 containers. Customer only has 1 outstanding containers"*. Transaction rolled back.

#### EDG-LGT-002: Delivery Partner Lost or Damaged Bottles on Route
- **Scenario:** Driver drops and shatters 2 glass bottles while riding.
- **Expected Result:** Driver logs `damaged = 2` during stop or hub handover. `dispatch_balances.damaged_qty` records 2. Warehouse stock reflects written-off damaged assets.

#### EDG-LGT-003: Multiple Orders Stacked at Same Customer Address
- **Scenario:** Customer has 1 subscription order (Milk) and 2 one-time orders (Veggies, Fruits) for same morning slot.
- **Expected Result:** Delivery app groups all 3 orders into a single physical stop. Partner uploads 1 proof photo and delivers all 3 orders in a single tap.

---

## 6. Catalog, Cart & Pricing Integrity

#### EDG-PRC-001: Variant Deleted / Inactive During Active Cart Checkout
- **Scenario:** Admin deactivates variant while customer has it in cart. Customer taps Place Order.
- **Expected Result:** Checkout validation catches unavailable variant. Rejects with `400 Bad Request`: *"Product variant [ID] is unavailable"*. No fallback ₹150 charge.

#### EDG-PRC-002: Zero Quantity and Negative Quantity Injection
- **Scenario:** Malicious user posts cart item with `quantity = -5` or `quantity = 0`.
- **Expected Result:** DTO validation pipe strips or rejects with `400 Bad Request` (`@Min(1)`).

---

## 7. Referrals Anti-Fraud

#### EDG-REF-001: Re-Delivering First Order Does Not Trigger Second Reward
- **Scenario:** Driver marks first order delivered, then server retries delivery webhook.
- **Expected Result:** `ReferralRewardEngineService` row lock finds `status = 'rewarded'`. Returns immediate no-op. Zero extra wallet credit.

#### EDG-REF-002: Circular Referral Attempt (A refers B, B refers A)
- **Scenario:** Customer A refers B; Customer B attempts to use A as referee to get A's code.
- **Expected Result:** System blocks circular registration or treats as already referred.
