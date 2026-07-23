# PgBouncer Setup for NestJS + PostgreSQL + Docker

## Why PgBouncer

PgBouncer sits between your NestJS app and PostgreSQL. Instead of letting every incoming request open or hold a dedicated PostgreSQL backend process, PgBouncer reuses a smaller set of server connections. That reduces connection churn, lowers memory usage on PostgreSQL, and helps the app survive bursty traffic.

In this repository the backend connects to `pgbouncer:6432`, and PgBouncer forwards traffic to `postgres:5432`.

## Folder Structure

```text
.
|-- .env.docker.example
|-- docker-compose.yml
|-- secrets/
|   |-- app_db_password.txt.example
|   `-- postgres_superuser_password.txt.example
|-- infra/
|   |-- postgres/
|   |   `-- init/
|   |       `-- 01-init-app.sh
|   `-- pgbouncer/
|       |-- Dockerfile
|       |-- entrypoint.sh
|       |-- pgbouncer.ini
|       `-- userlist.txt.example
`-- backend/
    |-- .env.pgbouncer.example
    `-- docs/
        `-- PGBOUNCER_SETUP.md
```

## How It Works

1. `postgres` starts first and creates the application role/database from Docker secrets.
2. `pgbouncer` starts next, connects to PostgreSQL as the configured auth query user, fetches the role's SCRAM secret from `pg_authid`, and writes `userlist.txt` with that same SCRAM secret.
3. `backend` connects to PgBouncer, not directly to PostgreSQL.
4. PgBouncer uses `transaction` pooling, so one PostgreSQL connection can serve many short-lived web requests.

## Connection Flow

Normal application traffic flows like this:

```text
NestJS app
   |
   v
PgBouncer (port 6432)
   |
   v
PostgreSQL (port 5432)
```

In this project:

- application queries should go to `pgbouncer:6432` inside Docker
- application queries should go to `95.111.246.72:6432` outside Docker
- PostgreSQL stays behind PgBouncer for normal API traffic

Why this works:

- NestJS opens client connections to PgBouncer
- PgBouncer reuses a smaller number of real PostgreSQL server connections
- PostgreSQL is protected from too many direct application connections

## Direct PostgreSQL Connection for Migrations

Table migrations should use a direct PostgreSQL connection, not the PgBouncer transaction pool.

Flow for migrations:

```text
Migration runner / psql / Prisma migrate
   |
   v
PostgreSQL directly (port 5432)
```

Why direct connection is better for migrations:

- schema changes often need a stable session
- some migration tools open long transactions
- migration tools may use session-level features that do not fit transaction pooling
- direct PostgreSQL removes PgBouncer from the migration path and avoids confusing failures

For this repository, the SQL files in `backend/migrations/` should be executed directly against PostgreSQL.

Recommended direct migration env:

```env
MIGRATION_DB_HOST=95.111.246.72
MIGRATION_DB_PORT=5432
MIGRATION_DB_DATABASE=f2hfresh
MIGRATION_DB_USERNAME=f2h_app
MIGRATION_DB_PASSWORD=your-password
```

Example direct `psql` command from the host:

```bash
psql "postgresql://f2h_app:your-password@95.111.246.72:5432/f2hfresh" -f backend/migrations/001-auth-login-attempts.sql
```

Example direct `psql` command from inside the PostgreSQL container:

```bash
docker exec -i postgres_db psql -U f2h_app -d f2hfresh < backend/migrations/001-auth-login-attempts.sql
```

Rule of thumb:

- use `6432` for normal app queries
- use `5432` for migrations, schema changes, and admin maintenance

## Recommended PgBouncer Values

These values are already applied in [`infra/pgbouncer/pgbouncer.ini`](/c:/Users/91768/Projects/f2hfresh/infra/pgbouncer/pgbouncer.ini):

- `pool_mode = transaction`
- `max_client_conn = 12000`
- `default_pool_size = 150`
- `server_idle_timeout = 30`

Why these values:

- `max_client_conn = 12000` gives headroom above a 10k burst target so clients queue at PgBouncer instead of immediately failing at the socket layer.
- `default_pool_size = 150` keeps the real PostgreSQL connection count bounded while allowing more parallel SQL work than the smaller starter setup.
- `server_idle_timeout = 30` trims idle backend connections faster under bursty traffic so PostgreSQL memory is recycled more aggressively.

For sustained traffic near 10k concurrent users, these are a stronger starting point, but they still assume horizontal app scaling and caching rather than 10k active SQL transactions at once.

## NestJS Integration

The backend now supports both inline passwords and Docker secret files, plus environment-aware host resolution:

```env
DB_RUNTIME=auto
DB_HOST_DOCKER=pgbouncer
DB_HOST_LOCAL=95.111.246.72
DB_PORT_DOCKER=6432
DB_PORT_LOCAL=6432
DB_DATABASE=f2hfresh
DB_USERNAME=f2h_app
DB_PASSWORD=
DB_PASSWORD_FILE=/run/secrets/app_db_password
DB_POOL_SIZE=12
DB_APPLICATION_NAME=backend-api
```

Notes:

- Keep the app-side pool small when PgBouncer is in front. `DB_POOL_SIZE=10..15` is a better target per NestJS container at 10k-user scale.
- With `DB_RUNTIME=auto`, the backend uses `pgbouncer:6432` inside Docker and `95.111.246.72:6432` outside Docker.
- When NestJS runs outside Docker, prefer `DB_PASSWORD` in your local `.env`; `DB_PASSWORD_FILE` is mainly for containerized runs with Docker secrets.
- This codebase currently uses `pg.Pool` directly, not TypeORM or Prisma.
- `max_prepared_statements = 0` is intentional in the base PgBouncer config so transaction pooling stays predictable across drivers.
- Merge these database settings into your real backend `.env`; your existing app secrets such as `JWT_SECRET` and `ENCRYPTION_SECRET` are still required by NestJS validation.

## TypeORM Example

```ts
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  extra: {
    max: 20,
    application_name: 'backend-api',
  },
});
```

Guidance:

- TypeORM itself is usually fine with PgBouncer transaction pooling.
- Avoid relying on session state such as `SET search_path` that must persist across requests unless you reapply it inside each transaction.
- For TypeORM migrations, prefer a separate direct PostgreSQL config that points to port `5432`.

Example direct migration config:

```ts
{
  type: 'postgres',
  host: process.env.MIGRATION_DB_HOST || '95.111.246.72',
  port: Number(process.env.MIGRATION_DB_PORT || 5432),
  username: process.env.MIGRATION_DB_USERNAME,
  password: process.env.MIGRATION_DB_PASSWORD,
  database: process.env.MIGRATION_DB_DATABASE,
}
```

## Prisma Example

For Prisma with transaction pooling, keep a PgBouncer URL for application queries and a direct PostgreSQL URL for migrations:

```env
DATABASE_URL="postgresql://f2h_app:password@pgbouncer:6432/f2hfresh?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://f2h_app:password@postgres:5432/f2hfresh"
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Guidance:

- Prisma migrations should go to `DIRECT_URL`, not through PgBouncer transaction pooling.
- If you run into prepared-statement issues, keep `pgbouncer=true` and prefer the direct connection for schema operations.

## This Repo Migration Pattern

This repository already stores raw SQL migration files under `backend/migrations/`.

That means the safest pattern is:

1. Keep NestJS runtime traffic on PgBouncer.
2. Run migration SQL files directly on PostgreSQL.
3. Do not send schema migrations through the pooled `6432` port.

Example:

```bash
psql "postgresql://f2h_app:your-password@95.111.246.72:5432/f2hfresh" -f backend/migrations/029-users.sql
psql "postgresql://f2h_app:your-password@95.111.246.72:5432/f2hfresh" -f backend/migrations/029-users-seed.sql
```

## Prepared Statements

Transaction pooling cannot safely preserve arbitrary session affinity. That matters for prepared statements and any state stored on the PostgreSQL session.

Practical guidance:

- `node-postgres`: usually safe if you are not explicitly naming prepared statements.
- TypeORM: typically works, but avoid assuming session stickiness.
- Prisma: use `pgbouncer=true` and `directUrl` for migrations.
- JDBC clients: disable prepared statements with `prepareThreshold=0` when needed.

If you later want PgBouncer to track named prepared statements in transaction pooling mode, test `max_prepared_statements` with your exact driver first.

## Security

This setup avoids putting live database passwords in Git and avoids downgrading back to MD5:

- Docker secrets hold the PostgreSQL superuser password and the application password.
- PgBouncer generates `userlist.txt` at container start.
- The generated `userlist.txt` stores the same SCRAM secret PostgreSQL stores for the application role.

Production note:

- `scram-sha-256` is preferred.
- MD5 is weaker and deprecated in PostgreSQL.
- PgBouncer SCRAM auth works when PgBouncer and PostgreSQL use the same SCRAM secret for the user.
- Do not expose PostgreSQL directly to the internet. Expose PgBouncer only on trusted network paths, and prefer private subnets/security groups in cloud deployments.

## Startup Steps

1. Copy `.env.docker.example` to `.env`.
2. Copy `secrets/app_db_password.txt.example` to `secrets/app_db_password.txt`.
3. Copy `secrets/postgres_superuser_password.txt.example` to `secrets/postgres_superuser_password.txt`.
4. Put strong passwords in both secret files.
5. Start the stack:

```bash
docker compose up -d --build
```

## Verification Commands

Check container health:

```bash
docker compose ps
docker compose logs -f postgres
docker compose logs -f pgbouncer
```

Connect through PgBouncer:

```bash
psql "postgresql://f2h_app:<app-password>@95.111.246.72:6432/f2hfresh"
```

Manually inspect the PostgreSQL SCRAM secret if needed:

```sql
SELECT rolpassword
FROM pg_authid
WHERE rolname = 'f2h_app';
```

Or with the legacy compatibility view mentioned in some setups:

```sql
SELECT passwd
FROM pg_shadow
WHERE usename = 'f2h_app';
```

Open the PgBouncer admin console:

```bash
psql "postgresql://f2h_app:<app-password>@95.111.246.72:6432/pgbouncer"
```

Inside the PgBouncer admin console:

```sql
SHOW POOLS;
SHOW STATS;
SHOW SERVERS;
SHOW CLIENTS;
SHOW DATABASES;
SHOW CONFIG;
```

What to look for:

- `SHOW POOLS;`: `cl_active`, `cl_waiting`, `sv_active`, `sv_idle`
- `SHOW STATS;`: throughput, query time, wait time
- `SHOW SERVERS;`: number of real PostgreSQL connections

## When to Use Transaction Pooling

Use transaction pooling when:

- your backend is stateless
- requests are short and database-heavy
- you need high connection fan-in
- PostgreSQL memory pressure is caused by too many client connections

Avoid or reconsider it when you need:

- session-level temp tables across requests
- `LISTEN/NOTIFY` on pooled app connections
- session advisory locks
- `SET` state that must survive beyond one transaction
- long-lived idle transactions

## High Concurrency Guidance for 10k Users

10k connected users does not mean 10k active SQL queries at once. The normal pattern is:

- many client sockets
- far fewer active API workers
- even fewer PostgreSQL server connections

Practical scaling path:

- keep PgBouncer in front of every write primary
- run multiple NestJS replicas behind a load balancer
- keep each app replica pool small, typically `10..15`
- add Redis for cache, rate limiting, and short-lived hot data
- add PostgreSQL read replicas for read-heavy workloads
- keep migrations, background jobs, and admin tooling on direct connections when required

Recommended starting budget for 10k concurrent users:

- `8` NestJS replicas
- `DB_POOL_SIZE=12` per replica
- total app-side pool budget: about `96`
- PgBouncer `default_pool_size=150`
- PgBouncer `reserve_pool_size=50`
- PostgreSQL server-connection target: `150..200`, not thousands

How to think about it:

- the API tier handles request concurrency
- PgBouncer absorbs socket fan-in
- PostgreSQL stays protected with a much smaller server-connection ceiling
- Redis should absorb hot reads, counters, OTP/rate-limit state, and repetitive lookups

Infrastructure guidance for this load:

- run at least `2` PgBouncer instances behind a private load balancer for HA
- keep PgBouncer close to PostgreSQL in the same low-latency network boundary
- use provisioned IOPS storage for PostgreSQL
- monitor `cl_waiting`, `avg_wait_time`, CPU, and disk latency before increasing pool sizes

## Common Mistakes and Fixes

- Mistake: App still points to `postgres:5432`.
  Fix: point application traffic to `pgbouncer:6432`.

- Mistake: App pool is too large.
  Fix: reduce NestJS `DB_POOL_SIZE` to around `10..30` per container.

- Mistake: Running Prisma migrations through PgBouncer.
  Fix: use `directUrl` to reach PostgreSQL directly.

- Mistake: Session features break under transaction pooling.
  Fix: move that workflow to direct PostgreSQL connections or redesign it to be transaction-scoped.

- Mistake: Putting plaintext passwords in Compose files.
  Fix: use Docker secrets or an external secret manager.

## References

- PgBouncer overview and usage: https://www.pgbouncer.org/usage
- PgBouncer configuration and authentication: https://www.pgbouncer.org/config
- PgBouncer prepared statement FAQ: https://www.pgbouncer.org/faq.html
- PostgreSQL password authentication: https://www.postgresql.org/docs/current/auth-password.html
- PostgreSQL `pg_hba.conf`: https://www.postgresql.org/docs/current/auth-pg-hba-conf.html


# Role Create
CREATE ROLE f2h_app WITH LOGIN PASSWORD 'CREATE_ROLE_f2h_app_WITH_LOGIN_PASSWORD';
# Access Database
ALTER DATABASE f2hfresh OWNER TO f2h_app;
# Role permissions 
GRANT USAGE ON SCHEMA public TO f2h_app;

GRANT SELECT, INSERT, UPDATE, DELETE 
ON ALL TABLES IN SCHEMA public 
TO f2h_app;

GRANT USAGE, SELECT 
ON ALL SEQUENCES IN SCHEMA public 
TO f2h_app;
# Feature permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO f2h_app;
# Start Docker run

# Stop Docker run 
docker compose stop backend