#!/usr/bin/env bash
# Isolated restore drill: verifies a backup's SQLite + FILES_DIR without touching
# the live arcvale-data volume.
#
# Usage:
#   ./deploy/scripts/restore-drill.sh backups/arcvale-YYYYMMDDTHHMMSSZ.db.gz
#
# Requires: .env.production (DATA_ENCRYPTION_KEY), built app image.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=../lib.sh
source "$ROOT/deploy/lib.sh"

src="${1:?Usage: restore-drill.sh <backup.db.gz>}"
[[ -f "$src" ]] || { log_err "No such file: $src"; exit 1; }
if [[ -f "${src}.sha256" ]]; then sha256sum -c "${src}.sha256"; fi

base="$(basename "$src" .db.gz)"
files_src="$(dirname "$src")/${base}-files.tar.gz"
if [[ -f "$files_src" ]]; then
  if [[ -f "${files_src}.sha256" ]]; then sha256sum -c "${files_src}.sha256"; fi
else
  log_err "Sibling files archive missing: ${files_src}"
  exit 1
fi

ENV_FILE="$(env_file_default)"
[[ -f "$ENV_FILE" ]] || { log_err "Missing $ENV_FILE"; exit 1; }
if ! env_has_value DATA_ENCRYPTION_KEY "$ENV_FILE"; then
  log_err "DATA_ENCRYPTION_KEY missing from .env.production"
  exit 1
fi

tmp="$(mktemp -d "${TMPDIR:-/tmp}/arcvale-restore-drill.XXXXXX")"
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

gunzip -c "$src" >"$tmp/arcvale-production.db"
tar -xzf "$files_src" -C "$tmp"
# backup.sh stores archive members as <basename(FILES_DIR)>/... → usually ./files/
files_dir="$tmp/files"
if [[ ! -d "$files_dir" ]]; then
  log_err "Extracted archive has no files/ directory"
  exit 1
fi

log "Drill workspace: $tmp (destroyed on exit)"
log "Opening restored DB + verifying encrypted blobs with current DATA_ENCRYPTION_KEY…"

# Throwaway mounts only — never the live volume name.
compose run --rm --no-deps \
  -e DATABASE_PATH=/drill/arcvale-production.db \
  -e FILES_DIR=/drill/files \
  -v "${tmp}:/drill" \
  app node --disable-warning=ExperimentalWarning dist-server/cli.js migration-status

compose run --rm --no-deps \
  -e DATABASE_PATH=/drill/arcvale-production.db \
  -e FILES_DIR=/drill/files \
  -v "${tmp}:/drill" \
  app node --disable-warning=ExperimentalWarning dist-server/cli.js verify-audit

compose run --rm --no-deps \
  -e DATABASE_PATH=/drill/arcvale-production.db \
  -e FILES_DIR=/drill/files \
  -v "${tmp}:/drill" \
  app node --disable-warning=ExperimentalWarning dist-server/cli.js verify-storage

log ""
log "Restore drill OK. Live volume was not modified."
log "Production restore (destructive): ./deploy/scripts/restore.sh ${src}"
log "Wrong DATA_ENCRYPTION_KEY → verify-storage fails (ciphertext unreadable)."
