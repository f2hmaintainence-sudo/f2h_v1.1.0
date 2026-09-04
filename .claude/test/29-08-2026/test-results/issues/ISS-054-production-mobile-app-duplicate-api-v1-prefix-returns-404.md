# ISS-054 — Production Mobile App duplicate "/api/v1/api/v1" prefix returns HTTP 404

| Field | Value |
|---|---|
| **Issue ID** | `ISS-054` |
| **Test Case ID(s)** | MOB-AUTH-001, MOB-HTTP-001 |
| **Module** | Mobile Apps / API Routing & Versioning |
| **Severity** | **Critical** |
| **Status** | **Resolved** |
| **Environment** | Production release APK, Nginx proxy, NestJS API |
| **Detected** | 2026-09-04 (production mobile app login screen) |
| **Resolved Date** | 2026-09-04 |

## Title

Production mobile app fails to log in with error "Cannot POST /api/v1/api/v1/auth/login" due to duplicated base URL path

## Steps to Reproduce

1. Launch installed production customer mobile app APK on an Android device.
2. Enter valid email/mobile credentials and tap "Sign In".
3. Observe red snackbar/toast error banner at the bottom of the screen.

## Expected Result

The app posts credentials to `/api/v1/auth/login`, receives a valid JWT session token or bad credential error (HTTP 200 or 401), and logs in.

## Actual Result

The app displays a red error banner:
```
Cannot POST /api/v1/api/v1/auth/login
```
And HTTP response status is 404 Not Found:
```json
{"message":"Cannot POST /api/v1/api/v1/auth/login","error":"Not Found","statusCode":404}
```

## Root Cause

1. In Flutter release build commands (documented in `docs/plans/2week.md` line 134):
   The build was executed with `--dart-define=F2H_API_BASE_URL=https://f2hfresh.com/api/v1`.
2. In `apps/mobile/customer/lib/core/api/api_endpoints.dart` and `apps/mobile/delivery/lib/core/api/api_endpoints.dart`:
   ```dart
   static String get host => _envBaseUrl.isNotEmpty ? _envBaseUrl : _devBaseUrl;
   static String get apiBaseUrl => '$host/api/v1';
   ```
   Because `host` returned `https://f2hfresh.com/api/v1`, `apiBaseUrl` appended `/api/v1` a second time, evaluating to:
   `https://f2hfresh.com/api/v1/api/v1`.
3. In debug builds, `DART_API` was set in Makefile to `https://f2hfresh.com` (without `/api/v1`), so debug builds worked fine.
4. When production mobile devices sent `POST /api/v1/api/v1/auth/login`, Nginx proxied the full path to NestJS. NestJS Express router had `/api/v1/auth/login` registered, resulting in an Express 404.

## Affected Files / API / Tables

- `apps/api/src/main.ts`
- `apps/mobile/customer/lib/core/api/api_endpoints.dart`
- `apps/mobile/customer/lib/core/api/dio_client.dart`
- `apps/mobile/delivery/lib/core/api/api_endpoints.dart`
- `apps/mobile/delivery/lib/core/api/dio_client.dart`
- `docs/plans/2week.md`

## Resolution

1. **Backend URL Normalization Middleware (`apps/api/src/main.ts`):**
   Added Express middleware prior to route handling:
   ```typescript
   app.use((req: Request, _res: Response, next: NextFunction) => {
     if (req.url) {
       req.url = req.url
         .replace(/^(\/api\/v1)+(?=\/|$|\?)/, '/api/v1')
         .replace(/^\/api\/api\/v1(?=\/|$|\?)/, '/api/v1');
     }
     if ((req as any).originalUrl) {
       (req as any).originalUrl = (req as any).originalUrl
         .replace(/^(\/api\/v1)+(?=\/|$|\?)/, '/api/v1')
         .replace(/^\/api\/api\/v1(?=\/|$|\?)/, '/api/v1');
     }
     next();
   });
   ```
   *Result:* Already-distributed production mobile APKs have their requests transparently rewritten to `/api/v1/*` without requiring an emergency client re-release.

2. **Client-Side Host URL Sanitization:**
   Updated `ApiEndpoints.host` in both Customer and Delivery Partner apps:
   ```dart
   final raw = _envBaseUrl.isNotEmpty ? _envBaseUrl : _devBaseUrl;
   return raw.replaceAll(RegExp(r'/api(/v1)?/?$'), '').replaceAll(RegExp(r'/+$'), '');
   ```

3. **Interceptor Safeguards (`dio_client.dart`):**
   Added an explicit regex check in Dio request interceptors to replace any duplicate `/api/v1/api/v1` occurrence in `options.path`.

4. **Documentation Alignment:**
   Updated `docs/plans/2week.md` to specify `--dart-define=F2H_API_BASE_URL=https://f2hfresh.com`.
