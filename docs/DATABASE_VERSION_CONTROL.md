# F2H Fresh — Database & Application Version Control Guide

## Overview

* **Production Environment (`f2hfresh.com`)**: Runs version `v1.0.0` connected to database `f2h_fresh` containing live customer data, wallet balances, orders, delivery partner accounts, and inventory.
* **Development Environment (`dev.f2hfresh.com`)**: Runs version `v1.1.0` connected to database `f2h_dev`.

When developing features, refactoring, or deleting/modifying fields in `v1.1.0`, **we must guarantee zero data loss and zero disruption** to existing user records when deploying to production (`f2hfresh.com`).

---

## The 5 Golden Rules of Database Version Control

### Rule 1: Never Edit or Delete an Existing Migration File
Once a migration file (e.g., `001-init-unified-schema.sql` through `020-...sql`) has been committed or executed on any environment, **its contents must never be altered**.
* Each migration is tracked in the `schema_migrations` table with a SHA-256 checksum.
* If a bug is found in a migration, create a **new forward migration script** (e.g., `021-fix-orders-status.sql`) to fix it.

### Rule 2: Follow the Expand-and-Contract Pattern
Never perform destructive changes (renaming columns, changing column types, dropping tables) in a single step.

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   1. EXPAND    │ ──> │  2. BACKFILL   │ ──> │   3. VERIFY    │ ──> │  4. CONTRACT   │
│ Add new column │     │ Copy data from │     │ Switch code to │     │ Remove old     │
│ (NULL/DEFAULT) │     │ old to new col │     │ read/write new │     │ deprecated col │
└────────────────┘     └────────────────┘     └────────────────┘     └────────────────┘
```

* **Adding a Column**: Must be `NULLABLE` or define a `DEFAULT` value. Adding a `NOT NULL` column without a default will fail on existing production tables with rows.
* **Renaming a Column**: Do **not** use `ALTER TABLE ... RENAME COLUMN`. Instead:
  1. Add the new column (`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name ...`).
  2. Backfill data (`UPDATE users SET full_name = name WHERE full_name IS NULL;`).
  3. Deploy code that writes to both columns and reads from the new column.
  4. In a subsequent release, drop or deprecate the old column.
* **Deleting a Column/Table**: First remove all application code references, verify production health, and drop in a later migration.

### Rule 3: Single Source of Truth for Identities
* All core identity fields (`first_name`, `last_name`, `phone`, `email`, `user_name`, `password_hash`) live on the `users` table.
* Satellite tables (`customers`, `delivery_partners`, `admins`) contain only domain extension fields.
* Never duplicate identity columns across satellite tables.

### Rule 4: Always Use Standardized SQL Parameter Binding
* Use PostgreSQL `$1, $2` parameterized queries in backend services.
* Use `IF NOT EXISTS` / `IF EXISTS` in all migration scripts for idempotency.

### Rule 5: Mandatory Pre-Hosting Backup
Before running migrations or switching database targets on production, **always take an automated snapshot**.

---

## Tooling & CLI Commands

The repository provides automated tools to manage migrations and backups:

| Command | Description |
|---|---|
| `npm run db:create-migration <name>` | Generates the next sequentially numbered `.sql` migration file with boilerplate and guidelines. |
| `npm run db:migrate` | **Dry-run**: Connects to the database and prints exactly which migrations would be executed without applying changes. |
| `npm run db:migrate:apply` | **Apply**: Executes pending migrations sequentially inside transactions and records their checksums in `schema_migrations`. |
| `npm run db:backup [dbname]` | Creates a timestamped, gzip-compressed snapshot of the database in `backups/db/`. |

---

## Step-by-Step Developer Workflows

### 1. How to Add a New Table or Column in Development (`v1.1.0`)

1. Generate a new migration file:
   ```bash
   npm run db:create-migration add-secondary-phone-to-users
   ```
   This creates `apps/api/migrations/021-add-secondary-phone-to-users.sql`.

2. Write the SQL statements in the file:
   ```sql
   BEGIN;

   -- Schema change with backward compatibility
   ALTER TABLE users 
     ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(20) DEFAULT NULL;

   -- Index if filtered or searched
   CREATE INDEX IF NOT EXISTS idx_users_secondary_phone ON users(secondary_phone);

   COMMIT;
   ```

3. Test the dry run:
   ```bash
   npm run db:migrate
   ```

4. Apply the migration to `f2h_dev`:
   ```bash
   npm run db:migrate:apply
   ```

5. Update your backend entity/DTOs and frontend models.

---

### 2. How to Safely Host / Deploy `v1.1.0` to Production (`f2hfresh.com`)

When it is time to host `v1.1.0` on `f2hfresh.com` using the existing `f2h_fresh` database:

#### Step 1: Create a Production Backup
```bash
./scripts/db-backup.sh f2h_fresh
```
*Verify that the `.sql.gz` file exists in `backups/db/` and has a valid file size.*

#### Step 2: Inspect Pending Migrations (Dry-Run)
Point the migration runner to `f2h_fresh` and perform a dry run:
```bash
DB_DATABASE=f2h_fresh npm run db:migrate
```
*Review the list of migrations that will be executed. Ensure none contain destructive queries without defaults.*

#### Step 3: Apply Migrations to Production
```bash
DB_DATABASE=f2h_fresh npm run db:migrate:apply
```
*The runner applies each migration inside an atomic transaction (`BEGIN ... COMMIT`). If any file encounters an error, it immediately rolls back without corrupting existing data.*

#### Step 4: Build & Reload Applications
```bash
# Verify quality builds
npm run build:api
npm run build:web

# Deploy mobile apps to webroots
./build-flutter.sh both clean

# Zero-downtime PM2 reload
pm2 reload all
```

#### Step 5: Post-Deployment Sanity Checks
1. Check process health: `pm2 status`
2. Verify existing user login on Customer and Partner apps.
3. Check database table counts in Adminer (`https://database.f2hfresh.com`).

---

## Rollback & Disaster Recovery

If an issue occurs during hosting:

1. **Restore Database from Snapshot**:
   ```bash
   gunzip -c backups/db/f2h_fresh_YYYYMMDD_HHMMSS.sql.gz | \
     PGPASSWORD="f2h_password" psql -h 127.0.0.1 -p 5432 -U f2h_user -d f2h_fresh
   ```
2. **Revert Git Branch**:
   ```bash
   git checkout v1.0.0
   pm2 restart all
   ```
