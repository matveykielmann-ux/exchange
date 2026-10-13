# Architecture

Status: frontend preview with mock adapters only. **Real-money movement is disabled in code** (`src/config/runtime.ts`).

## Stack and rationale

| Choice | Why |
|---|---|
| React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) + Vite 8 | Required by the brief and verified in this environment (Node 22, pnpm 10). It is a fast, standard toolchain. |
| React Router 7 (`BrowserRouter`) | Plain client-side routing. No server rendering is needed for a preview. |
| Plain CSS with design tokens (`src/styles/*.css`) | A small, auditable design system that maps 1:1 to `docs/design-spec.md`. No runtime CSS-in-JS and no utility-class soup. |
| `@fontsource` self-hosted fonts | No third-party requests, which is simpler for privacy and a strict CSP. |
| Vitest + Testing Library; Playwright + axe | Unit and component tests, plus real-browser visual and accessibility QA (`.claude/skills/visual-qa`). |

## Layers

```
src/
  config/      brand constants, runtime safety switches (REAL_MONEY_ENABLED=false, fail-closed service mode, feature flags)
  domain/      pure, framework-free business logic — the code that must be identical on a future server
    money.ts         bigint money math (cents, USD micros, atomic units), parsing and formatting
    assets.ts        assets × networks, confirmation policy, address validation, atomic-unit parsing
    payout.ts        payout methods, fee schedules, eligibility; courier gated by FEATURE_FLAGS
    quote.ts         pricing policy + calculateQuote (pure, deterministic, reconciles to the cent)
    transaction.ts   transaction state machine, event log, customer-facing timeline
    validation.ts    field validators (ABA checksum, refund address, amounts, email/password)
  services/
    types.ts     provider interfaces — the seam for real integrations
    mock/        one mock adapter per interface, backed by browser storage
    registry.ts  selects adapters by VITE_SERVICE_MODE (only "mock" exists; others throw)
  state/       React context for services, auth (useSyncExternalStore), exchange draft, live quote hook
  components/  design-system components (Field, QuoteBreakdown, Calculator, Layout, …)
  pages/       route components
  content/     shared copy (FAQ)
```

**Dependency rule:** `domain` imports nothing from React or services. `services` import `domain`. UI imports both, but talks to providers only through `useServices()`. Replacing a mock with a real adapter therefore touches only `services/` and `registry.ts`.

## Money and quotes

- All amounts are `bigint`: USD in **cents**, prices in **USD micros per whole unit**, crypto in **atomic units** (sats, wei, 6-decimal stablecoin units). There is no floating point anywhere in the money path.
- Typed input is parsed with `parseAssetAmount`, which separates *typed precision* (`inputDecimals`) from *atomic precision* (`decimals`). The Playwright flow caught a bug here before release (40000 USDT was parsed as 4 USDT); it is now covered by unit tests.
- Commas are accepted only as US thousands separators. `0,05` is rejected rather than read as `5`.
- `calculateQuote` rounds every line to cents **before** subtraction, so `gross − spread − fee = net` holds exactly. A 2,000-case property test checks this.
- Spread tiers, minimum ($50), online maximum ($25,000), quote TTL (60s), deposit window (30m) and indicative refresh (15s) all live in `PRICING_POLICY`. **They are placeholder values.**

## Transaction lifecycle

```
awaiting_deposit ──DEPOSIT_DETECTED──▶ deposit_detected ──CONFIRMATION──▶ confirming ──CONFIRMATION(final)──▶ payout_processing ──PAYOUT_SETTLED──▶ completed
      │  (late or wrong amount) ─────────────────────────────────────▶ refund_pending ──REFUND_SENT──▶ refunded
      ├──WINDOW_EXPIRED──▶ expired ──DEPOSIT_DETECTED (late)──▶ refund_pending
      └──CUSTOMER_CANCELLED──▶ cancelled
confirming ──CONFIRMATION(final) with reviewReason──▶ compliance_review ──REVIEW_CLEARED──▶ payout_processing
                                                                     └─REVIEW_REJECTED──▶ refund_pending
payout_processing ──PAYOUT_FAILED──▶ payout_failed ──RETRY_PAYOUT──▶ payout_processing
```

Invariants enforced in `applyEvent`, each covered by tests:

- Unlisted transitions throw `InvalidTransitionError`.
- A deposit after the deadline, or of a different amount, is **never** paid out at the locked rate.
- Confirmation counts must strictly increase.
- A screening flag forces `compliance_review` before payout.
- Every change appends a time-stamped log entry.

## Server-side rules the mock already enforces

`services/mock/transactions.ts` behaves the way the real backend must:

- **Quote verification ignores client-derived fields.** The reference price is re-fetched for the quote's timestamp, the timestamp must be fresh, every derived field is recomputed, and the issues list comes from the recomputation.
- **Quotes are single-use**, recorded before any `await`.
- **The customer must be verified.** The payout destination is resolved by ID from the customer's own saved list.
- **Ownership checks** apply to every read and write.
- **Unpaid transactions expire** automatically once their deposit window passes.

## Path to production integrations

| Interface | Production adapter needs | Notes |
|---|---|---|
| `PricingProvider` | A market-data feed or liquidity provider with signed quotes | Quotes must be issued and stored **server-side**; the client should submit only `quoteId`. |
| `QuoteService` | A backend endpoint | Persist quotes; keep the single-use rule; hedging and treasury logic. |
| `AuthService` | An identity provider (OIDC), httpOnly Secure SameSite cookies, real TOTP/WebAuthn, rate limits | The mock session is an unsigned localStorage record and is **not** secure. |
| `KycProvider` | An identity-verification vendor (document, selfie, SSN, watchlists) plus webhooks | Tiered levels; enhanced due diligence for the desk. |
| `ScreeningProvider` | Sanctions and blockchain-analytics provider (addresses, transactions) | Strict-liability OFAC exposure; screen before accepting and before payout. |
| `DepositMonitor` | Node or indexer per chain, unique deposit addresses, reorg handling | Emits `DEPOSIT_DETECTED` and `CONFIRMATION` as **authenticated server events only**. |
| `PayoutProvider` | Bank or payments partner for ACH, wire and push-to-card; PCI DSS tokenization for cards | Store tokens, never raw numbers. |
| `TransactionService.dispatch` | **Server-only.** Customers may only cancel. | In the preview, the "Mock controls" call dispatch directly to simulate events. |
| `CourierProvider` | A licensed armored-carrier partner | Blocked; see `compliance-readiness.md`. |

## Hosting and security headers (recommended for any deployment)

- Serve over HTTPS with HSTS.
- Set `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`.
- Set `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` and `Cross-Origin-Opener-Policy: same-origin`.
- Send these as HTTP headers, not meta tags.
- Host on a **dedicated origin**, because the mock data lives in localStorage, which shares an origin.
- `index.html` sets `robots: noindex` for the preview.
