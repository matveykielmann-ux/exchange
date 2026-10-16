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

# --- OS / resources (tech) ---
if [[ "$(uname -s)" == "Linux" ]]; then
  report PASS os "Linux host" tech
else
  report WARN os "Non-Linux host ($(uname -s)); production target is Ubuntu/Debian VPS" tech
fi

if require_cmd free; then
  mem_mb="$(free -m | awk '/^Mem:/ {print $2}')"
  if [[ "${mem_mb:-0}" -lt 900 ]]; then
    report WARN memory "${mem_mb}MB RAM — recommend ≥1–2GB" tech
  else
    report PASS memory "${mem_mb}MB RAM" tech
  fi
fi

if require_cmd df; then
  disk_gb="$(df -BG "$ROOT" 2>/dev/null | awk 'NR==2 {gsub(/G/,""); print $4}')"
  if [[ "${disk_gb:-0}" -lt 5 ]]; then
    report FAIL disk "Only ${disk_gb:-?}GB free under $ROOT — need ≥5GB" tech
  else
    report PASS disk "${disk_gb}GB free" tech
  fi
fi

for c in openssl curl; do
  if require_cmd "$c"; then
    report PASS "cmd_$c" "$c available" tech
  else
    report BLOCKER "cmd_$c" "Missing required command: $c" tech
  fi
done

if [[ "$SKIP_DOCKER" -eq 1 ]]; then
  if require_cmd docker; then
    report PASS cmd_docker "docker available (stack checks skipped)" tech
  else
    report WARN cmd_docker "docker not installed (skipped via --skip-docker)" tech
  fi
else
  if require_cmd docker; then
    report PASS cmd_docker "docker available" tech
    if docker compose version >/dev/null 2>&1; then
      report PASS docker_compose "docker compose plugin available" tech
    else
      report BLOCKER docker_compose "Docker Compose plugin missing (install docker-compose-plugin)" tech
    fi
  else
    report BLOCKER cmd_docker "Missing docker — install Docker Engine + Compose on the VPS before ./deploy/install.sh" tech
  fi
fi

for p in 80 443; do
  if port_listening "$p"; then
    report WARN "port_$p" "Port $p is already listening (ok if this is Caddy from a prior install)" tech
  else
    report PASS "port_$p" "Port $p is free" tech
  fi
done

# --- env (tech) ---
if [[ ! -f "$ENV_FILE" ]]; then
  report BLOCKER env_file "Missing $ENV_FILE — run ./deploy/configure-env.sh --domain <REAL_DOMAIN> --email <REAL_EMAIL>" tech
else
  report PASS env_file ".env.production present" tech
  mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%OLp' "$ENV_FILE" 2>/dev/null || echo '?')"
  if [[ "$mode" == "600" || "$mode" == "0600" ]]; then
    report PASS env_perms "mode $mode" tech
  else
    report WARN env_perms "mode $mode (prefer chmod 600)" tech
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  for key in APP_MODE PUBLIC_DOMAIN CRM_DOMAIN ACME_EMAIL PUBLIC_ORIGIN CRM_ORIGIN SESSION_SECRET DATA_ENCRYPTION_KEY; do
    val="$(env_get "$key" "$ENV_FILE")"
    if is_placeholder "$val"; then
      report BLOCKER "env_$key" "$key is missing or still a placeholder — replace YOUR_DOMAIN / template values with real ones" tech
    else
      report PASS "env_$key" "$key set" tech
    fi
  done

  app_mode="$(env_get APP_MODE "$ENV_FILE")"
  if [[ "$app_mode" != "production" ]]; then
    report BLOCKER app_mode "APP_MODE must be production (got '${app_mode}')" tech
  fi

  pub="$(env_get PUBLIC_ORIGIN "$ENV_FILE")"
  crm="$(env_get CRM_ORIGIN "$ENV_FILE")"
  if [[ "$pub" == "$crm" ]]; then
    report BLOCKER origins "PUBLIC_ORIGIN and CRM_ORIGIN must differ" tech
  fi
  if [[ "$pub" != https://* ]] || [[ "$crm" != https://* ]]; then
    report BLOCKER origins_https "PUBLIC_ORIGIN and CRM_ORIGIN must use https://" tech
  fi

  files_dir="$(env_get FILES_DIR "$ENV_FILE")"
  [[ -z "$files_dir" ]] && files_dir="/app/data/files"
  if [[ "$files_dir" == /tmp/* ]] || [[ "$files_dir" == /var/tmp/* ]]; then
    report BLOCKER files_dir "FILES_DIR must not be under a temporary directory" tech
  else
    report PASS files_dir "FILES_DIR=${files_dir}" tech
  fi

  if grep -E '^SANDBOX_[A-Z0-9_]+=' "$ENV_FILE" | grep -vE '=$|^#' >/dev/null 2>&1; then
    report BLOCKER sandbox_env "SANDBOX_* variables must not be set in production" tech
  else
    report PASS sandbox_env "No SANDBOX_* overrides" tech
  fi

  rates="$(env_get RATES_SOURCE "$ENV_FILE")"
  if [[ "$rates" == "coingecko" || -z "$rates" ]]; then
    report PASS rates_source "RATES_SOURCE=coingecko (reference prices only — not settlement)" tech
  else
    report WARN rates_source "RATES_SOURCE=${rates}" tech
  fi

  sess="$(env_get SESSION_SECRET "$ENV_FILE")"
  if [[ ${#sess} -lt 32 ]]; then
    report BLOCKER session_secret "SESSION_SECRET must be at least 32 characters" tech
  fi

  dek="$(env_get DATA_ENCRYPTION_KEY "$ENV_FILE")"
  if ! printf '%s' "$dek" | openssl base64 -d >/dev/null 2>&1; then
    report FAIL data_key "DATA_ENCRYPTION_KEY is not valid base64" tech
  else
    blen="$(DATA_ENCRYPTION_KEY="$dek" python3 - <<'PY' 2>/dev/null || echo 0
import os, base64
print(len(base64.b64decode(os.environ["DATA_ENCRYPTION_KEY"])))
PY
)"
    if [[ "$blen" != "32" ]]; then
      report BLOCKER data_key "DATA_ENCRYPTION_KEY must decode to 32 bytes (got ${blen})" tech
    else
      report PASS data_key "DATA_ENCRYPTION_KEY length ok" tech
    fi
  fi

  if [[ -f "$ROOT/secrets/DATA_ENCRYPTION_KEY.offline" ]]; then
    report PASS key_backup "Offline key file present under secrets/ (also store off-server)" backup
  else
    report WARN key_backup "No secrets/DATA_ENCRYPTION_KEY.offline — ensure the key is in a password manager" backup
  fi
fi

# --- DNS / TLS ---
if [[ "$SKIP_DNS" -eq 1 ]]; then
  report WARN dns "DNS checks skipped (--skip-dns) — TLS cannot be confirmed" dns
elif [[ -f "$ENV_FILE" ]]; then
  domain="$(env_get PUBLIC_DOMAIN "$ENV_FILE")"
  crm_domain="$(env_get CRM_DOMAIN "$ENV_FILE")"
  if is_placeholder "$domain" || is_placeholder "$crm_domain"; then
    report BLOCKER dns_placeholder "Domain values still contain YOUR_DOMAIN / placeholders" dns
  else
    expected_ip="$(detect_public_ipv4)"
    if [[ -z "$expected_ip" ]]; then
      report WARN dns_self "Could not detect this host's public IPv4 — compare DNS manually" dns
    else
      report PASS dns_self "Host public IPv4 appears to be ${expected_ip}" dns
    fi
    dns_ok=1
    for host in "$domain" "$crm_domain"; do
      resolved="$(resolve_a "$host")"
      if [[ -z "$resolved" ]]; then
        report FAIL "dns_$host" "No A record resolved for ${host} — create DNS before TLS can issue" dns
        dns_ok=0
      elif [[ -n "$expected_ip" && "$resolved" != "$expected_ip" ]]; then
        report FAIL "dns_$host" "${host} → ${resolved}, expected ${expected_ip}" dns
        dns_ok=0
      else
        report PASS "dns_$host" "${host} → ${resolved}" dns
      fi
    done
    if [[ "$dns_ok" -eq 1 ]]; then
      report PASS dns_ready "DNS A records look ready for ACME/TLS" dns
    fi
  fi
fi

# --- docker / running stack ---
INCOMPLETE_PROVIDERS=()
CONFIGURED_MONEY=0

if [[ "$SKIP_DOCKER" -eq 1 ]]; then
  report WARN docker_stack "Docker stack checks skipped (--skip-docker)" tech
  report WARN integrations_skip "Provider states not queried (stack skipped) — treat money integrations as incomplete" integrations
elif require_cmd docker && docker compose version >/dev/null 2>&1 && [[ -f "$ENV_FILE" ]]; then
  if compose ps --status running 2>/dev/null | grep -q app; then
    report PASS app_running "app container is running" tech
    if out="$(compose exec -T app node --disable-warning=ExperimentalWarning dist-server/cli.js check-config 2>&1)"; then
      report PASS check_config "check-config exited 0" tech
      # Parse provider lines: "  key   state   detail"
      while IFS= read -r pline; do
        [[ "$pline" =~ ^[[:space:]]*([a-zA-Z]+)[[:space:]]+([a-z_]+)[[:space:]]+ ]] || continue
        pkey="${BASH_REMATCH[1]}"
        pstate="${BASH_REMATCH[2]}"
        case "$pkey" in
          rates)
            if [[ "$pstate" == "configured" ]]; then
              report PASS rates_feed "rates=${pstate} (CoinGecko/reference — not settlement)" tech
            else
              report WARN rates_feed "rates=${pstate}" tech
            fi
            ;;
          custody|identity|screening|bankPayout|cardPayout|cash|email)
            if [[ "$pstate" == "configured" ]]; then
              report PASS "provider_$pkey" "${pkey}=configured (credentials present; still needs vendor sandbox proof)" integrations
              CONFIGURED_MONEY=1
            elif [[ "$pstate" == "disabled_by_policy" ]]; then
              report WARN "provider_$pkey" "${pkey}=disabled_by_policy (credentials present but policy gate off)" integrations
              INCOMPLETE_PROVIDERS+=("$pkey")
            else
              report WARN "provider_$pkey" "${pkey}=${pstate} — INCOMPLETE; money/KYC/email actions that need it are refused" integrations
              INCOMPLETE_PROVIDERS+=("$pkey")
            fi
            ;;
        esac
      done <<<"$out"
      if [[ ${#INCOMPLETE_PROVIDERS[@]} -gt 0 ]]; then
        report WARN integrations_incomplete "Incomplete integrations: ${INCOMPLETE_PROVIDERS[*]}" integrations
      else
        report PASS integrations_complete "All listed adapters report configured (still not real-money clearance)" integrations
      fi
    else
      report BLOCKER check_config "check-config failed — fix env before continuing" tech
      report WARN integrations_unknown "Could not read provider states" integrations
    fi

    if compose exec -T app node -e "fetch('http://127.0.0.1:8787/api/ready').then(async r=>{const t=await r.text(); console.log(t); process.exit(r.ok?0:1)}).catch(e=>{console.error(e); process.exit(1)})" >/dev/null 2>&1; then
      report PASS api_ready "/api/ready ok (process + DB — not financial go-live)" tech
    else
      report FAIL api_ready "/api/ready not ready" tech
    fi

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
      report WARN owner "Could not query owners — run ./deploy/create-owner.sh after first start" tech
    elif [[ "$owner_count" == "0" ]]; then
      report WARN owner "No owner account yet — run ./deploy/create-owner.sh --email <you@real-domain>" tech
    else
      report PASS owner "Owner account(s) present: ${owner_count}" tech
    fi

    if ls "$ROOT"/backups/arcvale-*.db.gz >/dev/null 2>&1; then
      report PASS backups "Local backup artifacts present under backups/" backup
      if crontab -l 2>/dev/null | grep -Fq "deploy/scripts/backup.sh"; then
        report PASS backup_cron "Nightly backup cron installed" backup
      else
        report WARN backup_cron "No backup cron line found — schedule ./deploy/scripts/backup.sh" backup
      fi
    else
      report WARN backups "No backups yet — run ./deploy/scripts/backup.sh and ship copies off-server" backup
    fi

    pub_origin="$(env_get PUBLIC_ORIGIN "$ENV_FILE")"
    crm_origin="$(env_get CRM_ORIGIN "$ENV_FILE")"
    if [[ "$SKIP_DNS" -eq 0 ]] && require_cmd curl && ! is_placeholder "$pub_origin"; then
      tls_ok=1
      for origin in "$pub_origin" "$crm_origin"; do
        if curl -fsS --max-time 15 "${origin}/api/health" >/dev/null 2>&1; then
          report PASS "https_health" "${origin}/api/health reachable over HTTPS" dns
        else
          report WARN "https_health" "${origin}/api/health not reachable yet (DNS/TLS may still be propagating)" dns
          tls_ok=0
        fi
      done
      if [[ "$tls_ok" -eq 1 ]]; then
        report PASS tls_ready "HTTPS health OK on customer + CRM origins" dns
      fi
    fi
  else
    report WARN app_running "app container not running — install has not completed or stack is down" tech
    report WARN integrations_skip "Provider states not queried — treat money integrations as incomplete" integrations
  fi
else
  report WARN integrations_skip "Docker unavailable — provider states not queried" integrations
fi

# Real-money layer is never PASS from automation alone.
if [[ ${#INCOMPLETE_PROVIDERS[@]} -gt 0 ]]; then
  report WARN real_money "Real-money NOT cleared — incomplete providers: ${INCOMPLETE_PROVIDERS[*]}. See docs/compliance-readiness.md" money
elif [[ "$CONFIGURED_MONEY" -eq 1 ]]; then
  report WARN real_money "Adapters configured in env, but real-money still requires vendor sandbox proof + compliance sign-off" money
else
  report WARN real_money "Real-money NOT cleared — deploy alone is not go-live; providers incomplete or not assessed" money
fi

ec=0
print_report_summary || ec=$?

if [[ "$JSON_SUMMARY" -eq 1 ]]; then
  python3 - "$ec" "${#INCOMPLETE_PROVIDERS[@]}" <<'PY' || true
import json, sys
print(json.dumps({
  "exitCode": int(sys.argv[1]),
  "incompleteProviderCount": int(sys.argv[2]),
  "realMoneyReady": False,
  "note": "technicalOk means no BLOCKER/FAIL; not financial clearance",
  "technicalOk": int(sys.argv[1]) == 0,
}))
PY
fi

exit "$ec"
