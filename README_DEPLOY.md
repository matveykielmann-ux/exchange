# Deploying Arcvale to a VPS

This guide puts Arcvale on one Linux server with Docker: the app container (API + built web app + SQLite) behind Caddy, which handles HTTPS. **Nothing here has been deployed.** Publishing the site is a separate, explicit decision.

> **Real money stays off.** `REAL_MONEY_ENABLED = false` in `src/config/runtime.ts` is a code constant, not a setting. In production mode, provider adapters that move money report `DISABLED_BY_POLICY` even with credentials, and providers without credentials report `NOT_CONFIGURED`. Neither state fakes an outcome. Turning real money on is a reviewed code change made only after [`docs/compliance-readiness.md`](docs/compliance-readiness.md) and [`docs/production-checklist.md`](docs/production-checklist.md) are signed off.

## What runs

| Piece | Where | Notes |
| --- | --- | --- |
| `app` | `Dockerfile` | Node 22, non-root `node` user, read-only root filesystem, `tini` as PID 1. Serves `/api/*` and the built web app. No npm packages at runtime. |
| Database | volume `arcvale-data` → `/app/data/arcvale-<mode>.db` | SQLite in WAL mode. Migrations run automatically at start. A database records its mode and refuses to open in the other mode. |
| `caddy` | `deploy/Caddyfile` | Automatic Let's Encrypt certificates, HTTP→HTTPS, HSTS, compression, 1 MB body cap, unbuffered SSE. |
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

- `APP_MODE`, `ARCVALE_DOMAIN`, `ACME_EMAIL` and `PUBLIC_ORIGIN` (`https://` + the domain).
- `SESSION_SECRET` and `DATA_ENCRYPTION_KEY`. **Store the encryption key in your password manager too.** Without it, payout details and MFA secrets in the database and in every backup are unreadable.
- Provider blocks only for providers you have contracts with ([`docs/providers.md`](docs/providers.md)).

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
curl -fsS https://$ARCVALE_DOMAIN/api/health
curl -fsS https://$ARCVALE_DOMAIN/api/ready           # 503 lists anything not ready
```

Create the first owner account. In production it prints a one-time authenticator secret:

```bash
docker compose --env-file .env.production exec app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js create-user --email you@yourdomain --role owner --name "Your Name"
```

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
| Quotes fail with "not available yet" | The rates provider is `NOT_CONFIGURED`. Expected in production until a rates contract exists. |
| Staff cannot sign in | Production requires an authenticator code. Re-create the account with `create-user` to get a new secret. |
| Permission denied writing backups | `sudo chown 1000:1000 backups`. |

See also [`docs/production-checklist.md`](docs/production-checklist.md) before any launch.
