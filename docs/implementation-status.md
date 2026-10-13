# Implementation status

Last updated: 2026-10-13. Branch: `claude/exciting-feynman-g5ijls`.

## Summary

A working, tested **mock** frontend for a US crypto-to-USD exchange. Every price, quote, verification result, deposit address, transaction and payout is simulated and labelled. **Real-money movement is disabled in code.** Nothing here is a production exchange; see `compliance-readiness.md` for the launch gate.

## Phases

| Phase | Result |
|---|---|
| 1. Research and design spec | Four parallel research tracks (Coinbase/Kraken, Cash App and fintech conventions, Behance/Dribbble trends, US compliance) via the deep-research skill, plus a synthesized report. `design-spec.md` written. The reference sites were **blocked by this environment's network policy**, so findings come from cited web-search summaries. |
| 2. Scaffold, design system, homepage | Vite 8 + React 19 + TS (strict) + React Router 7. Token-based CSS design system. Homepage with live calculator, quote anatomy, assets/networks, payout comparison, large-transaction band, security posture and FAQ. |
| 3. Journey and screens | 4-step exchange (amount → payout → details → review/confirm). Payout selection with eligibility. Quote lock with countdown and expiry. Transaction status with timeline, receipt and event log. History. Sign-up and sign-in with a mock second factor. Account (verification, payout methods, security). Large-transaction desk. Disabled courier module with availability checker. Fees, how it works, security, FAQ, help, legal and 404 pages. |
| 4. Domain and services | bigint money math. Asset/network catalog with atomic-unit parsing. Pure `calculateQuote` (reconciles to the cent) and server-style `verifyQuote`. Transaction state machine (late or mismatched deposits refunded, monotonic confirmations, review hold before payout). Provider interfaces with mock adapters (pricing, quotes, auth, KYC, screening, payouts, deposits, simulator, transactions, large desk, courier). Fail-closed service registry. |
| 5. QA, accessibility, security | Playwright visual QA at 1440/1024/768/390 (52 page renders per run), console, request, overflow, axe WCAG 2.2 AA, keyboard and two end-to-end flows. Code review, security review and simplify passes; findings fixed (below). |
| 6. Checks and build | `pnpm lint`, `typecheck`, `test` (46 tests), `format:check` and `build` all pass. Visual QA passes against both the dev server and the production preview. |

## Verification (latest run)

| Command | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` | pass (0 warnings) |
| `pnpm format:check` | pass |
| `pnpm test` | **46 passed** (7 files: money, assets, quote incl. 2,000-case reconciliation property, transaction state machine, validation, mock services, Calculator component) |
| `pnpm build` | pass. Main bundle 264.7 kB (82.5 kB gzip); routes code-split. |
| `pnpm qa:visual` (dev) | **All checks passed**: 52 renders, keyboard checks, full flow at 1440 and 390 |
| `BASE_URL=http://localhost:4173 pnpm qa:visual` (production preview) | **All checks passed** |

## Defects found by QA and reviews, all fixed

| Source | Defect | Fix |
|---|---|---|
| Playwright flow | Typed amounts were parsed at *input* precision, not atomic precision: 40,000 USDT was quoted as 4 USDT (ETH also wrong) | `parseAssetAmount` separates typed vs atomic decimals; regression tests |
| Playwright | Horizontal overflow at 390/1024px from grid min-content sizing | `minmax(0, 1fr)` tracks; `.field` single shrinkable column |
| Playwright keyboard | StrictMode double effect stole initial focus, so the skip link wasn't first | Route-focus compares the last handled location |
| Visual review | Desktop Menu button visible; nav wrapping; mismatched select heights; empty right column on review; stray notices | CSS order and specificity fixes; review aside; status-scoped notices |
| code-review | Client-supplied quote `issues` and price trusted; quote reusable; decimal comma read as thousands; deposit deadline and amount not enforced; review hold not enforced; draft not validated; refresh disabled Continue | Server-style `verifyQuote` (independent price lookup, freshness, recomputed issues); single-use quotes; strict comma grouping; state-machine rules; full draft validation; refresh keeps the quote usable |
| security review | Destination object and KYC trusted from client; non-monotonic confirmations; deposit address rendered without a placeholder check; backslash in return path | Destination resolved by ID; KYC checked in the service; monotonic counts; `isPreviewDepositAddress` guard; stricter return-path regex; sign-out clears the session draft |
| simplify (4 agents) | Duplicated USD formatting and checkbox/error-summary wiring; mock code imported by pages; per-second re-render of whole pages; sequential independent awaits; eager page imports | `formatUsd({ whole })`, `Checkbox`, self-focusing `ErrorSummary`, `useDestinations`; `verifyQuote` and placeholder guard moved to the domain; simulator split from the `DepositMonitor` contract; isolated `Countdown`/`useExpired`; `Promise.all`; lazy routes; Latin-only serif subset |

Simplify findings deliberately skipped: an in-memory cache for the mock auth user (per-render reads are now rare since ticking is isolated); merging the large-desk form's nine `useState`s (works as written); a full split of `ReviewStep` (only the countdown was extracted).

## Tooling actually used

| Tool / skill | How it was used |
|---|---|
| `deep-research` skill | Coordinated 4 research subagents and a report writer → `docs/research_notes/…`, `docs/reports/…` |
| WebSearch | Working: used for research and a brand-name collision check. WebFetch: the reference hosts were blocked by the network policy. |
| 21st.dev MCP | `search` tested (component metadata returned). Paid component code was not fetched. |
| `web-artifacts-builder` skill | Design guidance applied (avoid centred-everything layouts, purple gradients, uniform radii, Inter). Its init script was not used (artifact-oriented). |
| `prompt-master` skill | Its Claude Code guidance shaped `CLAUDE.md` (states, allowed and forbidden actions, stop conditions, verification commands). |
| `skill-creator` skill | Structure used for the project skill `.claude/skills/visual-qa`. Its benchmark/eval loop was not run; the skill was validated by using it in every QA pass. |
| `canvas-design` skill | `docs/brand/design-philosophy.md` plus `public/og-image.png` (rendered with its bundled OFL fonts) |
| Playwright 1.56.1 + Chromium, `@axe-core/playwright` | All browser QA |
| `code-review`, `security-review`, `simplify` | Run. `security-review` could not compute its diff (the remote has no default branch), so an equivalent scoped read-only security review ran via a subagent. |
| `run` skill | Not invoked. The visual-qa script starts the dev server itself, covering the same need. |
| Lovable, Higgsfield | Not used (paid credits; not approved) |

## Known limitations and open items

- Reference sites (coinbase.com, kraken.com, cash.app, dribbble.com, behance.net) were unreachable from this environment. To enable live screenshots, add them under the environment's network **Allowed domains**.
- Mock auth is not secure by design (unsigned localStorage session, fixed preview MFA code `000000`, no rate limits). See `architecture.md` for the production replacement.
- Mock controls on the transaction page call `dispatch` directly. In production only the customer's cancel would be client-callable.
- No dark theme in v1 (light only, per the brief's warm-white direction).
- Brand name "Settlewell" is a placeholder pending trademark clearance.
- All pricing policy values (spreads, limits, TTLs, confirmation counts, payout fees and timings) are placeholders.
- `docs/compliance-readiness.md` lists the legal and operational launch gate. Real-money integration stays blocked until it is signed off.
