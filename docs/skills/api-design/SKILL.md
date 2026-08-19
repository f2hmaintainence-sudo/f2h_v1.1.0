---
name: api-design
description: Use when designing, adding, or changing an API endpoint, RPC method, or any interface consumed by another system or team. Covers resource and operation naming, request and response contracts, validation at the boundary, consistent error shapes and status codes, pagination, filtering and sorting, idempotency, versioning and backward compatibility, rate limiting, and observability. Triggers on "add an endpoint", "design this API", "what should this return", changing a response shape or field, adding a query parameter, or defining a webhook or event payload. Also use when judging whether a change breaks existing consumers. Covers the contract itself - authorization enforcement belongs to security, and internal service structure to backend-engineering.
metadata:
  category: domain
  version: "1.0.0"
---

# API Design

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## First: match the existing API

**MUST** read two or three existing endpoints before adding one. Copy their conventions exactly, even where you would design differently — an API's value comes from being predictable.

Determine and match: URL and naming style, casing of fields (`snake_case` versus `camelCase`), the envelope shape (bare object versus `{ data: ... }`), the error format, how pagination is expressed, how auth is passed, and how dates and money are represented.

**NEVER** introduce a second convention for any of these. One inconsistent endpoint costs every future consumer.

## Contracts

- The contract is the **promise**, not the implementation. Do not expose internal entities, column names, or enum values directly — they will change for reasons that have nothing to do with consumers.
- Be **strict in what you accept, explicit in what you return.** Reject unknown or malformed fields rather than ignoring them silently; a typo'd field name that is silently dropped is a bug consumers cannot see.
- Return **stable, explicit field sets.** Never serialize a whole database record — it leaks internal fields today and adds unintended contract surface tomorrow. See the `security` skill.
- Represent time as ISO 8601 with an offset, money as a decimal string or integer minor units **plus a currency**, and identifiers as strings.
- Prefer explicit enumerated values over booleans for anything with a plausible third state.
- Make responses self-consistent: the same entity SHOULD have the same shape everywhere it appears.

## Naming and operations

For HTTP APIs, follow the project's style. Where the project has no established style:

- **Endpoint Paths**: All route paths and controller root decorators MUST use lowercase `kebab-case` (`@Controller({ path: 'delivery-partner/profile', version: '1' })`). NEVER use CamelCase or PascalCase in endpoints (`DeliveryPartner/profile`).
- **Backward Compatibility**: When updating legacy endpoints from camelCase/PascalCase, use array routing to support both `kebab-case` (primary) and legacy aliases (secondary) e.g., `@Controller({ path: ['delivery-partner/auth', 'DeliveryPartner/auth'], version: '1' })`.
- Resources are plural nouns: `/invoices`, `/invoices/{id}/line-items`.
- Methods carry the verb: `GET` reads, `POST` creates, `PUT`/`PATCH` update, `DELETE` removes.
- `GET` MUST be safe — **never** state-changing.
- `PUT` and `DELETE` MUST be idempotent: repeating them produces the same end state.
- Operations that genuinely are not CRUD get a clear action endpoint (`POST /invoices/{id}/void`) rather than an overloaded update with a magic field.

## Validation

Validate every request at the boundary, before any business logic runs, using the project's existing validation mechanism.

- Check type, format, required-ness, allowed values, length, and range.
- **MUST** enforce a maximum page size, body size, and array length. Absent limits are a denial-of-service path.
- Return **all** validation errors at once with the field path for each, not the first failure — one round trip per mistake makes an API painful.
- **NEVER** accept a client-supplied value that determines identity, ownership, privilege, or price. Derive those server-side.

Validation is a security control; see the `security` skill for what MUST NOT be relaxed.

## Errors

Use one error shape across the entire API. If the project has one, use it. Otherwise:

```json
{
  "error": {
    "code": "invoice_already_paid",
    "message": "This invoice has already been paid.",
    "details": [{ "field": "amount", "issue": "must be greater than 0" }],
    "request_id": "req_01H..."
  }
}
```

- `code` is a **stable machine-readable string** consumers can branch on. Never make them parse `message`.
- `message` is for a human debugging the integration. It MUST NOT contain stack traces, SQL, internal hostnames, or any secret.
- Include a request or correlation id in every error so a report can be traced to a log.

Status codes — use the ordinary meanings and use them consistently:

| Code | Use for |
|---|---|
| 400 | Malformed or invalid request |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but not permitted |
| 404 | Not found — also correct for a resource the caller may not know exists |
| 409 | Conflict with current state (duplicate, version mismatch) |
| 422 | Well-formed but semantically invalid, where the project distinguishes it from 400 |
| 429 | Rate limited — include `Retry-After` |
| 5xx | The server failed. **Never** return 5xx for a client's invalid input |

**NEVER** return `200` with an error body. It breaks every client's error handling and every monitor.

## Pagination, filtering, sorting

- Every collection endpoint MUST be paginated, from the first version. Retrofitting pagination is a breaking change.
- Apply a **default** limit and a **maximum** limit; clamp rather than reject when possible.
- Prefer cursor pagination for large or frequently-changing collections; offset pagination is acceptable for small, stable ones. See the `database` skill.
- Return enough to continue: a next cursor, or the total when it can be computed cheaply.
- Filtering and sorting parameters MUST map through a **fixed allowlist** of permitted fields, never straight into a query.

## Idempotency

Required wherever a retry could cause duplicate side effects — payments, order creation, message sending, external provisioning.

- Accept a client-supplied idempotency key on unsafe operations, store the result against it, and return the original result on replay.
- Webhook and queue consumers MUST be idempotent: delivery is at-least-once, and duplicates will arrive.
- Make natural operations idempotent where you can (setting a state rather than toggling it).

## Versioning and compatibility

Do not build elaborate versioning for a small internal API with known consumers you can update. Coordinate the change instead.

**Non-breaking** (safe to ship): adding an optional request field, adding a response field, adding a new endpoint, adding a new enum value **only if** consumers are documented to tolerate unknown values.

**Breaking** (requires a version, a deprecation period, or coordinated deploy): removing or renaming a field, changing a type or format, making an optional field required, tightening validation, changing an error code or status, changing default behavior, changing sort order or pagination semantics.

When versioning is warranted, pick one mechanism (URL path or a header), apply it consistently, and define how long old versions live. Announce deprecations with a date and a migration path before removing anything.

**MUST** check existing consumers before changing a response shape. "Nobody uses that field" requires evidence.

## Rate limiting and observability

- Apply rate limits to authentication, expensive operations, and anything externally billed. Communicate them with standard headers and a `Retry-After` on 429.
- Emit per-request logs with method, route, status, duration, and a correlation id — and never with secrets or personal data.
- Propagate a correlation id through downstream calls so one request can be traced end to end.

Instrumentation details are owned by the `backend-engineering` skill.

## Documenting the contract

An API with external consumers MUST be documented: endpoints, request and response shapes, error codes, auth requirements, and limits. Generate it from schemas or types where the project supports it, so it cannot drift. See the `documentation` skill.

## Related skills

- `security` — authentication, authorization, injection, data exposure.
- `backend-engineering` — what sits behind the endpoint.
- `database` — pagination and query cost.
- `documentation` — publishing the contract.
