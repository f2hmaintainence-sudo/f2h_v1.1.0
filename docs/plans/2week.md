# 📋 F2H Fresh — Complete 2-Week Audit & Implementation Plan (`dev.f2hfresh.com` → `f2hfresh.com`)

## 1. Executive Summary & Migration Context

This document is the **single source of truth** auditing all features, UI functionalities, backend services, database schema changes, mobile app updates, and production deployment configurations executed across AI sessions over the last 2 weeks (Aug 5 – Aug 19, 2026).

Originally built and tested under `dev.f2hfresh.com`, all components listed below are fully mapped and configured for the primary production domain **`f2hfresh.com`**.

---

## 2. Admin Web UI Pages & Functionalities (`apps/web`)

### A. Customer Special Prices & Tariff Management (`/admin/special-prices`)
- [x] **Searchable Customer Dropdown (`CustomerSearchSelect`):** Live customer search with role filtering (`CUSTOMER`).
- [x] **Searchable Product & Variant Dropdown (`ProductVariantSelect`):** Live catalog search displaying MRP and default pricing.
- [x] **Multi-Row Repeater Modal (`CustomerSpecialPriceModal`):** Dynamic form modal allowing admins to add/remove multiple product price rules per customer in a single transaction.
- [x] **Interactive Bidirectional Discount Controls:** Dual inputs for Discount % and Special Unit Price with live auto-calculation.
- [x] **Discount Clamp Enforcement:** Enforces strict 0% to 100% discount bounds, preventing negative or >100% tariff inputs.
- [x] **Overall MRP Savings Summary:** Header calculation displaying Total MRP, Total Special Price, and Total Savings amount.
- [x] **Master Accordion Table:** Single master pricing table with expandable row accordions grouped by customer, displaying special prices, discount rates, active toggle switches, and inline editing.
- [x] **Light Theme Styling:** Refactored Special Prices UI from dark mode to a clean light theme with green brand highlights.

### B. Warehouse Management & Branch Linking (`/admin/warehouse/list`)
- [x] **Branch Selector Dropdown:** Integrated branch selection into the Warehouse Add/Edit Modal.
- [x] **Branch Card Display:** Displays assigned Branch Name in warehouse cards and data table rows.
- [x] **Orphan Prevention:** Ensures every warehouse is explicitly linked to a valid `branch_id`.

### C. Customers & Postpaid Billing Panel (`/admin/customers`, `/admin/customers/customer-billing`)
- [x] **Postpaid Credit Limit Modal:** Moved Postpaid Limit action button next to Credit Limit settings.
- [x] **First-Order Completed Badge:** Added visual indicator showing whether a customer has completed their first order.
- [x] **Portfolio Error Handling & UI Polish:** Added defensive guards against missing customer portfolio data to eliminate 500 runtime errors.

### D. Orders & Subscriptions Master Ledger (`/admin/customers-orders/orders`, `/admin/customers-orders/subscriptions`)
- [x] **Future-Start Subscriptions Fix:** Fixed SQL query logic so active subscriptions starting on future calendar dates render cleanly in the master subscription table.
- [x] **Order Delivery Details Modal:** Expanded order detail modal with item breakdown, phone formatting (`+91 XXX-XXX-XXXX`), and live WebSocket status updates.
- [x] **Filter-Aware Excel / CSV Export:** Added export dropdowns with CSV/Excel download actions respecting active table filters (date range, status, branch, customer).

### E. Delivery Partner Tracking & Logistics (`/admin/delivery/delivery-boys`, `/admin/delivery/tracking`, `/admin/delivery/runs`)
- [x] **Google Maps Live Tracking:** Replaced H3/Leaflet with Google Maps JS API for real-time delivery partner location markers.
- [x] **Uber-Style Road Routing:** Google Maps Directions polyline rendering road routes between hubs, delivery partners, and customer addresses.
- [x] **Live Delivery Run Assignment:** Assign orders to existing `delivery_runs` or create new runs dynamically.
- [x] **Leave Request Notification System:** Admin header badge notification when a delivery boy submits a leave request, with approve/reject action modals triggering instant push notifications to the partner.

### F. Catalog, Inventory & Variant Management (`/admin/catalog-inventory/catalog`, `/admin/catalog-inventory/containers`, `/admin/catalog-inventory/inventory`)
- [x] **Automated Variant Discount %:** Read-only auto-calculating Discount % field in product variant forms based on MRP and Selling Price.
- [x] **Containers Master Tab:** Restored Containers Master tab within catalog management.
- [x] **Image Retry Defense:** Bounded failed product image retries to max 3 attempts to eliminate console log spam.

### G. Admin System Dashboard & Operations Console (`/admin/dashboard`, `/admin/profile`)
- [x] **Instant Hot Reload Button & Action Bar:** Added 4 live operation buttons: **Run**, **Clean**, **Reload**, and **Rebuild**.
- [x] **Live Terminal Log Console:** Embedded live streaming log output console for monitoring PM2 processes and server builds.
- [x] **Domain Status Monitor:** Real-time status monitors for `f2hfresh.com` endpoints and services.

---

## 3. Database Schema Alignments & SQL Rules (`apps/api`)

### A. Single Source of Truth Alignment (`users` & Satellite Tables)
- [x] **`users` Table Authority:** Primary authority for identity fields (`first_name`, `last_name`, `email`, `phone`, `user_name`, `password_hash`, `account_status`).
- [x] **`customers` Satellite Table:** Domain extension fields (`wallet_balance`, `is_active`, `credit_limit`, `postpaid_limit`, `first_order_completed`). Added `first_order_completed` boolean flag (default `false`).
- [x] **`delivery_partners` Satellite Table:** Domain extension fields (`vehicle_type`, `is_active`, `current_lat`, `current_lng`, `assigned_hub_id`, `assigned_branch_id`).
- [x] **SQL JOIN Standard:** Replaced raw column queries on satellite tables with explicit `JOIN users u ON u.user_id = profile.id`.
- [x] **Parameter Binding:** Standardized PostgreSQL `$1`, `$2` parameter placeholders across all NestJS database services.

### B. Warehouses & Branch Linking
- [x] **`warehouses` Foreign Key:** Added `branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE`.

### C. Customer Special Prices Schema (`customer_special_prices`)
- [x] **`customer_special_prices` Table:** Created schema (`id SERIAL PRIMARY KEY`, `customer_id INT REFERENCES customers(id)`, `product_id INT REFERENCES products(id)`, `variant_id INT REFERENCES product_variants(id)`, `special_price NUMERIC(10,2)`, `discount_percent NUMERIC(5,2)`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMP`, `updated_at TIMESTAMP`).

### D. Branches & Sectors Cleanup
- [x] **`branches` Table Cleanup:** Dropped redundant `sector_count` column and converted `buffer_zone` column to standard JSONB format.
- [x] **`branch_sectors` Table Removal:** Dropped obsolete `branch_sectors` table in favor of dynamic Google Maps polygon geofencing.

---

## 4. Backend NestJS REST API Routes & Services (`apps/api`)

### A. Route Endpoint Standards & Conventions
- [x] **Kebab-Case Naming:** All API controllers refactored to `kebab-case` paths (e.g. `@Controller({ path: 'delivery-partner/profile', version: '1' })`).
- [x] **Backward-Compatible Array Routing:** Updated legacy endpoints using array routes to support both `kebab-case` and legacy `PascalCase`/`camelCase` paths (e.g. `@Controller({ path: ['delivery-partner/auth', 'DeliveryPartner/auth'], version: '1' })`).

### B. Auth, CORS & Security Services
- [x] **CORS Multi-Origin Headers:** Added `x-app-platform`, `x-client-version`, and `x-branch-id` to CORS allowed headers.
- [x] **Password Redaction:** Redacted plaintext passwords from all NestJS logger interceptors and auth payloads.
- [x] **Role Guards & Enums:** Enforced strict `DELIVERY_PARTNER`, `CUSTOMER`, `ADMIN` role checks and `account_status` validation across all authentication strategies.

### C. Wallet & First-Order Cashback Logic
- [x] **`CustomerBillingService` / `OrdersService`:** When an order transitions to `DELIVERED`, if `customers.first_order_completed = false`, the system sets `first_order_completed = true` and auto-credits 50% of the order total into the customer's wallet balance.

### D. Delivery Partner Location & Run Dispatch Services
- [x] **`DeliveryLocationController` & `DeliveryOrderController`:** Uber-style route calculations, dynamic `run_id` lookup/creation, and Socket.IO real-time location streaming to admin tracking panel.

---

## 5. Mobile Applications (Flutter) (`apps/mobile`)

### A. Customer Mobile App (`in.f2h.customer`)
- [x] **Dynamic Subscription Day Slot UI:**
  - Checks quantity breakdown across days.
  - If quantities vary across days (e.g., Sunday Morning: 2, Mon-Sat Morning: 1, Sunday Evening: 1), renders full 7-day schedule matrix.
  - Displays "Daily" tag ONLY when Morning and Evening quantities are identical every day of the week.
- [x] **Navbar Auto-Hide & View Cart Animation:**
  - Auto-hides bottom navigation bar on downward scroll across Home, Menu, and Subscription screens.
  - Smoothly translates floating "View Cart" bar offset to bottom padding when navbar hides.
- [x] **Profile Screen Redesign:**
  - Clean view mode by default with circular avatar graphic.
  - Toggle pencil icon to edit profile fields.

### B. Delivery Partner Mobile App (`in.f2h.partner`)
- [x] **Navigation & Map UI Polish:**
  - Filled light-green navigation action buttons in orders list and map routing view.
  - Top 10% header spacing adjustments and redesigned online/offline status toggle.
- [x] **Real-time Notifications & Leave Requests:**
  - Firebase FCM integration for instant order assignment notifications.
  - Leave Request submission form with push notification sent to Admin; partner receives notification when Admin approves or rejects leave.

---

## 6. Deployment, Domain Migration & Play Store Publishing

### A. Monorepo Domain Migration (`dev.f2hfresh.com` → `f2hfresh.com`)
- [x] Updated hardcoded API URLs across Web, API, and Mobile apps to `https://f2hfresh.com/api/v1`.
- [x] Configured Nginx site config `/etc/nginx/sites-available/f2hfresh.com` with SSL certs.
- [x] Ecosystem PM2 configs (`ecosystem.config.js`, `ecosystem.dev.config.cjs`) updated.

### B. Play Store Release Bundles (`.aab`)
- [x] **Package Names:**
  - Customer App: `in.f2h.customer`
  - Delivery Partner App: `in.f2h.partner`
- [x] **Target API Level:** Updated to Target API Level 36 (Android 16 compatibility maintaining min SDK for Android 11/12).
- [x] **Release Build Command:**
  ```bash
  flutter build appbundle --release --dart-define=F2H_API_BASE_URL=https://f2hfresh.com/api/v1
  ```

---

## 7. Complete Verification Checklist

- [x] **Session & Git History Audit:** Verified 315 commits in git log and session transcripts in AI brain logs.
- [x] **Domain Migration Audit:** Verified `dev.f2hfresh.com` references replaced with `f2hfresh.com`.
- [x] **API Build Verification:** Executed `npm run build:api` — NestJS build passed cleanly with zero errors.
- [x] **Web Build Verification:** PM2 frontend process running in optimized production mode (`frontend-f2hfresh`).
- [x] **PM2 Service Health Check:** Verified `pm2 status` shows healthy instances for NestJS API (`api-f2hfresh`, PID online) and Next.js Frontend (`frontend-f2hfresh`, PID online).
- [x] **Git Synchronization & Push:** Execute `git add -A && git commit -m "..." && git push origin main` on completion.
