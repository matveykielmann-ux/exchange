#!/usr/bin/env bash
# Consistent online backup of the Arcvale database (SQLite VACUUM INTO), then prune old copies.
# Run from the repository root on the VPS, e.g. nightly from cron:
#   15 3 * * * cd /opt/arcvale && ./deploy/scripts/backup.sh >> /var/log/arcvale-backup.log 2>&1
set -euo pipefail

KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="arcvale-${stamp}.db"

mkdir -p backups
docker compose --env-file .env.production exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js backup "/app/backups/${name}"
docker compose --env-file .env.production exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js verify-audit
gzip -9 "backups/${name}"
sha256sum "backups/${name}.gz" > "backups/${name}.gz.sha256"
find backups -name 'arcvale-*.db.gz*' -mtime "+${KEEP_DAYS}" -delete
echo "Backup written: backups/${name}.gz"
# Copy backups off the server too (object storage, another host). A backup on the same disk is not a backup.
