# ISS-045 — Referral code lookup resolves strangers by phone suffix and creates accounts from an unauthenticated GET

| Field | Value |
|---|---|
| **Issue ID** | `ISS-045` |
| **Test Case ID(s)** | REF-CODE-001, REF-CODE-002 |
| **Module** | Referrals / Code Resolution |
| **Severity** | **Critical** |
| **Status** | Open |
| **Environment** | Live application, `f2h_fresh` database, API `:5001` |
| **Detected** | 2026-08-31 (live real-time run) |

## Title

Referral code lookup resolves strangers by phone suffix and creates accounts from an unauthenticated GET

## Steps to Reproduce

```
curl -s http://127.0.0.1:5001/api/v1/customer/referrals/validate/ashokroman007
curl -s http://127.0.0.1:5001/api/v1/customer/referrals/validate/0644
curl -s http://127.0.0.1:5001/api/v1/customer/referrals/validate/ASHOK0644
curl -s http://127.0.0.1:5001/api/v1/customer/referrals/validate/F2H9169
psql -c "SELECT user_id, email, phone, created_at FROM users WHERE user_id LIKE 'USER\_F2H%';"
```

## Expected Result

A referral code resolves only by exact match against a code actually issued to a customer or
delivery partner. An unknown code returns `valid:false` and writes nothing. A public
unauthenticated endpoint never creates a user account.

## Actual Result

| Code entered | Response | Effect |
|---|---|---|
| `ashokroman007` | `{"valid":false,"message":"Invalid referral code"}` | the identifier the business hands out does not work |
| `ashoknanda130120@gmail.com` | `{"valid":false}` | same for the delivery partner |
| `F2HQFK7NH` | `{"valid":true,"referrer_name":"Ashok"}` | correct — the real code is the `customer_id` |
| `0644` | `{"valid":true,"referrer_name":"Allen"}` | matched `users.phone LIKE '%0644'` — an arbitrary 4-digit string resolves to a real person |
| `ASHOK0644` | `{"valid":true,"referrer_name":"Allen"}` | letters discarded; only the digits are used |
| `F2H9169` | `{"valid":true,"referrer_name":"F2H Referrer"}` | **created `users` + `customers` rows for `USER_F2H9169`** |

```
        user_id         |  first_name   |               email                |   phone    |         created_at
------------------------+---------------+------------------------------------+------------+----------------------------
 USER_F2H9169           | F2H Referrer  | ref_f2h9169@f2hfresh.com           | 9992916900 | 2026-08-31 19:41:47.802+02
 USER_F2HVOD3GJ-PARTNER | Vodgj-partner | ref_f2hvod3gj-partner@f2hfresh.com | 9992300000 | 2026-08-31 07:34:49.961+02
 USER_F2HQFK7           | Qfk           | ref_f2hqfk7@f2hfresh.com           | 9992700000 | 2026-08-30 17:26:46.779+02
 USER_F2HQFK            | Qfk           | ref_f2hqfk@f2hfresh.com            | 9992000000 | 2026-08-30 17:26:44.317+02
```

`USER_F2HQFK` and `USER_F2HQFK7` are truncated mistypings of `F2HQFK7NH` — real customers who
mistyped Ashok's code were attached to ghost accounts instead of to Ashok. `referrals.id = 34`
is live evidence: ₹100 `pending` owed to `USER_F2HVOD3GJ-PARTNER`, an account that exists only
because someone typed `F2HVOD3GJ-PARTNER` into the referral box.

## Root Cause

`ReferralRepository.findByReferralCode()` has three fallbacks after the exact-id lookup fails:

1. **Phone-suffix match** (`referral.repository.ts:93-107`) — strips all non-digits from the code
   and runs `WHERE u.phone LIKE '%<last 4 digits>'`. Keyspace is 10,000; trivially brute-forcible,
   and collides accidentally with ordinary typos.
2. **Account fabrication** (`referral.repository.ts:110-160`) — any code starting with `F2H` and
   at least 6 characters long causes `INSERT INTO users` + `INSERT INTO customers` for a
   synthesised `USER_<code>` id. Reached from `@Public() @Get('validate/:code')`, so it is
   unauthenticated write access.
3. **Hardcoded identity** (`referral.repository.ts:113-118`) — the literal string `F2HASH647` is
   special-cased to the name "Ashok Roman" and the address `ashokroman007@gmail.com`.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/repositories/referral.repository.ts:59-163`
- `apps/api/src/panels/customer/referral/referral.controller.ts:46-61` (`@Public()` validate)
- Tables: `users`, `customers`, `referrals`

## Recommended Fix

1. Delete fallbacks 1–3. Resolve a code by exact match only, against an id that was actually issued.
2. Never write from the validate path; `findByReferralCode` must be read-only.
3. Decide the canonical code format and expose it consistently — the app currently issues
   `customer_id` as the code while operations hand out `ashokroman007`-style strings. If human
   readable codes are wanted, add a `referral_code` column with a unique index and issue from it.
4. Clean up the four `USER_F2H*` phantom accounts and re-point `referrals.id = 34`.

## Regression Tests Required

- REF-CODE-001, REF-CODE-002
- Unknown code returns `valid:false` and creates no rows
- Digit-only and mixed codes matching a phone suffix return `valid:false`
