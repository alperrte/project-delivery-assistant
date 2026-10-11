#!/usr/bin/env bash
# Restores a PDA database dump made by ops/backup.sh into a SCRATCH database, to prove the backup is usable.
# Linux counterpart of ops/restore.ps1, for the PRODUCTION stack (docker-compose.prod.yml).
#
# By default the dump is restored into a new database named 'pda_restore_check' on the running postgres container, a few
# checks run (table count, Flyway history, user count) and the scratch database is dropped again. The live database is
# never touched. This is the "restore drill" that must succeed before a backup is trusted.
#
# To restore into the LIVE database (disaster recovery) pass the live database name as TARGET and CONFIRM_OVERWRITE=yes.
# That replaces the contents of that database; stop the backend first:
#   docker compose -f docker-compose.prod.yml --env-file .env.prod stop backend
#
# Media: put pda-media-*.tar.gz back into the media volume with
#   docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T backend tar -xzf - -C /app/organization-media < pda-media-<timestamp>.tar.gz
#
# Usage:
#   ./ops/restore.sh /var/backups/pda/pda-db-20261015-031500.dump
#   TARGET=pda CONFIRM_OVERWRITE=yes ./ops/restore.sh /var/backups/pda/pda-db-20261015-031500.dump
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DUMP_FILE="${1:-}"
[ -n "$DUMP_FILE" ] || { echo "Usage: $0 <dump-file>" >&2; exit 1; }
[ -f "$DUMP_FILE" ] || { echo "Dump file not found: $DUMP_FILE" >&2; exit 1; }

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

env_value() {
  local name="$1" default="$2" value
  value="$(grep -E "^${name}=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '\r' || true)"
  printf '%s' "${value:-$default}"
}

[ -f "$ENV_FILE" ] || { echo "Env file not found: $ENV_FILE" >&2; exit 1; }
DB_NAME="$(env_value DB_NAME pda)"
DB_USERNAME="$(env_value DB_USERNAME pda)"
TARGET="${TARGET:-pda_restore_check}"

[[ "$TARGET" =~ ^[A-Za-z0-9_]+$ ]] || { echo "TARGET must contain only letters, digits and underscores." >&2; exit 1; }
SCRATCH=1
if [ "$TARGET" = "$DB_NAME" ]; then
  SCRATCH=0
  [ "${CONFIRM_OVERWRITE:-}" = "yes" ] || {
    echo "'$TARGET' is the live database. Set CONFIRM_OVERWRITE=yes only for a deliberate disaster recovery." >&2
    exit 1
  }
fi

[ -n "$("${COMPOSE[@]}" ps -q postgres)" ] || { echo "The postgres container is not running." >&2; exit 1; }

psql_in() { "${COMPOSE[@]}" exec -T postgres psql -U "$DB_USERNAME" "$@"; }

cleanup() {
  "${COMPOSE[@]}" exec -T postgres rm -f /tmp/pda-restore.dump >/dev/null 2>&1 || true
  if [ "$SCRATCH" = 1 ]; then
    psql_in -d postgres -c "DROP DATABASE IF EXISTS $TARGET" >/dev/null 2>&1 || true
    echo "Scratch database '$TARGET' dropped."
  fi
}
trap cleanup EXIT

"${COMPOSE[@]}" exec -T postgres sh -c 'cat > /tmp/pda-restore.dump' < "$DUMP_FILE"

if [ "$SCRATCH" = 1 ]; then
  psql_in -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $TARGET" -c "CREATE DATABASE $TARGET"
  "${COMPOSE[@]}" exec -T postgres pg_restore -U "$DB_USERNAME" -d "$TARGET" --no-owner --exit-on-error /tmp/pda-restore.dump
else
  "${COMPOSE[@]}" exec -T postgres pg_restore -U "$DB_USERNAME" -d "$TARGET" --clean --if-exists --no-owner --exit-on-error /tmp/pda-restore.dump
fi

echo "Restore finished. Checks on '$TARGET':"
psql_in -d "$TARGET" -At \
  -c "SELECT 'tables', count(*) FROM information_schema.tables WHERE table_schema='public'" \
  -c "SELECT 'flyway migrations', count(*) FROM flyway_schema_history WHERE success" \
  -c "SELECT 'users', count(*) FROM users"
