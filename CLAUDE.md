# CLAUDE.md: project instructions for coding agents

## Context (carry forward)
- **What this is:** a *mock* US crypto-to-USD exchange frontend (React 19 + TypeScript + Vite 8, pnpm). Sell BTC, ETH, USDT or USDC and receive USD; a large-transaction desk; a disabled courier cash module.
- **Hard safety rule:** real-money movement is disabled. `src/config/runtime.ts` has `REAL_MONEY_ENABLED = false` and a fail-closed `resolveServiceMode`. Only mock adapters exist (`src/services/mock/`).
- **Docs to read before non-trivial work:** `docs/design-spec.md` (visual system), `docs/architecture.md` (layers, state machine, integration seams), `docs/compliance-readiness.md` (launch gate and language rules), `docs/implementation-status.md`.

## Non-negotiable rules
1. NEVER enable real money, add a non-mock service mode, or make a deposit address that could be valid on a real chain. Deposit addresses must satisfy `isPreviewDepositAddress`.
2. NEVER add claims of licensing, regulation, FDIC/SIPC or other insurance, partner banks, guaranteed or "instant" settlement, user counts, testimonials or partner logos. Timings are "Estimated …".
3. Every simulated price, quote, receipt, status or verification result MUST carry a visible MOCK badge (`<MockBadge />`).
4. Money is `bigint` only: cents for USD, USD micros for prices, atomic units for crypto. Parse typed amounts with `parseAssetAmount`. Never use floating point for money.
5. Business rules live in `src/domain/` (pure, no React). Pages call providers only through `useServices()`. Do not import from `src/services/mock/` in UI code.
6. Transaction status changes go through `applyEvent` in `src/domain/transaction.ts`. Add transitions to the table; never mutate `status` directly.
7. Courier cash delivery stays behind `FEATURE_FLAGS.courierCashDelivery = false` until the checklist in `docs/compliance-readiness.md` §6 is signed off.

## Design system
Use tokens in `src/styles/tokens.css` and the existing classes (`.btn`, `.panel`, `.field`, `.option`, `.notice`, `.badge`, `.dl`, `.title`). Primary buttons are navy; emerald is an accent (links, focus, selected, completed). Use `font-variant-numeric: tabular-nums` for figures.

shadcn/ui and registry components (`@react-bits`, `@spaceui` in `components.json`) are added with `pnpm exec shadcn add <item>` into `src/components/ui` (hooks into `src/hooks`). Tailwind v4 runs without preflight; its theme maps to our tokens in `src/styles/shadcn.css`. App stylesheets stay unlayered and win over utilities, so existing pages are unaffected. Registry code must pass our lint and strict typecheck, and any new npm dependency a component pulls in needs approval (see below). Keep layouts working at 1440, 1024, 768 and 390px with no horizontal scroll.

## Commands (run before every commit)
```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build
pnpm qa:visual          # Playwright: screenshots, axe, overflow, keyboard, end-to-end flow (see .claude/skills/visual-qa)
```
Done means all of the above pass, and you have looked at the affected screenshots in `qa-output/` at 390 and 1440.

## Stop and ask before
- Adding a runtime dependency, or any third-party script, font CDN or analytics.
- Changing pricing policy values, limits, fee schedules or the transaction state table.
- Anything touching legal copy on `/legal` or the compliance docs' conclusions.
- Force-pushing or rewriting history.
