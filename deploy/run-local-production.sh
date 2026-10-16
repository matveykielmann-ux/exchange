#!/usr/bin/env bash
# Start local APP_MODE=production with dual HTTPS origins (Vite + API).
# Prerequisites: ./deploy/configure-local-production.sh && pnpm build (or server build).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib.sh
source "$ROOT/deploy/lib.sh"

ENV_FILE="${ENV_FILE:-$ROOT/.env.local.production}"
SESSION_NAME="${SESSION_NAME:-cryptobit-local-prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  log "Missing $ENV_FILE — running configure-local-production.sh"
  "$ROOT/deploy/configure-local-production.sh"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Hard guards (same rules as server/config.ts)
if [[ "${APP_MODE:-}" != "production" ]]; then
  log_err "APP_MODE must be production (got '${APP_MODE:-}')."
  exit 2
fi
if [[ "${PUBLIC_ORIGIN:-}" == "${CRM_ORIGIN:-}" ]]; then
  log_err "CRM_ORIGIN must differ from PUBLIC_ORIGIN (got both ${PUBLIC_ORIGIN:-})."
  log_err "Fix: ./deploy/configure-local-production.sh"
  exit 2
fi
if [[ "${PUBLIC_ORIGIN:-}" != https://* || "${CRM_ORIGIN:-}" != https://* ]]; then
  log_err "Production origins must use https://"
  exit 2
fi
if [[ "${DATABASE_PATH:-}" == *sandbox* ]]; then
  log_err "Refusing to open a sandbox-named database in production mode."
  exit 2
fi
if [[ -f "$ROOT/data/arcvale-sandbox.db" ]]; then
  log "Note: sandbox DB at data/arcvale-sandbox.db is left untouched."
fi

cd "$ROOT"
if [[ ! -f dist-server/main.js ]]; then
  log "Building server bundle…"
  pnpm exec vite build -c vite.server.config.ts --logLevel warn
fi

log "==> check-config"
node --disable-warning=ExperimentalWarning dist-server/cli.js check-config

WEB_PORT="${WEB_PORT:-43127}"
API_PORT="${PORT:-8742}"

# Stop prior local-prod or conflicting listeners
tmux -f /exec-daemon/tmux.portal.conf kill-session -t cryptobit-dev 2>/dev/null || true
tmux -f /exec-daemon/tmux.portal.conf kill-session -t "$SESSION_NAME" 2>/dev/null || true
for p in "$WEB_PORT" "$API_PORT"; do
  pid="$(ss -ltnp 2>/dev/null | awk -v p=":$p" '$4 ~ p {print}' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)"
  [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null || true
done
sleep 1

mkdir -p /tmp
: > /tmp/cryptobit-local-prod-api.log

tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$ROOT" -- "${SHELL:-zsh}" -l
tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION_NAME:0.0" \
  "cd '$ROOT'; set -a; source '$ENV_FILE'; set +a; node --disable-warning=ExperimentalWarning dist-server/main.js >> /tmp/cryptobit-local-prod-api.log 2>&1 & echo API_PID=\$!; sleep 2; LOCAL_HTTPS=1 pnpm exec vite --host 0.0.0.0 --port ${WEB_PORT} --strictPort" \
  C-m

log "Waiting for API + Vite…"
ok=0
for i in $(seq 1 40); do
  if curl -fsSk --max-time 2 "${PUBLIC_ORIGIN}/api/health" >/dev/null 2>&1 \
    && curl -fsSk --max-time 2 "${CRM_ORIGIN}/api/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 0.5
done

if [[ "$ok" -ne 1 ]]; then
  log_err "Stack failed to become healthy. API log:"
  tail -40 /tmp/cryptobit-local-prod-api.log || true
  tmux -f /exec-daemon/tmux.portal.conf capture-pane -t "$SESSION_NAME:0.0" -p | tail -30 || true
  exit 1
fi

log ""
log "======== Local production running ========"
log "Mode:     APP_MODE=production (real adapters; missing ones stay not_configured)"
log "Customer: ${PUBLIC_ORIGIN}"
log "CRM:      ${CRM_ORIGIN}/admin/login"
log "DB:       ${DATABASE_PATH}"
log "Files:    ${FILES_DIR}"
log "Sandbox:  ./data/arcvale-sandbox.db untouched"
log ""
log "Owner (once): ENV_FILE=.env.local.production ./deploy/create-owner.sh --email owner@local.test"
log "Sign-in CRM:  ${CRM_ORIGIN}/admin/login"
log "=========================================="
