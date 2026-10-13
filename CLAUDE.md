# CLAUDE.md: project instructions for coding agents

## Context (carry forward)
- **What this is:** Arcvale (working name), a US crypto-to-USD exchange: React 19 + TypeScript + Vite 8 web app (`src/`), a Node 22 API server with SQLite and zero runtime npm dependencies (`server/`), an admin panel (`src/admin/`), real-time support chat, 14 versioned legal documents and VPS deployment files. Sell BTC, ETH, USDT or USDC and receive USD; a large-transaction desk; a disabled courier cash module.
- **Two server modes:** `APP_MODE=sandbox` (simulated providers in `server/providers/sandbox/`, signed simulated webhooks, seed data, sandbox lab) and `APP_MODE=production` (adapters in `server/providers/production/`; `NOT_CONFIGURED` without credentials). The modes never share a database.
- **Hard safety rule:** real-money movement is disabled. `src/config/runtime.ts` has `REAL_MONEY_ENABLED = false`; production adapters that move money report `DISABLED_BY_POLICY` while it is false.
- **Docs to read before non-trivial work:** `docs/design-spec.md` (visual system), `docs/architecture.md` (layers, state machine, security), `docs/providers.md`, `docs/compliance-readiness.md` (launch gate and language rules), `docs/implementation-status.md`, `README_DEPLOY.md`.

## Non-negotiable rules
1. NEVER enable real money, bypass `REAL_MONEY_ENABLED` or the provider states, let sandbox behaviour (seed data, `SANDBOX_*` settings, simulators, test accounts) reach production mode, or make a sandbox deposit address that could be valid on a real chain. Sandbox deposit addresses must satisfy `isPreviewDepositAddress`. A provider without credentials reports `NOT_CONFIGURED`; never fake its result.
2. NEVER add claims of licensing, regulation, FDIC/SIPC or other insurance, partner banks, guaranteed or "instant" settlement, user counts, testimonials or partner logos. Timings are "Estimated …".
3. Every simulated price, quote, receipt, status or verification result MUST carry a visible sandbox badge (`<MockBadge />`).
4. Money is `bigint` only: cents for USD, USD micros for prices, atomic units for crypto. Parse typed amounts with `parseAssetAmount`. Never use floating point for money.
5. Business rules live in `src/domain/` (pure, no React, shared with the server). Pages reach the API only through `useServices()`. The server decides every outcome; the browser never confirms a deposit, a payout or a refund.
6. Order status changes go through `applyOrderEvent` in `server/services/orders.ts`, which enforces the table in `src/domain/order.ts` and `EVENT_ACTORS`. Add transitions to the table; never update `status` directly. Money states (deposit, payout, refund outcomes) come only from signed, de-duplicated provider webhooks. Staff actions need a reason and write an audit event.
7. Courier cash delivery stays behind `FEATURE_FLAGS.courierCashDelivery = false` until the checklist in `docs/compliance-readiness.md` §6 is signed off.

## Design system
Use tokens in `src/styles/tokens.css` and the existing classes (`.btn`, `.panel`, `.field`, `.option`, `.notice`, `.badge`, `.dl`, `.title`). Primary buttons are navy in the light theme and emerald in the dark theme (via `--cta-*` tokens); otherwise emerald is an accent (links, focus, selected, completed). Both themes are token-driven, so never hardcode colors. Motion follows `docs/design-spec.md` §7 (explanatory only, off under reduced motion, `@/lib/motion`). Use `font-variant-numeric: tabular-nums` for figures.

shadcn/ui and registry components (`@react-bits`, `@spaceui` in `components.json`) are added with `pnpm exec shadcn add <item>` into `src/components/ui` (hooks into `src/hooks`). Tailwind v4 runs without preflight; its theme maps to our tokens in `src/styles/shadcn.css`. App stylesheets stay unlayered and win over utilities, so existing pages are unaffected. Registry code must pass our lint and strict typecheck, and any new npm dependency a component pulls in needs approval (see below). Keep layouts working at 1440, 1024, 768 and 390px with no horizontal scroll.

## Commands (run before every commit)
```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build
pnpm server:scenarios   # deterministic sandbox lifecycle scenarios
pnpm qa:visual          # Playwright against the built server: screenshots, axe, overflow, keyboard, 16-step journey (see .claude/skills/visual-qa)
```
`pnpm dev` runs the API (sandbox, `./data/arcvale-sandbox.db`) and Vite together; `pnpm server:seed` adds demo accounts (password `sandbox-pass-2026`). Schema changes are new migrations in `server/db/migrations.ts` (see `docs/migrations.md`); never edit a shipped one.
Done means all of the above pass, and you have looked at the affected screenshots in `qa-output/` at 390 and 1440.

## Stop and ask before
- Adding a runtime dependency, or any third-party script, font CDN or analytics.
- Changing pricing policy values, limits, fee schedules, the review threshold or the order state table.
- Anything touching legal copy on `/legal` or the compliance docs' conclusions.
- Force-pushing or rewriting history.
- Deploying or publishing anywhere.
