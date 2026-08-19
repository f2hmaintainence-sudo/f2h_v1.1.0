---
name: django
description: Use when working in a Django or Django REST Framework project - adding apps, models, migrations, views, serializers, forms, admin, management commands, or Celery tasks. Covers app boundaries and where business logic belongs, ORM query cost and N+1 prevention with select_related and prefetch_related, migration safety, settings and secret handling, object-level permissions in DRF, serializer separation from models, transaction boundaries and on_commit, signals and their hazards, and testing with the test client. Triggers on django or djangorestframework in the requirements or pyproject, manage.py, settings.py, models.py, serializers.py, views.py, or any file under a migrations directory. Load with api-design for contracts and database for schema rules.
compatibility: For Django projects, with notes for Django REST Framework. Verify version-specific behavior against the project's lockfile and the Django documentation for that version.
metadata:
  category: framework
  version: "1.0.0"
---

# Django

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against Django 6.1 (requires Python 3.12+) and Django REST Framework 3.18.x as of 2026-08-11.

**MUST** read the project's lockfile or pinned requirements for the actual Django version, and check whether DRF, Django Ninja, or plain Django views are in use. Django deprecates on a published schedule; check the release notes for the installed version when something looks version-sensitive.

## Detect before writing

- Requirements or `pyproject.toml` — Django version, DRF, Celery, settings library, database backend.
- The settings layout: a single `settings.py`, a settings package with per-environment modules, or environment-driven configuration.
- `INSTALLED_APPS` — the existing apps and how they are named and scoped.
- Whether the project keeps logic in views, in model methods, in a service layer, or in DRF serializers.
- Two or three existing models, views, and serializers near your change.
- `tests/` — the existing test style and fixture or factory approach.

## Apps and structure

- An app is a **bounded feature**, not a layer. `orders`, `billing`, `accounts` — not `models`, `views`, `utils`.
- **MUST** follow the project's existing app granularity. Adding a new app to a project with three large ones, or a fourth model to a project of small focused apps, both break consistency.
- Create apps with `startapp` so the layout matches the framework's expectations.
- Naming follows PEP 8 for modules and `PascalCase` for models; model classes are singular (`Order`), tables are derived. See the `naming-conventions` skill.

## Where logic belongs

```
urls.py          routing only
views / viewsets translate request, call one thing, return a response
serializers      validation and representation (DRF)
forms            validation and representation (server-rendered)
services         use cases, transaction boundaries
models           fields, relationships, invariants, queryset methods
managers         reusable query logic
```

- **Fat views are the characteristic Django defect.** A view that validates, queries, decides, writes, and formats is doing five jobs. Extract the use case.
- Business rules belong on the model, in a manager or queryset method, or in a service — never only in a view or a serializer, because neither is reachable from a management command or a task.
- **NEVER** put business logic in a template or in `admin.py`.
- Custom queryset and manager methods are the idiomatic home for reusable query logic. Use them instead of repeating filter chains.

## ORM and query cost

The ORM makes expensive access invisible at the call site. This is the highest-value area to get right.

- **N+1 queries are the default failure mode.** Use `select_related` for forward single-valued relationships (join) and `prefetch_related` for reverse and many-to-many relationships (second query). Without them, iterating a queryset and touching a relation issues one query per row.
- Reach for `only`, `defer`, and `values`/`values_list` on wide tables and large result sets.
- Use `annotate` and `aggregate` to compute in the database. **NEVER** load a queryset into Python to sum, count, or filter it.
- Querysets are lazy and **re-evaluate on each iteration**. Assigning to a variable and iterating twice runs the query twice; wrap in `list()` when reusing.
- `count()` issues a query; truthiness evaluates the queryset. Use `exists()` for a presence check.
- **NEVER** fetch unbounded querysets. Paginate list views; use `iterator()` for large batch reads.
- Use `bulk_create` and `bulk_update` for batches instead of saving in a loop — but know that `bulk_create` skips `save()` and signals.
- **MUST** verify a query change with the actual SQL and query count, not by assumption. See the `performance` and `database` skills.

**Concurrency:** **NEVER** implement a counter or balance as read-modify-write. Use `F()` expressions for atomic updates, `select_for_update()` inside a transaction where you must lock, and `get_or_create`/`update_or_create` plus a database unique constraint rather than check-then-insert.

## Migrations

- **MUST** generate migrations with `makemigrations` and commit them. A model change without its migration breaks every other environment.
- **MUST** review the generated migration before committing. `makemigrations` guesses on renames and can produce a destructive operation.
- **NEVER** edit a migration that has already been applied anywhere. Write a new one.
- Adding a non-nullable field to a populated table requires a default or a data migration. Use `RunPython` with a reverse function for data migrations.
- Renaming or dropping a field requires expand-and-contract when old and new code run together during a deploy. See the `database` and `devops-docker-cicd` skills.
- Be aware which operations lock the table on your database backend; an index build or column rewrite on a large table can block writes for a long time.
- **NEVER** run `migrate --fake`, `flush`, or a squash against a shared database without explicit authorization.

## Settings and secrets

- **NEVER** commit `SECRET_KEY`, database passwords, or API credentials. Read them from the environment.
- **NEVER** ship `DEBUG = True` to a deployed environment. It exposes settings, SQL, and stack traces to anyone who triggers an error.
- **MUST** set `ALLOWED_HOSTS` explicitly. Follow the project's existing pattern for per-environment settings rather than adding a second mechanism.
- Keep security middleware and settings enabled — CSRF, clickjacking, secure cookies, HSTS where configured. **NEVER** disable CSRF protection to make a request work; fix the request. See the `security` skill.
- `manage.py check --deploy` reports common misconfigurations; run it when changing settings.

## DRF

- **MUST** define separate serializers for input and output where they differ. A single serializer used for both exposes writable fields the client must not set.
- **NEVER** use `fields = '__all__'` on a model serializer. It publishes every current and future field, so adding a column silently adds it to the API. List fields explicitly.
- Mark derived and server-owned fields read-only, and derive ownership from the authenticated user rather than the payload.
- **MUST** set a default permission class project-wide and override deliberately. A view added without a permission class inherits whatever the default is — make that default restrictive.
- **Permission classes handle coarse access. Object-level access requires either `get_queryset` scoped to the user or an object permission check** — a detail view that looks up by primary key without scoping will return another tenant's record. Scope in `get_queryset` so every action inherits it.
- **MUST** configure default pagination. An unpaginated list endpoint is both a performance and an availability defect.
- Validate in the serializer (`validate_<field>`, `validate`), not in the view.
- Use `select_related`/`prefetch_related` in `get_queryset` — nested serializers are a common N+1 source.

## Transactions, signals, and tasks

- Wrap a multi-write business operation in `transaction.atomic`. **NEVER** perform an external call, send mail, or enqueue a task inside an open transaction.
- **MUST** use `transaction.on_commit` to dispatch tasks and side effects, so a worker cannot pick up a job before the row is committed — and so a rollback does not leave the side effect behind.
- **Signals are implicit control flow.** Prefer an explicit service call. When a signal is genuinely right, keep it small and never rely on ordering between signal receivers. Remember `bulk_create`, `update()`, and `delete()` on a queryset bypass `save`/`delete` signals entirely.
- Celery or equivalent tasks MUST be idempotent, take identifiers rather than model instances, and have a bounded retry policy. See the `backend-engineering` skill.

## Testing

- Use the project's existing base test class and client. Prefer factories over fixtures for test data.
- Test through the client for routing, permissions, validation, and response shape; test services and model methods directly for business rules.
- **MUST** assert permission denials, not only success paths.
- Assert query counts on list endpoints where N+1 regressions matter — the framework provides an assertion for this and it is the only reliable guard.
- Substitute external calls, mail, and storage rather than reaching real services.

## Validation gates

Typically some of the following — confirm against the project and CI:

```
ruff format --check .   (or black --check .)
ruff check .
mypy .                  if configured
python manage.py makemigrations --check --dry-run   fails if a migration is missing
python manage.py test   (or pytest)
```

`makemigrations --check --dry-run` is worth running on any model change; it catches the missing-migration defect before CI does.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Relation accessed per row in a loop | `select_related` / `prefetch_related` |
| Loading a queryset into Python to sum or filter | `annotate`, `aggregate`, or filter in the query |
| `if queryset.count():` for a presence check | `exists()` |
| Saving in a loop | `bulk_create` / `bulk_update` |
| Read-modify-write on a counter | `F()` expression or `select_for_update` |
| `fields = '__all__'` on a serializer | List fields explicitly |
| Detail view looking up by pk without scoping | Scope `get_queryset` to the user |
| No default permission class | Set a restrictive default project-wide |
| Unpaginated list endpoint | Configure default pagination |
| Business logic in a view or template | Model method, manager, or service |
| Model change committed without its migration | `makemigrations`, and check in CI |
| Editing an applied migration | Write a new one |
| Task enqueued inside an open transaction | `transaction.on_commit` |
| Disabling CSRF to fix a failing request | Fix the request |
| `DEBUG = True` in a deployed environment | Never |
| Secrets in `settings.py` | Read from the environment |
| Relying on signal ordering | Explicit service call |

## Related skills

- `api-design` — contracts, errors, pagination, versioning.
- `database` — schema, migrations, indexes, transactions.
- `backend-engineering` — services, tasks, observability.
- `security` — authorization, CSRF, secrets, exposure.
- `performance` — measuring query cost.
