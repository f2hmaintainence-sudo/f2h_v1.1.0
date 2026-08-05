#!/bin/sh
set -eu

APP_DB_PASSWORD="$(tr -d '\r\n' < "${APP_DB_PASSWORD_FILE}")"

export PGPASSWORD="$(tr -d '\r\n' < "${POSTGRES_PASSWORD_FILE}")"

psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  --set app_db_user="${APP_DB_USER}" \
  --set app_db_password="${APP_DB_PASSWORD}" <<'SQL'
SET password_encryption = 'scram-sha-256';
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_db_user', :'app_db_password')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_db_user'
) \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_db_user', :'app_db_password') \gexec
SQL

psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  --set app_db_name="${APP_DB_NAME}" \
  --set app_db_user="${APP_DB_USER}" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'app_db_name', :'app_db_user')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'app_db_name'
) \gexec
SQL

psql --username "${POSTGRES_USER}" --dbname "${APP_DB_NAME}" \
  --set app_db_user="${APP_DB_USER}" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_db_user') \gexec
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'app_db_user') \gexec
SQL
