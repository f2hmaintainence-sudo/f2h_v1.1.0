# PgBouncer Runbook

## Why `DB connection failed` happens

The most common reasons in this project are:

- Docker `postgres` / `pgbouncer` is not running
- NestJS is using the wrong host or port
- PgBouncer is healthy, but PostgreSQL is not ready yet
- local `.env` points to PgBouncer, but the Docker DB stack is stopped

In this repository the correct runtime path is:

- local NestJS -> `95.111.246.72:6432`
- Docker NestJS -> `pgbouncer:6432`

## Important Docker Commands

Start only the database stack:

```powershell
docker compose up -d postgres pgbouncer redis
```

Start full stack:

```powershell
docker compose up -d --build
```

See running containers:

```powershell
docker compose ps
```

Stop only backend container:

```powershell
docker compose stop backend
```

Restart PgBouncer:

```powershell
docker compose restart pgbouncer
```

See PostgreSQL logs:

```powershell
docker compose logs -f postgres
```

See PgBouncer logs:

```powershell
docker compose logs -f pgbouncer
```

See backend logs:

```powershell
docker compose logs -f backend
```

## Which setup to use in development

If you run:

```powershell
cd backend
npm run start:dev
```

then keep only these Docker services running:

- `postgres`
- `pgbouncer`
- `redis`

and stop Docker backend:

```powershell
docker compose stop backend
```

Otherwise port `4000` will already be occupied.

## Runtime DB ports

- `6432` = PgBouncer for application traffic
- `5432` = direct PostgreSQL for migrations and admin work

## Migration reminder

Run migrations directly on PostgreSQL:

```powershell
psql "postgresql://f2h_app:your-password@95.111.246.72:5432/f2hfresh" -f backend/migrations/029-users.sql
```

Do not run schema migrations through PgBouncer port `6432`.



This guide explains exactly how to use the current NestJS + PostgreSQL + PgBouncer setup in this repository.

Use this when:

- you get `relation "users" does not exist`
- you are not sure which port to use
- you need to run migrations
- you need to connect to the database manually
- someone pulls the repo and needs to make PgBouncer work

## Quick Answer

There are 2 database entry points in this project:

1. `95.111.246.72:6432`
   Use this for the NestJS application at runtime.
   This goes through PgBouncer.

2. `95.111.246.72:5432`
   Use this for migrations, schema changes, and direct database admin work.
   This goes directly to PostgreSQL.

If you see:

```json
{"success":true,"data":{"status":false,"data":[],"message":"relation \"users\" does not exist","query":"","bindings":[]}}
```

it means:

- your app is running
- your DB connection is working
- but the `users` table was not created yet in the PostgreSQL database the app is using

So the fix is usually: run migrations directly on PostgreSQL `5432`.

## Which Passwords To Use

Current app database user:

- username: `f2h_app`
- password: use the value in [secrets/app_db_password.txt](/c:/Users/91768/Projects/f2hfresh/secrets/app_db_password.txt)

Current PostgreSQL superuser:

- username: `postgres`
- password: use the value in [secrets/postgres_superuser_password.txt](/c:/Users/91768/Projects/f2hfresh/secrets/postgres_superuser_password.txt)

In your current setup, the active values are:

- app user password: `replace-with-a-long-random-application-password`
- postgres superuser password: `replace-with-a-long-random-postgres-superuser-password`

## Which Services Must Run

For local development with `npm run start:dev`, you should usually run:

- `postgres`
- `pgbouncer`
- `redis`

You should usually stop Docker `backend` if you want to run NestJS locally, because both the Docker backend and local NestJS try to use port `4000`.

## Recommended Local Development Flow

### Option A: Run backend locally

1. Start database services:
```powershell
docker compose up -d postgres pgbouncer redis backend 
```

2. Stop Docker backend if it is running:

```powershell
docker compose stop backend
```

3. Start NestJS locally:

```powershell
cd backend
npm run start:dev
```

Use this option when you want hot reload and local debugging.

### Option B: Run everything in Docker

```powershell
docker compose up -d --build
```

If you use this option, do not run `npm run start:dev` locally on port `4000`.

## How To Connect To The Database

### Connect through PgBouncer

Use this for normal app-style queries:

```powershell
psql "postgresql://f2h_app:replace-with-a-long-random-application-password@95.111.246.72:6432/f2hfresh"
```

### Connect directly to PostgreSQL

Use this for migrations and admin work:

```powershell
psql "postgresql://f2h_app:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/f2hfresh"
```

### Connect as postgres superuser

```powershell
psql "postgresql://postgres:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/postgres"
```

## How To Check Tables

After connecting with `psql`, use:

```sql
\dt
```

To check the `users` table specifically:

```sql
SELECT COUNT(*) FROM "users";
```

If this fails with `relation "users" does not exist`, migrations were not applied yet.

## Why `users` Table Error Happens

This repository has migration files under [backend/migrations](/c:/Users/91768/Projects/f2hfresh/backend/migrations).

The `users` table is created by:

- [029-users.sql](/c:/Users/91768/Projects/f2hfresh/backend/migrations/029-users.sql)

If your running database has no tables, then the migration files exist in Git but were never executed on the live PostgreSQL database.

## How To Run Migrations

Important:

- run migrations on PostgreSQL direct port `5432`
- do not run migrations through PgBouncer port `6432`

### Run one migration manually

```powershell
psql "postgresql://f2h_app:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/f2hfresh" -f backend/migrations/029-users.sql
```

### Run one seed file manually

```powershell
psql "postgresql://f2h_app:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/f2hfresh" -f backend/migrations/029-users-seed.sql
```

### Run all migrations in order

PowerShell:

```powershell
Get-ChildItem backend\migrations\*.sql |
  Sort-Object Name |
  ForEach-Object {
    psql "postgresql://f2h_app:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/f2hfresh" -f $_.FullName
  }
```

This repository already uses numbered migration files, so sorting by filename runs them in order.

## What To Do Right Now To Fix `users` Error

Follow these steps exactly:

1. Start database services:

```powershell
docker compose up -d postgres pgbouncer redis
```

2. Stop Docker backend if you want local NestJS:

```powershell
docker compose stop backend
```

3. Run migrations directly on PostgreSQL:

```powershell
Get-ChildItem backend\migrations\*.sql |
  Sort-Object Name |
  ForEach-Object {
    psql "postgresql://f2h_app:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/f2hfresh" -f $_.FullName
  }
```

4. Verify tables:

```powershell
psql "postgresql://f2h_app:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/f2hfresh" -c "\dt"
```

5. Verify `users`:

```powershell
psql "postgresql://f2h_app:replace-with-a-long-random-postgres-superuser-password@95.111.246.72:5432/f2hfresh" -c "SELECT COUNT(*) FROM \"users\";"
```

6. Start NestJS locally:

```powershell
cd backend
npm run start:dev
```

## PgBouncer Admin Commands

To inspect PgBouncer:

```powershell
psql "postgresql://f2h_app:replace-with-a-long-random-application-password@95.111.246.72:6432/pgbouncer"
```

Then run:

```sql
SHOW POOLS;
SHOW STATS;
SHOW SERVERS;
SHOW CLIENTS;
SHOW DATABASES;
```

## Which Env File Is Used

Runtime backend env is:

- [backend/.env](/c:/Users/91768/Projects/f2hfresh/backend/.env)

Docker Compose env is:

- [.env](/c:/Users/91768/Projects/f2hfresh/.env)

Docker secrets are:

- [secrets/app_db_password.txt](/c:/Users/91768/Projects/f2hfresh/secrets/app_db_password.txt)
- [secrets/postgres_superuser_password.txt](/c:/Users/91768/Projects/f2hfresh/secrets/postgres_superuser_password.txt)

## What Another User Must Do After `git pull`

After pulling the repository, another developer must do these steps:

1. Install PostgreSQL client tools if `psql` is not available.
2. Create these local secret files if they do not exist:
   - `secrets/app_db_password.txt`
   - `secrets/postgres_superuser_password.txt`
3. Put valid plaintext passwords into those files.
4. Update `backend/.env` with the same app DB password.
5. Start Docker services:

```powershell
docker compose up -d postgres pgbouncer redis
```

6. Run migrations directly on `5432`.
7. Start backend either:
   - locally with `npm run start:dev`, or
   - in Docker with `docker compose up -d backend`

Without those steps, PgBouncer may run but the app database may still be empty.

## Before You Push To Git

Do not push real passwords to a public repository.

If this repo will be shared:

- replace real passwords in `backend/.env`
- replace real passwords in `secrets/*.txt`
- keep only examples in Git
- share real secrets separately

If this is a private/internal project, be aware that anyone with repo access can use those credentials.

## Most Important Rule

Remember this:

- `6432` = app runtime through PgBouncer
- `5432` = direct PostgreSQL for migrations

If `users` does not exist, run migrations on `5432`.

## Important Docker Commands

Use these from the project root:

```powershell
docker compose up -d postgres pgbouncer redis
docker compose up -d --build backend
docker compose ps
docker compose logs --tail 120 pgbouncer
docker compose logs --tail 120 backend
docker compose restart pgbouncer
docker compose restart backend
docker compose stop backend
docker compose down
```

## Fast Recovery Steps

If PgBouncer fails with `pgbouncer-entrypoint.sh: no such file or directory`:

1. Rebuild the PgBouncer image:
```powershell
docker compose up -d --build pgbouncer
```
2. Check PgBouncer logs:
```powershell
docker compose logs --tail 120 pgbouncer
```
3. If logs say `Failed to load SCRAM secret for f2h_app from PostgreSQL`, make sure the app role exists in PostgreSQL with a SCRAM password.
4. Restart PgBouncer after fixing the role:
```powershell
docker compose restart pgbouncer
```

## Live Verification

Check backend HTTP:

```powershell
Invoke-WebRequest http://95.111.246.72:4000/
```

Check PgBouncer admin:

```powershell
docker exec postgres_db sh -lc "PGPASSWORD='your_app_password' psql -h pgbouncer -p 6432 -U f2h_app -d pgbouncer -c 'SHOW POOLS;' -c 'SHOW STATS;'"
```

## If You Change `127.0.0.1` To `95.111.246.72`

Use `95.111.246.72` only for connections coming from outside the server.
Do not change Docker-internal service names like `postgres` or `pgbouncer`.

### What To Change

For local or remote clients connecting to PgBouncer from outside Docker:

- old host: `127.0.0.1`
- new host: `95.111.246.72`
- PgBouncer port stays: `6432`
- direct PostgreSQL port stays: `5432`

Update connection examples like this:

```powershell
psql "postgresql://f2h_app:your_app_password@95.111.246.72:6432/f2hfresh"
```

PgBouncer admin example:

```powershell
psql "postgresql://f2h_app:your_app_password@95.111.246.72:6432/pgbouncer"
```

Backend env when running outside Docker on another machine:

```env
DB_HOST_LOCAL=95.111.246.72
DB_PORT_LOCAL=6432
```

### What Must NOT Change

Keep these values as they are for container-to-container communication:

```env
DB_HOST_DOCKER=pgbouncer
DB_PORT_DOCKER=6432
PGBOUNCER_DB_HOST=postgres
PGBOUNCER_DB_PORT=5432
```

### Security Notes For Public IP Usage

If you expose `95.111.246.72` publicly:

- open only the required ports in the firewall
- prefer allowing trusted IPs only
- avoid exposing direct PostgreSQL `5432` to the public internet
- prefer exposing only PgBouncer `6432` if remote app access is required
- use strong passwords and rotate them if already shared

## About PgAdmin Password

This project does not currently have a `pgadmin` container in `docker-compose.yml`.
So there is no PgAdmin password to change yet in this repo.

If later you add PgAdmin, its login password is separate from PostgreSQL and PgBouncer passwords.
Typical PgAdmin env values are:

```env
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=change_this_to_a_strong_password
```

That password is only for signing in to the PgAdmin web UI.
It does not replace these existing DB credentials:

- `postgres` superuser password in `secrets/postgres_superuser_password.txt`
- `f2h_app` application password in `secrets/app_db_password.txt`

## If You Want To Change The PostgreSQL Admin Password

Update:

- `secrets/postgres_superuser_password.txt`
- any matching local docs/examples that use the old password

Then restart the stack:

```powershell
docker compose down
docker compose up -d --build postgres pgbouncer redis backend
```

## If You Want To Change The App DB Password

Update:

- `secrets/app_db_password.txt`
- `backend/.env`

Then reset the role password in PostgreSQL and restart PgBouncer/backend.
Because this setup uses SCRAM, PgBouncer must load the matching SCRAM secret from PostgreSQL.

## File Path Changes

These files were updated to switch client-facing PgBouncer/PostgreSQL access from 127.0.0.1 to 95.111.246.72:

- [docker-compose.yml](/c:/Users/91768/Projects/form2home/f2hbackend/docker-compose.yml)
  Changed backend container env DB_HOST_LOCAL from 127.0.0.1 to 95.111.246.72.

- [backend/.env](/c:/Users/91768/Projects/form2home/f2hbackend/backend/.env)
  Already uses DB_HOST_LOCAL=95.111.246.72 and did not need a new edit.

- [.env](/c:/Users/91768/Projects/form2home/f2hbackend/.env)
  Already uses DATABASE_URL and DB_HOST_LOCAL with 95.111.246.72 and did not need a new edit.

These values were intentionally not changed:

- PgBouncer healthcheck 127.0.0.1:6432 inside [docker-compose.yml](/c:/Users/91768/Projects/form2home/f2hbackend/docker-compose.yml)
  This runs inside the PgBouncer container itself, so localhost is correct there.

- Docker-internal names like pgbouncer and postgres
  Container-to-container traffic should still use service names, not the public IP.