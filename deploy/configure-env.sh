#!/usr/bin/env bash
# Prepare .env.production for CryptoBit Exchange without overwriting live secrets.
# Usage:
#   PUBLIC_DOMAIN=example.com ACME_EMAIL=ops@example.com ./deploy/configure-env.sh
#   ./deploy/configure-env.sh --domain example.com --email ops@example.com
# Idempotent: existing SESSION_SECRET / DATA_ENCRYPTION_KEY are never replaced.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib.sh
source "$ROOT/deploy/lib.sh"

DOMAIN="${PUBLIC_DOMAIN:-}"
EMAIL="${ACME_EMAIL:-}"
CRM_SUB="${CRM_DOMAIN:-}"
FORCE_SECRETS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --crm-domain) CRM_SUB="$2"; shift 2 ;;
    --force-new-secrets)
      log_err "Refusing --force-new-secrets: rotating DATA_ENCRYPTION_KEY would make existing ciphertext unreadable."
      log_err "Generate new secrets only on a fresh install with an empty data volume."
      exit 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: configure-env.sh [--domain HOST] [--email ADDR] [--crm-domain HOST]

Creates or updates .env.production from .env.example.
Never overwrites non-empty SESSION_SECRET or DATA_ENCRYPTION_KEY.
Writes a one-time offline key reminder under secrets/ (gitignored) when a new key is generated.
EOF
      exit 0
      ;;
    *) log_err "Unknown argument: $1"; exit 2 ;;
  esac
done

ENV_FILE="$(env_file_default)"
EXAMPLE="$ROOT/.env.example"
SECRETS_DIR="$ROOT/secrets"
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR" 2>/dev/null || true

if [[ ! -f "$EXAMPLE" ]]; then
  log_err "Missing .env.example at $EXAMPLE"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "Created $ENV_FILE from .env.example (mode 600)."
else
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  log "Using existing $ENV_FILE (secrets will not be overwritten)."
fi

# Domain / origins
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(env_get PUBLIC_DOMAIN "$ENV_FILE")"
fi
if is_placeholder "$DOMAIN"; then
  if [[ -t 0 ]]; then
    read -r -p "Public domain (e.g. exchange.example.com): " DOMAIN
  else
    log_err "PUBLIC_DOMAIN is required (pass --domain or set PUBLIC_DOMAIN)."
    exit 1
  fi
fi
if is_placeholder "$DOMAIN"; then
  log_err "PUBLIC_DOMAIN still looks like a placeholder."
  exit 1
fi

if [[ -z "$CRM_SUB" ]] || is_placeholder "$CRM_SUB"; then
  CRM_SUB="crm.${DOMAIN}"
fi

if [[ -z "$EMAIL" ]]; then
  EMAIL="$(env_get ACME_EMAIL "$ENV_FILE")"
fi
if is_placeholder "$EMAIL"; then
  if [[ -t 0 ]]; then
    read -r -p "ACME email for Let's Encrypt: " EMAIL
  else
    log_err "ACME_EMAIL is required (pass --email or set ACME_EMAIL)."
    exit 1
  fi
fi

env_set_if_empty APP_MODE production "$ENV_FILE"
env_set_if_empty NODE_ENV production "$ENV_FILE"
env_set_if_empty PUBLIC_DOMAIN "$DOMAIN" "$ENV_FILE"
env_set_if_empty CRM_DOMAIN "$CRM_SUB" "$ENV_FILE"
env_set_if_empty ACME_EMAIL "$EMAIL" "$ENV_FILE"
env_set_if_empty PUBLIC_ORIGIN "https://${DOMAIN}" "$ENV_FILE"
env_set_if_empty CRM_ORIGIN "https://${CRM_SUB}" "$ENV_FILE"
env_set_if_empty FILES_DIR /app/data/files "$ENV_FILE"
env_set_if_empty DATABASE_PATH /app/data/arcvale-production.db "$ENV_FILE"
env_set_if_empty RATES_SOURCE coingecko "$ENV_FILE"
env_set_if_empty LOG_LEVEL info "$ENV_FILE"
env_set_if_empty MANUAL_REVIEW_THRESHOLD_USD 10000 "$ENV_FILE"
# Compose sets TRUST_PROXY=true; keep explicit for non-compose runs.
env_set_if_empty TRUST_PROXY true "$ENV_FILE"

NEW_SESSION=0
NEW_DATA_KEY=0

if env_refuse_overwrite_secret SESSION_SECRET "$ENV_FILE"; then
  secret="$(generate_session_secret)"
  env_set_if_empty SESSION_SECRET "$secret" "$ENV_FILE"
  NEW_SESSION=1
  log "Generated SESSION_SECRET (not printed)."
else
  log "SESSION_SECRET already set — left unchanged."
fi

if env_refuse_overwrite_secret DATA_ENCRYPTION_KEY "$ENV_FILE"; then
  key="$(generate_data_encryption_key)"
  env_set_if_empty DATA_ENCRYPTION_KEY "$key" "$ENV_FILE"
  NEW_DATA_KEY=1
  backup_file="${SECRETS_DIR}/DATA_ENCRYPTION_KEY.offline"
  # Only write offline backup when we just generated the key.
  umask 077
  printf '%s\n' "$key" >"$backup_file"
  chmod 600 "$backup_file"
  log "Generated DATA_ENCRYPTION_KEY (not printed)."
  log "OFFLINE BACKUP written to secrets/DATA_ENCRYPTION_KEY.offline (mode 600)."
  log "Copy that file to a password manager / offline vault NOW. Losing it makes encrypted data unreadable."
  log "Do not commit secrets/ to git."
else
  log "DATA_ENCRYPTION_KEY already set — left unchanged (rotation refused)."
fi

# Ensure placeholder provider blocks stay empty (do not invent credentials).
mkdir -p "$ROOT/backups"
if [[ "$(id -u)" -eq 0 ]]; then
  chown 1000:1000 "$ROOT/backups" 2>/dev/null || true
fi

log ""
log "Configuration ready:"
log "  file: $ENV_FILE"
log "  PUBLIC_DOMAIN=$(env_get PUBLIC_DOMAIN "$ENV_FILE")"
log "  CRM_DOMAIN=$(env_get CRM_DOMAIN "$ENV_FILE")"
log "  PUBLIC_ORIGIN=$(env_get PUBLIC_ORIGIN "$ENV_FILE")"
log "  CRM_ORIGIN=$(env_get CRM_ORIGIN "$ENV_FILE")"
log "  FILES_DIR=$(env_get FILES_DIR "$ENV_FILE")"
log "  RATES_SOURCE=$(env_get RATES_SOURCE "$ENV_FILE")"
log "  new SESSION_SECRET: $([[ "$NEW_SESSION" -eq 1 ]] && echo yes || echo no)"
log "  new DATA_ENCRYPTION_KEY: $([[ "$NEW_DATA_KEY" -eq 1 ]] && echo yes || echo no)"
log ""
log "Next: ./deploy/preflight.sh && ./deploy/install.sh"
