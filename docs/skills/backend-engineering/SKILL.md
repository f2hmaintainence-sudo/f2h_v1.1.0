---
name: backend-engineering
description: Use when building or changing server-side application code - services, handlers, use cases, background jobs, workers, schedulers, queue consumers, and integrations with external systems. Covers service boundaries and where logic belongs, request validation and authorization placement, transaction boundaries in service code, error taxonomy and failure handling, logging metrics and tracing, background job design, concurrency and idempotency, caching and invalidation, retries with backoff, timeouts, and degrading gracefully when a dependency fails. Triggers on "add a service or handler", "add a background job", "call this external API", "add caching", "this endpoint is slow", or handling a failure from a downstream system. Framework-agnostic - follow whatever the project already uses.
metadata:
  category: domain
  version: "1.1.0"
---

# Backend Engineering

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Layering a request

Each stage has one job. Mixing them is the most common structural defect in server code.

```
Handler/controller  parse, validate shape, map to a call, format the response
        ↓
Service/use case    authorize, orchestrate, own the transaction boundary
        ↓
Domain              business rules and invariants
        ↓
Data access         queries and persistence
        ↓
Infrastructure      external systems, clients, configuration
```

- Handlers MUST NOT contain business rules, and MUST NOT issue queries directly.
- Services MUST NOT know about HTTP status codes, request objects, or response formatting — that coupling makes them unusable from a job, a CLI, or a queue consumer.
- Framework types (request, response, context) SHOULD stop at the handler.

See the `architecture` skill for dependency direction and the `api-design` skill for the wire contract.

## Validation and authorization placement

- **Validate the request shape at the handler**, before any work starts. See the `api-design` skill.
- **Enforce authorization in the service layer**, not only at the route. A route-level check protects one entry point; the same operation invoked from a job, an admin path, or another service bypasses it. Placing the check where the operation lives protects all callers.
- **MUST** check object-level access, not just role. See the `security` skill.

## Transactions

- The **service/use-case layer owns the transaction boundary**, because it knows what constitutes one business operation. Data-access functions should participate in a transaction, not start their own.
- One business operation, one transaction. Do not open several sequential transactions for what must be atomic.
- **NEVER** call an external service, publish a message, or send an email inside an open transaction — the lock is held for the duration of an unbounded network wait, and the side effect cannot be rolled back if the transaction later fails.
- Perform external side effects **after commit**. When they must be reliable, record the intent in the same transaction and dispatch it afterwards from that record — otherwise a crash between commit and dispatch loses the effect silently.

Isolation, locking, and concurrency at the storage level are owned by the `database` skill.

## Errors

Define a small error taxonomy and use it consistently across the service:

| Category | Meaning | Behavior |
|---|---|---|
| Validation | The input is wrong | Reject; never retry |
| Not found | The resource does not exist or is not visible | Reject; never retry |
| Permission | Authenticated but not allowed | Reject; never retry; log the attempt |
| Conflict | State prevents this operation | Reject; the caller may retry after changing state |
| Dependency failure | A downstream system failed | May be retryable — see below |
| Internal | A bug or violated invariant | Never retryable; alert |

Rules:

- Domain and service code SHOULD raise typed, meaningful errors; the handler maps them to transport codes. Do not scatter status codes through business logic.
- **NEVER** swallow an error to keep a path working. Handle it deliberately or let it propagate. See the `clean-code` skill.
- Preserve the cause when wrapping, and add the context the caller lacks (which entity, which operation, which identifier).
- Internal detail MUST NOT reach an external caller — return a stable code, a safe message, and a correlation id. See `api-design`.

## Observability

You cannot operate what you cannot see. For every meaningful operation:

- **Structured logs** as key-value fields, not interpolated prose — they must be searchable and aggregatable.
- **A correlation id** generated at the entry point, attached to every log line, and propagated to downstream calls. Without it, a single request cannot be traced.
- **Log levels used consistently:** `error` for things needing attention, `warn` for degraded-but-handled, `info` for significant business events, `debug` for diagnosis. Logging everything at `error` destroys alerting.
- **NEVER** log credentials, tokens, session ids, full payment details, or personal data beyond what is needed. Redact at the logging layer so a new call site cannot leak by accident.
- **Metrics** for rate, error rate, and duration on every external boundary and expensive operation.
- Health checks that distinguish "process is up" from "dependencies are reachable" — a check that returns healthy while the database is down is worse than none.

## Calling external systems

Every network call fails eventually. Design for that, not around it.

- **MUST** set an explicit timeout on every outbound call. Default client timeouts are frequently infinite, and one hung dependency will exhaust your connection or thread pool.
- **Retry only what is safe to retry:** timeouts, connection failures, 429s, and 5xx. **NEVER** retry a validation error, a permission error, or a non-idempotent write without an idempotency key.
- Use **exponential backoff with jitter** and a bounded attempt count. Fixed-interval retries from many clients synchronize into a thundering herd.
- Respect `Retry-After` when the remote provides it.
- **CONSIDER a circuit breaker** for a dependency whose failures are frequent or costly — retrying into a dead service turns its outage into yours.
- Decide the degraded behavior deliberately: fail the request, serve stale data, queue for later, or omit an optional section. Say which in the code.
- Isolate resources per dependency so one slow integration cannot consume the capacity every other request needs.

## Idempotency and concurrency

- Any operation that can be retried MUST be safe to execute twice. Queue and webhook delivery is at-least-once; duplicates will arrive.
- Deduplicate with an idempotency key, a unique constraint, or a processed-message record — enforced at the database, not by an in-memory check that a second instance does not share. See the `database` skill.
- **NEVER** rely on in-process state (a local lock, a module-level cache, an in-memory counter) for correctness when more than one instance runs. It works in development and fails in production.
- For check-then-act logic, use a conditional write or a database lock rather than reading, deciding, and writing.

## Background jobs

- Move work off the request path when it is slow, retryable, or not needed for the response: sending mail, generating documents, calling slow third parties, bulk processing.
- Jobs MUST be idempotent — they will be retried.
- Pass **identifiers, not whole objects**, in the payload. The job re-reads current state; a serialized snapshot is stale on arrival and breaks when the shape changes.
- **NEVER** enqueue inside a transaction that has not committed — the worker can pick the job up before the row exists.
- Set a bounded retry policy and a dead-letter destination. Silent infinite retries hide failures indefinitely.
- Make jobs resumable or safely restartable; a worker can be killed mid-run at any time.
- Scheduled jobs MUST tolerate overlapping runs, missed runs, and running twice.

## Caching

Whether to cache, and the four questions to answer first, are owned by the `performance` skill. What belongs here is where the cache lives in service code:

- Cache **behind the data-access boundary**, so callers cannot tell whether a value was cached. A cache read scattered through service code is impossible to invalidate reliably.
- **MUST** use a shared cache, not process memory, when more than one instance runs. An in-memory cache is per-instance and produces different answers per request.
- Invalidate in the same code path as the write, so a new write site cannot forget. A cache invalidated from a distant location will be missed.
- **NEVER** cache a value whose key omits the tenant, user, or permission scope. That is a data-exposure defect, not a staleness bug. See the `security` skill.

## Configuration

- Read configuration from the environment through one module; do not scatter environment access through the codebase.
- **Validate configuration at startup and fail immediately** if something required is missing or malformed. A service that starts and fails on the first request is much harder to diagnose.
- Secrets come from the project's secret mechanism, never from source. See the `security` skill.
- No environment-specific branching (`if (env === 'production')`) in business logic — express the difference as configuration values.

## This workspace

- Service methods receive an already-authenticated caller id from the controller and **MUST**
  re-scope every query to it (`WHERE profile.id = $1`), rather than trusting a body field. Route
  guards do not cover object-level access — see `security`.
- Data access is raw SQL through `DatabaseService` (a `pg` pool). Transaction boundaries therefore
  sit in the service, held explicitly with a client checked out of the pool — **NEVER** spread a
  multi-statement business operation across separate pool queries and call it atomic.
- Identity fields come from `users` via an explicit `JOIN`; satellite tables carry domain fields
  only. The `database` skill owns that rule and the `$1` placeholder rule.
- A `try { … } catch (error) { log; throw error; }` wrapper that adds no context is noise. Either
  attach the context the caller lacks (which record, which operation) or let it propagate — see
  `clean-code`.

## Related skills

- `architecture` — layer boundaries and dependency direction.
- `api-design` — the contract in front of these services.
- `database` — transactions, queries, concurrency at the storage layer.
- `performance` — measuring before caching or parallelizing.
- `frameworks/laravel`, `frameworks/nestjs` — framework-specific service and job rules.
- `security` — authorization, secrets, safe logging.
