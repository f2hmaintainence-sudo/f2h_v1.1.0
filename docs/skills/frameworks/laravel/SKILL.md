---
name: laravel
description: Use when working in a Laravel or PHP application - adding routes, controllers, form requests, Eloquent models, migrations, policies, jobs, events, commands, or Blade views. Covers the real default directory layout, where validation and authorization belong, Eloquent relationship and N+1 handling, mass assignment safety, queue and job design, migration safety, config and environment access, and Pest or PHPUnit testing. Triggers on composer.json containing laravel/framework, artisan, Eloquent, Blade, or any file under app/, routes/, or database/migrations/. Load together with the naming-conventions skill for PSR-4 and Laravel naming, and with security for mass assignment and authorization rules.
compatibility: For Laravel applications. Verify version-specific structure against the project's composer.lock and the Laravel documentation for that version.
metadata:
  category: framework
  version: "1.0.0"
---

# Laravel

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against Laravel 13.x (latest stable 13.24.0, requires PHP 8.3+) on 2026-08-11.

**MUST** determine the project's actual version from `composer.json` and `composer.lock` before relying on any structural claim here. Laravel's skeleton changed substantially across recent majors — notably the removal of `app/Http/Kernel.php` and `app/Console/Kernel.php` in favour of configuration in `bootstrap/app.php`. When behavior looks version-sensitive, check the documentation for that version rather than assuming.

## Detect before writing

**MUST** inspect before adding anything:

- `composer.json` — Laravel version, PHP version, packages already installed (Sanctum, Horizon, Livewire, Filament, Inertia, Telescope).
- `app/` — which directories actually exist, and whether the project uses `Services/`, `Actions/`, `Repositories/`, or puts logic in controllers.
- `routes/` — which route files exist and how routes are grouped and named.
- `bootstrap/app.php` — middleware, exception handling, and routing wiring.
- Two or three existing controllers, form requests, and models near your change.
- `tests/` — whether the project uses Pest or PHPUnit.

## Directory structure

The framework's real default `app/` contains only **`Http`, `Models`, and `Providers`**. Every other directory (`Console`, `Events`, `Jobs`, `Listeners`, `Mail`, `Notifications`, `Policies`, `Rules`, `Exceptions`, `Broadcasting`) is created on demand by the corresponding `make:` command and **does not exist until then**.

`routes/` ships with `web.php` and `console.php`. `api.php` and `channels.php` are installed by `php artisan install:api` and `php artisan install:broadcasting`.

Consequences:

- **NEVER** assume `app/Services/`, `app/Actions/`, `app/Repositories/`, or `app/DTOs/` exists. Those are community conventions, not framework defaults. Use them only if the project already does.
- **SHOULD** create classes with the `make:` Artisan commands rather than by hand. They place the file correctly, apply the right namespace, and follow current framework conventions. Run `php artisan list make` to see what is available.
- **NEVER** invent a parallel structure alongside a coherent existing one. A project with `app/Actions/` should get another action, not its first service.

Naming and PSR-4 path rules are owned by the `naming-conventions` skill; its ecosystem reference covers Eloquent, migration, and PSR-4 naming in detail.

## Where logic belongs

```
routes/          route definition and naming only
Middleware       cross-cutting request concerns
Form Request     validation and request-level authorization
Controller       translate request, call one thing, return a response
Action/Service   the use case; owns the transaction boundary
Model            relationships, casts, scopes, accessors
Policy           per-model authorization decisions
Job              deferred work
Resource         response shaping
```

- **Controllers SHOULD stay thin.** A controller that validates, decides, queries, and formats is doing four jobs. Extract the use case into the project's existing service or action layer.
- **NEVER** put business rules in a Blade template, a route closure, or a model accessor that performs I/O.
- Fat models are acceptable in Laravel for relationships, casts, and scopes. They are not the place for cross-aggregate orchestration or external calls.

See the `architecture` and `backend-engineering` skills for the general layering rules.

## Validation

- **MUST** validate through a Form Request (`php artisan make:request`) or `$request->validate()`. Never read raw request input into a write path unvalidated.
- **MUST** use `$request->validated()`, not `$request->all()`, when creating or updating a model. `all()` is how unexpected fields reach the database.
- Put `authorize()` logic in the Form Request when it concerns this request, and in a Policy when it concerns a model.
- Custom rules belong in `app/Rules/` via `make:rule`, not duplicated as closures across requests.

## Mass assignment

This is Laravel's most common serious security defect.

- **MUST** define `$fillable` on every model that is created or updated from request data.
- **NEVER** set `$guarded = []`. That disables mass assignment protection entirely and lets any request field write any column — including `is_admin`, `role`, `balance`, or `user_id`.
- **NEVER** pass `$request->all()` into `create()`, `fill()`, `update()`, or `forceFill()`.
- Derive ownership and privilege server-side: `$request->user()->orders()->create($validated)`, not a `user_id` from the payload.

See the `security` skill for the general rule.

## Authorization

- **MUST** enforce authorization on every route that touches a resource. A route added without a check inherits nothing from its neighbours.
- Use Policies (`make:policy`) for per-model decisions, and Gates for non-model abilities. Call them via `authorize()`, `can()`, or the `can` middleware.
- **MUST** check ownership, not just role. Scope queries to the authenticated user (`$user->orders()->findOrFail($id)`) so an unauthorized id cannot be fetched at all.
- Blade's `@can` controls display only. It is not enforcement.

## Eloquent

- **N+1 queries are the default failure mode.** Eager-load with `with()` when you will access a relation on a collection. Enable strict lazy-loading prevention in local and test environments so the problem surfaces during development rather than in production.
- Select the columns you need on wide tables; avoid loading large text or JSON columns into a list view.
- **NEVER** filter, sort, or aggregate in PHP what the database can do in SQL. Loading a table into a collection to filter it does not scale.
- Use `chunk()`, `chunkById()`, `lazy()`, or `cursor()` for large result sets. Never `all()` on a growing table.
- Use `whereBelongsTo`, relationship methods, and query scopes rather than reconstructing joins by hand.
- Accessors and casts belong on the model. **NEVER** perform a query or an HTTP call inside an accessor — it turns property access into hidden I/O.
- Prefer `firstOrCreate`/`updateOrCreate` plus a database unique constraint over check-then-insert, which races.

Query cost, indexes, and plans: see the `database` and `performance` skills.

## Migrations

- **MUST** use `make:migration` and never edit a migration that has already run in any shared environment. Write a new one.
- Declare foreign keys, unique constraints, and indexes in the migration, not only in application validation.
- Adding a non-nullable column to a populated table requires a default or a backfill. A bare `NOT NULL` add will fail or lose rows.
- Renaming or dropping a column requires the expand-and-contract sequence — see the `database` skill.
- `migrate:fresh` and `migrate:refresh` **destroy all data**. **NEVER** run them against a shared or production database. Local only.
- Seeders and factories are for development and tests. Never make application behavior depend on seeded data.

## Queues and jobs

General job design — idempotency, retry policy, and dead-lettering — is owned by the `backend-engineering` skill. Laravel-specific rules:

- **Pass identifiers, not models with loaded relations.** Laravel serializes models by key and re-resolves them, so a queued job sees current state; passing large payloads or relying on a serialized snapshot is fragile.
- **NEVER** dispatch inside a transaction that has not committed — the worker can pick the job up before the row exists. Use `dispatch()->afterCommit()` or the queue's `after_commit` configuration.
- Set `$tries`, `$backoff`, and `$timeout` deliberately, and handle `failed()`. Unbounded retries hide failures.
- Scheduled tasks defined in `routes/console.php` MUST tolerate overlapping and missed runs. Use `withoutOverlapping()` where relevant.

## Configuration and environment

- **MUST** read configuration through `config()`, never `env()` outside `config/` files. Configuration caching in production makes `env()` return null at runtime — this is a real and frequent production outage.
- Add new settings to a `config/` file that reads `env()` with a sensible default, then read the config key everywhere else.
- **NEVER** commit `.env`. Update `.env.example` with a placeholder whenever you add a variable.
- Secrets come from the environment or a secret manager. See the `security` skill.

## Testing

- **MUST** match the project's existing framework — Pest or PHPUnit — and its existing test style. Both are shipped; do not introduce the other.
- Feature tests through the HTTP layer are the highest-value tests in a Laravel application: they cover routing, middleware, validation, authorization, and the response shape together.
- Use `RefreshDatabase` for tests that touch the database, and factories for test data. Never depend on a shared seeded database.
- Fake external boundaries with the framework's own fakes (`Queue::fake()`, `Mail::fake()`, `Event::fake()`, `Http::fake()`, `Storage::fake()`) rather than hand-rolled mocks.
- Assert authorization failures, not only success paths.
- Run with `php artisan test`, or the project's configured command.

See the `testing` skill for what to test.

## Validation gates

Run what the project actually configures, which is usually some of:

```
./vendor/bin/pint --test        code style
./vendor/bin/phpstan analyse    static analysis, if configured
php artisan test                tests
```

Check `composer.json` scripts and the CI configuration for the authoritative list.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| `$guarded = []` | Define `$fillable` |
| `Model::create($request->all())` | `create($request->validated())` |
| `env()` outside `config/` | `config('key')` |
| Business logic in a route closure or Blade | A service, action, or controller-called use case |
| Lazy-loading a relation inside a loop | `with()` eager load |
| `Model::all()` on a growing table | Paginate, chunk, or cursor |
| Filtering a collection in PHP that SQL could filter | Do it in the query |
| Editing an already-run migration | Write a new migration |
| `migrate:fresh` on a shared database | Local only |
| Dispatching a job inside an uncommitted transaction | `afterCommit()` |
| Query or HTTP call inside an accessor | Load it explicitly |
| Inventing `app/Services/` in a project using `app/Actions/` | Follow the existing structure |
| Adding a package for something Laravel ships | Check the framework first |

## Related skills

- `naming-conventions` — PSR-4, Eloquent, and migration naming.
- `security` — mass assignment, authorization, secrets.
- `database` — schema, indexes, migration safety.
- `backend-engineering` — transactions, jobs, observability.
- `api-design` — resource responses and error shape.
