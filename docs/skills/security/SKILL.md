---
name: security
description: Use when handling untrusted input, credentials, authentication, authorization, file paths, outbound requests, database queries, shell commands, or anything a user can influence. Covers secret handling, authentication and authorization enforcement, input validation and output encoding, injection classes (SQL, command, path traversal, SSRF, XSS, CSRF), sensitive data in logs and errors, least privilege, insecure defaults, and vulnerable dependencies. Triggers on adding or changing a login, session, token, permission check, upload, redirect, query, admin route, or integration; on any request to store or read a key, password, or API token; and whenever a change would remove, weaken, or bypass an existing security control. Also use as a review pass over a diff that touches user-supplied data.
metadata:
  category: domain
  version: "1.0.0"
---

# Security

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

Security rules are not negotiable against convenience, deadline, style, or simplicity. When another skill's guidance conflicts with this one, this one wins.

## Non-negotiable rules

1. **NEVER expose secrets** — in source code, configuration committed to the repository, logs, error messages, comments, examples, test fixtures, commit messages, or any client-side bundle. This includes API keys, passwords, tokens, private keys, connection strings, session identifiers, and webhook signing secrets.
2. **NEVER remove, weaken, or bypass an existing security control** to make something work — no disabled certificate verification, no widened permission check, no relaxed validation, no `sudo`/root to get past a permission error, no disabled CSRF protection, no wildcard CORS to fix a browser error. If a control blocks the task, satisfy it or report it.
3. **NEVER trust input from outside the process** — request bodies, query strings, headers, cookies, path parameters, uploaded files and their names, third-party API responses, message queue payloads, or environment-supplied data. Validate at the boundary.
4. **NEVER weaken cryptography** — no home-rolled crypto, no reversible or fast hashing for passwords, no deprecated algorithms (MD5, SHA-1 for security purposes, DES, RC4), no hardcoded IVs or keys, no `Math.random()`-class generators for tokens.
5. **NEVER log or return sensitive data** — credentials, tokens, full card numbers, government identifiers, health data, or personal data beyond what the destination needs. Internal errors and stack traces MUST NOT reach an external client.

## Secrets

- Read secrets from the project's existing configuration mechanism — environment variables, a secret manager, a mounted file. Follow whatever the project already does; do not introduce a second mechanism.
- Commit a `.env.example` with **placeholder** values. Confirm real secret files are covered by `.gitignore`.
- In examples, tests, and documentation, use obviously fake values (`sk_test_example`, `REPLACE_ME`). Never use a real-looking key, even a revoked one.
- Anything that reaches a browser, mobile binary, or public repository is **public**. There is no such thing as a client-side secret — including in build-time environment variables that get inlined into bundles.
- **If a secret has been committed:** stop and tell the user immediately. It MUST be rotated — removing it from the code or rewriting history does not undo the exposure.

## Authentication and authorization

These are different, and the second is where most defects live.

- **Authentication** proves identity. **Authorization** decides what that identity may do. Passing the first grants nothing about the second.
- **MUST** enforce authorization on **every** access path — every endpoint, action, job, and query. A route added without a permission check inherits nothing from its neighbors.
- **MUST** check ownership and scope, not just role. `GET /invoices/{id}` requires that this caller may see *this* invoice; a valid session is not sufficient. Missing object-level checks are the single most common serious web vulnerability.
- **MUST** enforce authorization server-side. Hiding a button, disabling a field, or filtering a menu in the UI is presentation, not enforcement.
- Deny by default: unknown roles, missing permissions, and unrecognized states MUST fail closed.
- Passwords: store with a purpose-built password hash (argon2, scrypt, bcrypt) at current cost parameters. Never encrypt or plain-hash them.
- Sessions and tokens: rotate the session identifier on login and privilege change, invalidate on logout, set an expiry, and use `HttpOnly`, `Secure`, and an appropriate `SameSite` on cookies. Validate token signature, issuer, audience, and expiry — never trust unverified claims.
- Do not reveal whether an account exists through differing messages, status codes, or response timing on login and password reset.

## Validating input

Validate **at the boundary**, where untrusted data enters, then trust the validated value inward.

- Use the project's existing validation mechanism (schema validator, framework validation, type guards). Do not add a second one.
- **Allowlist, not denylist.** Define what is acceptable — type, format, range, length, enumerated set — and reject everything else. Denylists are always incomplete.
- Enforce bounds: maximum lengths, array sizes, numeric ranges, upload sizes, page sizes. Absent limits are a denial-of-service path.
- **NEVER** let a client supply a field that determines privilege, price, ownership, or identity. Derive `userId`, `role`, `isAdmin`, `price`, and `status` server-side. Bind request bodies to an explicit allowlist of fields — blanket object assignment permits mass assignment.
- Validation is a security control: **MUST NOT** be loosened to make a test, a caller, or a bad payload pass.

## Injection: the shared rule

Every injection class has the same cause — untrusted data interpreted as code or structure — and the same fix: **keep data out of the interpreted string**.

| Context | Required approach | Never |
|---|---|---|
| SQL | Parameterized queries / bound placeholders | String concatenation or interpolation of input |
| Shell / OS | Argument arrays, no shell; better, a library instead of a subprocess | Building a command string from input |
| File paths | Resolve, then confirm the result stays inside the allowed base directory | Joining user input into a path unchecked |
| HTML output | Context-appropriate escaping, via the framework's default | Raw HTML injection sinks with user data |
| Outbound URLs | Allowlist of permitted hosts, validated after redirects | Fetching a user-supplied URL directly |
| Templates, XML, LDAP, NoSQL, log lines | The context's escaping or parameterization | Interpolating raw input |

For identifiers that genuinely cannot be parameterized (table names, sort columns, directions), map the input through a **fixed allowlist** of permitted values.

Detailed per-class guidance, including SSRF, XSS, CSRF, path traversal, unsafe deserialization, upload handling, and redirects: [Vulnerability checklist](references/vulnerability-checklist.md).

## Least privilege and defaults

- Grant the minimum permission that works: narrow database roles, scoped API tokens, restrictive file permissions, non-root containers, time-limited credentials.
- New resources SHOULD default to private, disabled, and restricted. Opening access is an explicit decision.
- Check the security-relevant defaults of anything you configure — many are permissive for convenience (open CORS, disabled TLS verification, verbose errors in production, default credentials, publicly readable storage).
- Set the encryption, TLS, and transport requirements the project already uses; never downgrade them.

## Dependencies

- Check for known vulnerabilities using the project's own tooling (`npm audit`, `pip-audit`, `cargo audit`, or the configured scanner) when adding or updating a package.
- Treat a dependency as executing code with your process's privileges. Verify the exact package name — typosquatting is common.

See the `dependency-management` skill.

## Reviewing a change for security

Ask, for the diff in front of you:

1. What untrusted data does this introduce or newly trust?
2. Does every new access path check both authentication and object-level authorization?
3. Does any user-controlled value reach a query, command, path, URL, template, or rendered output?
4. Could a secret or personal data reach a log, an error response, or a commit?
5. Was any existing check, limit, or control removed or loosened?

Report security findings as **blocking**. Say precisely what an attacker could do, not merely that a practice is unsafe.

## Related skills

- `api-design` — contract-level validation, auth, and error shape.
- `backend-engineering` — where authorization checks sit in service code.
- `database` — parameterization and least-privilege database roles.
- `frontend-engineering` — output encoding and client-side trust boundaries.
- `dependency-management` — supply-chain risk.
