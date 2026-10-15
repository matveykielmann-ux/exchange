# VPS checklist — before and after go-live

Replace `YOUR_DOMAIN` with the real hostname when you deploy. This checklist does not claim the site is live.

## Before first start

- [ ] DNS `A` for `YOUR_DOMAIN` and `crm.YOUR_DOMAIN` point at the VPS
- [ ] Firewall: 22/80/443 only; app port 8787 not published
- [ ] `.env.production` mode 600; `SESSION_SECRET` and `DATA_ENCRYPTION_KEY` generated and stored offline
- [ ] `PUBLIC_ORIGIN=https://YOUR_DOMAIN` and `CRM_ORIGIN=https://crm.YOUR_DOMAIN`
- [ ] `PUBLIC_DOMAIN` / `CRM_DOMAIN` / `ACME_EMAIL` set for Caddy
- [ ] `APP_MODE=production`, no `SANDBOX_*` variables
- [ ] `RATES_SOURCE=coingecko` (or documented exception)
- [ ] `check-config` exits 0
- [ ] `backups/` writable by container UID 1000

## After `docker compose up -d`

- [ ] `https://YOUR_DOMAIN/api/health` → 200
- [ ] `https://crm.YOUR_DOMAIN/api/health` → 200
- [ ] `https://YOUR_DOMAIN/api/ready` → 200 (or 503 with an understood `problems` list)
- [ ] Customer homepage loads on `YOUR_DOMAIN` (no CRM nav)
- [ ] `YOUR_DOMAIN/admin` redirects browser to `crm.YOUR_DOMAIN`
- [ ] CRM login at `crm.YOUR_DOMAIN/admin/login`
- [ ] Owner created via `create-user`; TOTP enrolled; customer account cannot use staff login
- [ ] Staff can open orders / credentials on CRM; customer session cookie not present on CRM host
- [ ] CSRF: state-changing CRM API calls work from CRM origin; evil origin rejected
- [ ] CoinGecko prices on `/api/prices` (or explicit unavailable state — not sandbox schedule)
- [ ] Nightly `backup.sh` scheduled; off-site copy planned
- [ ] External uptime monitor on `/api/ready`

## Security smoke

- [ ] Anonymous `/api/admin/*` → 401
- [ ] Customer session on `/api/admin/*` → 403
- [ ] No stack traces in API error JSON
- [ ] HSTS present without `includeSubDomains` until every subdomain is ready
- [ ] `.env`, `backups/`, and `/app/data` not reachable over HTTP

## Not claimed by deploy alone

- [ ] Real custody / bank / cash providers contracted and configured
- [ ] Compliance launch gate signed ([`docs/compliance-readiness.md`](docs/compliance-readiness.md))
- [ ] Document storage provider (production uploads currently `NOT_CONFIGURED`)
