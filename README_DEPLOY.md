# Deploying to a VPS (summary)

> **Full runbook:** [`DEPLOYMENT.md`](DEPLOYMENT.md) · Backups: [`BACKUP_RESTORE.md`](BACKUP_RESTORE.md) · Checklist: [`VPS_CHECKLIST.md`](VPS_CHECKLIST.md)

CryptoBit Exchange on one Linux server with Docker: the app container (API + built web app + SQLite) behind Caddy for **two hostnames** — customer `https://YOUR_DOMAIN` and CRM `https://crm.YOUR_DOMAIN`. **Nothing here has been deployed.** Publishing the site is a separate, explicit decision.

> **Money movement is provider-gated.** `REAL_MONEY_ENABLED = true` in `src/config/runtime.ts` allows production adapters to become usable only when credentials are present. Providers without credentials report `NOT_CONFIGURED` and refuse money-moving steps. Neither state invents deposit addresses, confirmations, or payout references. Go-live still requires [`docs/compliance-readiness.md`](docs/compliance-readiness.md) and [`docs/production-checklist.md`](docs/production-checklist.md).

## What runs

| Piece | Where | Notes |
| --- | --- | --- |
| `app` | `Dockerfile` | Node 22, non-root `node` user, read-only root filesystem, `tini` as PID 1. Serves `/api/*` and the built web app. No npm packages at runtime. |
| Database | volume `arcvale-data` → `/app/data/arcvale-<mode>.db` | SQLite in WAL mode. Migrations run automatically at start. A database records its mode and refuses to open in the other mode. |
| `caddy` | `deploy/Caddyfile` | Automatic Let's Encrypt certificates for `PUBLIC_DOMAIN` and `CRM_DOMAIN`, HTTP→HTTPS, HSTS (no `includeSubDomains` until ready), compression, 8 MB body cap, unbuffered SSE. |
| Backups | `./backups` on the host | `deploy/scripts/backup.sh` (online, consistent `VACUUM INTO`). |

Two modes, chosen with `APP_MODE`:

- **`sandbox`**: simulated providers, seed data, sandbox lab, signed simulated webhooks. Use it for staging and demos. Keep it private (Caddy `basic_auth`, see the Caddyfile). Any `SANDBOX_*` variable is rejected in production mode.
- **`production`**: real adapters only. Each one is `NOT_CONFIGURED` until its credentials are set. Staff must use an authenticator app (`REQUIRE_STAFF_MFA` defaults to on).

## 1. Prepare the server

- A small VPS (1 vCPU, 1–2 GB RAM, 20 GB disk) running a current Debian or Ubuntu.
- A DNS `A`/`AAAA` record for your domain pointing at it.
- Docker Engine with the compose plugin: <https://docs.docker.com/engine/install/>.
- A firewall allowing only 22, 80 and 443 (`ufw allow OpenSSH; ufw allow 80; ufw allow 443; ufw enable`).
- SSH keys only; disable password login. Turn on unattended security updates.

```bash
sudo mkdir -p /opt/arcvale && sudo chown "$USER" /opt/arcvale
git clone <your repository URL> /opt/arcvale
cd /opt/arcvale
mkdir -p backups && sudo chown 1000:1000 backups   # the container's node user writes backups here
```

## 2. Configure

```bash
cp .env.example .env.production
chmod 600 .env.production
openssl rand -hex 32      # → SESSION_SECRET
openssl rand -base64 32   # → DATA_ENCRYPTION_KEY
```

Fill in `.env.production`:

- `APP_MODE`, `PUBLIC_DOMAIN`, `CRM_DOMAIN`, `ACME_EMAIL`, `PUBLIC_ORIGIN`, and `CRM_ORIGIN` (`https://YOUR_DOMAIN` and `https://crm.YOUR_DOMAIN`).
- `SESSION_SECRET` and `DATA_ENCRYPTION_KEY`. **Store the encryption key in your password manager too.** Without it, payout details and MFA secrets in the database and in every backup are unreadable.
- Provider blocks only for providers you have contracts with ([`docs/providers.md`](docs/providers.md)).

### Exchange rates (CoinGecko)

**Default.** Reference prices for BTC, ETH, USDT and USDC come from CoinGecko unless you set `RATES_SOURCE=default` (offline/tests) or configure `RATES_PROVIDER_*`. Recommended `.env.production` / local settings:

```bash
RATES_SOURCE=coingecko
# optional, recommended: a free Demo key from https://www.coingecko.com/en/api
COINGECKO_API_KEY=CG-...
# COINGECKO_API_PLAN=demo        # or pro (then the key is required)
COINGECKO_CACHE_SECONDS=30     # 10-55
```

- **Server side only.** The app server calls CoinGecko; browsers only call `/api/prices` and `/api/quotes*`, so the CSP stays `connect-src 'self'` and the key never reaches the client.
- **Outbound network.** The VPS must allow outbound HTTPS (TCP 443) to `api.coingecko.com` (`pro-api.coingecko.com` on the pro plan). Check it with `docker compose --env-file .env.production exec app node -e "fetch('https://api.coingecko.com/api/v3/ping').then(r=>console.log(r.status))"`; expect `200`.
- **Rate limits.** One request fetches all four assets and is cached for `COINGECKO_CACHE_SECONDS`, and requests are only made while someone is viewing prices, so the server makes at most ~2 requests a minute. A 429 pauses requests for the `Retry-After` period (at least a minute). The free Demo plan has a monthly call allowance; on a busy site raise the cache time or use a paid plan.
- **No fake numbers.** A cached price is served for at most 60 seconds. After that, quotes fail with "Pricing is temporarily unavailable" and the price strip shows "Rate unavailable" until CoinGecko answers again. There is no fallback to the sandbox price schedule or hardcoded values. The admin **System** page shows the last CoinGecko error.
- **Sandbox stays sandbox.** With `APP_MODE=sandbox` only the price is real: deposit addresses, payouts and orders remain simulated.
- **Live prices ≠ real money.** CoinGecko does not provide custody, deposit monitoring or payouts.
- **Rules.** CoinGecko is an aggregated, indicative source. The service rules (section 5, `/legal/terms`) say rates are determined from Binance, Coinbase, OKX and Kraken; the owner should update that clause or describe CoinGecko as indicative before using these prices for real quotes.
- **Local run.** `pnpm dev` defaults to CoinGecko. Offline: `RATES_SOURCE=default pnpm dev`.

For a sandbox staging site, set `APP_MODE=sandbox`, remove the provider blocks, and enable `basic_auth` in `deploy/Caddyfile`.

Check the configuration without starting anything:

```bash
docker compose --env-file .env.production build app
docker compose --env-file .env.production run --rm app node --disable-warning=ExperimentalWarning dist-server/cli.js check-config
```

The server refuses to start on an invalid or unsafe configuration (exit code 78) and prints every problem.

## 3. Start

```bash
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps          # app should become "healthy"
curl -fsS https://$PUBLIC_DOMAIN/api/health
curl -fsS https://$CRM_DOMAIN/api/health
curl -fsS https://$PUBLIC_DOMAIN/api/ready           # 503 lists anything not ready
```

Create the first owner account (the master account). Staff accounts are created only this way or by an owner in the CRM; public sign-up always creates customers. In production it prints a one-time authenticator secret. Re-running with the same email and role does nothing (no password reset).

```bash
ARCVALE_NEW_PASSWORD='…' docker compose --env-file .env.production exec -T app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js create-user --email you@YOUR_DOMAIN --role owner --name "Your Name"
```

Staff sign in at `https://crm.YOUR_DOMAIN/admin/login` (customer accounts refused). The customer site never shows CRM navigation when hosts are split.

Sandbox only: `... dist-server/cli.js seed` creates demo staff and customer accounts (password `sandbox-pass-2026`) and orders in several states. It refuses to run in production mode.

## 4. Operate

**Health and monitoring**
- `/api/health` (liveness) and `/api/ready` (database reachable, migrations applied, provider states) are both unauthenticated and cheap. Point an external uptime monitor at `/api/ready`.
- Docker restarts the app if its health check fails (`restart: unless-stopped`).
- The admin **System** page shows provider states, configuration warnings and the webhook log.
- Logs are JSON lines on stdout: `docker compose logs -f app`. They never include passwords, codes, tokens, full payout details or request bodies.

**Log rotation**: compose sets the `json-file` driver to keep 5 × 20 MB per container. For longer retention, ship logs to your log service with a Docker logging driver.

**Backups**
```bash
./deploy/scripts/backup.sh                 # consistent online copy → backups/arcvale-<UTC>.db.gz (+ .sha256)
crontab -e                                  # nightly:
15 3 * * * cd /opt/arcvale && ./deploy/scripts/backup.sh >> /var/log/arcvale-backup.log 2>&1
```
Backups also verify the audit-log hash chain. Copy `backups/` off the server (object storage or another host). Test a restore at least monthly on a separate machine.

**Restore**
```bash
./deploy/scripts/restore.sh backups/arcvale-20261013T031500Z.db.gz
# sandbox instance: DB_FILE=arcvale-sandbox.db ./deploy/scripts/restore.sh ...
```
It stops the app, keeps the current database as `backups/pre-restore-<UTC>.db`, restores, restarts, and checks readiness and the audit chain.

**Upgrade and rollback**
```bash
./deploy/scripts/upgrade.sh <git tag or commit>
```
It backs up first, builds an image tagged with the commit, starts it, and waits for `/api/ready`. To roll back:
```bash
ARCVALE_IMAGE_TAG=<previous tag> docker compose --env-file .env.production up -d app
```
If the new version applied a migration, roll back the database too, using the pre-upgrade backup. Migrations only move forward; see [`docs/migrations.md`](docs/migrations.md).

**Graceful shutdown**: on `SIGTERM` the server stops accepting connections, closes live-update streams, finishes in-flight requests and closes the database. Compose allows 20 s.

## Security notes

- The app sets CSP (`script-src 'self'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `frame-ancestors 'none'`. Caddy adds HSTS.
- Sessions are `HttpOnly; Secure; SameSite=Lax` cookies. Every state-changing request needs a CSRF token and a same-origin `Origin` header.
- Rate limits apply per IP on sign-in, sign-up, password reset, quotes, orders, verification, chat, live updates and webhooks; an account locks for 15 minutes after 5 failed sign-ins. `TRUST_PROXY=true` (set in compose) takes the client IP from the hop Caddy appends.
- Payout details and MFA secrets are encrypted at rest with AES-256-GCM. Card numbers are never accepted: card payouts use a token from the card provider's own form. CVV is never accepted or stored.
- Webhooks must carry a valid `X-Arcvale-Signature` (HMAC-SHA256 with a timestamp, 5-minute tolerance). Duplicate deliveries are recorded and ignored.
- Never commit `.env.production`, database files or backups. `.gitignore` and `.dockerignore` exclude them.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| App exits with code 78 | Invalid configuration. `docker compose logs app` lists every problem. Common ones: a missing secret, `PUBLIC_ORIGIN` without https in production, a `SANDBOX_*` variable in production. |
| "database belongs to sandbox mode" | The volume holds a sandbox database and `APP_MODE=production` (or the reverse). Use a separate `DATABASE_PATH`; never convert one into the other. |
| `/api/ready` returns 503 | Read the `problems` array. Pending migrations mean the app did not finish starting. Check the logs. |
| Caddy cannot get a certificate | DNS does not point at the server yet, or ports 80/443 are blocked. `docker compose logs caddy`. |
| Live updates show "Reconnecting" | A proxy is buffering `/api/events`. Keep `flush_interval -1` in the Caddyfile. Pages fall back to polling meanwhile. |
| Everyone shares one rate-limit bucket | `TRUST_PROXY` is off behind the proxy. It is set in `compose.yaml`; keep it. |
| Price strip shows "Rate unavailable" with `RATES_SOURCE=coingecko` | The server cannot reach CoinGecko or is rate limited. Check outbound HTTPS to `api.coingecko.com` and the System page; add `COINGECKO_API_KEY` or raise `COINGECKO_CACHE_SECONDS` if it says 429. |
| Quotes fail with "not available yet" | The rates provider is `NOT_CONFIGURED`. Expected in production until a rates contract exists. |
| Staff cannot sign in | Production requires an authenticator code. Re-create the account with `create-user` to get a new secret. |
| Permission denied writing backups | `sudo chown 1000:1000 backups`. |

See also [`docs/production-checklist.md`](docs/production-checklist.md) before any launch.
