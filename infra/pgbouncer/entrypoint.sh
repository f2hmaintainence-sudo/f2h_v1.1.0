#!/bin/sh
set -eu

DB_USER="${PGBOUNCER_DB_USER:?PGBOUNCER_DB_USER is required}"
DB_HOST="${PGBOUNCER_DB_HOST:?PGBOUNCER_DB_HOST is required}"
DB_PORT="${PGBOUNCER_DB_PORT:-5432}"
DB_NAME="${PGBOUNCER_DB_NAME:?PGBOUNCER_DB_NAME is required}"
AUTH_QUERY_USER="${PGBOUNCER_AUTH_QUERY_USER:?PGBOUNCER_AUTH_QUERY_USER is required}"
AUTH_QUERY_PASSWORD_FILE="${PGBOUNCER_AUTH_QUERY_PASSWORD_FILE:?PGBOUNCER_AUTH_QUERY_PASSWORD_FILE is required}"
AUTH_QUERY_DB="${PGBOUNCER_AUTH_QUERY_DB:-postgres}"
AUTH_QUERY_PASSWORD="$(tr -d '\r\n' < "${AUTH_QUERY_PASSWORD_FILE}")"

rm -f /var/run/pgbouncer/pgbouncer.pid

sed \
  -e "s|__PGBOUNCER_DB_HOST__|${DB_HOST}|g" \
  -e "s|__PGBOUNCER_DB_PORT__|${DB_PORT}|g" \
  -e "s|__PGBOUNCER_DB_NAME__|${DB_NAME}|g" \
  -e "s|__PGBOUNCER_DB_USER__|${DB_USER}|g" \
  -e "s|__PGBOUNCER_POOL_MODE__|${PGBOUNCER_POOL_MODE:-transaction}|g" \
  -e "s|__PGBOUNCER_MAX_CLIENT_CONN__|${PGBOUNCER_MAX_CLIENT_CONN:-12000}|g" \
  -e "s|__PGBOUNCER_DEFAULT_POOL_SIZE__|${PGBOUNCER_DEFAULT_POOL_SIZE:-150}|g" \
  -e "s|__PGBOUNCER_MIN_POOL_SIZE__|${PGBOUNCER_MIN_POOL_SIZE:-50}|g" \
  -e "s|__PGBOUNCER_RESERVE_POOL_SIZE__|${PGBOUNCER_RESERVE_POOL_SIZE:-50}|g" \
  -e "s|__PGBOUNCER_MAX_DB_CONNECTIONS__|${PGBOUNCER_MAX_DB_CONNECTIONS:-200}|g" \
  -e "s|__PGBOUNCER_MAX_USER_CONNECTIONS__|${PGBOUNCER_MAX_USER_CONNECTIONS:-200}|g" \
  -e "s|__PGBOUNCER_SERVER_IDLE_TIMEOUT__|${PGBOUNCER_SERVER_IDLE_TIMEOUT:-30}|g" \
  /etc/pgbouncer/pgbouncer.ini.template > /etc/pgbouncer/pgbouncer.ini

for _ in 1 2 3 4 5 6 7 8 9 10; do
  SCRAM_SECRET="$(PGPASSWORD="${AUTH_QUERY_PASSWORD}" psql \
    --host "${DB_HOST}" \
    --port "${DB_PORT}" \
    --username "${AUTH_QUERY_USER}" \
    --dbname "${AUTH_QUERY_DB}" \
    --tuples-only \
    --no-align \
    --command "SELECT rolpassword FROM pg_authid WHERE rolname = '${DB_USER}'")" && break
  echo "Waiting for PostgreSQL SCRAM secret for ${DB_USER}..."
  sleep 3
done

SCRAM_SECRET="$(printf '%s' "${SCRAM_SECRET}" | tr -d '\r\n')"

if [ -z "${SCRAM_SECRET}" ]; then
  echo "Failed to load SCRAM secret for ${DB_USER} from PostgreSQL" >&2
  exit 1
fi

cat > /etc/pgbouncer/userlist.txt <<EOF
"${DB_USER}" "${SCRAM_SECRET}"
EOF

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
