# FU-008 — Mobile Base URL Sanitization & API Duplicate Prefix Normalization

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-008` |
| **Related Test Case(s)** | MOB-AUTH-001, MOB-HTTP-001, ISS-054 |
| **Status** | **Implemented & Verified** |
| **Raised** | 2026-09-04 |

## Current Behaviour

1. If an operator compiles a Flutter mobile build with `--dart-define=F2H_API_BASE_URL=https://f2hfresh.com/api/v1` (with the `/api/v1` path included in the base origin), `ApiEndpoints.apiBaseUrl` appends `/api/v1`, resulting in doubled `/api/v1/api/v1` route paths.
2. In debug or local development, `F2H_API_BASE_URL` is passed as `https://f2hfresh.com`, which works correctly.
3. When the NestJS API receives `/api/v1/api/v1/...`, Express route matching fails with a 404 error (`Cannot POST /api/v1/api/v1/auth/login`).
4. Users with already-installed production builds are blocked from signing in or placing orders until a new app version is compiled, approved, and downloaded.

## Required Behaviour

1. **Backend Tolerance & Transparent Normalization:**
   The backend API must be fault-tolerant against duplicate `/api/v1/api/v1` or `/api/api/v1` route prefixes, transparently rewriting incoming request URLs before route matching so that legacy or misconfigured mobile builds function without interruption.
2. **Client-Side Sanitization:**
   Client applications must sanitize any incoming base URL string by stripping trailing slashes and redundant `/api` or `/api/v1` fragments before constructing API endpoints.
3. **Build Documentation Accuracy:**
   Release commands and build documentation must consistently prescribe the root domain (`https://f2hfresh.com`) for `F2H_API_BASE_URL`.

## Exact Implementation Requirement

1. **NestJS URL Normalization Middleware (`apps/api/src/main.ts`):**
   Execute early middleware before route resolution:
   - Match and normalize `^(\/api\/v1)+(?=\/|$|\?)` to `/api/v1` on both `req.url` and `req.originalUrl`.
   - Match and normalize `^\/api\/api\/v1(?=\/|$|\?)` to `/api/v1`.
2. **Flutter `ApiEndpoints.host` Sanitization (`api_endpoints.dart`):**
   In both `apps/mobile/customer` and `apps/mobile/delivery`:
   - Replace any trailing `/api(/v1)?/?$` with an empty string.
   - Strip all trailing slashes.
3. **Dio Request Interceptor Safeguard (`dio_client.dart`):**
   Sanitize `options.path` in `_onRequest` to replace duplicate `/api/v1/api/v1` occurrences.
4. **CI/Build Guide Updates (`docs/plans/2week.md`):**
   Update build instructions to use `--dart-define=F2H_API_BASE_URL=https://f2hfresh.com`.

## Affected Modules / Files

- `apps/api/src/main.ts`
- `apps/mobile/customer/lib/core/api/api_endpoints.dart`
- `apps/mobile/customer/lib/core/api/dio_client.dart`
- `apps/mobile/delivery/lib/core/api/api_endpoints.dart`
- `apps/mobile/delivery/lib/core/api/dio_client.dart`
- `docs/plans/2week.md`

## Verification & Impact

- Verified live requests to `POST https://f2hfresh.com/api/v1/api/v1/auth/login` and `GET https://f2hfresh.com/api/v1/api/v1/csrf/token`. Both resolve successfully to the controller endpoints without returning 404.
- PM2 process `api-f2hfresh` reloaded and healthy.
