---
name: database
description: Use when designing or changing a schema, writing a migration, writing or optimizing queries, or handling transactions and data integrity. Covers schema and relationship design, constraints as the last line of integrity, indexing and query cost, N+1 access patterns, pagination, transaction boundaries and isolation, concurrency and lost updates, and migrations that preserve existing data and deploy safely. Triggers on "add a table/column/index", "write a migration", "this query is slow", "add a relationship", schema or model file edits, ORM query changes, or any operation that reads or writes production data. Also use before any destructive data operation, which requires explicit authorization.
metadata:
  category: domain
  version: "1.0.0"
---

# Database

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Before changing anything

**MUST** first: read the existing schema or model definitions, read the migration directory to learn the project's migration tool and conventions, and read two or three existing queries near your change.

Follow the project's existing naming (singular versus plural tables, `snake_case` versus `camelCase`, id and foreign-key conventions, timestamp columns). A schema with two naming conventions is permanently confusing.

## Production data

**NEVER** run a destructive or irreversible operation against production data without explicit authorization for that specific operation: dropping a table or column, deleting or updating rows without a narrow `WHERE`, truncating, resetting a database, or running a migration directly against production by hand.

When such an operation is genuinely required, state exactly what it will affect, how many rows, and whether it is reversible — then wait. Confirm a backup or restore path exists first.

For any bulk write: run it as a `SELECT` first, verify the row count, then convert to the write inside a transaction.

## Schema design

- Model what the domain actually is. Do not shape tables around one screen or one endpoint — those change more often than the data does.
- Choose the narrowest correct type. Use the database's native types for timestamps, booleans, decimals, JSON, and enumerations rather than storing everything as text.
- **Money MUST NOT use floating point.** Use a decimal type or integer minor units, and store the currency alongside it.
- **Timestamps SHOULD be stored in UTC** with an explicit time zone-aware type. Convert at the presentation boundary.
- Prefer `NOT NULL` with a sensible default. Nullable columns force every reader to handle absence; make nullability mean something specific.
- Avoid a JSON column for data you will filter, join, or aggregate on. Use it for genuinely unstructured or caller-defined payloads.
- Give status and type columns a constrained set of values (native enum or a check constraint), not open text.

## Constraints

Constraints are the last line of integrity — they hold even when application code is wrong, a second service writes, or someone runs a manual script.

**SHOULD** declare in the database:

- Primary keys on every table.
- Foreign keys with a deliberate `ON DELETE` behavior (`RESTRICT`, `CASCADE`, or `SET NULL` — choose it consciously; the default is rarely what you want).
- Unique constraints on anything that must be unique. Application-level uniqueness checks are racy: two concurrent requests both see "not taken" and both insert.
- Check constraints for invariants the data must always satisfy.
- `NOT NULL` wherever absence is not meaningful.

Application-level validation is for good error messages. Database constraints are for correctness. **Do both** — see the `api-design` skill for the message layer.

## Indexes and query cost

- Index the columns you filter, join, and sort on — foreign keys especially, which are frequently unindexed by default.
- Composite index column **order matters**: most selective and equality-filtered columns first; a composite index serves queries on its leading prefix, not its trailing columns.
- Indexes cost write throughput and storage. Do not add one speculatively; add it for a query you can point to.
- Remove indexes that duplicate a prefix of another index.
- **MUST** check the query plan (`EXPLAIN` / `EXPLAIN ANALYZE`) before concluding a query is slow, and before claiming a change made it fast. Never guess at performance.

**N+1 queries** are the most common serious performance defect: fetching a list, then querying once per row. They appear naturally in ORM code because the per-row query is invisible at the call site. Fix by eager-loading the relation or by batching into a single query. Look for any query inside a loop or inside a per-item mapping function.

**Never fetch unbounded result sets.** Every list endpoint and every batch job MUST have a limit. Prefer keyset (cursor) pagination over `OFFSET` for large or frequently-paged data — `OFFSET` scans and skips every preceding row, and shifts results when rows are inserted mid-paging.

Select the columns you need rather than everything, particularly where large text or blob columns exist.

## Transactions

- Wrap in a transaction any set of writes that must all succeed or all fail. Partial writes leave data that no code path expects.
- **Keep transactions short.** An open transaction holds its locks until it ends, so every row it touched blocks other writers for that whole span — including any wait the surrounding code performs.
- Acquire locks in a consistent order across the codebase to avoid deadlocks. Expect deadlocks anyway on contended paths and handle the retry.
- Know the project's isolation level and what it does not protect against. Read-committed does not prevent lost updates from read-modify-write cycles.
- Long-running batch writes SHOULD be chunked into bounded transactions rather than one transaction over millions of rows.

What code may run inside a transaction, and where the boundary sits in service code, is owned by the `backend-engineering` skill.

## Concurrency

- **NEVER** implement a counter or balance as read-then-write in application code. Use an atomic database operation (`SET n = n + 1`), a lock, or optimistic concurrency with a version column.
- For check-then-act logic, enforce the condition in the write itself (`WHERE status = 'pending'`) and verify the affected row count, rather than checking first and writing second.
- Use the database's upsert primitive rather than select-then-insert-or-update, which races.

## Migrations

**MUST**:

- Use the project's migration tool and directory. Never modify a schema out of band.
- Never edit a migration that has already run anywhere. Write a new one.
- Preserve existing data. Adding a `NOT NULL` column to a populated table requires a default or a backfill — a bare `ADD COLUMN NOT NULL` fails or destroys rows.
- Test the migration against a copy with realistic data volume, not an empty schema.
- Know whether the migration takes a lock that blocks writes. On a large table, an index build, a column rewrite, or a type change can lock production for a long time — use the database's concurrent or online variant.

**Safe expand-and-contract sequence** for any change that removes or renames, deployed alongside running code:

```
1. Expand   — add the new column/table, nullable; deploy
2. Backfill — populate in batches; deploy code that writes both, reads new
3. Verify   — confirm data is complete and correct
4. Contract — stop writing the old; then drop it in a later deploy
```

Renaming or dropping a column in one step breaks every running instance of the previous code version during the deploy window.

Write a `down` migration where the tool supports it and reversal is meaningful. Say explicitly when a migration is irreversible.

## Queries in code & Project Conventions

- **MUST** parameterize queries using PostgreSQL `$1`, `$2` positional placeholders. NEVER use MySQL `?` placeholders or string concatenation. See the `security` skill.
- **Single Source of Truth**: Identity properties (`first_name`, `last_name`, `phone`, `email`, `user_name`) live on the `users` table. Satellite tables (`customers`, `delivery_partners`) hold domain extensions.
- **SQL JOIN Standard**: Queries retrieving identity information alongside domain profiles MUST explicitly `JOIN users u ON u.user_id = profile.id` rather than querying missing identity columns on satellite tables.
- Keep queries within the data-access layer; business decisions do not belong in SQL, and SQL does not belong in controllers or UI. See the `architecture` skill.
- Grant the application the narrowest database role that works. It rarely needs schema-modification rights at runtime.
- Prefer soft deletes only where the domain requires recoverability or audit — and then **every** query must exclude deleted rows, which is easy to forget and worth enforcing in one place.

## Related skills

- `security` — injection, least-privilege roles, data exposure.
- `performance` — measuring before indexing or caching.
- `data-structures` — when a database index is the right structure instead of an in-memory one.
- `backend-engineering` — service-level transaction boundaries and retries.
- `architecture` — containing data access behind a boundary.
- `naming-conventions` — table, column, and index identifiers.
- `testing` — integration tests against a real database.
