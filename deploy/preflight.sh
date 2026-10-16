#!/usr/bin/env bash
# Production preflight for CryptoBit Exchange.
# Usage: ./deploy/preflight.sh [--skip-dns] [--skip-docker] [--json-summary]
# Exit: 0 ok, 1 fail, 2 blocker
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib.sh
source "$ROOT/deploy/lib.sh"

SKIP_DNS=0
SKIP_DOCKER=0
JSON_SUMMARY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-dns) SKIP_DNS=1; shift ;;
    --skip-docker) SKIP_DOCKER=1; shift ;;
    --json-summary) JSON_SUMMARY=1; shift ;;
    -h|--help)
      echo "Usage: preflight.sh [--skip-dns] [--skip-docker] [--json-summary]"
      exit 0
      ;;
    *) log_err "Unknown argument: $1"; exit 2 ;;
  esac
done

ENV_FILE="$(env_file_default)"
REPORT_LINES=()
REPORT_HAS_BLOCKER=0
REPORT_HAS_FAIL=0

# --- OS / resources ---
if [[ "$(uname -s)" == "Linux" ]]; then
  report PASS os "Linux host"
else
  report WARN os "Non-Linux host ($(uname -s)); production target is Ubuntu/Debian VPS"
fi

if require_cmd free; then
  mem_mb="$(free -m | awk '/^Mem:/ {print $2}')"
  if [[ "${mem_mb:-0}" -lt 900 ]]; then
    report WARN memory "${mem_mb}MB RAM — recommend ≥1–2GB"
  else
    report PASS memory "${mem_mb}MB RAM"
  fi
fi

if require_cmd df; then
  disk_gb="$(df -BG "$ROOT" 2>/dev/null | awk 'NR==2 {gsub(/G/,""); print $4}')"
  if [[ "${disk_gb:-0}" -lt 5 ]]; then
    report FAIL disk "Only ${disk_gb:-?}GB free under $ROOT — need ≥5GB"
  else
    report PASS disk "${disk_gb}GB free"
  fi
fi

for c in openssl curl; do
  if require_cmd "$c"; then
    report PASS "cmd_$c" "$c available"
  else
    report BLOCKER "cmd_$c" "Missing required command: $c"
  fi
done

if [[ "$SKIP_DOCKER" -eq 1 ]]; then
  if require_cmd docker; then
    report PASS cmd_docker "docker available (stack checks skipped)"
  else
    report WARN cmd_docker "docker not installed (skipped via --skip-docker)"
  fi
else
  if require_cmd docker; then
    report PASS cmd_docker "docker available"
    if docker compose version >/dev/null 2>&1; then
      report PASS docker_compose "docker compose plugin available"
    else
      report BLOCKER docker_compose "Docker Compose plugin missing (install docker-compose-plugin)"
    fi
  else
    report BLOCKER cmd_docker "Missing docker — install Docker Engine + Compose on the VPS before ./deploy/install.sh"
  fi
fi

# Ports 80/443 — warn if something unexpected holds them before install
for p in 80 443; do
  if port_listening "$p"; then
    report WARN "port_$p" "Port $p is already listening (ok if this is Caddy from a prior install)"
  else
    report PASS "port_$p" "Port $p is free"
  fi
done

# --- env ---
if [[ ! -f "$ENV_FILE" ]]; then
  report BLOCKER env_file "Missing $ENV_FILE — run ./deploy/configure-env.sh first"
else
  report PASS env_file ".env.production present"
  mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%OLp' "$ENV_FILE" 2>/dev/null || echo '?')"
  if [[ "$mode" == "600" || "$mode" == "0600" ]]; then
    report PASS env_perms "mode $mode"
  else
    report WARN env_perms "mode $mode (prefer chmod 600)"
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  for key in APP_MODE PUBLIC_DOMAIN CRM_DOMAIN ACME_EMAIL PUBLIC_ORIGIN CRM_ORIGIN SESSION_SECRET DATA_ENCRYPTION_KEY; do
    val="$(env_get "$key" "$ENV_FILE")"
    if [[ -z "$val" ]] || is_placeholder "$val"; then
      report BLOCKER "env_$key" "$key is missing or still a placeholder"
    else
      report PASS "env_$key" "$key set"
    fi
  done

  app_mode="$(env_get APP_MODE "$ENV_FILE")"
  if [[ "$app_mode" != "production" ]]; then
    report BLOCKER app_mode "APP_MODE must be production (got '${app_mode}')"
  fi

  pub="$(env_get PUBLIC_ORIGIN "$ENV_FILE")"
  crm="$(env_get CRM_ORIGIN "$ENV_FILE")"
  if [[ "$pub" == "$crm" ]]; then
    report BLOCKER origins "PUBLIC_ORIGIN and CRM_ORIGIN must differ"
  fi
  if [[ "$pub" != https://* ]] || [[ "$crm" != https://* ]]; then
    report BLOCKER origins_https "PUBLIC_ORIGIN and CRM_ORIGIN must use https://"
  fi

  files_dir="$(env_get FILES_DIR "$ENV_FILE")"
  [[ -z "$files_dir" ]] && files_dir="/app/data/files"
  if [[ "$files_dir" == /tmp/* ]] || [[ "$files_dir" == /var/tmp/* ]]; then
    report BLOCKER files_dir "FILES_DIR must not be under a temporary directory"
  else
    report PASS files_dir "FILES_DIR=${files_dir}"
  fi

  # Reject sandbox leakage
  if grep -E '^SANDBOX_[A-Z0-9_]+=' "$ENV_FILE" | grep -vE '=$|^#'; then
    report BLOCKER sandbox_env "SANDBOX_* variables must not be set in production"
  else
    report PASS sandbox_env "No SANDBOX_* overrides"
  fi

  rates="$(env_get RATES_SOURCE "$ENV_FILE")"
  if [[ "$rates" == "coingecko" || -z "$rates" ]]; then
    report PASS rates_source "RATES_SOURCE=coingecko (reference prices only; not settlement)"
  else
    report WARN rates_source "RATES_SOURCE=${rates}"
  fi

  sess="$(env_get SESSION_SECRET "$ENV_FILE")"
  if [[ ${#sess} -lt 32 ]]; then
    report BLOCKER session_secret "SESSION_SECRET must be at least 32 characters"
  fi

  dek="$(env_get DATA_ENCRYPTION_KEY "$ENV_FILE")"
  if ! printf '%s' "$dek" | openssl base64 -d >/dev/null 2>&1; then
    report FAIL data_key "DATA_ENCRYPTION_KEY is not valid base64"
  else
    # length check via python for exact 32 bytes
    blen="$(DATA_ENCRYPTION_KEY="$dek" python3 - <<'PY' 2>/dev/null || echo 0
import os, base64
print(len(base64.b64decode(os.environ["DATA_ENCRYPTION_KEY"])))
PY
)"
    if [[ "$blen" != "32" ]]; then
      report BLOCKER data_key "DATA_ENCRYPTION_KEY must decode to 32 bytes (got ${blen})"
    else
      report PASS data_key "DATA_ENCRYPTION_KEY length ok"
    fi
  fi

  if [[ -f "$ROOT/secrets/DATA_ENCRYPTION_KEY.offline" ]]; then
    report PASS key_backup "Offline key file present under secrets/ (confirm it is also stored off-server)"
  else
    report WARN key_backup "No secrets/DATA_ENCRYPTION_KEY.offline — ensure the key is stored in a password manager"
  fi
fi

# --- DNS ---
if [[ "$SKIP_DNS" -eq 1 ]]; then
  report WARN dns "DNS checks skipped (--skip-dns)"
elif [[ -f "$ENV_FILE" ]]; then
  domain="$(env_get PUBLIC_DOMAIN "$ENV_FILE")"
  crm_domain="$(env_get CRM_DOMAIN "$ENV_FILE")"
  expected_ip="$(detect_public_ipv4)"
  if [[ -z "$expected_ip" ]]; then
    report WARN dns_self "Could not detect this host's public IPv4 — compare DNS manually"
  else
    report PASS dns_self "Host public IPv4 appears to be ${expected_ip}"
  fi
  for host in "$domain" "$crm_domain"; do
    resolved="$(resolve_a "$host")"
    if [[ -z "$resolved" ]]; then
      report FAIL "dns_$host" "No A record resolved for ${host}"
    elif [[ -n "$expected_ip" && "$resolved" != "$expected_ip" ]]; then
      report FAIL "dns_$host" "${host} → ${resolved}, expected ${expected_ip}. Update DNS before TLS can issue."
    else
      report PASS "dns_$host" "${host} → ${resolved}"
    fi
  done
fi

# --- docker / running stack ---
if [[ "$SKIP_DOCKER" -eq 1 ]]; then
  report WARN docker_stack "Docker stack checks skipped (--skip-docker)"
elif require_cmd docker && docker compose version >/dev/null 2>&1 && [[ -f "$ENV_FILE" ]]; then
  if compose ps --status running 2>/dev/null | grep -q app; then
    report PASS app_running "app container is running"
    if out="$(compose exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js check-config 2>&1)"; then
      report PASS check_config "check-config exited 0"
      if printf '%s\n' "$out" | grep -qi 'not_configured'; then
        report WARN providers "One or more money/KYC providers are NOT_CONFIGURED (expected until credentials exist)"
      fi
      if printf '%s\n' "$out" | grep -qi 'configured.*CoinGecko\|rates .*configured'; then
        report PASS rates_feed "Rates provider configured (CoinGecko reference feed)"
      fi
    else
      report BLOCKER check_config "check-config failed — fix env before continuing"
    fi

    if ready="$(compose exec -T app node -e "fetch('http://127.0.0.1:8787/api/ready').then(async r=>{const t=await r.text(); console.log(t); process.exit(r.ok?0:1)}).catch(e=>{console.error(e); process.exit(1)})" 2>&1)"; then
      report PASS api_ready "/api/ready ok"
    else
      report FAIL api_ready "/api/ready not ready: ${ready}"
    fi

    # Owner presence (count staff owners)
    owner_count="$(compose exec -T app node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
const path = process.env.DATABASE_PATH || "/app/data/arcvale-production.db";
try {
  const db = new DatabaseSync(path, { readOnly: true });
  const row = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = ?").get("owner");
  console.log(String(row?.c ?? 0));
  db.close();
} catch {
  console.log("err");
}
' 2>/dev/null | tail -n1 || echo err)"
    if [[ "$owner_count" == "err" ]]; then
      report WARN owner "Could not query owners (DB may be empty — run create-owner after first start)"
    elif [[ "$owner_count" == "0" ]]; then
      report WARN owner "No owner account yet — run ./deploy/create-owner.sh after install"
    else
      report PASS owner "Owner account(s) present: ${owner_count}"
    fi

    # Backup presence
    if ls "$ROOT"/backups/arcvale-*.db.gz >/dev/null 2>&1; then
      report PASS backups "Local backup artifacts present under backups/"
    else
      report WARN backups "No backups yet — schedule ./deploy/scripts/backup.sh after go-live"
    fi

    # HTTPS smoke (optional — only if DNS looks ok)
    pub_origin="$(env_get PUBLIC_ORIGIN "$ENV_FILE")"
    crm_origin="$(env_get CRM_ORIGIN "$ENV_FILE")"
    if [[ "$SKIP_DNS" -eq 0 ]] && require_cmd curl; then
      for origin in "$pub_origin" "$crm_origin"; do
        if curl -fsS --max-time 15 "${origin}/api/health" >/dev/null 2>&1; then
          report PASS "https_${origin}" "${origin}/api/health reachable"
        else
          report WARN "https_${origin}" "${origin}/api/health not reachable yet (DNS/TLS may still be propagating)"
        fi
      done
    fi
  else
    report WARN app_running "app container not running — install has not completed or stack is down"
  fi
fi

# Money / compliance reminder (always)
report WARN real_money "Real money movement requires contracted providers + docs/compliance-readiness.md — deploy alone is not go-live"

ec=0
print_report_summary || ec=$?

if [[ "$JSON_SUMMARY" -eq 1 ]]; then
  # Minimal machine-readable summary without secrets
  python3 - "$ec" <<'PY' || true
import json, sys
print(json.dumps({"exitCode": int(sys.argv[1]), "technicalOk": int(sys.argv[1]) == 0, "realMoneyReady": False}))
PY
fi

exit "$ec"
