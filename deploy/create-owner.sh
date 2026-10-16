#!/usr/bin/env bash
# Create the first owner account via the existing CLI (no public setup endpoint).
# Re-running with the same email+role is a no-op (does not reset password or MFA).
#
# Preferred (interactive, password never on argv / never logged):
#   ./deploy/create-owner.sh --email you@example.com --name "Your Name"
#
# Non-interactive (CI/automation only) — still not placed on argv:
#   ARCVALE_NEW_PASSWORD='…' ./deploy/create-owner.sh --email you@example.com --name "Your Name"
#   (CRYPTOBIT_NEW_PASSWORD is accepted as an alias; ARCVALE_NEW_PASSWORD kept for CLI compatibility.)
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

Requires a running production stack (.env.production + compose).

Password (preferred):
  Interactive hidden prompts with confirmation (min 12 characters).
  Nothing is written to shell history as a command argument.

Automation only:
  ARCVALE_NEW_PASSWORD or CRYPTOBIT_NEW_PASSWORD in the environment
  (passed into the container via env, never as a CLI flag).

No default password. No public HTTP setup route.
Replace ADDR with a real mailbox — not you@YOUR_DOMAIN.
EOF
      exit 0
      ;;
    *) log_err "Unknown argument: $1"; exit 2 ;;
  esac
done

[[ -n "$EMAIL" ]] || { log_err "--email is required (e.g. --email you@example.com)"; exit 2; }
if is_placeholder "$EMAIL" || [[ "$EMAIL" == *YOUR_DOMAIN* ]]; then
  log_err "Email looks like a placeholder. Replace YOUR_DOMAIN with your real domain (e.g. you@example.com)."
  exit 2
fi
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
if is_placeholder "$crm"; then
  log_err "CRM_ORIGIN is still a placeholder. Run ./deploy/configure-env.sh with a real domain first."
  exit 2
fi

# Resolve password: interactive (preferred) or env alias for automation.
PASSWORD=""
if [[ -n "${CRYPTOBIT_NEW_PASSWORD:-}" ]]; then
  PASSWORD="${CRYPTOBIT_NEW_PASSWORD}"
elif [[ -n "${ARCVALE_NEW_PASSWORD:-}" ]]; then
  PASSWORD="${ARCVALE_NEW_PASSWORD}"
fi

if [[ -z "$PASSWORD" ]]; then
  if [[ ! -t 0 ]]; then
    log_err "No TTY for password entry. Run interactively, or set ARCVALE_NEW_PASSWORD / CRYPTOBIT_NEW_PASSWORD for automation."
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

# Pass password only through container env (ARCVALE_NEW_PASSWORD is what the Node CLI reads).
# Never put the password on argv. Do not enable compose logging of env.
set +x
compose exec -T -e ARCVALE_NEW_PASSWORD="$PASSWORD" app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js create-user \
  --email "$EMAIL" --role owner --name "$NAME"
unset PASSWORD PASSWORD_CONFIRM CRYPTOBIT_NEW_PASSWORD ARCVALE_NEW_PASSWORD 2>/dev/null || true

log ""
log "Sign in at: ${crm}/admin/login"
log "Customer accounts cannot use staff login (staffOnly gate)."
log "Re-run is safe: existing owner with the same email is left unchanged."
