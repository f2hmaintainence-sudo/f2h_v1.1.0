---
name: fastapi
description: Use when working in a FastAPI or modern async Python backend - adding routes, routers, Pydantic models, dependencies, background tasks, or database access. Covers project layout by feature, Pydantic v2 model and settings patterns, separating request and response models from ORM models, dependency injection and its scope, async correctness including the blocking-call trap, async SQLAlchemy sessions and transaction boundaries, authorization placement, exception handlers and error shape, and testing with the async test client. Triggers on fastapi or pydantic in the project requirements or pyproject, an APIRouter, a path operation decorator, Depends, or async def endpoints. Load with api-design for contracts and backend-engineering for service-layer rules.
compatibility: For FastAPI with Pydantic v2. Verify version-specific APIs against the project's lockfile and the FastAPI and Pydantic documentation for those versions.
metadata:
  category: framework
  version: "1.0.0"
---

# FastAPI

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against FastAPI 0.141.x (requires Python 3.10+), Pydantic 2.13.x, and SQLAlchemy 2.0.x as of 2026-08-11.

**MUST** read the project's lockfile (`uv.lock`, `poetry.lock`, or a pinned `requirements.txt`) for the actual versions. **Pydantic v1 and v2 are substantially different APIs** — confirm which the project uses before writing a model. The v2 names are `model_validate`, `model_dump`, `model_dump_json`, `field_validator`, `model_validator`, `ConfigDict`, and `Field(...)`; the v1 equivalents (`parse_obj`, `dict`, `validator`, inner `class Config`) are removed or deprecated in v2.

FastAPI is pre-1.0 and its minor versions can carry behavior changes. Check the release notes when something version-sensitive matters.

## Detect before writing

- `pyproject.toml` or requirements — FastAPI, Pydantic major version, ORM, migration tool (Alembic), task queue, settings library.
- The package layout: flat modules, or a package per feature.
- `main.py` or the app factory — registered routers, middleware, exception handlers, lifespan setup. **These are already applied; do not duplicate them per route.**
- Two or three existing routers and their schema modules.
- Whether the codebase is sync, async, or mixed — and whether the database driver matches.
- `tests/` — the existing client fixture and async test setup.

## Structure

Organize by feature, with schemas, routes, and service logic co-located:

```
app/
  main.py                 app creation, router registration, lifespan
  core/
    config.py             settings
    security.py           auth primitives
  api/
    deps.py               shared dependencies
  orders/
    router.py             APIRouter, path operations
    schemas.py            Pydantic request/response models
    service.py            use cases
    models.py             ORM models
  db/
    session.py            engine and session factory
```

- **MUST** group path operations into an `APIRouter` per feature and register them on the app. A single module of every route does not survive growth.
- Set the prefix, tags, and shared dependencies on the router rather than repeating them on each operation.
- Naming follows PEP 8 — `snake_case` modules and functions, `PascalCase` classes. See the `naming-conventions` skill.

## Pydantic models

- **MUST** define separate models for request input and response output. A single model used for both exposes fields the client must not set and returns fields it must not see.
- **NEVER** use an ORM model as a request body. It accepts every column as writable input and couples the wire contract to the schema. See the `api-design` skill.
- Declare the `response_model` on each path operation. It filters the response to the declared fields — which is what prevents a service from accidentally returning a password hash or an internal flag.
- Use `Field` for constraints (length, range, pattern) and descriptions. Constraints in the model are enforced automatically and documented automatically.
- Use `field_validator` and `model_validator` for validation that spans fields. **NEVER** perform I/O inside a validator.
- Mark server-owned fields read-only or leave them out of the request model, populating them from the authenticated principal (see `security`).
- Keep response models flat and explicit. Returning a nested ORM graph serializes more than intended and triggers lazy loads.

**Settings**: load configuration through a Pydantic settings model and **validate it at import or startup**, so a missing variable fails immediately rather than on first request. **NEVER** read `os.environ` scattered through the codebase. Secrets come from the environment or a secret manager — see the `security` skill.

## Async correctness

This is where FastAPI applications most often break under load.

- **NEVER call a blocking function inside an `async def` path operation or dependency.** A synchronous database driver, `requests`, `time.sleep`, or heavy CPU work blocks the event loop and stalls **every** concurrent request, not just the current one. The symptom is an application that is fast in development and collapses under concurrency.
- If the work is blocking and cannot be made async, either declare the path operation as plain `def` — FastAPI runs it in a threadpool — or offload it explicitly to a threadpool or worker.
- **MUST** match the driver to the style: an async endpoint needs an async database driver and an async HTTP client. Mixing a sync driver into async code is the most common form of this defect.
- **NEVER** mix sync and async sessions for the same unit of work.
- Background tasks run in the same process after the response is sent. Use them for short, non-critical work. **NEVER** use them for work that must not be lost — a process restart discards it. Use a real queue. See the `backend-engineering` skill.

## Dependencies

- Use `Depends` for shared setup: sessions, current user, pagination parameters, permission checks. It makes the requirement explicit and substitutable in tests.
- **MUST** provide the database session as a dependency that closes it, so a session cannot leak on an error path.
- Attach authentication to the router or app as a dependency rather than repeating it per operation, so a new route cannot be added without it.
- **Route-level dependencies protect one entry point.** Object-level authorization — "may this user see *this* order" — belongs in the service layer, which every caller passes through. See the `security` skill.
- Scope the query rather than filtering after the fetch: `where(Order.id == id, Order.tenant_id == tenant_id)`.
- Dependency overrides are the correct way to substitute a dependency in tests.

## Database

- **The service layer owns the transaction boundary.** Commit once per business operation, not per repository call.
- **NEVER** perform an external HTTP call or publish a message inside an open transaction. Do it after commit.
- Eager-load relationships you will access. A relationship touched per item in a loop is an N+1, and in async SQLAlchemy an unexpected lazy load raises rather than silently querying. See the `performance` skill.
- Use the project's migration tool for every schema change; never alter a schema out of band. See the `database` skill.
- Select the columns you need on wide tables rather than whole entities.

## Errors

- Raise `HTTPException` from the route layer. Raise **domain exceptions from the service layer** and map them centrally with an exception handler — a service that raises `HTTPException` cannot be reused from a worker or a CLI.
- **NEVER** let a stack trace, ORM error, or SQL fragment reach a client; the handler maps it to the project's standard payload (see `api-design`).
- Register one handler for validation errors if the project needs a consistent shape; the default differs from most hand-written error formats.

## Testing

- Use the framework's test client with the project's existing fixtures. For async endpoints and an async database, use an async client and an async test session.
- **MUST** override the database and authentication dependencies rather than reaching into internals. That is what the override mechanism exists for.
- Test through the HTTP layer for validation, authorization, and response shape — these bypass unit tests entirely. Test service logic directly for business rules.
- Assert authorization failures, not only success paths.
- Substitute external HTTP calls; never reach a real service in a test. See the `testing` skill.

## Validation gates

Typically some of the following — confirm against `pyproject.toml` and the CI configuration:

```
ruff format --check .
ruff check .
mypy .            (or pyright)
pytest
```

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Blocking call inside `async def` | Async driver, or plain `def`, or offload |
| Sync database driver in an async endpoint | Match driver to style |
| ORM model used as a request body | Separate request schema |
| One model for request and response | Separate them |
| Missing `response_model` | Declare it; it filters output |
| Pydantic v1 idioms in a v2 project | `model_validate`, `model_dump`, `field_validator`, `ConfigDict` |
| `os.environ` read throughout the code | A validated settings model |
| Config failing on first request rather than startup | Validate at startup |
| Session created inline in a route | A dependency that closes it |
| Authorization only in a route dependency | Enforce object-level access in the service |
| `HTTPException` raised from a service | Domain exception, mapped centrally |
| Background task for work that must not be lost | A real queue |
| I/O inside a Pydantic validator | Validate only; fetch elsewhere |
| Relationship accessed per item in a loop | Eager-load |
| Every route in one module | An `APIRouter` per feature |

## Related skills

- `api-design` — contracts, status codes, pagination, versioning.
- `backend-engineering` — transactions, queues, retries, observability.
- `database` — schema, migrations, query cost.
- `security` — authorization, validation, secrets.
- `naming-conventions` — PEP 8 naming.
