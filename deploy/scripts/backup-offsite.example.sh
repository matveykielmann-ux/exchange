#!/usr/bin/env bash
# EXAMPLE — copy local backups/ off the VPS. Do not commit real credentials.
# Adapt DEST and auth to your object storage or secondary host, then install in cron
# after ./deploy/scripts/backup.sh succeeds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${ROOT}/backups/"
# Examples (pick one and fill in):
# DEST="user@backup-host:/var/backups/cryptobit/"
# DEST="s3://your-bucket/cryptobit-backups/"
DEST="${OFFSITE_BACKUP_DEST:?Set OFFSITE_BACKUP_DEST to an rsync/scp/rclone target}"

if command -v rclone >/dev/null 2>&1 && [[ "$DEST" == *:* ]]; then
  rclone copy "$SRC" "$DEST" --checksum --exclude '*.tmp'
elif command -v rsync >/dev/null 2>&1; then
  rsync -a --checksum "$SRC" "$DEST"
else
  echo "Install rclone or rsync to ship backups off-server." >&2
  exit 1
fi

echo "Off-site copy complete → ${DEST}"
# Also back up secrets/DATA_ENCRYPTION_KEY.offline (or password-manager export) separately —
# without the key, encrypted DB fields and FILES_DIR blobs are unreadable.
