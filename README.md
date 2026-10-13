# Settlewell (working name): crypto-to-USD exchange preview

A frontend preview of a US-focused instant crypto-to-USD exchange for retail customers and larger transactions.

> **Preview only.** Prices, quotes, verification, deposit addresses, transactions and payouts are simulated. No real funds can move. The operating entity holds no licenses. See [`docs/compliance-readiness.md`](docs/compliance-readiness.md).

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Try the flow: create a preview account (any email; the password is discarded) → `/exchange` → run the simulated verification on the review step → confirm → use **Mock controls** on the status page to advance the transaction. The sign-in code is `000000`. Use test routing number `011000015`.

## Quality gates

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build
pnpm qa:visual      # Playwright visual + a11y + end-to-end QA at 1440/1024/768/390
```

## Docs

- [Design spec](docs/design-spec.md) and [brand philosophy](docs/brand/design-philosophy.md)
- [Architecture](docs/architecture.md)
- [Compliance readiness](docs/compliance-readiness.md)
- [Implementation status](docs/implementation-status.md)
- [Research report](docs/reports/Crypto%20to%20USD%20exchange%20UX.md) and [notes](docs/research_notes/)
