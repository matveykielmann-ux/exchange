# Integrator package — CryptoBit Exchange

This folder is the **handoff kit** for a professional integrator deploying CryptoBit Exchange on a VPS. It does not replace the legal/compliance gate in [`../compliance-readiness.md`](../compliance-readiness.md).

> **Nothing here deploys by itself.** You need SSH to a VPS, DNS control, and owner-supplied domains/secrets policy. Money movement stays `NOT_CONFIGURED` until real providers are contracted and credentials are set.

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
| Volume `arcvale-data` | `/app/data/arcvale-production.db` + `FILES_DIR` (default `/app/data/files`) |
| Origins | Customer cookies on `PUBLIC_ORIGIN`; CRM cookies on `CRM_ORIGIN` (host-only) |

CoinGecko (`RATES_SOURCE=coingecko`) supplies **reference market prices only**. It does not execute exchanges, custody, or payouts.

## Command cheat sheet

Run from the repository root on the VPS.

```bash
# 1) Configure (idempotent; never rotates existing DATA_ENCRYPTION_KEY)
./deploy/configure-env.sh --domain YOUR_DOMAIN --email ops@YOUR_DOMAIN

# 2) Preflight (DNS, secrets, ports, docker)
./deploy/preflight.sh
# If DNS is not pointed yet:
./deploy/preflight.sh --skip-dns

# 3) Install / update stack (safe to re-run; does not wipe DB)
./deploy/install.sh
./deploy/install.sh --skip-dns          # DNS later
./deploy/install.sh --dry-run           # checks only

# 4) First owner (CLI only; no public setup URL; re-run is a no-op)
ARCVALE_NEW_PASSWORD='…' ./deploy/create-owner.sh --email you@YOUR_DOMAIN --name "Owner Name"
# Sign in: https://crm.YOUR_DOMAIN/admin/login  (TOTP required)

# 5) Status
docker compose --env-file .env.production ps
docker compose --env-file .env.production exec -T app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js check-config
curl -fsS https://YOUR_DOMAIN/api/health
curl -fsS https://crm.YOUR_DOMAIN/api/health
curl -fsS https://YOUR_DOMAIN/api/ready
./deploy/preflight.sh

# 6) Backup / off-site / restore drill
./deploy/scripts/backup.sh
# OFFSITE_BACKUP_DEST='user@host:/path/' ./deploy/scripts/backup-offsite.example.sh
./deploy/scripts/restore-drill.sh backups/arcvale-YYYYMMDDTHHMMSSZ.db.gz

# 7) Upgrade / rollback
./deploy/scripts/upgrade.sh <git-tag-or-commit>
# Image rollback: ARCVALE_IMAGE_TAG=<previous> docker compose --env-file .env.production up -d app
# If migrations shipped: also restore pre-upgrade backup via restore.sh
```

## Readiness levels (do not conflate)

| Level | Meaning |
| --- | --- |
| **Technical** | Stack up, TLS, DB, FILES_DIR, owner, backups — `preflight` has no BLOCKER |
| **Integration** | Required money/KYC/email adapters `configured` and webhook-tested against vendor sandboxes |
| **Real money** | Compliance gate signed + contracted vendors + operational monitoring — see [`../production-checklist.md`](../production-checklist.md) |

`/api/ready` returning 200 means the **app process and DB** are ready. It does **not** mean financial services are live. Missing providers remain `not_configured` and refuse money-moving actions (no simulation in production).

## Secrets

| Secret | Generate | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | `openssl rand -hex 32` | Auto-created by `configure-env.sh` if empty |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` | **Never rotate** on a live DB; offline copy under `secrets/` + password manager |

`.env.production` mode `600`. Never commit `.env.production`, `secrets/`, `backups/`, or customer files.
