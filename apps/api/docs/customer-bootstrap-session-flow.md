# Customer Bootstrap Session Flow

## Goal

The customer app uses one bootstrap request after authentication to hydrate the reusable customer session. This gives the app enough cached data to render Home, Wallet, and Profile quickly without repeating profile/address/wallet API calls.

## Startup Flow

```text
Splash
-> Check secure token
-> If token exists:
      attach token to Dio
      GET /customer/bootstrap
      restore CustomerSessionCubit
      open home shell
-> Else:
      open login
```

## Login Flow

1. Customer logs in through `/Customer/auth/login`.
2. The returned access token is stored in `flutter_secure_storage`.
3. Dio attaches the token as `Authorization: Bearer <token>` for every request.
4. `CustomerSessionGate` calls `GET /customer/bootstrap`.
5. The bootstrap response is stored in global session state and local cache.
6. The app opens `AppShell`.

## Bootstrap API

Endpoint:

```http
GET /customer/bootstrap
Authorization: Bearer <access_token>
```

Response:

```json
{
  "profile": {},
  "addresses": [],
  "wallet": {
    "balance": 0
  },
  "subscription_summary": {},
  "notifications_count": 0
}
```

## Global Session State

Flutter stores bootstrap data in `CustomerSessionCubit`.

Session fields:

- `profile`
- `addresses`
- `wallet`
- `subscriptionSummary`
- `notificationsCount`

## Cache Policy

Cached locally:

- `profile`
- `addresses`
- `wallet`

Not cached:

- order history
- wallet transactions
- analytics
- invoices
- delivery history

## Failure Handling

- Bootstrap `401`: clear secure token and session cache, then logout.
- Network failure: use cached session data if available.
- After using cache for a network failure, retry bootstrap silently in the background.

## Lazy Loading

These must be fetched only when their screen opens:

- orders
- wallet transactions
- invoices
- delivery history

## Current Flutter Entry Points

- Token storage: `lib/core/services/token_storage_service.dart`
- Bootstrap API client: `lib/core/session/customer_bootstrap_api.dart`
- Session cache: `lib/core/session/customer_session_cache.dart`
- Session state: `lib/core/session/customer_session_state.dart`
- Session cubit: `lib/core/session/customer_session_cubit.dart`
- Startup gate: `lib/app.dart`

## Current Backend Entry Point

- `GET /customer/bootstrap`: `backend/src/Panels/Customer/auth/customer-bootstrap.controller.ts`
