# 09 — Customer & Delivery Partner Referrals Master Test Specification

> **Subsystems:** Customer Referral Wallet Rewards & Delivery Partner Acquisition Bonuses  
> **API Services:** `ReferralRewardEngineService`, `FirstOrderDetectorService`, `CustomerReferralService`, `DeliveryPartnerReferralService`  
> **Tables:** `customers`, `referrals`, `customer_wallet_transactions`, `delivery_partner_referral_bonuses`, `notifications`  
> **Priority:** `P0 — Growth Engine & Reward Anti-Fraud Protection`

---

## 1. Business Logic & Referral Rules

1. **Customer-to-Customer Referral (Existing User refers New User)**:
   - **Existing User (Referrer)**: Receives **₹100 wallet reward** when the new referred user completes and gets their first order delivered.
   - **New User (Referee / Referred Customer)**: Receives **₹0 referral reward** (`₹0.00`).
2. **Delivery Partner Referral (Partner refers New User)**:
   - **Delivery Partner (Referrer)**: Receives **₹75 acquisition bonus** logged into `delivery_partner_referral_bonuses` when the new referred user completes and gets their first order delivered.
   - **New User (Referee / Referred Customer)**: Receives **₹0 referral reward** (`₹0.00`).
3. **No Automatic First-Order Refunds/Cashbacks**:
   - No hardcoded ₹50 refund/cashback or referral unlock bonus on first order.
   - New customers get discounts on their first order **strictly via active Coupons and Promotions** entered at checkout.
4. **Idempotency & Concurrency Protection**:
   - Atomic PostgreSQL transactions with `SELECT ... FOR UPDATE` row-level locks prevent double-crediting or duplicate reward events when multiple delivery callbacks occur.

---

## 2. Referral Reward Engine Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant REF as Referrer (Existing Customer or Delivery Partner)
    participant NEW as New Referee Customer
    participant ORD as Order Engine & Dispatch
    participant ENG as ReferralRewardEngineService
    participant DB as PostgreSQL Transaction (Row Lock)

    REF->>NEW: Shares Referral Code (e.g., REF_ALICE or DP_PARTNER)
    NEW->>DB: Registers with referral code (customers.referred_by = 'REF_ALICE')
    DB->>DB: INSERT INTO referrals (status='pending', referrer_reward_amount=100.00, referred_reward_amount=0.00)

    Note over NEW,ORD: New Referee places 1st order & order is delivered
    ORD->>ENG: processReferralReward(refereeCustomerId, orderId)

    ENG->>DB: BEGIN TRANSACTION
    ENG->>DB: SELECT * FROM referrals WHERE referred_customer_id = ... FOR UPDATE
    
    alt Status != 'rewarded' AND first_order_completed = false
        ENG->>DB: UPDATE referrals (status='rewarded', rewarded_at=NOW())
        ENG->>DB: UPDATE customers SET first_order_completed=true WHERE customer_id = refereeCustomerId
        
        alt Referrer is Existing Customer
            Note over ENG,DB: Referrer (Existing User) gets ₹100, Referee (New User) gets ₹0
            ENG->>DB: UPDATE customers SET wallet_balance += 100.00 WHERE customer_id = referrerId
            ENG->>DB: INSERT INTO customer_wallet_transactions (customer_id=referrerId, amount=100.00, type='credit', ref='referral_bonus')
            ENG->>REF: Send FCM Push: "🎉 ₹100 Referral Bonus Credited to your wallet!"
        else Referrer is Delivery Partner
            Note over ENG,DB: Partner gets ₹75 Bonus, Referee (New User) gets ₹0
            ENG->>DB: INSERT INTO delivery_partner_referral_bonuses (partner_id=dpId, amount=75.00, status='pending')
            ENG->>REF: Send FCM Push: "🎉 ₹75 New Customer Acquisition Bonus Accrued!"
        end
        ENG->>DB: COMMIT TRANSACTION
    else Already Rewarded / Duplicate Event
        ENG->>DB: ROLLBACK / COMMIT without mutation
        ENG-->>ORD: Returns { status: false, message: "Referral reward already processed previously." }
    end
```

---

## 3. Test Cases

### 3.1 Customer Referral Flows

#### REF-CUST-001: Existing User Gets ₹100 Wallet Reward (New User Gets ₹0)
- **Module:** `Referrals / Customer`
- **Scenario:** Existing Customer A refers New Customer B; upon B's first delivered order, Customer A (referrer) receives ₹100 in wallet, Customer B (new user) receives ₹0
- **Priority:** `Critical`
- **Preconditions:**
  - Customer A (`CUST_A` - Existing User) has wallet balance = `₹50.00`.
  - Customer B (`CUST_B` - New User) has wallet balance = `₹0.00`.
  - Customer B registers using A's referral code.
- **Dependencies:** None
- **Steps:**
  1. Customer B completes first order `#F2H-ORD-B1`.
  2. Delivery partner delivers `#F2H-ORD-B1`.
  3. `ReferralRewardEngineService.processReferralReward('CUST_B', 'F2H-ORD-B1')` is triggered.
- **Expected Result:**
  - Referral status transitions to `rewarded`.
  - Customer A's (existing user) wallet balance increases to `₹150.00` (`+₹100.00`).
  - Customer B's (new user) wallet balance remains `₹0.00` (`+₹0.00` — new user gets ₹0 referral reward).
  - Customer B's profile updates `first_order_completed = true`.
  - Customer A receives FCM Push Notification: *"🎉 Referral Reward Received! ₹100 credited to your wallet!"*.
- **Database / API Verification Points:**
  - Table `referrals`: `status = 'rewarded'`, `referrer_reward_amount = 100.00`, `referred_reward_amount = 0.00`, `rewarded_at` is set.
  - Table `customers` (Customer A - Referrer): `wallet_balance = 150.00`.
  - Table `customers` (Customer B - Referee): `wallet_balance = 0.00`, `first_order_completed = true`.
  - Table `customer_wallet_transactions`: row with `customer_id = 'CUST_A'`, `transaction_type = 'credit'`, `amount = 100.00`, `balance_after = 150.00`, `reference_type = 'referral_bonus'`.

#### REF-CUST-002: First Order Discount via Coupon Only (No Automatic Refund/Cashback)
- **Module:** `Orders / Promotions & Discounts`
- **Scenario:** New customer places first order without coupon; verify NO hardcoded ₹50 or automatic wallet refund is applied
- **Priority:** `High`
- **Preconditions:** New customer `CUST_NEW` registered.
- **Dependencies:** None
- **Steps:**
  1. `CUST_NEW` places first order of ₹450 without applying any coupon.
  2. Order is delivered and confirmed.
- **Expected Result:**
  - Order total charged is exactly ₹450 (no hardcoded ₹50 discount).
  - Wallet receives NO automatic first-order refund/cashback.
  - Discounts on first order apply only when an active promotional coupon (e.g. `WELCOME50`) is entered.
- **Database / API Verification Points:**
  - Table `orders`: `discount_amount = 0.00`, `total_amount = 450.00`.
  - Table `customer_wallet_transactions`: NO automatic cashback/refund transaction created.

#### REF-CUST-003: Double Reward Fraud & Idempotency Prevention
- **Module:** `Referrals / Idempotency`
- **Scenario:** Delivery partner marks order delivered multiple times or referee places 2nd order; verify referrer reward is credited ONLY once
- **Priority:** `Critical`
- **Preconditions:** Reward for `CUST_B` already processed in `REF-CUST-001`.
- **Dependencies:** `REF-CUST-001`
- **Steps:**
  1. Re-invoke `ReferralRewardEngineService.processReferralReward('CUST_B', 'F2H-ORD-B1')`.
  2. Customer B places a second order `#F2H-ORD-B2` and it is delivered.
- **Expected Result:**
  - Engine detects `referrals.status = 'rewarded'` and `first_order_completed = true`.
  - Rejection response returned: `{ status: false, message: "Referral reward already processed previously." }`.
  - Customer A's wallet balance remains `₹150.00` (NO second ₹100 credit).
- **Database / API Verification Points:**
  - `SELECT COUNT(*) FROM customer_wallet_transactions WHERE customer_id = 'CUST_A' AND reference_type = 'referral_bonus'` returns exactly `1`.

#### REF-CUST-004: Self-Referral Prevention
- **Module:** `Referrals / Security`
- **Scenario:** Customer attempts to refer their own phone number or email
- **Priority:** `High`
- **Preconditions:** Active customer `CUST_A` with phone `9123456780`.
- **Dependencies:** None
- **Steps:**
  1. New account registration with phone `9123456780` inputs referral code of `CUST_A`.
- **Expected Result:**
  - Registration rejects duplicate phone or ignores self-referral code with error: *"You cannot refer your own account"*.
- **Database / API Verification Points:**
  - No row created in `referrals` where `referrer_customer_id = referred_customer_id`.

---

### 3.2 Delivery Partner Acquisition Bonuses

#### REF-PART-001: Delivery Partner Referral ₹75 Bonus Accrual (New User Gets ₹0)
- **Module:** `Referrals / Partner Bonus`
- **Scenario:** Delivery partner `DP_01` refers customer `CUST_C`; on first delivery, ₹75 bonus is logged for partner and new user receives ₹0
- **Priority:** `Critical`
- **Preconditions:** Delivery partner `DP_01` exists in `delivery_partners`. `CUST_C` signs up with code `DP_01`.
- **Dependencies:** None
- **Steps:**
  1. `CUST_C` completes first order `#F2H-ORD-C1`.
  2. `ReferralRewardEngineService.processReferralReward('CUST_C', 'F2H-ORD-C1')` triggers.
- **Expected Result:**
  - Engine detects referrer is in `delivery_partners` table.
  - Inserts ₹75 pending acquisition bonus into `delivery_partner_referral_bonuses`.
  - Customer `CUST_C` (new user) wallet balance is unchanged (`+₹0.00`).
- **Database / API Verification Points:**
  - Table `delivery_partner_referral_bonuses`: row with `partner_id = 'DP_01'`, `amount = 75.00`, `status = 'pending'`, `order_id = 'F2H-ORD-C1'`.
  - Table `referrals`: `status = 'rewarded'`, `referrer_reward_amount = 75.00`, `referred_reward_amount = 0.00`.
  - Table `customers` (`CUST_C`): `wallet_balance` unchanged (`0.00`).
