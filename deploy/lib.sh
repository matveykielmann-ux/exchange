#!/usr/bin/env bash
# Shared helpers for CryptoBit Exchange deploy scripts.
# Sourced by install.sh / preflight.sh / configure-env.sh — not executed alone.
# shellcheck shell=bash

CRYPTOBIT_LIB_LOADED=1
# Compat alias for older sourced snippets.
ARCVALE_LIB_LOADED=1

repo_root() {
  # Prefer caller-set ROOT; otherwise resolve from this file's directory.
  if [[ -n "${ROOT:-}" ]]; then
    printf '%s\n' "$ROOT"
    return
  fi
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  printf '%s\n' "$here"
}

# Backward-compatible name (scripts may still call arcvale_root).
arcvale_root() { repo_root; }

log() { printf '%s\n' "$*"; }
log_err() { printf '%s\n' "$*" >&2; }

# Never print secret values. Redact lines that look like key assignments.
redact_line() {
  local line="$1"
  if [[ "$line" =~ ^(SESSION_SECRET|DATA_ENCRYPTION_KEY|.*_API_KEY|.*_WEBHOOK_SECRET|ARCVALE_NEW_PASSWORD|CRYPTOBIT_NEW_PASSWORD)= ]]; then
    printf '%s=***REDACTED***\n' "${line%%=*}"
  else
    printf '%s\n' "$line"
  fi
}

# --- status reporting (PASS / WARN / FAIL / BLOCKER) with readiness layers ---
# Layers: tech | dns | backup | integrations | money
REPORT_LINES=()
REPORT_HAS_BLOCKER=0
REPORT_HAS_FAIL=0

report() {
  local level="$1" code="$2" message="$3" layer="${4:-tech}"
  REPORT_LINES+=("${layer}|${level}|${code}|${message}")
  case "$level" in
    BLOCKER) REPORT_HAS_BLOCKER=1 ;;
    FAIL) REPORT_HAS_FAIL=1 ;;
  esac
  printf '[%s] %s — %s\n' "$level" "$code" "$message"
}

_layer_worst() {
  # stdin: lines "layer|level|..." ; arg1 = layer name → prints PASS|WARN|FAIL|BLOCKER|NONE
  local want="$1" line level code_layer worst="NONE"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    code_layer="${line%%|*}"
    [[ "$code_layer" == "$want" ]] || continue
    rest="${line#*|}"
    level="${rest%%|*}"
    case "$level" in
      BLOCKER) worst="BLOCKER" ;;
      FAIL) [[ "$worst" != "BLOCKER" ]] && worst="FAIL" ;;
      WARN) [[ "$worst" == "NONE" || "$worst" == "PASS" ]] && worst="WARN" ;;
      PASS) [[ "$worst" == "NONE" ]] && worst="PASS" ;;
    esac
  done
  printf '%s\n' "$worst"
}

_layer_label() {
  case "$1" in
    PASS) printf 'YES' ;;
    WARN) printf 'PARTIAL (warnings)' ;;
    FAIL) printf 'NO (failures)' ;;
    BLOCKER) printf 'NO (blockers)' ;;
    *) printf 'NOT ASSESSED' ;;
  esac
}

print_report_summary() {
  local line level code msg layer
  local tech dns backup integ money
  local dump=""
  log ""
  log "======== CryptoBit Exchange preflight report ========"
  for line in "${REPORT_LINES[@]+"${REPORT_LINES[@]}"}"; do
    layer="${line%%|*}"
    rest="${line#*|}"
    level="${rest%%|*}"
    rest2="${rest#*|}"
    code="${rest2%%|*}"
    msg="${rest2#*|}"
    printf '  %-8s %-28s %s\n' "$level" "$code" "$msg"
    dump+="${line}"$'\n'
  done
  tech="$(_layer_worst tech <<<"$dump")"
  dns="$(_layer_worst dns <<<"$dump")"
  backup="$(_layer_worst backup <<<"$dump")"
  integ="$(_layer_worst integrations <<<"$dump")"
  money="$(_layer_worst money <<<"$dump")"

  log "--------------------------------------------"
  log "Readiness layers (do not conflate):"
  log "  1. Application (tech):     $(_layer_label "$tech")  [$tech]"
  log "  2. DNS / TLS:              $(_layer_label "$dns")  [$dns]"
  log "  3. Backups:                $(_layer_label "$backup")  [$backup]"
  log "  4. Integrations:           $(_layer_label "$integ")  [$integ]"
  log "  5. Real-money clearance:   $(_layer_label "$money")  [$money]"
  log ""
  log "Notes:"
  log "  • /api/ready = process + DB only — not financial go-live."
  log "  • Providers in not_configured stay blocked (no production simulation)."
  log "  • CoinGecko is reference prices only, not settlement."
  log "===================================================="
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
  printf '%s\n' "$(repo_root)/.env.production"
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

# True when value is empty or still a template placeholder (must not ship to production).
is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  # Any leftover YOUR_DOMAIN token is forbidden.
  if [[ "$val" == *YOUR_DOMAIN* ]]; then
    return 0
  fi
  case "$val" in
    change-me*|CHANGE_ME*|example.com|crm.example.com|https://example.com|https://crm.example.com)
      # Bare example.com is reserved for documentation — use a real hostname.
      return 0
      ;;
  esac
  return 1
}

# Exit non-zero with a clear message if domain/email still contain placeholders.
refuse_placeholder() {
  local label="$1" val="$2"
  if is_placeholder "$val"; then
    log_err "${label} is missing or still a placeholder (${val:-empty})."
    log_err "Replace YOUR_DOMAIN with your real hostname, e.g. exchange.example.com"
    log_err "Example: ./deploy/configure-env.sh --domain exchange.example.com --email ops@example.com"
    return 1
  fi
  return 0
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
