#!/usr/bin/env bash
# Restore drill in a disposable, network-isolated PostgreSQL container.
# Never connects to the live database, changes its schema, or mounts its volumes.
# On a production host, obtain explicit approval before creating this container.
# Usage: bash ops/verify-meeting-backup.sh <db.dump> <media.tar.gz> [local-image-id]
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo 'Usage: verify-meeting-backup.sh <db.dump> <media.tar.gz> [local-image-id]' >&2
  exit 2
fi
db_file="$1"
media_file="$2"
for file in "$db_file" "$media_file"; do
  [ -f "$file" ] && [ -s "$file" ] && [ -r "$file" ] || {
    echo 'Backup input missing, unreadable, or empty.' >&2; exit 2;
  }
done
command -v docker >/dev/null
command -v tar >/dev/null
command -v timeout >/dev/null
# Verify the media archive without extracting user files or printing their names.
tar -tzf "$media_file" >/dev/null 2>&1 || {
  echo 'Media archive validation failed.' >&2; exit 1;
}
image="${3:-}"
if [ -z "$image" ]; then
  image="$(docker inspect --format '{{.Image}}' pda-prod-postgres-1)"
fi
# Reuse the exact locally available image: no pull and no mutable-tag resolution.
image_id="$(docker image inspect --format '{{.Id}}' "$image")"
[[ "$image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || {
  echo 'A local PostgreSQL image is required.' >&2; exit 2;
}

scratch_id=''
cleanup() {
  if [[ "$scratch_id" =~ ^[a-f0-9]{64}$ ]]; then
    local owned
    owned="$(docker inspect --format '{{index .Config.Labels "com.pda.meeting-backup-probe"}}' "$scratch_id" 2>/dev/null || true)"
    if [ "$owned" = 'true' ]; then
      docker rm -f "$scratch_id" >/dev/null 2>&1 || {
        echo 'WARNING: scratch container cleanup failed; remove the labeled probe before continuing.' >&2
        return 1
      }
    fi
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Trust authentication is limited to Unix sockets in this disposable container.
# Network is disabled, TCP listening is disabled, and no port is published.
# All database data and internal diagnostics remain on bounded tmpfs mounts.
scratch_id="$(docker run -d --rm --pull never \
  --label com.pda.meeting-backup-probe=true \
  --network none --user postgres --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  --memory 512m --memory-swap 512m --cpus 0.5 --pids-limit 128 --shm-size 32m \
  --tmpfs /var/lib/postgresql:rw,nosuid,nodev,size=384m,mode=1777 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=8m,mode=1777 \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m,mode=1777 \
  -e POSTGRES_DB=restore_check -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$image_id" postgres -c listen_addresses= -c shared_buffers=32MB -c max_connections=10)"
[[ "$scratch_id" =~ ^[a-f0-9]{64}$ ]] || {
  echo 'Scratch container creation failed.' >&2; exit 1;
}

ready=false
for ((attempt=0; attempt<90; attempt++)); do
  # The entrypoint briefly runs a temporary server during initdb. Only the final
  # postgres PID 1 means initialization (including restore_check) has completed.
  if docker exec "$scratch_id" sh -c '[ "$(cat /proc/1/comm)" = postgres ] && pg_isready -q -U postgres -d restore_check' >/dev/null 2>&1; then
    ready=true; break
  fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$scratch_id" 2>/dev/null || true)" != true ]; then
    echo 'Scratch PostgreSQL exited during startup; no live service was changed.' >&2
    exit 1
  fi
  sleep 1
done
[ "$ready" = true ] || { echo 'Scratch PostgreSQL readiness timed out.' >&2; exit 1; }

# Feed the host-readable, mode-600 dump through stdin; no permission changes or
# permanent copy of production data. Error output may contain row data, so keep
# it inside the disposable container and never print it into operational logs.
if ! timeout 180s docker exec -i "$scratch_id" sh -c \
  'pg_restore -U postgres -d restore_check --no-owner --no-privileges --exit-on-error > /tmp/restore.out 2> /tmp/restore.err' < "$db_file"; then
  echo 'Restore drill failed. Do not deploy; inspect diagnostics through an approved private workflow.' >&2
  exit 1
fi
counts="$(docker exec "$scratch_id" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d restore_check -c \
  "SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'), (SELECT count(*) FROM public.flyway_schema_history WHERE success), (SELECT count(*) FROM public.flyway_schema_history WHERE NOT success)")"
IFS='|' read -r tables migrations failed <<< "$counts"
[[ "$tables" =~ ^[0-9]+$ && "$migrations" =~ ^[0-9]+$ && "$failed" =~ ^[0-9]+$ ]] && \
  [ "$tables" -gt 0 ] && [ "$migrations" -gt 0 ] && [ "$failed" -eq 0 ] || {
  echo 'Restored schema/history validation failed.' >&2; exit 1;
}
cleanup
scratch_id=''
printf 'PASS: isolated backup restore; tables=%s; successful_migrations=%s; media_archive=readable; scratch_removed=true\n' "$tables" "$migrations"
echo 'This verifies the selected backup, not migration upgrade, point-in-time consistency, secret recovery, or deployment readiness.'
