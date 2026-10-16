#!/usr/bin/env bash
# Consistent online backup of the database (SQLite VACUUM INTO) plus encrypted
# order-attachment files under FILES_DIR, then prune old copies.
# Run from the repository root on the VPS, e.g. nightly from cron:
#   15 3 * * * cd /opt/cryptobit && ./deploy/scripts/backup.sh >> /var/log/cryptobit-backup.log 2>&1
set -euo pipefail

KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="arcvale-${stamp}.db"
files_name="arcvale-${stamp}-files.tar.gz"

mkdir -p backups
docker compose --env-file .env.production exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js backup "/app/backups/${name}"
docker compose --env-file .env.production exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js verify-audit

# Order attachments (encrypted). Default FILES_DIR is /app/data/files on the data volume.
docker compose --env-file .env.production exec -T app sh -euc '
  dir="${FILES_DIR:-/app/data/files}"
  if [ -d "$dir" ]; then
    tar -czf "/app/backups/'"${files_name}"'" -C "$(dirname "$dir")" "$(basename "$dir")"
  else
    # Empty archive so restore knows files were considered.
    tar -czf "/app/backups/'"${files_name}"'" -T /dev/null
  fi
'

gzip -9 "backups/${name}"
sha256sum "backups/${name}.gz" > "backups/${name}.gz.sha256"
sha256sum "backups/${files_name}" > "backups/${files_name}.sha256"
find backups -name 'arcvale-*.db.gz*' -mtime "+${KEEP_DAYS}" -delete
find backups -name 'arcvale-*-files.tar.gz*' -mtime "+${KEEP_DAYS}" -delete
echo "Backup written: backups/${name}.gz and backups/${files_name}"
# Copy backups off the server too (object storage, another host). A backup on the same disk is not a backup.
