# ISS-044 — Account lockout triggers on the 5th attempt instead of the documented 429 throttle, and is remotely triggerable against any known account

| Field | Value |
|---|---|
| **Issue ID** | `ISS-044` |
| **Test Case ID(s)** | ADM-AUTH-002 |
| **Module** | Auth / Brute-Force Protection |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Account lockout triggers on the 5th attempt instead of the documented 429 throttle, and is remotely triggerable against any known account

## Steps to Reproduce

1. `POST /api/v1/auth/login` with a wrong password five times for `qa.admin@f2htest.local` (header `X-Role: ADMIN`).
2. Attempt a sixth time.
3. Attempt with the **correct** password.
4. `SELECT locked_at, max_logins FROM users WHERE user_id = 'QA_ADM_01';`

## Expected Result

Per the test plan: attempts 1–5 return 401 *"Invalid credentials"*; the 6th returns 429 Too Many Requests from `CustomThrottlerGuard`.

## Actual Result

```
attempt 1-4 -> 401 {"message":"Invalid email/mobile or password"}
attempt 5   -> 403 {"message":"Account has been locked due to multiple failed login attempts. Please try again in 30 minutes."}
attempt 6   -> 403 (same)
correct password -> 403 (still locked)
users: locked_at = 2026-08-29 13:14:11+02, max_logins = 6
```
The login route does declare `@Throttle({short:{limit:10,ttl:60000}, medium:{limit:30,ttl:900000}})` and returns the `X-RateLimit-*` headers, but the account lock fires first, at 5.

The lock is per **account**, not per IP: five wrong guesses from anywhere lock the real account for 30 minutes. During this run the QA admin account had to be unlocked manually (`UPDATE users SET locked_at = NULL`) to continue testing.

## Root Cause

Two mechanisms overlap and the documentation matches neither. The throttler is IP/route-scoped at 10/min, while `validateUser` maintains a `max_logins` counter and sets `users.locked_at` at the 5th failure with a 30-minute window. Because the lock threshold (5) is below the throttle limit (10), the throttle is unreachable on this route. Note the in-line lock *check* in `validateUser` is commented out, so the enforcement lives elsewhere in the flow — the two halves have drifted apart.

An account lockout without an IP/CAPTCHA dimension is a denial-of-service vector: an unauthenticated attacker who knows an admin's email can keep that admin locked out indefinitely with five requests every 30 minutes. There is no unlock path in the Admin Panel.

## Affected Files / API / Tables

- `apps/api/src/auth/auth.controller.ts:54-70` (`@Throttle` decorators)
- `apps/api/src/auth/auth.service.ts:140+` (`validateUser`, `max_logins` / `locked_at`; commented-out lock check at `:249-260`)
- `apps/api/src/auth/security-alerts.service.ts` (lock alert email)
- Table: `users` (`locked_at`, `max_logins`)

## Recommended Fix

Decide on one policy and document it. Recommended: keep the account lock but make it resilient — count failures per (account, IP), apply exponential backoff instead of a hard 30-minute freeze, exempt requests that later succeed with a valid second factor, and give the Admin Panel an explicit unlock action with an audit entry. If the 429 behaviour in the test plan is the intended contract, lower the throttle limit below the lock threshold and update the plan either way. Also remove or reinstate the commented-out lock check so enforcement lives in one place.

## Regression Tests Required

- ADM-AUTH-002 (documented rejection behaviour, whichever policy is chosen)
- Lockout expires after the configured window and the correct password then works
- Admin unlock action clears `locked_at` and writes an audit entry
- Failed attempts from one IP do not lock an account for a different IP
