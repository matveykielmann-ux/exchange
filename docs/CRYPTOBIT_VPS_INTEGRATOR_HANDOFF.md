# CryptoBit Exchange — VPS integrator handoff

This document is the **single entry point** for publishing CryptoBit Exchange on a VPS. It points at the live scripts and checklists in this repository. It does **not** claim the app is already deployed, that DNS is configured, or that real-money rails are live.

> **Money movement is provider-gated.** A healthy Docker stack and `/api/ready` only prove the application process and SQLite database are up. Custody, bank, card, cash, KYC, screening, and email adapters stay `not_configured` until the owner contracts vendors and supplies credentials. See [`compliance-readiness.md`](./compliance-readiness.md) and [`production-checklist.md`](./production-checklist.md).

## Related documents

| Document | Role |
| --- | --- |
| [`integrator/README.md`](./integrator/README.md) | Command cheat sheet and readiness layers |
| [`integrator/OWNER_HANDOFF.md`](./integrator/OWNER_HANDOFF.md) | What the business owner must provide |
| [`integrator/INTEGRATIONS.md`](./integrator/INTEGRATIONS.md) | Provider adapter configuration |
| [`integrator/ACCEPTANCE.md`](./integrator/ACCEPTANCE.md) | Technical / integration / real-money acceptance |
| [`../DEPLOYMENT.md`](../DEPLOYMENT.md) | Full VPS + CRM subdomain runbook |
| [`../README_DEPLOY.md`](../README_DEPLOY.md) | Shorter deploy summary |
| [`../VPS_CHECKLIST.md`](../VPS_CHECKLIST.md) | Before/after go-live checklist |
| [`../BACKUP_RESTORE.md`](../BACKUP_RESTORE.md) | Backup, restore drill, live restore |
| [`../.env.example`](../.env.example) | Complete list of env vars the app reads (no real secrets) |
| [`providers.md`](./providers.md) | HTTP contracts for production adapters |

## Architecture (one VPS)

| Piece | Role |
| --- | --- |
| `app` (Docker) | Node 22 API + built SPA + SQLite; listens on `8787` **inside** the compose network only |
| `caddy` | HTTPS for `PUBLIC_DOMAIN` and `CRM_DOMAIN` → `app:8787` ([`deploy/Caddyfile`](../deploy/Caddyfile)) |
| Volume `arcvale-data` | Persistent SQLite (`arcvale-production.db`) + encrypted `FILES_DIR` |
| Customer origin | `PUBLIC_ORIGIN=https://YOUR_DOMAIN` — customer cookies (host-only) |
| CRM origin | `CRM_ORIGIN=https://crm.YOUR_DOMAIN` — staff cookies (host-only, different host) |
| SPA routing | Same bundle: CRM host serves `/admin*`; customer host redirects `/admin*` to CRM |

Reference prices default to CoinGecko (`RATES_SOURCE=coingecko`). That feed is **not** settlement, custody, or payout infrastructure.

## Manual exchange scope (what this build supports)

| Flow | Operator path |
| --- | --- |
| Crypto → USD (sell) | Customer sends crypto → CRM deposit wallet / manual deposit confirm → ACH, wire, card, or courier payout (manual record when providers absent) |
| USD → crypto (buy) | Cash by courier, bank wire, or card pay-in → CRM fee / credentials / meeting → manual deposit confirm → crypto payout to customer wallet |
| Wire credentials | CRM credentials library; per-order issue / custom assign / replace |
| Deposit wallets | CRM wallet library; assign / replace deposit address on sell orders |
| Card data | Tokenised / masked staff views; no raw PAN storage in CRM UI |
| Order numbers | Numeric public references (migration-backed) |
| Assets / networks | Configured pairs in domain assets; CRM deposit wallets per asset+network |

Known limitation: without contracted custody / bank / cash providers, operators complete money steps **manually** in CRM. The integrator must verify those manual paths on a real VPS (acceptance §A + relevant §B) before any owner claims “live exchange.”

## VPS requirements

- Current Ubuntu LTS or Debian
- Docker Engine + Compose plugin
- ~1 vCPU, 1–2 GB RAM, ≥20 GB disk (small traffic)
- Firewall: **22 / 80 / 443** only — do **not** publish `8787`
- Outbound HTTPS for Let's Encrypt and CoinGecko (`api.coingecko.com`)
- SSH key access; prefer key-only login + unattended security updates

## DNS and HTTPS

At the DNS provider (not from this repo):

```
YOUR_DOMAIN          A    <VPS_IPV4>
crm.YOUR_DOMAIN      A    <VPS_IPV4>
```

Caddy issues Let's Encrypt certificates on first start when A records point here and ports 80/443 are open. Do not claim DNS is ready until `./deploy/preflight.sh` shows PASS for both hosts (or use `--skip-dns` only while records are pending).

## Install order (repository root on the VPS)

Replace example hostnames/emails with real values. Scripts refuse the literal string `YOUR_DOMAIN`.

```bash
sudo mkdir -p /opt/cryptobit && sudo chown "$USER" /opt/cryptobit
git clone https://github.com/matveykielmann-ux/exchange.git /opt/cryptobit
cd /opt/cryptobit
git checkout release/cryptobit-vps-handoff   # or the tag/commit the owner specifies
mkdir -p backups && sudo chown 1000:1000 backups

# 1) Idempotent env (never rotates an existing DATA_ENCRYPTION_KEY)
./deploy/configure-env.sh --domain exchange.example.com --email ops@example.com

# 2) Preflight (tech / DNS-TLS / backup / integrations / money layers)
./deploy/preflight.sh
# ./deploy/preflight.sh --skip-dns   # only if A records are not pointed yet

# 3) Install / update (safe to re-run; does not wipe DB)
./deploy/install.sh
# ./deploy/install.sh --skip-dns
# ./deploy/install.sh --dry-run

# 4) First owner — interactive hidden password (preferred)
./deploy/create-owner.sh --email you@example.com --name "Owner Name"
# Sign in: https://crm.exchange.example.com/admin/login  (enrol TOTP)

# 5) Health
docker compose --env-file .env.production ps
curl -fsS https://exchange.example.com/api/health
curl -fsS https://crm.exchange.example.com/api/health
curl -fsS https://exchange.example.com/api/ready
./deploy/preflight.sh
```

Local dual-host production smoke (no VPS): see [`integrator/README.md`](./integrator/README.md) (`configure-local-production.sh` / `run-local-production.sh`).

## Production environment (no secrets in git)

| Variable | Notes |
| --- | --- |
| `APP_MODE=production` | Rejects `SANDBOX_*` |
| `PUBLIC_DOMAIN` / `CRM_DOMAIN` | Hostnames for Caddy |
| `PUBLIC_ORIGIN` / `CRM_ORIGIN` | Must be `https://…` and **different** hosts |
| `ACME_EMAIL` | Let's Encrypt contact |
| `SESSION_SECRET` | ≥32 chars; `openssl rand -hex 32` |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32`; **store offline forever**; never rotate on a live DB |
| `RATES_SOURCE=coingecko` | Optional `COINGECKO_API_KEY` |
| `FILES_DIR` | Default `/app/data/files` on `arcvale-data` |
| Provider blocks | Only for contracted vendors — see [`.env.example`](../.env.example) |

`.env.production` must be mode `600` and **never committed**. Templates: `.env.example` only.

Validate without claiming go-live:

```bash
docker compose --env-file .env.production run --rm app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js check-config
```

Exit code 78 = configuration refused (problems listed; secret values never printed).

## Owner + MFA

- No public “claim admin” endpoint.
- Prefer `./deploy/create-owner.sh` (interactive password confirmation).
- Production expects staff MFA (`REQUIRE_STAFF_MFA`); owner enrols TOTP at first CRM login.
- Customer accounts must not access `/api/admin/*`.

## Database, files, migrations

- SQLite WAL on volume `arcvale-data`.
- Migrations run automatically on app start; they do not delete users, orders, wallets, or audit history.
- Order attachments: encrypted under `FILES_DIR`; metadata in SQLite.
- KYC blobs: encrypted in SQLite.
- Migration notes: [`migrations.md`](./migrations.md).

## Backup and restore

| Action | Command |
| --- | --- |
| Nightly backup | `./deploy/scripts/backup.sh` |
| Off-site example | `OFFSITE_BACKUP_DEST=… ./deploy/scripts/backup-offsite.example.sh` |
| Non-destructive drill | `./deploy/scripts/restore-drill.sh backups/arcvale-YYYYMMDDTHHMMSSZ.db.gz` |
| Live restore (destructive) | `./deploy/scripts/restore.sh backups/arcvale-YYYYMMDDTHHMMSSZ.db.gz` |

Details: [`BACKUP_RESTORE.md`](../BACKUP_RESTORE.md). Keep an offline copy of `DATA_ENCRYPTION_KEY` ([`secrets/README.md`](../secrets/README.md)).

## Upgrade / rollback

```bash
./deploy/scripts/upgrade.sh <git-tag-or-commit>
# Image rollback (legacy env name kept for compose compatibility):
# ARCVALE_IMAGE_TAG=<previous> docker compose --env-file .env.production up -d app
# If migrations shipped with the upgrade: restore the pre-upgrade backup via restore.sh
```

## Credentials and external integrations the owner must supply

Do **not** put real credentials in git or chat. Use a sealed channel / password manager.

| Required for first install | Optional before money go-live |
| --- | --- |
| Primary domain + CRM hostname | Custody / deposit vendor keys + webhook secret |
| ACME email | Bank ACH/wire vendor |
| VPS SSH access | Card / instant-debit vendor (tokenised) |
| DNS control for two A records | Cash courier carrier |
| Owner staff email | Hosted KYC / AML screening |
| Offline vault for `DATA_ENCRYPTION_KEY` | Transactional email ESP |
| | CoinGecko Demo/Pro key (recommended) |

## Preflight and acceptance

- Preflight layers: Application → DNS/TLS → Backups → Integrations → Real-money ([`integrator/README.md`](./integrator/README.md)).
- Acceptance rows: [`integrator/ACCEPTANCE.md`](./integrator/ACCEPTANCE.md).
- Short ops checklist: [`VPS_CHECKLIST.md`](../VPS_CHECKLIST.md).

**Verdict language**

- “Technically accepted” = acceptance section A.
- “Integrations accepted” = A + relevant B.
- “Cleared for real money” = A + B + C. Never implied by Docker health alone.

## What the integrator must verify on a real VPS

1. Dual-origin cookies: customer session absent on CRM host; staff session absent on customer host.
2. `/admin` on customer host redirects to CRM; customer cannot call `/api/admin/*`.
3. Owner MFA enrolment and staff login.
4. Migrations apply cleanly on empty volume and on upgrade.
5. Encrypted file upload/download ACL for order documents.
6. `backup.sh` + `restore-drill.sh` once on non-production data.
7. Manual CRM paths: wire credentials issue, deposit wallet assign/replace, confirm deposit, record payout/refund, courier fee + meeting for cash buys.
8. CoinGecko prices visible; quotes fail closed if the feed is down.
9. Provider webhooks reject bad signatures when a provider is configured.
10. No secrets, SQLite DBs, or `FILES_DIR` contents exposed over HTTP.

## Explicitly out of scope for this handoff package

- Changing DNS at the registrar
- Signing compliance / MSB / licensing documents
- Inventing provider credentials or simulating production money movement
- Rotating `DATA_ENCRYPTION_KEY` on an existing database
- Declaring the product “live for real money” without owner/counsel sign-off
