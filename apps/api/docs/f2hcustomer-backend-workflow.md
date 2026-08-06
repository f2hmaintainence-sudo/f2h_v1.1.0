# F2H Customer App Backend Workflow

This document explains how the `f2hcustomer` Flutter app talks to `f2hbackend`, request by request.

## Base URL

Customer app base URL is defined in:

- `f2hcustomer/lib/core/api/api_endpoints.dart`

Current behavior:

- Android emulator: `http://10.0.2.2:8000`
- Desktop, iOS simulator, web localhost: `http://127.0.0.1:8000`
- Real device override:

```bash
flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP:8000
```

Android local HTTP is enabled in:

- `f2hcustomer/android/app/src/main/AndroidManifest.xml`

Required settings:

- `android.permission.INTERNET`
- `android:usesCleartextTraffic="true"`

## Shared HTTP Client

All customer app API calls go through:

- `f2hcustomer/lib/core/api/dio_client.dart`

Responsibilities:

- Sets `baseUrl`.
- Stores and sends cookies through `PersistCookieJar`.
- Fetches CSRF token from `/csrf/token` before non-GET requests.
- Adds `x-csrf-token` header for mutations when the CSRF cookie exists.
- Adds `Authorization: Bearer <token>` when an authenticated token is available.

The JWT is stored on login/register/google login in Isar through:

- `f2hcustomer/lib/features/auth/data/models/user_model.dart`
- `f2hcustomer/lib/features/auth/data/datasources/auth_local_datasource.dart`

On app start, `AuthCheckRequested` restores cached user and injects token back into `DioClient`.

## App Boot Flow

Flutter entry:

- `f2hcustomer/lib/main.dart`

Dependency injection:

- `f2hcustomer/lib/core/di/injection.dart`

App shell:

- `f2hcustomer/lib/app.dart`

Flow:

1. `main()` calls `di.init()`.
2. `DioClient` is created and initialized.
3. `F2HApp` creates global blocs:
   - `AuthBloc`
   - `CatalogBloc`
   - `ProfileBloc`
   - `SubscriptionBloc`
4. `AuthBloc` receives `AuthCheckRequested`.
5. If a cached user exists and session TTL is valid:
   - app emits `Authenticated`
   - cached JWT is set on `DioClient`
   - `AppShell` opens
6. `AppShell.initState()` loads:
   - catalog variants
   - authenticated profile
   - subscriptions and orders

## CSRF Flow

Before login/register/logout/order/subscription mutations, the app calls:

```http
GET /csrf/token
```

The backend sets a `csrf_token` cookie. `DioClient` reads that cookie and sends:

```http
x-csrf-token: <csrf_token>
```

This is required by backend guards such as `CsrfGuard`.

## Login Request

Flutter screen:

- `f2hcustomer/lib/features/auth/presentation/screens/login_screen.dart`

Bloc flow:

- UI sends `LoginRequested`
- `AuthBloc` calls `AuthRepository.login`
- repository calls `AuthRemoteDataSource.login`

Request:

```http
POST /Customer/auth/login
Content-Type: application/json
x-csrf-token: <csrf_token>
```

Payload:

```json
{
  "identifier": "user email / username / phone",
  "password": "password",
  "fcm_token": "optional firebase token"
}
```

Backend controller:

- `f2hbackend/backend/src/Panels/Customer/auth/auth.controller.ts`
- Controller prefix: `customer/auth`
- Login route: `POST login`

Backend response shape:

```json
{
  "message": "Login successful",
  "user": {
    "user_id": "USR_...",
    "email": "customer@example.com",
    "must_change_password": false
  },
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "navigations": [],
  "cache_ready": true
}
```

Client handling:

1. Extracts `response.data.user`.
2. Copies top-level `accessToken` into user map.
3. Creates `UserModel`.
4. Stores user/token in Isar.
5. Calls `dioClient.setAuthToken(accessToken)`.
6. Emits `Authenticated`.
7. Navigates to `AppShell`.

## Signup Request

Flutter screen:

- `f2hcustomer/lib/features/auth/presentation/screens/signup_screen.dart`

Request:

```http
POST /Customer/auth/register
Content-Type: application/json
x-csrf-token: <csrf_token>
```

Payload:

```json
{
  "user_name": "Customer Name",
  "email": "customer@example.com",
  "password": "password",
  "fcm_token": "optional firebase token"
}
```

Backend controller:

- `f2hbackend/backend/src/Panels/Customer/auth/auth.controller.ts`
- Route: `POST customer/auth/register`

Client expected response handling is the same as login: `user` plus `accessToken`.

Important: if backend register only returns a message and no `accessToken`, the Flutter app cannot auto-enter the authenticated app shell. In that case either backend should return tokens after register, or Flutter should navigate back to login.

## Google Login Request

Flutter flow:

- `AuthRepositoryImpl.signInWithGoogle()`
- Uses `google_sign_in`
- Gets `serverAuthCode`

Request:

```http
GET /Customer/auth/google/callback?code=<serverAuthCode>&fcm_token=<optional>
```

Backend route:

- `GET customer/auth/google/callback`

Client handling is the same as login: cache `accessToken`, set bearer token, emit authenticated.

## Authenticated Profile Request

Flutter load:

- `ProfileBloc` receives `LoadProfile`
- Calls `ProfileRepositoryImpl.getProfile`
- Calls `ProfileRemoteDataSource.getProfile`

Request:

```http
GET /Customer/auth/profile
Authorization: Bearer <accessToken>
Cookie: access_token=<optional cookie auth>
```

Backend controller:

- `f2hbackend/backend/src/Panels/Customer/auth/auth.controller.ts`
- Route: `GET customer/auth/profile`
- Guard: `AuthGuard('jwt')`

Backend behavior:

1. Reads authenticated user from JWT.
2. Resolves customer by email.
3. If no customer by email, resolves by `id = userId`.
4. If no customer exists, creates one with default zone/branch/route and wallet balance.
5. Returns customer row.

Response:

```json
{
  "status": true,
  "data": {
    "id": "USR_...",
    "customer_id": "CUS_...",
    "name": "Customer Name",
    "mobile": "9876543210",
    "email": "customer@example.com",
    "zone_id": "ZONE_...",
    "branch_id": "BRANCH_...",
    "route_id": "ROUTE_...",
    "customer_status": "active",
    "wallet_balance": "1000.00"
  }
}
```

Client model:

- `f2hcustomer/lib/features/profile/data/models/profile_model.dart`

UI:

- `f2hcustomer/lib/features/profile/presentation/screens/profile_screen.dart`
- `f2hcustomer/lib/features/catalog/presentation/screens/home_screen.dart`

The profile screen displays:

- customer name
- mobile
- email
- status
- zone
- wallet-derived data in related screens

## Product Variants Request

Flutter load:

- `CatalogBloc` receives `LoadCatalog`
- Calls `CatalogRepositoryImpl.getProducts`
- Calls `CatalogRemoteDataSource.getProductVariants`

Primary request:

```http
GET /api/v1/product/variants
```

Fallback request:

```http
GET /api/v1/product/variants
```

The fallback exists because the original backend route was misspelled as `vatiants`.

Backend controller:

- `f2hbackend/backend/src/Panels/Customer/Subscriptions/subscriptions.controller.ts`
- Controller prefix: `api/v1/product`
- Routes:
  - `GET variants`
  - `GET vatiants`

Backend service:

- `f2hbackend/backend/src/Panels/Customer/Subscriptions/subscriptions.service.ts`
- Method: `getVariants()`

Query joins:

- `product_variants pv`
- `products p`

Expected response:

```json
{
  "data": [
    {
      "variant_id": "VRT_...",
      "product_name": "Fresh Cow Milk",
      "variant_name": "500ml",
      "sku": "MILK_500",
      "price": "32.00",
      "subscription_price": "30.00",
      "unit_value": "500",
      "unit_type": "ml",
      "is_subscribable": true,
      "is_one_time": true
    }
  ]
}
```

Client conversion:

- `CatalogRepositoryImpl` maps raw variant rows into `Product`.
- `Product.id` is the backend `variant_id`.
- Product cards and order/subscription requests must send this `variant_id`.

UI:

- Home products: `home_screen.dart`
- Browse products: `product_detail_screen.dart`
- Product card: `product_tile.dart`
- Product order sheet: `product_options_sheet.dart`

## Product Options Sheet

Flutter file:

- `f2hcustomer/lib/features/catalog/presentation/widgets/product_options_sheet.dart`

User chooses:

- quantity
- buy once or subscribe
- subscription schedule
- delivery slot
- start/delivery date

The sheet reads `ProfileBloc.state` before creating a subscription because backend subscription creation needs:

- `customer_id`
- `branch_id`

If profile is not loaded, the sheet blocks subscription creation and asks user to try again.

## One-Time Order Request

Flutter event:

- `PlaceOneTimeOrderRequested`

Repository:

- `f2hcustomer/lib/features/subscription/data/repositories/subscription_repository_impl.dart`

Request:

```http
POST /api/v1/customer/orders
Authorization: Bearer <accessToken>
Content-Type: application/json
x-csrf-token: <csrf_token>
```

Payload:

```json
{
  "delivery_slot": "Morning",
  "scheduled_date": "2026-05-23",
  "payment_mode": "wallet",
  "items": [
    {
      "variant_id": "VRT_...",
      "quantity": 2,
      "unit_price": 32
    }
  ]
}
```

Backend controller:

- `f2hbackend/backend/src/Panels/Customer/Orders/controllers/customer.order.controller.ts`
- Prefix: `api/v1/customer/orders`
- Guard: `AuthGuard('jwt')`

Backend behavior:

1. Resolves customer from JWT email or user id.
2. Calculates subtotal.
3. Checks wallet balance.
4. Deducts wallet balance.
5. Inserts wallet transaction.
6. Inserts order.
7. Inserts order items.
8. Returns order id.

Response:

```json
{
  "status": true,
  "order_id": "ORD_...",
  "message": "Order placed successfully"
}
```

After success:

- `SubscriptionBloc` reloads subscriptions.
- `SubscriptionBloc` reloads orders.
- UI shows success snack bar.

## Orders List Request

Flutter:

- `SubscriptionBloc.LoadSubscriptions`
- Calls `subscriptionRepository.getOrders()`

Request:

```http
GET /api/v1/customer/orders
Authorization: Bearer <accessToken>
```

Backend:

- `CustomerOrderController.getOrders`

Backend behavior:

1. Resolves customer from JWT.
2. Fetches orders by `customer_id`.
3. Fetches order items for each order.
4. Fetches variant and product details for each item.
5. Returns formatted orders.

Response:

```json
{
  "status": true,
  "data": [
    {
      "order_id": "ORD_...",
      "customer_id": "CUS_...",
      "delivery_slot": "Morning",
      "scheduled_date": "2026-05-23",
      "status": "pending",
      "total_amount": "64.00",
      "items": [
        {
          "variant_id": "VRT_...",
          "quantity": "2",
          "unit_price": "32.00",
          "variant_name": "500ml",
          "product_name": "Fresh Cow Milk",
          "sku": "MILK_500"
        }
      ]
    }
  ]
}
```

UI usage:

- Wallet/order history screens convert raw order rows into order tiles.

## Subscription Create Request

Flutter event:

- `CreateSubscriptionRequested`

Repository:

- `SubscriptionRepositoryImpl.createSubscription`

Request:

```http
POST /api/v1/customer/developer/subscriptions
Authorization: Bearer <accessToken>
Content-Type: application/json
x-csrf-token: <csrf_token>
```

Payload:

```json
{
  "customer_id": "CUS_...",
  "branch_id": "BRANCH_...",
  "schedule_type": "weekly",
  "payment_type": "prepaid",
  "auto_renew": true,
  "custom_dates": [],
  "start_date": "2026-05-23",
  "items": [
    {
      "product_variant_id": "VRT_...",
      "unit_price": 32,
      "schedules": [
        {
          "day": 1,
          "m_quantity": 2,
          "e_quantity": 0
        }
      ]
    }
  ]
}
```

Schedule mapping:

- `day`: JavaScript day number, where Sunday is `0`, Monday is `1`.
- Morning slot sends quantity in `m_quantity`.
- Evening slot sends quantity in `e_quantity`.
- Daily creates all days `0..6`.
- Alternate currently creates Monday, Wednesday, Friday.
- Custom days maps selected day chips to day numbers.

Backend DTO:

- `f2hbackend/backend/src/Panels/Customer/Subscriptions/dto/create-developer-subscription.dto.ts`

Backend controller:

- `f2hbackend/backend/src/Panels/Customer/Subscriptions/subscriptions.controller.ts`
- Prefix: `api/v1/customer/developer/subscriptions`
- Route: `POST /`

Backend service:

- `SubscriptionsService.create`

Backend behavior:

1. Validates `customer_id`.
2. Validates `start_date`.
3. Filters schedules where morning or evening quantity is greater than zero.
4. Inserts `subscriptions`.
5. Inserts `subscription_items`.
6. Inserts weekly/custom schedules.
7. Inserts subscription logs.
8. Seeds subscription calendar cache.
9. Returns subscription id and item ids.

Response:

```json
{
  "status": true,
  "subscription_id": "SUB_...",
  "subscription_number": "SUBNO...",
  "items": [
    {
      "id": "SBI...",
      "product_variant_id": "VRT_..."
    }
  ]
}
```

Important current backend note:

- The subscription POST route is currently marked `@Public()` in the backend.
- The Flutter app still sends `Authorization` because it is an authenticated customer action and future backend hardening should require JWT.

## Subscriptions List Request

Flutter:

- `SubscriptionBloc.LoadSubscriptions`
- Calls `subscriptionRepository.getSubscriptions()`

Request:

```http
GET /api/v1/customer/developer/subscriptions
Authorization: Bearer <accessToken>
```

Backend:

- `SubscriptionsController.getSubscriptions`
- Guard: `AuthGuard('jwt')`

Backend behavior:

1. Resolves customer by authenticated email or user id.
2. Fetches subscriptions by `customer.customer_id`.
3. Fetches each subscription's items.
4. Joins each item to `product_variants`.
5. Joins variant to `products`.
6. Returns subscriptions with enriched items.

Client model:

- `f2hcustomer/lib/features/subscription/data/models/subscription_model.dart`
- `SubscriptionRepositoryImpl` maps raw rows into UI subscription cards.

## Wallet Transactions Request

Flutter:

- `ProfileBloc.LoadProfile`
- After profile load, also calls `getWalletTransactions`.

Request:

```http
GET /Customer/auth/wallet/transactions
Authorization: Bearer <accessToken>
```

Backend:

- `AuthController.getWalletTransactions`
- Guard: `AuthGuard('jwt')`

Backend behavior:

1. Resolves customer by email or user id.
2. Fetches `wallet_transactions` by `customer_id`.
3. Orders by newest first.

Response:

```json
{
  "status": true,
  "data": []
}
```

## Logout Request

Flutter:

- Profile screen logout button
- Sends `LogoutRequested`

Request:

```http
POST /Customer/auth/logout
Authorization: Bearer <accessToken>
x-csrf-token: <csrf_token>
```

Backend:

- `AuthController.logout`

Client cleanup:

1. Server logout is attempted.
2. Cookies are cleared.
3. Local cached user is cleared.
4. `DioClient` auth token is cleared.
5. App emits `Unauthenticated`.
6. App navigates to login screen.

## Database Tables Used By Customer App

Auth/profile:

- `users`
- `customers`
- `customer_addresses`
- `wallet_transactions`

Catalog:

- `products`
- `product_variants`

Orders:

- `orders`
- `order_items`

Subscriptions:

- `subscriptions`
- `subscription_items`
- `subscription_weekly_schedule`
- `subscription_custom_dates`
- `subscription_logs`
- `subscription_calendar_cache`

## Common Failure Points

Profile shows default customer:

- JWT was not attached to Dio.
- `AuthCheckRequested` loaded cached user but did not restore token.
- Backend cannot resolve customer by email or user id.

Products do not show:

- Backend route still only has misspelled `/vatiants`.
- App is pointing to the wrong base URL.
- Android emulator is using `127.0.0.1` instead of `10.0.2.2`.
- Android manifest is missing internet or cleartext settings.
- `product_variants.variant_id` is missing in schema.

One-time order fails:

- Wallet balance is lower than order total.
- `variant_id` sent from app does not exist in `product_variants.variant_id`.
- JWT missing for `AuthGuard('jwt')`.
- `order_items` migration must allow string ids because backend inserts `ORI_...`.

Subscription creation fails:

- Profile is not loaded, so `customer_id` is empty.
- `branch_id` is empty or invalid.
- Backend DTO expects `weekly` or `custom_dates`, not `daily` or `alternate`.
- At least one schedule must have positive `m_quantity` or `e_quantity`.
- `product_variant_id` must match `product_variants.variant_id`.

## Request Summary

| Feature | Method | Endpoint | Auth | Flutter source | Backend source |
| --- | --- | --- | --- | --- | --- |
| CSRF | GET | `/csrf/token` | No | `DioClient.fetchCsrfToken` | `csrf` module |
| Login | POST | `/Customer/auth/login` | CSRF | `auth_remote_datasource.dart` | `Customer/auth/auth.controller.ts` |
| Signup | POST | `/Customer/auth/register` | CSRF | `auth_remote_datasource.dart` | `Customer/auth/auth.controller.ts` |
| Google callback | GET | `/Customer/auth/google/callback` | No | `auth_remote_datasource.dart` | `Customer/auth/auth.controller.ts` |
| Profile | GET | `/Customer/auth/profile` | JWT | `profile_remote_datasource.dart` | `Customer/auth/auth.controller.ts` |
| Variants | GET | `/api/v1/product/variants` | No | `catalog_remote_datasource.dart` | `Customer/Subscriptions/subscriptions.controller.ts` |
| Variants legacy | GET | `/api/v1/product/variants` | No | `catalog_remote_datasource.dart` | `Customer/Subscriptions/subscriptions.controller.ts` |
| Create order | POST | `/api/v1/customer/orders` | JWT + CSRF | `subscription_remote_datasource.dart` | `Customer/Orders/customer.order.controller.ts` |
| List orders | GET | `/api/v1/customer/orders` | JWT | `subscription_remote_datasource.dart` | `Customer/Orders/customer.order.controller.ts` |
| Create subscription | POST | `/api/v1/customer/developer/subscriptions` | CSRF now, should be JWT + CSRF | `subscription_remote_datasource.dart` | `Customer/Subscriptions/subscriptions.controller.ts` |
| List subscriptions | GET | `/api/v1/customer/developer/subscriptions` | JWT | `subscription_remote_datasource.dart` | `Customer/Subscriptions/subscriptions.controller.ts` |
| Wallet transactions | GET | `/Customer/auth/wallet/transactions` | JWT | `profile_remote_datasource.dart` | `Customer/auth/auth.controller.ts` |
| Logout | POST | `/Customer/auth/logout` | CSRF | `auth_remote_datasource.dart` | `Customer/auth/auth.controller.ts` |

