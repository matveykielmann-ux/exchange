# Arcvale (working name): crypto-to-USD exchange

Sell BTC, ETH, USDT or USDC and receive US dollars by bank transfer, wire, debit card or cash by courier. The repo has a React web app, a Node API server with SQLite, an admin panel, real-time support chat, versioned legal documents and VPS deployment files.

> **No real money moves.** `REAL_MONEY_ENABLED = false` is a code constant. **Sandbox mode** simulates every provider end to end. **Production mode** has real adapters, but each one reports `NOT_CONFIGURED` until credentials exist, and the ones that move money stay disabled by policy. The operating entity holds no licenses. See [`docs/compliance-readiness.md`](docs/compliance-readiness.md).

## Run it (sandbox)

```bash
pnpm install
pnpm server:seed     # demo staff, a customer and orders in several states (sandbox database only)
pnpm dev             # web on http://localhost:5173, API on :8787 (APP_MODE=sandbox by default)
```

Every seeded account uses the password `sandbox-pass-2026`: `owner@`, `admin@`, `reviewer@`, `support@` and `customer@arcvale.test`. In sandbox mode sign-in and reset codes are shown on screen.

Customer-facing deposit/payout simulation controls are removed. Sandbox deposit and payout events are staff-only (`/admin` sandbox lab) or the optional server autopilot (`SANDBOX_AUTOPILOT_STEP_MS`, off by default). Production mode never registers those routes. Missing providers report `NOT_CONFIGURED` and block money-moving steps; admins can record a **manual payout** with evidence when a configured provider is not used.

To try it: sign up, then go to `/exchange`. On the order page, the **sandbox deposit monitor** simulates the chain. As an admin, authorize the payout in `/admin` and use the **sandbox lab** on the order to have the provider report the result. Sandbox fixtures:
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
