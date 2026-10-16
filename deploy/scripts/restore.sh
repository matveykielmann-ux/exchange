#!/usr/bin/env bash
# Restore the database and optional files archive from backup.sh.
#   ./deploy/scripts/restore.sh backups/arcvale-20261013T031500Z.db.gz
# Looks for a sibling arcvale-<stamp>-files.tar.gz when present.
# Stops the app, keeps the current database as a safety copy, restores, starts, and checks readiness.
set -euo pipefail

src="${1:?Usage: restore.sh <backup.db.gz>}"
# arcvale-production.db, or arcvale-sandbox.db for a sandbox instance.
DB_FILE="${DB_FILE:-arcvale-production.db}"
[ -f "$src" ] || { echo "No such file: $src" >&2; exit 1; }
if [ -f "${src}.sha256" ]; then sha256sum -c "${src}.sha256"; fi

base="$(basename "$src" .db.gz)"
files_src="$(dirname "$src")/${base}-files.tar.gz"
if [ -f "$files_src" ]; then
  if [ -f "${files_src}.sha256" ]; then sha256sum -c "${files_src}.sha256"; fi
else
  echo "Note: no sibling files archive ${files_src}; restoring database only."
  files_src=""
fi

read -r -p "This replaces the live database${files_src:+ and FILES_DIR} with ${src}. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

tmp="$(mktemp -d)"
gunzip -c "$src" > "$tmp/restore.db"
if [ -n "$files_src" ]; then cp "$files_src" "$tmp/files.tar.gz"; fi

docker compose --env-file .env.production stop app
volume="$(docker compose --env-file .env.production config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')_arcvale-data"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker run --rm -v "${volume}:/data" -v "$tmp:/restore:ro" -v "$PWD/backups:/backups" alpine:3.22 sh -euc "
  db=/data/${DB_FILE}
  if [ -f \$db ]; then cp \$db /backups/pre-restore-${stamp}.db; fi
  if [ -d /data/files ]; then tar -czf /backups/pre-restore-${stamp}-files.tar.gz -C /data files; fi
  rm -f \$db-wal \$db-shm
  cp /restore/restore.db \$db
  chown 1000:1000 \$db
  if [ -f /restore/files.tar.gz ]; then
    rm -rf /data/files
    tar -xzf /restore/files.tar.gz -C /data
    chown -R 1000:1000 /data/files 2>/dev/null || true
  fi
"
rm -rf "$tmp"
docker compose --env-file .env.production start app
sleep 5
docker compose --env-file .env.production exec -T app node -e "fetch('http://127.0.0.1:8787/api/ready').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)})"
docker compose --env-file .env.production exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js verify-audit
echo "Restored from ${src}. Previous DB kept as backups/pre-restore-${stamp}.db"
