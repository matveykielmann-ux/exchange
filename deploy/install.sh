#!/usr/bin/env bash
# Turnkey production installer for CryptoBit Exchange.
# Idempotent: safe to re-run. Never wipes the database, never rotates encryption keys,
# never resets an existing owner. Destructive actions are not automated.
#
# Usage (from repository root on the VPS — replace with real values, not YOUR_DOMAIN):
#   ./deploy/configure-env.sh --domain exchange.example.com --email ops@example.com
#   ./deploy/install.sh
#   ./deploy/install.sh --skip-dns          # when DNS is not pointed yet
#   ./deploy/install.sh --dry-run          # checks only; no compose up
#
# See docs/integrator/README.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib.sh
source "$ROOT/deploy/lib.sh"

SKIP_DNS=0
DRY_RUN=0
SKIP_PREFLIGHT=0
SKIP_CRON=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-dns) SKIP_DNS=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --skip-preflight) SKIP_PREFLIGHT=1; shift ;;
    --skip-cron) SKIP_CRON=1; shift ;;
    -h|--help)
      cat <<'EOF'
Usage: install.sh [--skip-dns] [--dry-run] [--skip-preflight] [--skip-cron]

Installs / updates the production Docker Compose stack:
  - verifies host, env, DNS (optional)
  - builds images, starts app + Caddy
  - waits for health
  - installs a nightly backup cron (unless --skip-cron)
  - prints next actions (owner creation, integrations)

Never deletes SQLite data, FILES_DIR, or existing secrets.
EOF
      exit 0
      ;;
    *) log_err "Unknown argument: $1"; exit 2 ;;
  esac
done

cd "$ROOT"
ENV_FILE="$(env_file_default)"

log "==> CryptoBit Exchange installer"
log "    root: $ROOT"
log "    dry-run: $DRY_RUN"

# 1) Ensure env exists
if [[ ! -f "$ENV_FILE" ]]; then
  log "No .env.production — running configure-env.sh (you will be prompted for a real domain)."
  "$ROOT/deploy/configure-env.sh"
fi

# Refuse literal template domains before any compose action.
if [[ -f "$ENV_FILE" ]]; then
  refuse_placeholder PUBLIC_DOMAIN "$(env_get PUBLIC_DOMAIN "$ENV_FILE")" || exit 2
  refuse_placeholder CRM_DOMAIN "$(env_get CRM_DOMAIN "$ENV_FILE")" || exit 2
  refuse_placeholder PUBLIC_ORIGIN "$(env_get PUBLIC_ORIGIN "$ENV_FILE")" || exit 2
  refuse_placeholder CRM_ORIGIN "$(env_get CRM_ORIGIN "$ENV_FILE")" || exit 2
  refuse_placeholder ACME_EMAIL "$(env_get ACME_EMAIL "$ENV_FILE")" || exit 2
fi

# 2) Preflight
if [[ "$SKIP_PREFLIGHT" -eq 0 ]]; then
  preflight_args=()
  [[ "$SKIP_DNS" -eq 1 ]] && preflight_args+=(--skip-dns)
  # Before first start, docker stack checks are warnings only — skip deep docker if not up
  if ! compose ps --status running 2>/dev/null | grep -q app; then
    preflight_args+=(--skip-docker)
  fi
  set +e
  "$ROOT/deploy/preflight.sh" "${preflight_args[@]}"
  pf_ec=$?
  set -e
  if [[ "$pf_ec" -eq 2 ]]; then
    log_err "Preflight reported BLOCKERs. Fix them, then re-run ./deploy/install.sh"
    exit 2
  fi
fi

# 3) Host prep (non-destructive)
mkdir -p "$ROOT/backups" "$ROOT/secrets"
chmod 700 "$ROOT/secrets" 2>/dev/null || true
chmod 600 "$ENV_FILE" 2>/dev/null || true
if [[ "$(id -u)" -eq 0 ]]; then
  chown 1000:1000 "$ROOT/backups" 2>/dev/null || true
fi

# Optional firewall hint (never auto-enable ufw — too invasive)
if require_cmd ufw && ufw status 2>/dev/null | grep -qi inactive; then
  log "NOTE: ufw is inactive. Recommended: allow 22/80/443 only. Not changing firewall automatically."
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry-run complete. Would build and start docker compose next."
  log "Command: docker compose --env-file .env.production up -d --build"
  exit 0
fi

# 4) Build + start (compose restart policy = unless-stopped → survives reboot)
log "==> Building and starting stack"
compose build app
compose up -d --remove-orphans

# 5) Wait for health
log "==> Waiting for app health"
ok=0
for i in $(seq 1 60); do
  if compose exec -T app node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  log_err "App failed to become healthy. Logs:"
  compose logs --tail=80 app || true
  exit 1
fi

# Migrations run automatically inside createApp on start — verify ready
log "==> Checking /api/ready and configuration"
compose exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js check-config
compose exec -T app node -e "fetch('http://127.0.0.1:8787/api/ready').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)})"

# 6) Cron for backups (idempotent)
if [[ "$SKIP_CRON" -eq 0 ]]; then
  cron_line="15 3 * * * cd ${ROOT} && ./deploy/scripts/backup.sh >> /var/log/cryptobit-backup.log 2>&1"
  if require_cmd crontab; then
    existing="$(crontab -l 2>/dev/null || true)"
    if printf '%s\n' "$existing" | grep -Fq "deploy/scripts/backup.sh"; then
      log "Backup cron already installed."
    else
      # Do not touch other crontab lines
      { printf '%s\n' "$existing"; printf '%s\n' "$cron_line"; } | crontab -
      log "Installed nightly backup cron (03:15 UTC)."
      log "Also copy backups/ off-server (see docs/integrator/README.md)."
    fi
  else
    log "NOTE: crontab not available — schedule ./deploy/scripts/backup.sh manually."
  fi
fi

# 7) Post-install preflight (with docker)
pf_args=()
[[ "$SKIP_DNS" -eq 1 ]] && pf_args+=(--skip-dns)
set +e
"$ROOT/deploy/preflight.sh" "${pf_args[@]}"
pf_ec=$?
set -e

pub="$(env_get PUBLIC_ORIGIN "$ENV_FILE")"
crm="$(env_get CRM_ORIGIN "$ENV_FILE")"

log ""
log "======== Install summary ========"
log "Stack:           docker compose up (restart: unless-stopped)"
log "Customer site:   ${pub}"
log "CRM:             ${crm}/admin/login"
log "Data volume:     arcvale-data (compat name) → /app/data (SQLite + FILES_DIR)"
log "Backups dir:     ${ROOT}/backups"
log ""
log "READY (application tech — not financial go-live):"
log "  - App health check passed"
log "  - Migrations applied on start"
log "  - Caddy terminates TLS for both hostnames (once DNS points here)"
log ""
log "MANUAL NEXT STEPS:"
log "  1. Confirm DNS A records for PUBLIC_DOMAIN and CRM_DOMAIN → this VPS"
log "  2. Create owner (interactive password): ./deploy/create-owner.sh --email you@$(env_get PUBLIC_DOMAIN "$ENV_FILE")"
log "  3. Sign in at ${crm}/admin/login with TOTP"
log "  4. Store DATA_ENCRYPTION_KEY offline (secrets/ + password manager)"
log "  5. Configure providers when contracts exist — see docs/integrator/INTEGRATIONS.md"
log "  6. Off-site backup: copy backups/ elsewhere nightly"
log "  7. Re-run ./deploy/preflight.sh and read the five readiness layers"
log ""
log "NOT cleared for real money:"
log "  - Providers without credentials stay not_configured and refuse money movement"
log "  - Complete docs/compliance-readiness.md before live settlement"
log "================================="

if [[ "$pf_ec" -eq 2 ]]; then
  exit 2
fi
exit 0
