# F2H Fresh — Existing System: Complete End-to-End Flow

> Audit date: 2026-08-19 · Branch `main` · Verified against source **and the live PostgreSQL database** (120 tables).
> Companion documents: [flaws.md](flaws.md) (defects + fixes) · [implementation.md](implementation.md) (roadmap).

---

## 1. What This System Is

F2H Fresh is a **farm-to-home fresh-produce delivery platform** built around **daily subscription deliveries**
(milk/vegetables style, morning + evening slots) plus one-time orders. It is a monorepo with **four deployable
surfaces** sharing **one NestJS API** and **one PostgreSQL database**.

| Surface | Tech | Audience | Deploy target |
|---|---|---|---|
| `apps/api` | NestJS 11 · Node · PostgreSQL (pg) · Redis · BullMQ · Socket.IO | All clients | PM2 `api-f2hfresh` → `:5001` |
| `apps/web` | Next.js 16 (App Router) · React 19 · Ant Design + PrimeReact + Bootstrap | **Admin/back-office** + landing | PM2 `frontend-f2hfresh` → `:5002` |
| `apps/mobile/customer` | Flutter 3.11 · BLoC · Dio · Isar | Customers (Android/iOS/Web) | `customer.f2hfresh.com` (static build) |
| `apps/mobile/delivery` | Flutter 3.11 · BLoC · Dio · Isar · Geolocator | Delivery partners | `partner.f2hfresh.com` (static build) |

**Scale in code:** 304 TS files / 54 controllers / 124 services / 54 modules in the API · 103 Next.js pages ·
168 Dart files (customer) · 130 Dart files (delivery) · 120 live DB tables.

---

## 2. System Architecture

```mermaid
graph TB
    subgraph Clients
        FC["Flutter Customer App<br/>customer.f2hfresh.com<br/>Android · iOS · Web"]
        FD["Flutter Delivery App<br/>partner.f2hfresh.com<br/>Android · iOS · Web"]
        WEB["Next.js Admin Panel<br/>f2hfresh.com<br/>103 pages"]
    end

    subgraph Edge
        NGX["Nginx<br/>TLS termination + routing"]
    end

    subgraph Runtime["PM2 on Contabo VPS"]
        API["NestJS API :5001<br/>/api/v1/*<br/>+ Socket.IO gateway<br/>+ @Cron schedulers"]
        NEXT["Next.js server :5002"]
    end

    subgraph Data
        PG[("PostgreSQL<br/>120 tables")]
        PGB["PgBouncer<br/>connection pooling"]
        RDS[("Redis<br/>sessions · cache<br/>JWT session registry<br/>BullMQ queues")]
    end

    subgraph External
        RZP["Razorpay<br/>payments + webhooks"]
        FCM["Firebase FCM<br/>push notifications"]
        F2S["Fast2SMS<br/>OTP"]
        SMTP["SMTP<br/>transactional mail"]
        S3["AWS S3 / local uploads"]
    end

    FC & FD --> NGX
    WEB --> NGX
    NGX --> NEXT
    NGX --> API
    NEXT -->|SSR/RSC via INTERNAL_API_URL| API
    API --> PGB --> PG
    API <--> RDS
    API --> RZP & FCM & F2S & SMTP & S3
    RZP -.webhook.-> API
    API -.WebSocket.-> WEB
    API -.WebSocket.-> FD
```

---

## 3. Repository Layout

```
f2hfresh.com/
├── apps/
│   ├── api/          NestJS backend  (src/panels/{admin,customer,delivery-partner})
│   ├── web/          Next.js admin panel + public landing
│   └── mobile/
│       ├── customer/ Flutter customer app
│       └── delivery/ Flutter delivery-partner app
├── infra/
│   ├── pgbouncer/    connection pooler config
│   └── postgres/     pg_hba.conf, postgresql.conf, init scripts
├── docs/
│   ├── plans/        ← this document
│   └── skills/       engineering conventions (architecture, security, testing …)
├── firebase/         FCM service-account config
├── ecosystem.config.js       PM2 production
├── ecosystem.dev.config.cjs  PM2 development
├── docker-compose.yml        local docker stack
├── Makefile / build-flutter.sh / dev-flutter.sh
└── optimize.md       prior "single source of truth" schema-unification plan
```

`package.json` declares npm workspaces: `apps/api`, `apps/web`, `apps/mobile/*`.

---

## 4. API Request Pipeline

Every request to the NestJS API passes through this chain, defined in
[main.ts](../../apps/api/src/main.ts) and [app.module.ts](../../apps/api/src/app.module.ts):

```mermaid
flowchart TD
    REQ["Incoming request<br/>/api/v1/..."] --> COMP["compression (gzip, >1KB, level 6)"]
    COMP --> RHM["RoleHeaderMiddleware<br/>X-Role C/D/A → CUSTOMER/DELIVERY_PARTNER/ADMIN<br/>X-Plt → x-app-platform<br/>X-Ver → x-app-version<br/>X-Csrf → x-csrf-token"]
    RHM --> BODY["json/urlencoded (50 MB limit)"]
    BODY --> HELM["helmet · CSP · HSTS · X-Frame-Options"]
    HELM --> SESS["express-session<br/>Redis-backed store (__x_sid, 10 min)"]
    SESS --> PASS["passport.initialize + session<br/>(OAuth state flow only)"]
    PASS --> CORS["CORS<br/>credentials: true"]
    CORS --> LOG["LoggerMiddleware<br/>method · url · status · duration"]
    LOG --> THR["CustomThrottlerGuard (APP_GUARD, global)<br/>short 200/min · medium 2000/15min · bruteForce 100/hr"]
    THR --> GRD{"@UseGuards(JwtAuthGuard)<br/>present on controller?"}
    GRD -->|yes| JWT["JwtStrategy.validate<br/>cookie access_token OR Bearer<br/>→ Redis session registry check<br/>→ user_devices revocation check"]
    GRD -->|no| CTL
    JWT --> VAL["Global ValidationPipe<br/>whitelist + transform"]
    VAL --> CTL["Controller → Service → DataService/DatabaseService → PostgreSQL"]
    CTL --> RES["JSON response"]
```

**Conventions**
- Global prefix `api` + URI versioning → all routes are `/api/v1/<path>`.
- Static uploads served at both `/uploads/` and `/api/v1/uploads/` with 1-year immutable cache.
- Compact wire headers keep mobile payloads small; `RoleHeaderMiddleware` expands them server-side.
- `JwtAuthGuard` is applied **per controller**, not globally (see [flaws.md](flaws.md#f-01)).

---

## 5. Authentication & Session Flow

Files: [auth.controller.ts](../../apps/api/src/auth/auth.controller.ts) ·
[auth.service.ts](../../apps/api/src/auth/auth.service.ts) ·
[jwt.strategy.ts](../../apps/api/src/auth/jwt.strategy.ts)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Flutter / Next.js)
    participant A as API /auth
    participant R as Redis
    participant DB as PostgreSQL

    C->>A: GET /csrf/token
    A-->>C: { csrfToken } + Set-Cookie csrf_token (httpOnly, strict)

    C->>A: POST /auth/login { identifier, password }<br/>Header X-Role: C | D | A
    A->>A: reject if x-role missing/invalid
    A->>DB: SELECT user by email/phone/username
    A->>A: bcrypt.compare(password, hash)
    A->>DB: check role_assignments allows requested X-Role
    A->>A: PasswordSecurityService · DeviceFingerprintService
    A->>DB: INSERT auth_logs / device_sessions / user_devices
    A->>R: PUT f2h_user_jwt_<userId> = { sessions: [ { accessJti, refreshJti, deviceId } ] }
    A-->>C: Set-Cookie access_token (httpOnly) + { access_token, refresh_token, user }

    Note over C,A: Subsequent authenticated requests
    C->>A: GET /api/v1/... (Cookie access_token or Bearer)
    A->>A: JwtStrategy — verify signature
    A->>R: fetch f2h_user_jwt_<userId>, match jti against sessions[]
    A->>DB: user_devices — is_active / revoked_at check
    A-->>C: 200 or 401 "Token has been revoked"

    C->>A: POST /auth/logout
    A->>R: remove matching session entry
    A->>A: NotificationGateway.checkAndDisconnectIfNoSessions()
```

**Key characteristics**
- Auth supports **password**, **OTP (SMS via Fast2SMS)**, **email**, and **Google OAuth** (`social.strategies.ts`).
- Multi-role users exist: one `users` row → many `role_assignments`. The **active role is a Redis preference**
  (`user_selected_role_<id>`, 30-day TTL), resolved in `GET /users/me`.
- Revocation is **Redis-registry driven**, not expiry driven — tokens are signed `expiresIn: '100y'` and the
  strategy sets `ignoreExpiration: true`. Logout deletes the Redis session entry.
- Supporting services: `TokenRevocationService`, `OtpRateLimitService`, `SecurityAlertsService`,
  `AuditLoggerService` (Winston daily-rotate, 90/180-day retention), `FieldEncryptionService`.

---

## 6. Customer Flow (Flutter Customer App)

### 6.1 App bootstrap

```mermaid
flowchart LR
    M["main.dart"] --> DI["get_it DI container"]
    DI --> FB["Firebase.initializeApp<br/>+ FCM token"]
    FB --> APP["app.dart → AuthBloc"]
    APP --> BS["GET /customer/bootstrap"]
    BS -->|200| HOME["Home screen<br/>CustomerSessionCubit hydrated"]
    BS -->|401| LOGIN["Login screen"]
```

Architecture is **clean/layered per feature**: `features/<name>/{data,domain,presentation}` with
datasources → repositories → usecases → BLoC → screens. Networking is a shared `DioClient` with
`AuthInterceptor` (Bearer injection + silent refresh), `PersistCookieJar`, and compact headers
(`X-Role: C`, `X-Plt`, `X-Ver`). Offline cache via **Isar**; secure token storage via `flutter_secure_storage`.

Features present: `address`, `catalog` (products/cart/checkout), `subscription`, `orders`, `wallet`,
`notifications`, `profile`, `onboarding`.

### 6.2 Browse → Cart → Checkout → Order

Files: [cartAndCheckout.controller.ts](../../apps/api/src/panels/customer/cartAndCheckout/controller/cartAndCheckout.controller.ts) ·
[cartAndCheckout.service.ts](../../apps/api/src/panels/customer/cartAndCheckout/ModuleServices/cartAndCheckout.service.ts)

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer App
    participant API as API /customer
    participant DB as PostgreSQL
    participant WS as Socket.IO
    participant FCM as Firebase

    U->>API: GET /customer/categories, /customer/products
    API->>DB: products ⋈ product_variants ⋈ product_images (LATERAL primary image)
    API-->>U: catalog + prices

    U->>API: POST /customer/cart-sync { items[], customer_id }
    API->>DB: UPSERT carts (user_id, cart_data JSON)
    API->>DB: SELECT price FROM product_variants WHERE variant_id = ANY($1)
    API-->>U: { billSummary }

    U->>API: GET /customer/cart-items
    API-->>U: hydrated cart with images + bill summary

    U->>API: POST /customer/checkout/payment { items[], address_id, payment_method, payment_type }
    Note over API: customer_id is overwritten from the JWT
    API->>DB: resolve customer_addresses (fallback to is_default)
    API->>DB: resolve customers ⋈ users (wallet_balance, branch_id, postpaid limits)
    API->>DB: per item — SELECT price FROM product_variants  (N+1)
    API->>API: group items by (delivery_date, delivery_slot)
    alt payment_method = wallet
        API->>API: assert wallet_balance >= total
        API->>DB: UPDATE customers SET wallet_balance = new
    end
    loop each (date, slot) group
        API->>DB: INSERT orders (status='placed')
        API->>DB: INSERT order_items[]
        API->>WS: emit order_created → room admin_live_orders
    end
    API->>DB: UPSERT carts with remaining items
    API->>DB: INSERT customer_wallet_transactions (prepaid only)
    API->>DB: INSERT customer_bills + customer_bill_items (prepaid only)
    API->>FCM: push "Order Placed Successfully"
    API->>DB: INSERT notifications + notification_recipients
    API-->>U: { success, status, id: "#F2H-<orderId>", address }
```

**Payment modes supported at checkout:** `wallet` (prepaid, deducts balance), `cod` (postpaid, `payment_status='pending'`),
`postpaid` (billed monthly via `customer_bills`).

> ⚠️ This entire sequence runs **without a database transaction** even though
> `DatabaseService.transaction()` exists and is used in 8 other services. See [flaws.md F-06](flaws.md#f-06).

### 6.3 Razorpay payment flow (wallet top-up / bill payment)

File: [payment.service.ts](../../apps/api/src/panels/customer/payment/payment.service.ts)

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer App
    participant API as API /customer/payment
    participant RZP as Razorpay
    participant DB as PostgreSQL

    U->>API: POST createOrder { amount, purpose }
    API->>DB: INSERT payment_transactions (status='created')
    API->>RZP: Orders.create
    API-->>U: { razorpay_order_id, key }
    U->>RZP: Checkout UI → pay
    RZP-->>U: { payment_id, signature }
    U->>API: POST verifyPayment
    API->>API: HMAC signature verification
    API->>DB: markPaid → fulfil(transactionId)
    alt purpose = wallet_topup
        API->>DB: credit customers.wallet_balance + customer_wallet_transactions
    else purpose = bill_payment
        API->>DB: settle customer_bills
    end

    RZP-->>API: POST webhook (payment.captured / authorized)
    API->>API: verifyWebhookSignature
    API->>DB: INSERT payment_webhook_events ON CONFLICT (provider, event_id) DO NOTHING
    Note over API,DB: unique index makes retries idempotent
    API->>DB: fulfil if not already fulfilled

    Note over API: @Cron('0 */10 * * * *') reconcileStrandedOrderPayments()<br/>sweeps transactions stuck between gateway and DB
```

This module is the **most mature** part of the codebase — signature verification, webhook idempotency,
DB transactions, and a reconciliation cron are all present.

### 6.4 Subscription lifecycle (customer side)

```mermaid
stateDiagram-v2
    [*] --> Draft: customer configures product + frequency + slots
    Draft --> Active: POST /customer/subscriptions (wallet/postpaid validated)
    Active --> Paused: subscription_pauses (date range)
    Paused --> Active: pause window ends
    Active --> Overridden: subscription_overrides (skip / qty change for a date)
    Overridden --> Active
    Active --> Expired: end_date reached
    Active --> Cancelled: customer cancels
    Expired --> Active: renewal (subscription_renewal_attempts)
    Cancelled --> [*]
    Expired --> RefundEligible: subscription_refund_candidates
    RefundEligible --> [*]: subscription_refund_payouts → wallet credit
```

Backing tables: `subscriptions`, `subscription_items`, `subscription_weekly_schedule`,
`subscription_custom_schedule`, `subscription_delivery_slots`, `subscription_pauses`,
`subscription_overrides`, `subscription_logs`, `subscription_calendar_cache`,
`subscription_status`, `subscription_global_config`, `catalog_subscription_config`,
`product_subscription_rules` / `_frequencies` / `_slot_rules`.

---

## 7. The Subscription Order-Generation Engine (core of the business)

This is the scheduled job that turns standing subscriptions into concrete daily `orders`.

File: [subscription-snapshot.cron.ts](../../apps/api/src/panels/admin/customers-orders/subscriptions/cron-job/subscription-snapshot.cron.ts)

```mermaid
flowchart TD
    subgraph Schedule["@Cron — timeZone Asia/Kolkata"]
        M["23:55 daily<br/>handleMorningOrderProcessing<br/>target = tomorrow, slot = morning"]
        E["11:55 daily<br/>handleEveningOrderProcessing<br/>target = today, slot = evening"]
    end

    M & E --> GEN["SubscriptionSnapshotService<br/>generateOrdersForDateAndSlot(date, slot, 'cron')"]

    GEN --> S1["Select active subscriptions for date+slot<br/>across ALL branches"]
    S1 --> S2["Apply weekly / custom schedule rules"]
    S2 --> S3["Subtract subscription_pauses"]
    S3 --> S4["Apply subscription_overrides (skip / qty)"]
    S4 --> S5["INSERT orders (order_source='subscription')<br/>+ order_items"]
    S5 --> S6["Confirm eligible one-time orders<br/>placed → confirmed"]
    S6 --> S7["Write subscription_logs + branch stats"]
    S7 --> NOTIF["Notify all ADMIN users<br/>counts + duration"]

    S5 --> ROUTE["delivery-route.cron<br/>00:00 morning · 12:00 evening"]
    ROUTE --> R1["Build delivery_runs per branch/slot"]
    R1 --> R2["Assign delivery_run_addresses<br/>route sequencing"]
    R2 --> R3["Build dispatch_plans / dispatch_requirements<br/>(what each partner must load)"]
```

Other schedulers:

| Cron | Schedule | Purpose |
|---|---|---|
| `subscription-snapshot.cron` | `23:55`, `11:55` IST | Generate next slot's subscription orders |
| `delivery-route.cron` | `00:00`, `12:00` IST | Build delivery runs + routes for the slot |
| `subscription-status.cron` | `01:00` daily | Expire / renew / flag refund candidates |
| `customer-billing.service` | `00:05` on the 1st | Generate monthly postpaid bills |
| `customer-billing.service` | `09:00` daily | Postpaid payment reminders |
| `payment-reconciliation.cron` | every 10 min | Sweep stranded Razorpay payments |

BullMQ queues: `default-queue`, `calendar-aggregation-queue`, `calendar-refresh-queue`
(subscription-calendar materialisation).

---

## 8. Delivery Partner Flow (Flutter Delivery App)

Files: [delivery.order.controller.ts](../../apps/api/src/panels/delivery-partner/orders/controllers/delivery.order.controller.ts) ·
[delivery.order.service.ts](../../apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts) ·
[basket.controller.ts](../../apps/api/src/panels/delivery-partner/orders/controllers/basket.controller.ts) ·
[location.controller.ts](../../apps/api/src/panels/delivery-partner/location/location.controller.ts)

```mermaid
sequenceDiagram
    autonumber
    participant P as Delivery App
    participant API as API /delivery
    participant DB as PostgreSQL
    participant WS as Socket.IO (admin_tracking)
    participant FCM as Firebase

    P->>API: POST /delivery-partner/auth/shift-toggle
    API->>DB: mark partner on-shift (attendance)

    P->>API: GET /delivery/orders/pickup-items
    API->>DB: dispatch_requirements for today's run
    API-->>P: products + quantities to load at hub
    P->>API: POST /delivery/orders/pickup-items/confirm
    API->>DB: delivery_dispatch + dispatch_balances (dispatched_qty)

    P->>API: GET /delivery/orders/run/today
    API->>DB: delivery_runs ⋈ delivery_run_addresses ⋈ orders
    API-->>P: ordered stop list

    P->>API: POST /delivery/orders/run/:runId/start
    API->>DB: delivery_runs.status = in_progress

    loop each stop
        P->>API: POST /delivery-partner/location/update { lat, lng, battery, speed }
        API->>DB: delivery_partner_locations + delivery_location_logs
        API->>WS: emit partner_location_update
        P->>API: POST /delivery/orders/:orderId/upload-proof (photo)
        API->>DB: delivery_proof_logs + orders.delivery_image
        P->>API: PATCH /delivery/orders/run/:runId/address/:addressId/deliver
        API->>DB: TRANSACTION — orders.status='delivered', order_status_logs,<br/>dispatch_balances.delivered_qty, container/basket movements
        API->>FCM: notify customer "Delivered"
    end

    P->>API: POST /delivery/orders/run/:runId/handover
    API->>DB: reconcile returned / damaged qty, close run
    P->>API: POST /delivery-partner/basket/containers/submit-hub
    API->>DB: container_transactions, customer_container_balances
```

Additional partner capabilities: SOS (`/location/sos`, `/clear-sos`), leave requests, attendance history,
leaderboard, documents/vehicles/bank-account KYC, referral bonuses and redeem requests.

---

## 9. Admin Panel Flow (Next.js Web)

`apps/web` is an **App Router** application. Route groups organise 103 pages:

```mermaid
graph LR
    ROOT["app/"] --> AUTH["(auth)<br/>login · register<br/>forgot/reset-password"]
    ROOT --> LAND["(landing)<br/>privacy · terms · refund<br/>delivery-policy · download/*"]
    ROOT --> PANEL["(panel)/admin"]

    PANEL --> BM["(BRANCH_MANAGEMENT)<br/>branches · zones · staffs<br/>radius · partners · analytics"]
    PANEL --> CI["(CATALOG_INVENTORY)<br/>catalog · inventory · production<br/>warehouse · stock-movements · transfers"]
    PANEL --> CO["(CUSTOMERS_ORDERS)<br/>customers · orders · subscriptions<br/>calendar · overrides · wallets"]
    PANEL --> DM["(DELIVERY_MANAGEMENT)<br/>assign · tracking · logs · missed<br/>leave-requests · packages"]
    PANEL --> OPS["(OPERATIONS)<br/>dashboard · live-orders<br/>dispatch · delivery-tracking"]
    PANEL --> FG["(FINANCE_GROWTH)<br/>finance · reports · analytics<br/>outstanding · refunds · wallet"]
    PANEL --> LV["(LOGISTICS_VENDORS)<br/>vendors · purchase-orders<br/>supply-chain · vendor-payments"]
    PANEL --> PS["(PROFILE_SYSTEM)<br/>profile · admins · company<br/>roles · audit · site-settings"]
    PANEL --> DEV["developer<br/>api-integrations: sms · email<br/>firebase · maps · payment-gateway"]
```

**Client-side data flow**

```mermaid
flowchart LR
    PAGE["page.tsx (client component)"] --> AC["ApiClient (services/api.client.ts)"]
    AC --> INT1["Request interceptor<br/>attach x-csrf-token on POST/PUT/PATCH/DELETE"]
    INT1 --> FETCH["fetch(credentials: 'include')"]
    FETCH --> INT2["Response interceptor<br/>401 → redirect /login<br/>429 → exponential backoff retry (3×)"]
    INT2 --> PAGE

    PROXY["proxy.ts (Next.js middleware)"] -.->|"panel routes pass through<br/>auth handled client-side"| PAGE
    AUTHCTX["AuthContext<br/>GET /users/me → roles + active_role"] --> PAGE
    SOCK["useOrderSocket hook<br/>socket.io-client"] -->|"join_admin_live_orders<br/>join_admin_tracking"| PAGE
```

- Auth on the web is **client-side**: `proxy.ts` lets `/admin/*`, `/delivery/*`, `/customer/*` through and
  `AuthProvider` calls `/users/me`; role→home mapping lives in `AuthContext.tsx`.
- Base URL resolution: `NEXT_PUBLIC_API_URL` in the browser, `INTERNAL_API_URL` during SSR/RSC.
- Realtime: `useOrderSocket` joins `admin_live_orders`; the tracking page joins `admin_tracking`.

---

## 10. Data Layer

### 10.1 Two parallel database services

```mermaid
graph TD
    subgraph "src/database/"
        D1["DatabaseService<br/>pg Pool max=10<br/>? → $n rewriting<br/>backtick → double-quote rewriting"]
    end
    subgraph "src/shared/database/"
        D2["DatabaseService<br/>pg Pool via PgBouncer, max=DB_POOL_SIZE (20)<br/>.transaction(client => …)<br/>createRequiredTables() DDL at boot"]
        D3["DataService (2,532 lines)<br/>query · insert · update · upsert<br/>delete · softDelete · edit<br/>dynamic WHERE builder"]
    end

    AUTHC["auth.controller<br/>users.controller<br/>notification.gateway"] --> D1
    MOST["most panel services"] --> D2
    MOST --> D3
    D1 --> PG[("PostgreSQL")]
    D2 --> PGB["PgBouncer"] --> PG
```

Both pools connect to the same database with the same credentials — **two independent connection pools
in one process**, only one of which goes through PgBouncer.

`DataService` is a hand-rolled query builder used across most panels; the raw
`DatabaseService.query(sql, params)` is used for joins and reports. Placeholders are parameterised
(`$1`/`?`), and `validateWriteOperation` / `buildDynamicWhereClause` guard the dynamic paths.

### 10.2 Live database inventory (120 tables)

| Domain | Tables |
|---|---|
| **Identity & access** | `users`, `roles`, `role_assignments`, `admin_roles`, `management_staff`, `device_sessions`, `user_devices`, `device_information`, `password_history`, `auth_logs`, `auth_otp_challenges`, `otp_rate_limit_logs`, `admin_audit_logs` |
| **Customers** | `customers`, `customer_addresses`, `customer_activity_logs`, `customer_feedback`, `customer_special_prices`, `customer_waitlist`, `customer_wallet_balances`, `customer_wallet_transactions`, `carts` |
| **Catalog** | `categories`, `products`, `product_variants`, `product_images`, `product_banner`, `product_batches`, `packaging_types`, `catalog_subscription_config`, `product_subscription_rules` / `_frequencies` / `_slot_rules` |
| **Inventory & warehouse** | `warehouses`, `stock_balances`, `stock_movements`, `stock_transfers`, `purchase_entries`, `vendors`, `vendor_intakes`, `production_plans`, `consumption_forecasts`, `order_batches`, `order_batch_items` |
| **Orders** | `orders`, `order_items`, `order_status_logs`, `order_containers` |
| **Subscriptions** | `subscriptions`, `subscription_items`, `subscription_weekly_schedule`, `subscription_custom_schedule`, `subscription_delivery_slots`, `subscription_pauses`, `subscription_overrides`, `subscription_logs`, `subscription_calendar_cache`, `subscription_global_config`, `subscription_refunds`, `subscription_refund_candidates`, `subscription_refund_payouts`, `subscription_renewal_attempts`, `delivery_calendar` |
| **Delivery ops** | `delivery_partners`, `delivery_runs`, `delivery_run_addresses`, `delivery_routes`, `delivery_route_customers`, `route_daily_overrides`, `delivery_dispatch`, `delivery_dispatch_items`, `dispatch_plans`, `dispatch_plan_items`, `dispatch_requirements`, `dispatch_balances`, `delivery_logs`, `delivery_proof_logs`, `delivery_location_logs`, `delivery_partner_locations`, `delivery_leave_requests`, `delivery_partner_documents` / `_bank_accounts` / `_redeem_requests` / `_referral_bonuses`, `breakdown_incidents` |
| **Containers/baskets** | `containers`, `container_transactions`, `customer_container_balances`, `delivery_baskets`, `basket_items`, `basket_movements`, `delivery_container_reconciliation` |
| **Geo** | `branches`, `branch_sectors`, `zones`, `zone_hexagons` (H3 indexing) |
| **Finance** | `payments`, `payment_transactions`, `payment_webhook_events`, `refunds`, `customer_bills`, `customer_bill_items` |
| **Growth** | `coupons`, `coupon_redemptions`, `promotions`, `promotion_products`, `promotion_redemptions`, `referrals` |
| **Platform** | `notifications`, `notification_recipients`, `notification_settings`, `support_tickets`, `contact_enquiries`, `site_settings`, `company_profile`, `app_configs`, `api_integrations_config`, `cache`, `cache_locks` |

**Measured schema characteristics** (live DB):
- 120 tables · 359 indexes · **28 foreign-key constraints** · every table has a primary key.
- Only 20 tables carry any FK. Core tables — `orders`, `subscriptions`, `customers`, `payments`,
  `delivery_runs` — have **none**.
- Timestamp types are mixed: 249 `timestamptz` columns vs 117 `timestamp without time zone`.
- Wallet balance is stored in **two places**: `customers.wallet_balance` and `customer_wallet_balances.wallet_balance`.

---

## 11. Cross-Cutting Services

```mermaid
graph TD
    subgraph Notifications
        NS["NotificationService"] --> NG["NotificationGateway (Socket.IO)"]
        NS --> DBN["notifications + notification_recipients"]
        PN["PushNotificationService"] --> FCM["Firebase Admin SDK"]
        MS["MailService"] --> SMTP["nodemailer / SMTP"]
        SMS["Fast2SMS"] --> OTP["OTP delivery"]
    end
    subgraph Security
        FE["FieldEncryptionService<br/>column-level encrypt/decrypt"]
        ENC["EncryptionService"]
        AUD["AuditLoggerService<br/>winston daily-rotate 90/180 d"]
        DEV["DeveloperService<br/>structured app logging"]
    end
    subgraph Infra
        RED["RedisService<br/>fetch/put/forget + CACHE_KEYS/TTL"]
        Q["BullMQ queues"]
        TH["CustomThrottlerGuard"]
        PDF["PDFKit — invoices, receipts"]
        QR["qrcode — delivery proofs"]
        S3["@aws-sdk/client-s3 + multer uploads"]
    end
```

**Socket.IO rooms**

| Room | Joined by | Events |
|---|---|---|
| `user:<userId>` | auto on connect | `notification` |
| `admin_tracking` | client emits `join_admin_tracking` | `partner_location_update` |
| `admin_live_orders` | client emits `join_admin_live_orders` | `order_created`, `order_status_changed` |

---

## 12. Build, Run & Deploy

```mermaid
flowchart LR
    subgraph Dev
        MK["make api / make web"] --> PM2D["pm2 ecosystem.dev.config.cjs"]
        MKF["make customer-bg / partner-bg"] --> FLD["dev-flutter.sh<br/>tmux + flutter run web-server<br/>:8081 / :8082"]
        DC["docker-compose.yml<br/>api + web + redis"]
    end
    subgraph Prod
        BUILD["npm run build:api (nest build)<br/>npm run build:web (next build)"] --> PM2P["pm2 ecosystem.config.js<br/>api-f2hfresh :5001<br/>frontend-f2hfresh :5002"]
        FBUILD["build-flutter.sh / npm run deploy:all"] --> COPY["flutter build web --release<br/>→ /home/f2hfresh-customer|partner/htdocs/"]
        PM2P --> NGX["Nginx + TLS"]
        COPY --> NGX
    end
    CI[".github/workflows + Jenkinsfile"] -.-> BUILD
```

| Command | Effect |
|---|---|
| `make api` / `make web` | Dev servers on `:5001` / `:5002` |
| `make customer` / `make partner` | Release Flutter web build + publish |
| `make dev-all` | Both Flutter apps in tmux with hot reload |
| `npm run deploy:all` | Build + copy both Flutter web apps to their htdocs |
| `npm run db:migrate` | `src/scripts/run-migration.ts` |
| `npm run seed:kuppam` / `seed:delivery` | Demo data seeders |

---

## 13. End-to-End Business Flow (one day in the life)

```mermaid
sequenceDiagram
    autonumber
    participant CU as Customer
    participant SYS as API + Cron
    participant AD as Admin (Next.js)
    participant DP as Delivery Partner

    Note over CU: Day 0 — evening
    CU->>SYS: Create subscription (product, frequency, morning slot)
    SYS->>SYS: Validate wallet / postpaid limit → subscriptions + subscription_items

    Note over SYS: 23:55 IST
    SYS->>SYS: subscription-snapshot cron → generate tomorrow's morning orders
    SYS->>AD: notify admins (counts, branches, duration)

    Note over SYS: 00:00 IST
    SYS->>SYS: delivery-route cron → delivery_runs + run_addresses + dispatch_requirements

    Note over AD: Day 1 — early morning
    AD->>SYS: Review /admin/operations/live-orders, assign partners
    SYS-->>AD: WebSocket order_created / order_status_changed

    DP->>SYS: Shift on → view pickup items → confirm loaded (dispatch_balances)
    DP->>SYS: Start run → GPS pings every N seconds
    SYS-->>AD: partner_location_update on admin_tracking
    loop each stop
        DP->>SYS: Upload proof → mark delivered (TRANSACTION)
        SYS->>CU: FCM push "Delivered"
    end
    DP->>SYS: Handover — returned / damaged reconciliation, container returns

    Note over SYS: 11:55 IST
    SYS->>SYS: Evening slot generation → repeat

    Note over SYS: Month end
    SYS->>SYS: 1st @ 00:05 — postpaid bill generation (customer_bills)
    SYS->>CU: 09:00 daily reminders until paid
    CU->>SYS: Pay via Razorpay → webhook → settle bill
```

---

## 14. Summary of What Works Well

- **Clear panel segmentation** in the API (`admin` / `customer` / `delivery-partner`) mirrored by the Next.js route groups.
- **Flutter apps follow clean architecture** consistently — data/domain/presentation per feature, BLoC + get_it DI.
- **The payment module is production-grade**: HMAC verification, webhook idempotency via a unique
  `(provider, event_id)` index, DB transactions, and a 10-minute reconciliation sweep.
- **Deep operational domain modelling** — dispatch balances, container/basket reconciliation, H3 geo-zoning,
  route overrides, leave management, and refund candidacy are all modelled, not hand-waved.
- **Infrastructure discipline**: PgBouncer pooling, Redis-backed sessions (no MemoryStore leak), gzip,
  helmet + CSP + HSTS, throttling tiers, Winston audit logs with retention, PM2 process management.
- **Compact mobile wire protocol** (`X-Role`/`X-Plt`/`X-Ver`/`X-Csrf`) shows real attention to mobile payload cost.

Defects and their fixes are catalogued in **[flaws.md](flaws.md)**; the prioritised build plan is in
**[implementation.md](implementation.md)**.
