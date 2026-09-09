#!/usr/bin/env bash
# ==============================================================================
# F2H Fresh — Safe Database Sync: Clone Production Data into Development
#
# PURPOSE:
#   During 2-3 weeks of development on v1.1.0, developers can run this script
#   to refresh `f2h_dev` with the latest data (catalog, categories, users, zones)
#   from `f2h_fresh` (production) without affecting the live production database.
#
# SAFETY:
#   - SOURCE is strictly READ-ONLY (pg_dump).
#   - TARGET is strictly validated to ensure it is `f2h_dev` (never production!).
#   - Automatically applies pending v1.1.0 migrations onto the imported data.
#
# USAGE:
#   ./scripts/db-clone-prod-to-dev.sh [--confirm]
#   npm run db:clone-prod-to-dev
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/apps/api/.env"

# Load DB credentials from .env if available
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^(DB_HOST|DB_PORT|DB_USERNAME|DB_PASSWORD)=' "$ENV_FILE" | xargs -d '\n' 2>/dev/null || true)
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USERNAME:-f2h_user}"
DB_PASS="${DB_PASSWORD:-f2h_password}"

SRC_DB="f2h_fresh"
TARGET_DB="f2h_dev"

# Safety Check: Target MUST NEVER be production
if [ "$TARGET_DB" = "f2h_fresh" ] || [[ "$TARGET_DB" != *"dev"* ]]; then
  echo "❌ CRITICAL SAFETY ERROR: Target database '$TARGET_DB' is not a dev database!"
  echo "Refusing to proceed to prevent accidental production overwrite."
  exit 1
fi

echo "============================================================"
echo "  🔄 F2H Database Sync: Clone Production Data to Dev"
echo "============================================================"
echo "  Source (Read-Only) : $SRC_DB"
echo "  Target (Overwritten): $TARGET_DB"
echo "  Host               : $DB_HOST:$DB_PORT"
echo "  User               : $DB_USER"
echo "============================================================"
echo ""
echo "⚠️  WARNING: This will replace the contents of '$TARGET_DB' with '$SRC_DB',"
echo "    then apply all v1.1.0 forward migrations to '$TARGET_DB'."
echo ""

if [ "$1" != "--confirm" ] && [ -t 0 ]; then
  read -p "Are you sure you want to refresh $TARGET_DB from $SRC_DB? (y/N): " choice
  case "$choice" in 
    y|Y ) echo "Proceeding...";;
    * ) echo "Aborted by user."; exit 0;;
  esac
fi

export PGPASSWORD="$DB_PASS"

echo "1/4 Terminating active connections to $TARGET_DB..."
sudo -u postgres psql -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || true

echo "2/4 Recreating clean $TARGET_DB..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $TARGET_DB;" >/dev/null 2>&1 || true
sudo -u postgres psql -c "CREATE DATABASE $TARGET_DB OWNER $DB_USER;" >/dev/null 2>&1
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $TARGET_DB TO $DB_USER;" >/dev/null 2>&1

echo "3/4 Dumping $SRC_DB and restoring into $TARGET_DB..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c "$SRC_DB" | \
  pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" --no-owner --no-acl 2>/dev/null || true

# Grant permissions to f2h_user on all public schema objects
sudo -u postgres psql -d "$TARGET_DB" -c "
  GRANT ALL ON SCHEMA public TO $DB_USER;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_USER;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;
" >/dev/null 2>&1 || true

echo "4/4 Applying v1.1.0 forward migrations to $TARGET_DB..."
cd "$ROOT_DIR"
DB_DATABASE="$TARGET_DB" npm run db:migrate:apply

# Restart dev API if running
if command -v pm2 >/dev/null 2>&1; then
  echo "Restarting dev API process..."
  pm2 restart api-f2hfresh >/dev/null 2>&1 || true
fi

echo ""
echo "============================================================"
echo "✓ Sync completed successfully!"
echo "  $TARGET_DB is now populated with fresh data from $SRC_DB"
echo "  and has all v1.1.0 migrations applied."
echo "============================================================"
