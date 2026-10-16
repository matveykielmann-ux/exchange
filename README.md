# CryptoBit Exchange

Sell BTC, ETH, USDT, USDC, XRP, SOL or BNB and receive US dollars by bank transfer, wire, debit card or cash by courier — or buy crypto with cash collection or bank wire. The repo has a React web app, a Node API server with SQLite, an admin CRM for a single Admin role, real-time support chat, and versioned legal documents.

> **Owner-operated mode.** Standard local and VPS runs use `APP_MODE=production` with a dedicated production database and separate customer / CRM origins. Missing money-moving providers report `NOT_CONFIGURED` and never invent deposits or payouts — staff complete those steps manually in the CRM. Market reference prices come from CoinGecko. The operating entity holds no licenses. See [`docs/compliance-readiness.md`](docs/compliance-readiness.md).

## Standard local run (production mode)

Dual HTTPS hosts: customer site on `localhost`, CRM on `127.0.0.1` (cookies do not cross). Uses `./data/arcvale-production.db` and never opens the sandbox database.

```bash
pnpm install
./deploy/configure-local-production.sh   # once → .env.local.production
pnpm build
./deploy/run-local-production.sh
ENV_FILE=.env.local.production ./deploy/create-owner.sh --email owner@local.test
```

- Customer: [https://localhost:43127](https://localhost:43127)
- CRM: [https://127.0.0.1:43127/admin/login](https://127.0.0.1:43127/admin/login) (staff MFA required)
- API: `:8742` (proxied through Vite)

Or: `pnpm start:local-prod` (same as `./deploy/run-local-production.sh`).

**CRM** (`/admin`): Admin manages orders, wire credential sets, crypto wallets, identity verification, support and service status. Wire buy orders wait for the admin to assign bank details before the customer sees them. Customers upload a receipt/TXID for staff review (never auto-confirmed). Refunds are requested via support and require completed KYC before approval.

**CRM credentials** (`/admin/credentials`): manage bank wire sets and crypto deposit wallets. New orders snapshot the active set/wallet; editing credentials later never rewrites existing orders. Private keys are never stored.

## Sandbox / simulation (explicit only)

For demos and automated tests only. Uses `./data/arcvale-sandbox.db` and simulated money-moving providers. **Do not use for owner-operated operations.**

```bash
pnpm server:seed     # sandbox DB only; refused in production mode
pnpm dev             # forces APP_MODE=sandbox + sandbox DB
```

Sandbox seed, scenarios, and signed simulated webhooks cannot open the production database or send real payments.

## Fees (current product rules)

- Sell crypto → USD: exchange fee **3%**.
- Buy crypto ← USD: exchange fee **2%**.
- Wire: published **$30 bank processing fee** (separate from CryptoBit Exchange’s fee) + the exchange fee above.
- Courier: delivery cost is **calculated individually** per order; the customer must accept it before the exchange continues.
- No published order minimums; no maximum.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm server:scenarios   # in-memory sandbox scenarios only
```

## Operations

```bash
pnpm server:cli check-config
pnpm server:cli create-user --email you@example.com --role owner
pnpm server:cli backup ./backups/exchange.db
pnpm server:cli verify-audit
```

Deploying to a VPS: [`docs/integrator/README.md`](docs/integrator/README.md) (turnkey installer) · [`README_DEPLOY.md`](README_DEPLOY.md) · [`DEPLOYMENT.md`](DEPLOYMENT.md).

```bash
# Replace exchange.example.com / ops@example.com / you@example.com with real values (not YOUR_DOMAIN).
./deploy/configure-env.sh --domain exchange.example.com --email ops@example.com
./deploy/preflight.sh
./deploy/install.sh
./deploy/create-owner.sh --email you@example.com   # interactive hidden password
```

## Docs

- [Integrator package](docs/integrator/README.md), [integrations](docs/integrator/INTEGRATIONS.md), [acceptance](docs/integrator/ACCEPTANCE.md)
- [Architecture](docs/architecture.md), [providers](docs/providers.md), [migrations](docs/migrations.md)
- [Compliance readiness](docs/compliance-readiness.md), [production checklist](docs/production-checklist.md)
