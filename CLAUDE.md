# CLAUDE.md: project instructions for coding agents

## Context (carry forward)
- **What this is:** Arcvale (working name), a US crypto-to-USD exchange: React 19 + TypeScript + Vite 8 web app (`src/`), a Node 22 API server with SQLite and zero runtime npm dependencies (`server/`), an admin panel (`src/admin/`), real-time support chat, 14 versioned legal documents and VPS deployment files. Sell BTC, ETH, USDT or USDC and receive USD by bank, card or cash by courier; an optional large-transaction desk. Exchanging requires a signed-in account. Payout methods have minimums and no maximum (owner decision, 2026-10-14).
- **Two server modes:** `APP_MODE=sandbox` (simulated providers in `server/providers/sandbox/`, signed simulated webhooks, seed data, sandbox lab) and `APP_MODE=production` (adapters in `server/providers/production/`; `NOT_CONFIGURED` without credentials). The modes never share a database.
- **Hard safety rule:** money-moving production adapters become usable only when credentials are present and `REAL_MONEY_ENABLED` is true (`src/config/runtime.ts`). Without credentials they report `NOT_CONFIGURED` and refuse the operation. Never invent deposit addresses, confirmations, payout refs, or successful transfers.
- **Docs to read before non-trivial work:** `docs/design-spec.md` (visual system), `docs/architecture.md` (layers, state machine, security), `docs/providers.md`, `docs/compliance-readiness.md` (launch gate and language rules), `docs/implementation-status.md`, `README_DEPLOY.md`.

## Non-negotiable rules
1. NEVER bypass `REAL_MONEY_ENABLED` or provider states, let sandbox behaviour (seed data, `SANDBOX_*` settings, simulators, test accounts) reach production mode, or make a sandbox deposit address that could be valid on a real chain. Sandbox deposit addresses must satisfy `isPreviewDepositAddress`. A provider without credentials reports `NOT_CONFIGURED`; never fake its result.
2. NEVER add claims of licensing, regulation, FDIC/SIPC or other insurance, partner banks, guaranteed or "instant" settlement, user counts, testimonials or partner logos. Timings are "Estimated …".
3. Customer-facing UI must not present the live site as a demo. Internal testing instances (`APP_MODE=sandbox`) use the ModeBanner and clear Notices; staff tooling may still use `<MockBadge />`.
4. Money is `bigint` only: cents for USD, USD micros for prices, atomic units for crypto. Parse typed amounts with `parseAssetAmount`. Never use floating point for money.
5. Business rules live in `src/domain/` (pure, no React, shared with the server). Pages reach the API only through `useServices()`. The server decides every outcome; the browser never confirms a deposit, a payout or a refund.
6. Order status changes go through `applyOrderEvent` in `server/services/orders.ts`, which enforces the table in `src/domain/order.ts` and `EVENT_ACTORS`. Add transitions to the table; never update `status` directly. Money states (deposit, payout, refund outcomes) come only from signed, de-duplicated provider webhooks. Staff actions need a reason and write an audit event.
7. Courier cash delivery is enabled (`FEATURE_FLAGS.courierCashDelivery = true`, owner decision 2026-10-14). Real cash deliveries still need `REAL_MONEY_ENABLED`, a contracted carrier (`CASH_PROVIDER_*`) and the checklist in `docs/compliance-readiness.md` §6. Cash is released only to the verified account holder after an ID check; never add a way to deliver to someone else.

## Design system
Use tokens in `src/styles/tokens.css` and the existing classes (`.btn`, `.panel`, `.field`, `.option`, `.notice`, `.badge`, `.dl`, `.title`). The CryptoBit brand is dark by default: deep black canvas, graphite surfaces, champagne gold (`--gold`, `--cta-*`) for primary buttons and accents only, white and soft-silver text; success and error keep their own colours. A light theme (`:root[data-theme='light']` in tokens.css, header toggle) redefines the same tokens, so components never branch on the theme; check both (`QA_THEME=light`). The logo is the approved globe-and-orbit mark in `public/brand/` (`<Logo />`); never redraw it. Never hardcode colors. Motion follows `docs/design-spec.md` §7 (explanatory only, off under reduced motion, `@/lib/motion`). Use `font-variant-numeric: tabular-nums` for figures.

shadcn/ui and registry components (`@react-bits`, `@spaceui` in `components.json`) are added with `pnpm exec shadcn add <item>` into `src/components/ui` (hooks into `src/hooks`). Tailwind v4 runs without preflight; its theme maps to our tokens in `src/styles/shadcn.css`. App stylesheets stay unlayered and win over utilities, so existing pages are unaffected. Registry code must pass our lint and strict typecheck, and any new npm dependency a component pulls in needs approval (see below). Keep layouts working at 1440, 1024, 768 and 390px with no horizontal scroll.

## Commands (run before every commit)
```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build
pnpm server:scenarios   # deterministic sandbox lifecycle scenarios
pnpm qa:visual          # Playwright against the built server: screenshots, axe, overflow, keyboard, sell and buy journeys (see .claude/skills/visual-qa)
```
`pnpm dev` runs the API (sandbox, `./data/arcvale-sandbox.db`) and Vite together; `pnpm server:seed` adds demo accounts (password `sandbox-pass-2026`). Schema changes are new migrations in `server/db/migrations.ts` (see `docs/migrations.md`); never edit a shipped one.
Done means all of the above pass, and you have looked at the affected screenshots in `qa-output/` at 390 and 1440.

## Stop and ask before
- Adding a runtime dependency, or any third-party script, font CDN or analytics.
- Changing pricing policy values, limits, fee schedules, the review threshold or the order state table.
- Anything touching legal copy on `/legal` or the compliance docs' conclusions.
- Force-pushing or rewriting history.
- Deploying or publishing anywhere.
