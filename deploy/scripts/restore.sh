#!/usr/bin/env bash
# Restore the Arcvale database from a backup made by backup.sh.
#   ./deploy/scripts/restore.sh backups/arcvale-20261013T031500Z.db.gz
# Stops the app, keeps the current database as a safety copy, restores, starts, and checks readiness.
set -euo pipefail

src="${1:?Usage: restore.sh <backup.db.gz>}"
# arcvale-production.db, or arcvale-sandbox.db for a sandbox instance.
DB_FILE="${DB_FILE:-arcvale-production.db}"
[ -f "$src" ] || { echo "No such file: $src" >&2; exit 1; }
if [ -f "${src}.sha256" ]; then sha256sum -c "${src}.sha256"; fi

read -r -p "This replaces the live database with ${src}. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

tmp="$(mktemp -d)"
gunzip -c "$src" > "$tmp/restore.db"

docker compose --env-file .env.production stop app
volume="$(docker compose --env-file .env.production config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')_arcvale-data"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker run --rm -v "${volume}:/data" -v "$tmp:/restore:ro" -v "$PWD/backups:/backups" alpine:3.22 sh -euc "
  db=/data/${DB_FILE}
  if [ -f \$db ]; then cp \$db /backups/pre-restore-${stamp}.db; fi
  rm -f \$db-wal \$db-shm
  cp /restore/restore.db \$db
  chown 1000:1000 \$db
"
rm -rf "$tmp"
docker compose --env-file .env.production start app
sleep 5
docker compose --env-file .env.production exec -T app node -e "fetch('http://127.0.0.1:8787/api/ready').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)})"
docker compose --env-file .env.production exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js verify-audit
echo "Restored from ${src}. The previous database was kept as backups/pre-restore-${stamp}.db"
