# Arcvale (working name): crypto-to-USD exchange

Sell BTC, ETH, USDT or USDC and receive US dollars by bank transfer, wire, debit card or cash by courier. The repo has a React web app, a Node API server with SQLite, an admin panel, real-time support chat, versioned legal documents and VPS deployment files.

> **Money movement is provider-gated.** `REAL_MONEY_ENABLED = true` allows production adapters to become usable only when credentials are present and each operation still passes server-side validation, authorization, and `isUsable` checks. Missing providers report `NOT_CONFIGURED` and refuse money-moving steps — they never invent deposit addresses, confirmations, or payout references. **Sandbox mode** (`APP_MODE=sandbox`) still simulates providers for internal testing on an isolated database. The operating entity holds no licenses. See [`docs/compliance-readiness.md`](docs/compliance-readiness.md).

## Run it (local / internal testing)

```bash
pnpm install
pnpm server:seed     # staff, a customer and orders in several states (sandbox database only)
pnpm dev             # web on http://localhost:5173, API on :8787 (APP_MODE=sandbox; market prices from CoinGecko by default)
```

Market reference prices for BTC, ETH, USDT and USDC come from CoinGecko (`RATES_SOURCE=coingecko`). There is no fallback to fabricated prices if the feed is down. Offline/tests: `RATES_SOURCE=default`. Live prices do not enable custody or payouts.

Every seeded account uses the password `sandbox-pass-2026`: `owner@`, `admin@`, `reviewer@`, `support@` and `customer@arcvale.test`. In sandbox mode sign-in and reset codes are shown on screen.

Customer-facing deposit/payout simulation controls are removed. Sandbox deposit and payout events are staff-only (`/admin` sandbox lab) or the optional server autopilot (`SANDBOX_AUTOPILOT_STEP_MS`, off by default). Production mode never registers those routes. Missing providers report `NOT_CONFIGURED` and block money-moving steps; admins can record a **manual payout** with evidence when a configured provider is not used.

**CRM credentials** (`/admin/credentials`): staff manage bank wire sets and crypto deposit wallets in the database. New orders snapshot the default active set/wallet; editing credentials later never rewrites existing orders. Issuing an address or wire details does not mean a deposit or payment was received. Private keys are never stored.

To try it locally: sign up, then go to `/exchange`. As an admin, authorize the payout in `/admin` and use the **sandbox lab** on the order to have the test provider report the result. Sandbox fixtures:
- A legal name containing "Review", "Reject" or "Sanctioned" drives the KYC result. One containing "Decline" gets payouts declined.
- Cash by courier serves every ZIP code except those starting with `999`.
- Refund address `0x…bEEF` triggers address review, and `0x…dEaD` is blocked. The refund address is asked for on the order page only when a refund is pending.
- Routing number `011000015` is a valid test routing number.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build
pnpm server:scenarios   # 14 deterministic lifecycle scenarios on a throwaway database
pnpm qa:visual          # Playwright against the built server: screenshots, axe, overflow, keyboard, the sell and buy journeys
```

## Operations

```bash
pnpm server:cli check-config      # validate env, print provider states
pnpm server:cli create-user --email you@example.com --role owner
pnpm server:cli backup ./backups/arcvale.db
pnpm server:cli verify-audit
```

Deploying to a VPS: [`README_DEPLOY.md`](README_DEPLOY.md). Nothing is deployed automatically.

## Docs

- [Architecture](docs/architecture.md), [providers contract](docs/providers.md), [migrations](docs/migrations.md)
- [Compliance readiness](docs/compliance-readiness.md), [production checklist](docs/production-checklist.md), [legal review](LEGAL_REVIEW.md)
- [Implementation status](docs/implementation-status.md)
- [Design spec](docs/design-spec.md) and [brand philosophy](docs/brand/design-philosophy.md)
- [Research report](docs/reports/Crypto%20to%20USD%20exchange%20UX.md) and [notes](docs/research_notes/)
