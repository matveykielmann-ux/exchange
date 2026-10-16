#!/usr/bin/env bash
# Create the first owner account via the existing CLI (no public setup endpoint).
# Re-running with the same email+role is a no-op (does not reset password or MFA).
#
# Preferred (interactive, password never on argv / never logged):
#   ./deploy/create-owner.sh --email you@example.com --name "Your Name"
#
# Local production (no Docker):
#   ENV_FILE=.env.local.production ./deploy/create-owner.sh --email owner@localhost
#
# Non-interactive (CI/automation only) — still not placed on argv:
#   ARCVALE_NEW_PASSWORD='…' ./deploy/create-owner.sh --email you@example.com --name "Your Name"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib.sh
source "$ROOT/deploy/lib.sh"

EMAIL=""
NAME=""

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

Docker VPS: requires running compose stack and .env.production
Local prod: ENV_FILE=.env.local.production ./deploy/create-owner.sh --email owner@localhost

Password (preferred): interactive hidden prompts with confirmation (min 12 chars).
Automation: ARCVALE_NEW_PASSWORD or CRYPTOBIT_NEW_PASSWORD in the environment.
EOF
      exit 0
      ;;
    *) log_err "Unknown argument: $1"; exit 2 ;;
  esac
done

[[ -n "$EMAIL" ]] || { log_err "--email is required (e.g. --email you@example.com)"; exit 2; }
if is_placeholder "$EMAIL" || [[ "$EMAIL" == *YOUR_DOMAIN* ]]; then
  log_err "Email looks like a placeholder. Replace YOUR_DOMAIN with a real mailbox."
  exit 2
fi
[[ -n "$NAME" ]] || NAME="$EMAIL"

ENV_FILE="${ENV_FILE:-$(env_file_default)}"
if [[ ! -f "$ENV_FILE" && -f "$ROOT/.env.local.production" ]]; then
  ENV_FILE="$ROOT/.env.local.production"
fi
[[ -f "$ENV_FILE" ]] || { log_err "Missing env file ($ENV_FILE)"; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mode="$(env_get APP_MODE "$ENV_FILE")"
if [[ "$mode" != "production" ]]; then
  log_err "Refusing to create owner while APP_MODE=${mode} (expected production)."
  exit 1
fi

crm="$(env_get CRM_ORIGIN "$ENV_FILE")"
if is_placeholder "$crm"; then
  log_err "CRM_ORIGIN is still a placeholder."
  exit 2
fi

PASSWORD=""
if [[ -n "${CRYPTOBIT_NEW_PASSWORD:-}" ]]; then
  PASSWORD="${CRYPTOBIT_NEW_PASSWORD}"
elif [[ -n "${ARCVALE_NEW_PASSWORD:-}" ]]; then
  PASSWORD="${ARCVALE_NEW_PASSWORD}"
fi

if [[ -z "$PASSWORD" ]]; then
  if [[ ! -t 0 ]]; then
    log_err "No TTY for password entry. Run interactively, or set ARCVALE_NEW_PASSWORD / CRYPTOBIT_NEW_PASSWORD."
    exit 2
  fi
  log "Enter owner password (hidden; min 12 characters). It will not be printed or logged."
  # shellcheck disable=SC2162
  read -r -s -p "Password: " PASSWORD
  printf '\n' >&2
  # shellcheck disable=SC2162
  read -r -s -p "Confirm password: " PASSWORD_CONFIRM
  printf '\n' >&2
  if [[ "$PASSWORD" != "$PASSWORD_CONFIRM" ]]; then
    log_err "Passwords do not match."
    exit 2
  fi
fi

if [[ ${#PASSWORD} -lt 12 ]]; then
  log_err "Password must be at least 12 characters."
  exit 2
fi

log "Creating owner via CLI (idempotent for same email+role)…"
log "Password is not echoed. TOTP secret (if printed by the CLI) is shown once — save it immediately."

set +x
USE_DOCKER=0
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if [[ -f "$ROOT/.env.production" ]] && docker compose --env-file "$ROOT/.env.production" ps --status running 2>/dev/null | grep -q app; then
    USE_DOCKER=1
  fi
fi

if [[ "$USE_DOCKER" -eq 1 ]]; then
  compose exec -T -e ARCVALE_NEW_PASSWORD="$PASSWORD" app \
    node --disable-warning=ExperimentalWarning dist-server/cli.js create-user \
    --email "$EMAIL" --role owner --name "$NAME"
else
  # Local process: env already sourced from ENV_FILE
  ARCVALE_NEW_PASSWORD="$PASSWORD" node --disable-warning=ExperimentalWarning "$ROOT/dist-server/cli.js" create-user \
    --email "$EMAIL" --role owner --name "$NAME"
fi
unset PASSWORD PASSWORD_CONFIRM CRYPTOBIT_NEW_PASSWORD ARCVALE_NEW_PASSWORD 2>/dev/null || true

log ""
log "Sign in at: ${crm}/admin/login"
log "Customer accounts cannot use staff login (staffOnly gate)."
log "Re-run is safe: existing owner with the same email is left unchanged."
