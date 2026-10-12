#!/usr/bin/env bash
# Backs up the PDA database (pg_dump custom format) and the private media (organization images and chat attachments) volume of the PRODUCTION stack
# (docker-compose.prod.yml) on a Linux server. Linux counterpart of ops/backup.ps1 (which serves the local development stack).
#
# Writes two files into OUT_DIR (default /var/backups/pda):
#   pda-db-<timestamp>.dump        PostgreSQL custom-format dump (restore with ops/restore.sh or pg_restore)
#   pda-media-<timestamp>.tar.gz   Contents of the private media (organization images and chat attachments) volume (logos and covers)
# The database alone is NOT a full backup: organization images live on the media volume, the database only references them.
# Project logos, banners, profile photos and task attachments are stored in the database and are inside the dump.
#
# Nothing is deleted or modified in the running stack. Secrets are read from .env.prod and never printed.
# Keep copies OUTSIDE this server (another machine or object storage): a backup next to the data does not survive losing it.
#
# Usage (from anywhere; the script finds the repository itself):
#   ./ops/backup.sh
#   OUT_DIR=/srv/pda-backups KEEP_LAST=21 ./ops/backup.sh
# Daily at 03:15 with cron (crontab -e as the deploy user):
#   15 3 * * * /home/deploy/project-delivery-assistant/ops/backup.sh >> /var/log/pda-backup.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
OUT_DIR="${OUT_DIR:-/var/backups/pda}"
KEEP_LAST="${KEEP_LAST:-14}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

# Reads one NAME=value line without sourcing the file (some values contain characters a shell would interpret).
env_value() {
  local name="$1" default="$2" value
  value="$(grep -E "^${name}=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '\r' || true)"
  printf '%s' "${value:-$default}"
}

[ -f "$ENV_FILE" ] || { echo "Env file not found: $ENV_FILE" >&2; exit 1; }
DB_NAME="$(env_value DB_NAME pda)"
DB_USERNAME="$(env_value DB_USERNAME pda)"
MEDIA_PATH="/app/organization-media"

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
umask 077
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_FILE="$OUT_DIR/pda-db-$STAMP.dump"
MEDIA_FILE="$OUT_DIR/pda-media-$STAMP.tar.gz"

[ -n "$("${COMPOSE[@]}" ps -q postgres)" ] || { echo "The postgres container is not running." >&2; exit 1; }

echo "Dumping database '$DB_NAME' ..."
# The dump streams over stdout straight into the file: nothing is left inside the container.
if ! "${COMPOSE[@]}" exec -T postgres pg_dump -U "$DB_USERNAME" -d "$DB_NAME" -Fc > "$DB_FILE"; then
  rm -f "$DB_FILE"
  echo "pg_dump failed." >&2
  exit 1
fi
[ -s "$DB_FILE" ] || { rm -f "$DB_FILE"; echo "The database dump is empty." >&2; exit 1; }

if [ -n "$("${COMPOSE[@]}" ps -q backend)" ]; then
  echo "Archiving private media (organization images and chat attachments) from $MEDIA_PATH ..."
  if ! "${COMPOSE[@]}" exec -T backend tar -czf - -C "$MEDIA_PATH" . > "$MEDIA_FILE"; then
    rm -f "$MEDIA_FILE"
    echo "Media archive failed." >&2
    exit 1
  fi
else
  echo "WARNING: the backend container is not running: the media volume was NOT backed up (database only)." >&2
fi

# Retention of local copies: keep the newest KEEP_LAST of each kind.
for pattern in 'pda-db-*.dump' 'pda-media-*.tar.gz'; do
  # shellcheck disable=SC2012
  ls -1t "$OUT_DIR"/$pattern 2>/dev/null | tail -n +"$((KEEP_LAST + 1))" | xargs -r rm -f --
done

echo "Backup finished:"
ls -lh "$DB_FILE" "$MEDIA_FILE" 2>/dev/null || ls -lh "$DB_FILE"
