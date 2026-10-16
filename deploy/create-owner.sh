#!/usr/bin/env bash
# Create the first owner account via the existing CLI (no public setup endpoint).
# Re-running with the same email+role is a no-op (does not reset password or MFA).
#
# Usage:
#   ARCVALE_NEW_PASSWORD='…' ./deploy/create-owner.sh --email you@example.com --name "Your Name"
#   ./deploy/create-owner.sh --email you@example.com   # prompts for password on TTY
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib.sh
source "$ROOT/deploy/lib.sh"

EMAIL=""
NAME=""
ROLE="owner"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email) EMAIL="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --role)
      log_err "This script only creates role=owner. Use the CLI for other staff roles."
      exit 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: create-owner.sh --email ADDR [--name "Full Name"]

Requires a running production stack (.env.production + compose).
Password via ARCVALE_NEW_PASSWORD or interactive prompt (min 12 chars).
No default password. Does not publish any HTTP setup route.
EOF
      exit 0
      ;;
    *) log_err "Unknown argument: $1"; exit 2 ;;
  esac
done

[[ -n "$EMAIL" ]] || { log_err "--email is required"; exit 2; }
[[ -n "$NAME" ]] || NAME="$EMAIL"

ENV_FILE="$(env_file_default)"
[[ -f "$ENV_FILE" ]] || { log_err "Missing $ENV_FILE"; exit 1; }

if ! compose ps --status running 2>/dev/null | grep -q app; then
  log_err "app container is not running. Start with ./deploy/install.sh first."
  exit 1
fi

mode="$(env_get APP_MODE "$ENV_FILE")"
if [[ "$mode" != "production" ]]; then
  log_err "Refusing to create owner while APP_MODE=${mode} (expected production)."
  exit 1
fi

crm="$(env_get CRM_ORIGIN "$ENV_FILE")"

log "Creating owner via CLI (idempotent for same email+role)…"
log "Password is not echoed. TOTP secret (if printed) is shown once — save it immediately."

# Pass password only through env to the container; do not put it on argv.
# shellcheck disable=SC2097,SC2098
if [[ -n "${ARCVALE_NEW_PASSWORD:-}" ]]; then
  compose exec -T -e ARCVALE_NEW_PASSWORD app \
    node --disable-warning=ExperimentalWarning dist-server/cli.js create-user \
    --email "$EMAIL" --role owner --name "$NAME"
else
  compose exec -it app \
    node --disable-warning=ExperimentalWarning dist-server/cli.js create-user \
    --email "$EMAIL" --role owner --name "$NAME"
fi

log ""
log "Sign in at: ${crm}/admin/login"
log "Customer accounts cannot use staff login (staffOnly gate)."
log "Re-run is safe: existing owner with the same email is left unchanged."
