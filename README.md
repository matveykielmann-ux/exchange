# CryptoBit Exchange

Sell BTC, ETH, USDT, USDC, XRP, SOL or BNB and receive US dollars by bank transfer, wire, debit card or cash by courier — or buy crypto with cash collection or bank wire. The repo has a React web app, a Node API server with SQLite, an admin CRM for a single Admin role, real-time support chat, and versioned legal documents.

> **Money movement is provider-gated.** Missing providers report `NOT_CONFIGURED` and refuse money-moving steps — they never invent deposit addresses, confirmations, or payout references. Market reference prices come from CoinGecko. The operating entity holds no licenses. See [`docs/compliance-readiness.md`](docs/compliance-readiness.md).

## Run it locally

```bash
pnpm install
pnpm server:seed     # staff and sample orders (local database only)
pnpm dev             # web + API (market prices from CoinGecko by default)
```

This cloud session serves the app at [CryptoBit Exchange](http://127.0.0.1:43127) (API on `:8742`).

Market reference prices for BTC, ETH, USDT, USDC, XRP, SOL and BNB come from CoinGecko (`RATES_SOURCE=coingecko`). There is no fallback to fabricated prices if the feed is down. Offline/tests: `RATES_SOURCE=default`. Live prices do not enable custody or payouts.

**CRM** (`/admin`): a single Admin role manages orders, wire credential sets, crypto wallets, identity verification, support and service status. Wire buy orders wait for the admin to assign bank details before the customer sees them. Customers confirm payment with a receipt/TXID for staff review (never auto-confirmed). Refunds are requested via support and require completed KYC before approval.

**CRM credentials** (`/admin/credentials`): manage bank wire sets and crypto deposit wallets. New orders snapshot the active set/wallet; editing credentials later never rewrites existing orders. Private keys are never stored. XRP wallets may include a destination tag.

## Fees (current product rules)

- Exchange fee: **3%** on ACH, wire and debit.
- Wire: published **$30 bank processing fee** + **3%** exchange fee (shown as separate lines).
- Courier: delivery cost is **calculated individually** per order; the customer must accept it before the exchange continues.
- No published order minimums; no maximum.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm server:scenarios
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
./deploy/configure-env.sh --domain YOUR_DOMAIN --email ops@YOUR_DOMAIN
./deploy/preflight.sh
./deploy/install.sh
ARCVALE_NEW_PASSWORD='…' ./deploy/create-owner.sh --email you@YOUR_DOMAIN
```

## Docs

- [Integrator package](docs/integrator/README.md), [integrations](docs/integrator/INTEGRATIONS.md), [acceptance](docs/integrator/ACCEPTANCE.md)
- [Architecture](docs/architecture.md), [providers](docs/providers.md), [migrations](docs/migrations.md)
- [Compliance readiness](docs/compliance-readiness.md), [production checklist](docs/production-checklist.md)
