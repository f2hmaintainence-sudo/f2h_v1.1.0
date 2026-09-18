# Customer Application (Mobile & Web) — Comprehensive Test Plan (18-09-2026)

## Scope
Verification of the complete customer experience across Mobile and Web applications:
1. Customer Authentication (Mobile OTP & Google OAuth)
2. Profile & Address Management
3. Catalog Browsing, Search, and Category Filtering
4. Cart Operations & Quantity Management
5. One-Time Orders Placement & Checkout
6. Subscriptions Creation, Management & Schedule Customization
7. **Subscription Details Screen UI Validation** (Recent updates: active badge removal from card, order emoji removal)
8. Delivery Orders Bottom Sheet & History
9. Customer Wallet, Payments & Razorpay Integration
10. Referral Program & Reward Tracking

---

## Test Cases

### 1. Authentication & Onboarding
- **TC-CUST-001: Mobile OTP Request**
  - **Endpoint**: `POST /api/v1/auth/mobile/otp/request`
  - **Payload**: `{ "phone": "919876543210" }`
  - **Assert**: HTTP 200 OK, OTP dispatched (or test fallback `123456`), rate-limit headers present.
- **TC-CUST-002: Mobile OTP Verification & Customer Auto-Provisioning**
  - **Endpoint**: `POST /api/v1/auth/mobile/otp/verify`
  - **Payload**: `{ "phone": "919876543210", "otp": "123456" }`
  - **Verification**:
    1. HTTP 200 OK with `verification_token`.
    2. Phone stored on `users.phone`.
    3. `customers` table record created immediately with `customer_id = users.user_id`.
- **TC-CUST-003: Customer Profile Completion**
  - **Endpoint**: `POST /api/v1/auth/register`
  - **Payload**: `{ "first_name": "Ramesh", "last_name": "Kumar", "phone": "919876543210", "verification_token": "..." }`
  - **Assert**: Phone persisted in `users`, full customer profile initialized.

### 2. Customer Bootstrap & Addresses
- **TC-CUST-004: Customer App Bootstrap**
  - **Endpoint**: `GET /api/v1/customer/bootstrap` (with bearer token)
  - **Assert**: Returns active customer profile, saved delivery addresses, wallet balance, active subscriptions count, and assigned branch.
- **TC-CUST-005: Delivery Address Geocoding & Branch Assignment**
  - **Endpoint**: `POST /api/v1/customer/bootstrap/address`
  - **Payload**: Coordinates (`lat`, `lng`), `flatNo`, `street`, `pincode`
  - **Assert**: Automatically maps address to the closest active branch within delivery radius.

### 3. Catalog & Orders
- **TC-CUST-006: Catalog Categories & Products**
  - **Endpoint**: `GET /api/v1/customer/catalog/products`
  - **Assert**: Returns active product list, prices, variants, stock availability.
- **TC-CUST-007: One-Time Order Checkout**
  - **Endpoint**: `POST /api/v1/customer/orders`
  - **Payload**: Items list, delivery slot (`morning`/`evening`), delivery address, payment method
  - **Assert**: Order created with status `placed`, total calculation correct, inventory reserved.

### 4. Subscriptions & Subscription Details UI
- **TC-CUST-008: Subscription Plan Creation**
  - **Endpoint**: `POST /api/v1/customer/subscriptions`
  - **Payload**: Product variant, daily quantities matrix, delivery slot, start date
  - **Assert**: Subscription created in `active` state with unique subscription ID.
- **TC-CUST-009: Subscription Details Screen Data & Rendering**
  - **Screen**: `SubscriptionDetailScreen`
  - **Verification Points**:
    1. Header displays single `• Active` status pill in top app bar.
    2. Product card does **NOT** render duplicate active badge.
    3. Frequency and volume labels render cleanly.
- **TC-CUST-010: Delivery Orders Bottom Sheet**
  - **Screen**: `_OrdersHistorySheet` in `SubscriptionDetailScreen`
  - **Verification Points**:
    1. Clicking delivery orders action opens modal.
    2. Order items do **NOT** render emoji/icon square boxes on left.
    3. Left side cleanly aligns product name and scheduled date.
    4. Right side displays order amount and status pill (CONFIRMED/DELIVERED).

### 5. Wallet & Payments
- **TC-CUST-011: Wallet Balance & Ledger**
  - **Endpoint**: `GET /api/v1/customer/wallet`
  - **Assert**: Accurate `wallet_balance`, transaction history with credit/debit entries.
- **TC-CUST-012: Razorpay Order Creation**
  - **Endpoint**: `POST /api/v1/payments/razorpay/create-order`
  - **Payload**: Amount in INR
  - **Assert**: Returns Razorpay order ID for mobile SDK checkout.

### 6. Referral Program & Link-Based Attribution (No Manual Code Entry)
- **TC-CUST-013: Signup Screen Contract — Zero Manual Referral Code Entry**
  - **Screen**: `apps/mobile/customer/lib/auth/presentation/screens/signup_screen.dart`
  - **Verification Points**:
    1. Confirm `_showReferralField`, `Have a referral code?` toggle, and `_referralCodeController` are completely removed.
    2. Users cannot type or paste a referral code manually during registration.
- **TC-CUST-014: Deep Link / Storage Auto-Attribution & Verification Badge**
  - **Screen / Logic**: `_checkPendingReferralCode()` & `_validateDetectedReferral()` in `SignupScreen`
  - **Verification Points**:
    1. Referral code detected automatically from URL query (`?ref=`, `?code=`), path (`/r/<code>`), or `SharedPreferences`.
    2. Automatically validated against `/api/v1/customer/referrals/validate/:code`.
    3. If valid, renders non-editable green invitation pill badge (`Referral Invite Applied`).
- **TC-CUST-015: Referral Code Validation API**
  - **Endpoint**: `POST /api/v1/customer/referrals/validate`
  - **Assert**:
    1. Valid code: returns `{ status: true, valid: true, referrer_name: ... }`.
    2. Invalid code: returns `{ status: true, valid: false }`.
    3. Self-referral: returns `{ status: true, valid: false, message: 'Self-referral is not allowed' }`.
- **TC-CUST-016: Automatic Pending Referral Creation on Registration**
  - **Endpoint**: `POST /api/v1/auth/register` (payload passes auto-detected `referral_code`)
  - **Assert**:
    1. `users.referred_by` set to referrer ID.
    2. `customers` table record created with `wallet_balance = 0.00`, `first_order_completed = false`.
    3. `referrals` table record created with `status = 'pending'`, `referrer_reward_amount = 100.00`, `referred_reward_amount = 0.00`, `remarks = 'link-based attribution'`.
- **TC-CUST-017: First Order Delivery Reward Processing**
  - **Engine**: `ReferralRewardEngineService.processReferralReward(refereeId, orderId)`
  - **Assert**:
    1. Referrer wallet credited ₹100.00 (`customers.wallet_balance` += 100).
    2. `customer_wallet_transactions` ledger entry created (`reference_type = 'referral_bonus'`).
    3. Referee wallet balance remains unchanged (₹0.00) and `first_order_completed = true`.
    4. `referrals` record updated to `status = 'rewarded'` with `rewarded_at = NOW()`.
- **TC-CUST-018: Referral Reward Idempotency**
  - **Assert**: Second delivery event on same referee skips reward processing without double-crediting (0 pending records remain).

