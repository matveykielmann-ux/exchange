# Integrator package — CryptoBit Exchange

This folder is the **handoff kit** for a professional integrator deploying CryptoBit Exchange on a VPS. It does not replace the legal/compliance gate in [`../compliance-readiness.md`](../compliance-readiness.md).

> **Nothing here deploys by itself.** You need SSH to a VPS, DNS control, and owner-supplied domains/secrets policy. Money movement stays `not_configured` until real providers are contracted and credentials are set.

## Documents in this kit

| Doc | Purpose |
| --- | --- |
| [README.md](./README.md) (this file) | Install commands, architecture map, readiness levels |
| [OWNER_HANDOFF.md](./OWNER_HANDOFF.md) | What the business owner must provide before/during install |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | How to configure each existing provider adapter |
| [ACCEPTANCE.md](./ACCEPTANCE.md) | Acceptance checklist for technical vs money go-live |
| [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) | Primary VPS + CRM subdomain runbook |
| [`../../BACKUP_RESTORE.md`](../../BACKUP_RESTORE.md) | Backup / restore details |
| [`../../VPS_CHECKLIST.md`](../../VPS_CHECKLIST.md) | Short ops checklist |
| [`../../.env.example`](../../.env.example) | Full list of variables the app actually reads |
| [`../providers.md`](../providers.md) | HTTP contract for production adapters |

## Architecture (one VPS)

| Piece | Role |
| --- | --- |
| `app` | Node 22 API + SPA + SQLite; port 8787 internal only |
| `caddy` | HTTPS for `PUBLIC_DOMAIN` and `CRM_DOMAIN` → `app:8787` |
| Volume `arcvale-data` | Legacy compose volume name (keep for compatibility) → `/app/data/arcvale-production.db` + `FILES_DIR` |
| Origins | Customer cookies on `PUBLIC_ORIGIN`; CRM cookies on `CRM_ORIGIN` (host-only) |

CoinGecko (`RATES_SOURCE=coingecko`) supplies **reference market prices only**. It does not execute exchanges, custody, or payouts.

## Local production dual-host (no VPS)

If you previously launched with the same URL for both origins, config refuses: `CRM_ORIGIN must differ from PUBLIC_ORIGIN`. Production also requires `https://`.

```bash
./deploy/configure-local-production.sh   # → .env.local.production (does not touch sandbox DB)
pnpm build && ./deploy/run-local-production.sh
ENV_FILE=.env.local.production ./deploy/create-owner.sh --email owner@local.test
# Customer: https://localhost:43127
# CRM:      https://127.0.0.1:43127/admin/login
```

## Replace placeholders before you run anything

| Token in docs | Replace with |
| --- | --- |
| `YOUR_DOMAIN` / `<REAL_DOMAIN>` | Your real public hostname, e.g. `exchange.example.com` |
| `crm.YOUR_DOMAIN` | Usually `crm.<your-domain>`, e.g. `crm.exchange.example.com` |
| `ops@YOUR_DOMAIN` / `<REAL_EMAIL>` | A real ops mailbox, e.g. `ops@example.com` |
| `you@YOUR_DOMAIN` | Owner staff email, e.g. `you@example.com` |

Scripts **refuse** values that still contain the literal string `YOUR_DOMAIN`. Do not copy-paste the cheat sheet unchanged.

## Command cheat sheet

Run from the repository root on the VPS. Values below are examples — substitute yours.

```bash
# 1) Configure (idempotent; never rotates existing DATA_ENCRYPTION_KEY)
#    REPLACE exchange.example.com and ops@example.com with your real domain + email.
./deploy/configure-env.sh --domain exchange.example.com --email ops@example.com

# 2) Preflight (prints five readiness layers: tech / DNS-TLS / backup / integrations / money)
./deploy/preflight.sh
# If DNS A records are not pointed yet:
./deploy/preflight.sh --skip-dns

# 3) Install / update stack (safe to re-run; does not wipe DB)
./deploy/install.sh
./deploy/install.sh --skip-dns          # DNS later
./deploy/install.sh --dry-run           # checks only

# 4) First owner — interactive hidden password with confirmation (preferred)
#    REPLACE you@example.com with the owner's real mailbox.
./deploy/create-owner.sh --email you@example.com --name "Owner Name"
# Sign in: https://crm.exchange.example.com/admin/login  (TOTP required)

# 5) Status
docker compose --env-file .env.production ps
docker compose --env-file .env.production exec -T app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js check-config
curl -fsS https://exchange.example.com/api/health
curl -fsS https://crm.exchange.example.com/api/health
curl -fsS https://exchange.example.com/api/ready
./deploy/preflight.sh

# 6) Backup / off-site / restore drill
./deploy/scripts/backup.sh
# OFFSITE_BACKUP_DEST='user@host:/path/' ./deploy/scripts/backup-offsite.example.sh
./deploy/scripts/restore-drill.sh backups/arcvale-YYYYMMDDTHHMMSSZ.db.gz

# 7) Upgrade / rollback (ARCVALE_IMAGE_TAG is the compose image tag env — legacy name, keep)
./deploy/scripts/upgrade.sh <git-tag-or-commit>
# Image rollback: ARCVALE_IMAGE_TAG=<previous> docker compose --env-file .env.production up -d app
# If migrations shipped: also restore pre-upgrade backup via restore.sh
```

## Readiness layers (`./deploy/preflight.sh`)

| Layer | Meaning | When YES |
| --- | --- | --- |
| **1. Application (tech)** | Env, docker, app health, `/api/ready`, owner | No tech BLOCKER/FAIL |
| **2. DNS / TLS** | A records + HTTPS health on both origins | DNS points here; `/api/health` over https |
| **3. Backups** | Local artifacts, cron, offline encryption key | backup.sh run + key stored offline |
| **4. Integrations** | Each adapter state from `check-config` | Credentials present; still needs vendor proof |
| **5. Real-money** | Compliance + contracted rails | **Never set YES by install scripts alone** |

Missing custody / bank / card / cash / KYC / screening / email providers are reported as **INCOMPLETE** (`not_configured`). They must not be described as working. CoinGecko `rates=configured` is reference pricing only.

`/api/ready` returning 200 means the **app process and DB** are ready. It does **not** mean financial services are live.

## Secrets

| Secret | Generate | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | `openssl rand -hex 32` | Auto-created by `configure-env.sh` if empty |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` | **Never rotate** on a live DB; offline copy under `secrets/` + password manager |

`.env.production` mode `600`. Never commit `.env.production`, `secrets/`, `backups/`, or customer files.

Legacy identifiers kept for compatibility (do not rename casually): compose project/volume `arcvale`, DB file `arcvale-production.db`, backup prefix `arcvale-*.db.gz`, env `ARCVALE_IMAGE_TAG` / `ARCVALE_NEW_PASSWORD`, webhook header `X-Arcvale-Signature`.
