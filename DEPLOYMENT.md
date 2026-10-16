# Deployment — CryptoBit Exchange (VPS + CRM subdomain)

This is the primary runbook for putting the app on a VPS with:

- Customer site: `https://YOUR_DOMAIN`
- CRM: `https://crm.YOUR_DOMAIN`
- One Node process (API + built SPA + SQLite) behind Caddy
- No public exposure of the app port or the database

**Nothing in this repository deploys itself.** Publishing requires your DNS, SSH access, and an explicit start.

> Money movement stays provider-gated. Missing integrations report `NOT_CONFIGURED`. Do not treat a successful VPS deploy as “live exchange” until [`docs/compliance-readiness.md`](docs/compliance-readiness.md) and [`docs/production-checklist.md`](docs/production-checklist.md) are signed off.

## Architecture

| Piece | Role |
| --- | --- |
| `app` container | Serves `/api/*` and the SPA from `dist/`. Single SQLite DB on volume `arcvale-data`. |
| Caddy | HTTPS for `PUBLIC_DOMAIN` and `CRM_DOMAIN`, reverse-proxies both to `app:8787`. |
| Browser origins | Customer cookies stay on `PUBLIC_ORIGIN`; CRM cookies stay on `CRM_ORIGIN` (host-only, no `Domain=`). Admin APIs still require staff role + MFA. |
| SPA surface | Same JS bundle: on the CRM host only `/admin*` is shown; on the customer host `/admin*` redirects to the CRM origin. |
| Files | Encrypted order attachments under `FILES_DIR` (default `/app/data/files` on the data volume). KYC files encrypted in SQLite. No public URL to raw uploads. |

Local single-host mode (no `CRM_ORIGIN`) keeps the previous behaviour: customer site and `/admin` on one origin. Production **requires** `CRM_ORIGIN`.

## 1. DNS (you must do this)

At your DNS provider (not from this repo):

1. `A` record: `YOUR_DOMAIN` → VPS IPv4
2. `A` record: `crm.YOUR_DOMAIN` → same VPS IPv4
3. `AAAA` only if IPv6 is correctly configured end-to-end
4. Wait for propagation, then issue TLS (Caddy does this automatically on first start)

## 2. Server prep

Supported base: current Ubuntu LTS (or Debian) with Docker Engine + Compose plugin.

```bash
sudo mkdir -p /opt/cryptobit && sudo chown "$USER" /opt/cryptobit
git clone <your repository URL> /opt/cryptobit
cd /opt/cryptobit
mkdir -p backups && sudo chown 1000:1000 backups
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

Firewall: only 22, 80, 443. Do not publish port 8787.

## 3. Environment

```bash
cp .env.example .env.production
chmod 600 .env.production
openssl rand -hex 32      # → SESSION_SECRET
openssl rand -base64 32   # → DATA_ENCRYPTION_KEY
```

Required production values (placeholders only in git):

| Variable | Example shape |
| --- | --- |
| `APP_MODE` | `production` |
| `PUBLIC_DOMAIN` / `CRM_DOMAIN` | `YOUR_DOMAIN` / `crm.YOUR_DOMAIN` |
| `PUBLIC_ORIGIN` / `CRM_ORIGIN` | `https://YOUR_DOMAIN` / `https://crm.YOUR_DOMAIN` |
| `ACME_EMAIL` | ops mailbox for Let's Encrypt |
| `SESSION_SECRET` | ≥32 chars, unique |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` — store offline too |
| `RATES_SOURCE` | `coingecko` (default) |

Validate without starting:

```bash
docker compose --env-file .env.production build app
docker compose --env-file .env.production run --rm app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js check-config
```

Exit code 78 = configuration refused (problems listed; secrets never printed).

## 4. Start

```bash
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
curl -fsS https://YOUR_DOMAIN/api/health
curl -fsS https://crm.YOUR_DOMAIN/api/health
curl -fsS https://YOUR_DOMAIN/api/ready
```

Migrations apply automatically on start. They never delete users, orders, wallets, or audit history.

## 5. First administrator (CLI only)

There is no public “claim admin” endpoint. Create the owner once:

```bash
ARCVALE_NEW_PASSWORD='choose-a-strong-password' docker compose --env-file .env.production exec -T app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js create-user \
  --email you@YOUR_DOMAIN --role owner --name "Your Name"
```

- Password is never a shared default; pass via `ARCVALE_NEW_PASSWORD` or interactive stdin.
- Production prints a one-time TOTP secret — save it immediately.
- Sign in at `https://crm.YOUR_DOMAIN/admin/login` (customer accounts are refused).
- Re-running with the same email + role is a **no-op** (does not reset password or MFA).
- `seed` refuses to run when `APP_MODE=production`.

## 6. Operate

See [`BACKUP_RESTORE.md`](BACKUP_RESTORE.md) and [`VPS_CHECKLIST.md`](VPS_CHECKLIST.md).

- Health: `/api/health` (liveness), `/api/ready` (DB + migrations + provider readiness)
- Logs: `docker compose --env-file .env.production logs -f app` (JSON; no passwords / full bank details / document bodies)
- Upgrade: `./deploy/scripts/upgrade.sh <git-tag-or-commit>`
- Rollback image: `ARCVALE_IMAGE_TAG=<previous> docker compose --env-file .env.production up -d app`  
  If a migration shipped, restore the pre-upgrade DB backup as well.

## 7. Local dual-host smoke (optional)

With the existing Vite + API ports:

```bash
PUBLIC_ORIGIN=http://localhost:43127 \
CRM_ORIGIN=http://127.0.0.1:43127 \
APP_MODE=sandbox \
# …other sandbox vars…
```

Open the customer site on `localhost` and the CRM on `127.0.0.1` (different origins, same process). Cookies do not cross.

## Related files

- `.env.example` — every variable the app actually reads
- `compose.yaml`, `Dockerfile`, `deploy/Caddyfile`
- `deploy/scripts/{backup,restore,upgrade}.sh`
- [`README_DEPLOY.md`](README_DEPLOY.md) — shorter pointer + historical notes
