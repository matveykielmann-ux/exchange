#!/usr/bin/env bash
# Shared helpers for CryptoBit Exchange deploy scripts.
# Sourced by install.sh / preflight.sh / configure-env.sh — not executed alone.
# shellcheck shell=bash

ARCVALE_LIB_LOADED=1

arcvale_root() {
  # Prefer caller-set ROOT; otherwise resolve from this file's directory.
  if [[ -n "${ROOT:-}" ]]; then
    printf '%s\n' "$ROOT"
    return
  fi
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  printf '%s\n' "$here"
}

log() { printf '%s\n' "$*"; }
log_err() { printf '%s\n' "$*" >&2; }

# Never print secret values. Redact lines that look like key assignments.
redact_line() {
  local line="$1"
  if [[ "$line" =~ ^(SESSION_SECRET|DATA_ENCRYPTION_KEY|.*_API_KEY|.*_WEBHOOK_SECRET|ARCVALE_NEW_PASSWORD)= ]]; then
    printf '%s=***REDACTED***\n' "${line%%=*}"
  else
    printf '%s\n' "$line"
  fi
}

# --- status reporting (PASS / WARN / FAIL / BLOCKER) ---
REPORT_LINES=()
REPORT_HAS_BLOCKER=0
REPORT_HAS_FAIL=0

report() {
  local level="$1" code="$2" message="$3"
  REPORT_LINES+=("${level}|${code}|${message}")
  case "$level" in
    BLOCKER) REPORT_HAS_BLOCKER=1 ;;
    FAIL) REPORT_HAS_FAIL=1 ;;
  esac
  printf '[%s] %s — %s\n' "$level" "$code" "$message"
}

print_report_summary() {
  local line level code msg ready_tech ready_money
  log ""
  log "======== Preflight / install report ========"
  for line in "${REPORT_LINES[@]+"${REPORT_LINES[@]}"}"; do
    level="${line%%|*}"
    rest="${line#*|}"
    code="${rest%%|*}"
    msg="${rest#*|}"
    printf '  %-8s %-28s %s\n' "$level" "$code" "$msg"
  done
  log "--------------------------------------------"
  if [[ "$REPORT_HAS_BLOCKER" -eq 0 && "$REPORT_HAS_FAIL" -eq 0 ]]; then
    ready_tech="YES — application stack checks passed"
  else
    ready_tech="NO — fix BLOCKER/FAIL items before go-live"
  fi
  ready_money="NO until contracted providers are configured and compliance gate is signed"
  log "Technical readiness:  $ready_tech"
  log "Integration readiness: see provider states (NOT_CONFIGURED is expected until credentials exist)"
  log "Real-money readiness:  $ready_money"
  log "============================================"
  if [[ "$REPORT_HAS_BLOCKER" -ne 0 ]]; then
    return 2
  fi
  if [[ "$REPORT_HAS_FAIL" -ne 0 ]]; then
    return 1
  fi
  return 0
}

# --- .env helpers (never log values) ---

env_file_default() {
  printf '%s\n' "$(arcvale_root)/.env.production"
}

# Return value for KEY from FILE, empty if missing. Strips surrounding quotes.
env_get() {
  local key="$1" file="$2" line val
  [[ -f "$file" ]] || { printf '\n'; return 0; }
  line="$(grep -E "^${key}=" "$file" | tail -n1 || true)"
  [[ -n "$line" ]] || { printf '\n'; return 0; }
  val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" =~ ^\".*\"$ ]]; then val="${val:1:${#val}-2}"; fi
  if [[ "$val" =~ ^\'.*\'$ ]]; then val="${val:1:${#val}-2}"; fi
  printf '%s\n' "$val"
}

env_has_value() {
  local key="$1" file="$2" val
  val="$(env_get "$key" "$file")"
  [[ -n "$val" ]]
}

is_placeholder() {
  local val="$1"
  case "$val" in
    ''|YOUR_DOMAIN|crm.YOUR_DOMAIN|ops@YOUR_DOMAIN|https://YOUR_DOMAIN|https://crm.YOUR_DOMAIN|change-me*|CHANGE_ME*)
      return 0
      ;;
  esac
  return 1
}

# Set KEY=VALUE only when KEY is missing or empty/placeholder. Never overwrite real secrets.
env_set_if_empty() {
  local key="$1" value="$2" file="$3" current tmp
  mkdir -p "$(dirname "$file")"
  touch "$file"
  current="$(env_get "$key" "$file")"
  if [[ -n "$current" ]] && ! is_placeholder "$current"; then
    return 0
  fi
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    # shellcheck disable=SC2002
    cat "$file" | sed -E "s|^${key}=.*|${key}=${value}|" >"$tmp"
    mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
    rm -f "$tmp"
  fi
  chmod 600 "$file" 2>/dev/null || true
}

# Refuse to replace DATA_ENCRYPTION_KEY / SESSION_SECRET when already set to a non-placeholder.
env_refuse_overwrite_secret() {
  local key="$1" file="$2" current
  current="$(env_get "$key" "$file")"
  if [[ -n "$current" ]] && ! is_placeholder "$current"; then
    return 1
  fi
  return 0
}

generate_session_secret() {
  openssl rand -hex 32
}

generate_data_encryption_key() {
  openssl rand -base64 32
}

# --- host checks ---

require_cmd() {
  local c="$1"
  command -v "$c" >/dev/null 2>&1
}

detect_public_ipv4() {
  local ip=""
  if require_cmd curl; then
    ip="$(curl -4 -fsS --max-time 5 https://ifconfig.me/ip 2>/dev/null || true)"
    [[ -z "$ip" ]] && ip="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  fi
  printf '%s\n' "$ip"
}

resolve_a() {
  local host="$1"
  if require_cmd dig; then
    dig +short A "$host" | grep -E '^[0-9.]+$' | head -n1 || true
  elif require_cmd getent; then
    getent ahostsv4 "$host" 2>/dev/null | awk '{print $1; exit}' || true
  elif require_cmd python3; then
    python3 - "$host" <<'PY' 2>/dev/null || true
import socket, sys
try:
    print(socket.getaddrinfo(sys.argv[1], None, socket.AF_INET)[0][4][0])
except Exception:
    pass
PY
  fi
}

port_listening() {
  local port="$1"
  if require_cmd ss; then
    ss -ltn "sport = :${port}" 2>/dev/null | grep -q ":${port}"
  elif require_cmd netstat; then
    netstat -ltn 2>/dev/null | grep -qE "[:.]${port}[[:space:]]"
  else
    return 1
  fi
}

compose() {
  docker compose --env-file "$(env_file_default)" "$@"
}

app_cli() {
  compose exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js "$@"
}
