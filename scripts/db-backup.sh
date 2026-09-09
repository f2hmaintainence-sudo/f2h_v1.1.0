#!/usr/bin/env bash
# ==============================================================================
# F2H Fresh — Automated Database Backup Utility
# Usage:
#   ./scripts/db-backup.sh [database_name]
# Example:
#   ./scripts/db-backup.sh f2h_dev
#   ./scripts/db-backup.sh f2h_fresh
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/apps/api/.env"

# Load DB credentials from .env if available
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^(DB_HOST|DB_PORT|DB_USERNAME|DB_PASSWORD|DB_DATABASE)=' "$ENV_FILE" | xargs -d '\n' 2>/dev/null || true)
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USERNAME:-f2h_user}"
DB_PASS="${DB_PASSWORD:-f2h_password}"
TARGET_DB="${1:-${DB_DATABASE:-f2h_dev}}"

BACKUP_DIR="$ROOT_DIR/backups/db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${TARGET_DB}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "============================================================"
echo "  📦 F2H Database Backup"
echo "  Database : $TARGET_DB"
echo "  Host     : $DB_HOST:$DB_PORT"
echo "  User     : $DB_USER"
echo "  Target   : $BACKUP_FILE"
echo "============================================================"

export PGPASSWORD="$DB_PASS"

# Run pg_dump and compress on the fly
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F p --clean --if-exists "$TARGET_DB" | gzip > "$BACKUP_FILE"

FILESIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')

echo "✓ Backup completed successfully!"
echo "  File Size: $FILESIZE"
echo ""
echo "To restore this backup if ever needed:"
echo "  gunzip -c $BACKUP_FILE | PGPASSWORD='$DB_PASS' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TARGET_DB"
echo "============================================================"
