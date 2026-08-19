---
name: nestjs
description: Use when working in a NestJS application - adding or changing modules, controllers, providers, DTOs, guards, interceptors, pipes, filters, or repositories. Covers module boundaries and circular imports, dependency injection scope and tokens, validation with DTOs at the boundary, where authorization belongs, exception filters and error shape, transaction handling, configuration validation at startup, and testing modules in isolation. Triggers on package.json containing @nestjs/core, on files matching the controller, service, module, dto, guard, interceptor or pipe suffixes, or on decorators such as Injectable, Controller and Module. Load with naming-conventions for the file suffix convention and with backend-engineering for service-layer rules.
compatibility: For NestJS applications. Verify version-specific behavior against the project's package-lock and the NestJS documentation for that major version.
metadata:
  category: framework
  version: "1.0.0"
---

# NestJS

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against NestJS 11.x (latest `@nestjs/core` 11.1.29) on 2026-08-11.

**MUST** read the project's `package.json` for the NestJS major version, the HTTP adapter (Express or Fastify), the ORM (TypeORM, Prisma, Mongoose, Drizzle), and the validation stack before writing code. Adapter and ORM choice changes the correct answer for request objects, transactions, and testing.

## Detect before writing

- `package.json` — Nest version, adapter, ORM, validation library, testing setup.
- `src/` — the module tree and whether it is organized by feature (the norm) or by layer.
- `main.ts` — global pipes, filters, interceptors, prefix, versioning, CORS. **These are already applied; do not duplicate them per controller.**
- `app.module.ts` — configuration loading, global modules, database wiring.
- Two or three existing modules near your change: their controller, service, DTOs, and spec.

## Module structure

One module per feature, co-locating its controller, providers, DTOs, and entities. This is the convention the CLI generates and the one to follow:

```
src/orders/
  orders.module.ts
  orders.controller.ts
  orders.service.ts
  orders.service.spec.ts
  dto/create-order.dto.ts
  dto/update-order.dto.ts
  entities/order.entity.ts
```

- **SHOULD** generate with the Nest CLI (`nest g module orders`, `nest g resource orders`). It places files correctly, registers the module, and applies current conventions.
- A module's providers are **private unless exported**. To use a service in another module, export it from its own module and import that module — never reach into another module's file directly to bypass DI.
- **NEVER** create a circular import between modules. It is a boundary error: extract the shared concept into its own module, or move the code to the side that owns it. `forwardRef` makes a cycle work; it does not make it correct, and it should be a last resort with a comment explaining why.
- Cross-cutting infrastructure (config, database, logging) belongs in a module marked global or imported explicitly — follow whichever the project does.

File and class naming, including the suffix convention: see the `naming-conventions` skill.

## Dependency injection

- **MUST** inject dependencies through the constructor. **NEVER** instantiate a provider with `new` inside another provider — it bypasses DI, lifecycle, and testing.
- Use a class as its own token where possible. For interfaces and non-class values, define an exported token constant and inject it explicitly; do not scatter string literals.
- Providers default to singleton scope. **Request-scoped providers propagate up the whole injection chain** and carry a real performance cost — use them only when a per-request value genuinely cannot be passed as an argument.
- **NEVER** store request-specific state on a singleton provider. It leaks between concurrent requests. This is the most common correctness defect in Nest services.

## Validation

- **MUST** define a DTO class per request shape and validate it at the boundary. A DTO without validation decorators validates nothing.
- The global validation pipe MUST be configured to strip unknown properties and reject them; otherwise unexpected fields flow into your service and potentially into the database. Check `main.ts` — if `whitelist` and `forbidNonWhitelisted` are already set, do not weaken them.
- Enable implicit conversion deliberately: route and query parameters arrive as strings, and a DTO expecting a number receives a string without it.
- **NEVER** reuse an entity as a request DTO. It exposes every column as a writable input and couples the wire contract to the schema.
- Separate create and update DTOs. Deriving the update DTO from the create DTO with a partial helper is the conventional approach.
- Omit server-owned fields from the DTO entirely rather than accepting and ignoring them (see `security`).

## Authorization

- Guards are the right mechanism for authentication and coarse authorization. **MUST** apply them to every protected route.
- **Route-level guards protect one entry point.** Object-level checks — "may this user see *this* order" — belong in the service, where every caller passes through them, including jobs and other services. See the `security` skill.
- Scope the query rather than filtering after the fetch: `where: { id, tenantId }`, not fetch-then-compare.
- Prefer a metadata-driven guard (a roles or permissions decorator read by one guard) over duplicating checks across controllers.

## Errors

- Throw Nest's HTTP exceptions from the controller layer, and **domain-meaningful exceptions from the service layer**. A service that throws `BadRequestException` cannot be reused from a queue consumer or a CLI command.
- Map domain exceptions to HTTP responses in one exception filter, so the error shape is defined in a single place.
- **NEVER** let an internal message, stack trace, ORM error, or SQL fragment reach a client; the filter returns the project's standard payload (see `api-design`).
- Unhandled promise rejections in an interceptor or a listener will not surface as HTTP errors. Handle them explicitly.

## Data access and transactions

- Keep ORM queries in a repository or service, not in a controller.
- **The service owns the transaction boundary**, because it knows what constitutes one business operation. Use the ORM's transaction mechanism and pass the transactional context through, rather than opening a second connection.
- **NEVER** perform an external HTTP call, queue publish, or email send inside an open transaction. Do it after commit. See the `backend-engineering` skill.
- Eager-load relations you will use; a relation accessed per item in a loop is an N+1. See the `performance` skill.

## Configuration

- **MUST** load configuration through the project's config module and **validate it at startup**, failing immediately if something required is missing or malformed. A service that boots and fails on first request is far harder to diagnose.
- **NEVER** read `process.env` directly outside the configuration layer.
- Secrets come from the environment or a secret manager, never from source. See the `security` skill.

## Lifecycle and shutdown

- Use the lifecycle hooks for setup and teardown rather than doing work in a constructor. A constructor that opens a connection makes the class untestable.
- Enable shutdown hooks and close connections, consumers, and timers on shutdown. Without this, in-flight work is dropped on deploy.
- Health checks SHOULD distinguish "process is up" from "dependencies are reachable".

## Testing

- **Unit test providers directly** by constructing them with substituted dependencies. This is faster and clearer than building a testing module for a class with two dependencies.
- Use the testing module when you need the DI graph — overriding a provider is the correct way to substitute a dependency, not reaching into the module.
- **End-to-end tests through the real HTTP layer** are the highest-value Nest tests: they exercise pipes, guards, interceptors, and filters together, which unit tests bypass entirely. Global pipes and guards are not applied in a bare unit test, so validation and authorization bugs only appear here.
- Match the project's existing spec file convention and test runner.

## Validation gates

Typically some of the following — confirm against `package.json` scripts and CI:

```
npm run lint
npm run build          tsc must pass
npm run test
npm run test:e2e
```

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| `new SomeService()` inside a provider | Constructor injection |
| Request state stored on a singleton provider | Pass it as an argument |
| Entity used as a request DTO | A dedicated DTO with validation |
| DTO with no validation decorators | Add them, or it validates nothing |
| Weakening the global validation pipe to make a payload pass | Fix the payload or the DTO |
| `forwardRef` to resolve a module cycle | Extract the shared concept |
| Authorization only in a route guard | Enforce object-level access in the service |
| HTTP exceptions thrown from a service | Domain exceptions, mapped in a filter |
| ORM error or stack trace returned to the client | Stable code plus correlation id |
| `process.env` read throughout the codebase | The configuration layer |
| Config missing at runtime rather than startup | Validate config on boot |
| External call inside an open transaction | After commit |
| Only unit tests for a validated, guarded endpoint | Add an end-to-end test |

## Related skills

- `naming-conventions` — file suffixes and class naming.
- `backend-engineering` — layering, transactions, retries, observability.
- `api-design` — contracts, error shape, pagination.
- `security` — authorization, validation, secrets.
- `testing` — what to cover and at which level.
