# Implementation status

Last updated: 2026-10-14. Branch: `claude/arcvale-full-implementation-rc4mdf` (based on `claude/project-thread-wv5kpk`).

## Summary

Arcvale has a working API server, database, admin panel, real-time support chat, legal documents and deployment files. In **sandbox mode** every step of an exchange is simulated and works end to end. **Production mode** has adapters for every provider, but each one reports `NOT_CONFIGURED` until credentials exist, and the adapters that move money stay `DISABLED_BY_POLICY` because `REAL_MONEY_ENABLED = false`. Nothing has been deployed. The brand was renamed from the placeholder "Settlewell" to **Arcvale** (still a working name pending trademark clearance).

## What exists

| Area | State |
|---|---|
| Server | Node 22, zero runtime npm dependencies. Fail-closed config, migrations, sessions, CSRF, RBAC, rate limits, safe errors, structured logs, health and readiness, graceful shutdown, operations CLI. |
| Database | SQLite with 16-state orders, immutable quote snapshots, append-only order events, deposit observations, notes, messages, audit (hash-chained) and legal acceptances. Exact money columns. Payout details and TOTP secrets encrypted. |
| Order lifecycle | Table-driven state machine shared by the browser and the server. Only providers move money states, through signed, idempotent webhooks. Staff actions need a reason and are audited. |
| Sandbox | Deterministic rates and confirmations, signed simulated webhooks, payout success and failure, duplicate webhook replay, short, late and expired deposits, rejections, cancellations and refunds. Test-mode banner, sandbox lab in admin, `seed` and `scenarios` commands. Sandbox and production databases cannot be mixed. |
| Production adapters | Rates, custody, KYC, screening, bank and card payouts, cash, email: timeouts, retries, idempotency keys, logs, health states. Contract in `docs/providers.md`. |
| Cash by courier | Enabled (owner decision, 2026-10-14). Delivery address, phone, window and preferred date, validated in `src/domain/courier.ts` and checked with the carrier by ZIP; stored encrypted as a `courier` payout destination (migration 2). Payout goes to the cash provider; results come back as signed `payout.*` webhooks from source `cash`. Cash only to the verified account holder after an ID check. Admin sees the address (masked for support). Real cash stays blocked by `REAL_MONEY_ENABLED` and the missing carrier contract. |
| Limits | Each payout method has a minimum and **no maximum** (owner decision, 2026-10-14). Orders of $10,000 or more still go to manual review; the $25,000+ desk is optional. |
| Customer app | Home with 3D BTC/USD coins, exchange flow behind sign-in (amount, payout, details incl. courier address, verification, review), orders and order detail (timeline from stored events, receipt), account (profile, verification, payout methods, security, sessions, legal acceptances), sign-up, sign-in with code, password reset, support chat (widget and page), large-transaction desk, fees, help, FAQ and 14 legal pages. |
| Admin panel | Role-filtered layout; overview metrics; order queue with search, filters, sort, pagination, priority and assignment; order detail with masked customer data, timeline, actions and their availability, notes, conversations, audit and sandbox lab; support inbox with assignment and internal notes; users and roles; audit log; system (providers, warnings, webhook log); desk requests. |
| Real-time | Server-sent events for orders, conversations, messages and notifications, with a visible connection state and polling fallback. |
| Legal | 14 versioned documents with `[OWNER/COUNSEL INPUT REQUIRED]` placeholders, acceptance records, `LEGAL_REVIEW.md`. |
| Deployment | `Dockerfile` (non-root, read-only, tini), `compose.yaml`, Caddy HTTPS, backup, restore and upgrade scripts, `README_DEPLOY.md`, `docs/production-checklist.md`, `docs/migrations.md`. |

## Verification (latest run)

| Command | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | pass |
| `pnpm test` | **67 passed** in 12 files. Web: money, assets, quote (incl. a 2,000-case reconciliation property), order state machine, validation, courier details, Calculator, HoldButton. Server: API (auth, CSRF, RBAC, lifecycle, courier delivery, isolation, webhooks, chat, validation, lockout, MFA, proxy IPs), database (append-only, snapshots, audit tamper detection), production mode (fail-closed config, NOT_CONFIGURED, policy gates), scenarios. |
| `pnpm server:scenarios` | **14/14 passed**: happy path, cash by courier, duplicate webhook, large-amount review, payout failure and retry, payout declined then refund, short deposit, late deposit, expired window, expired quote, customer cancel, rejected request, KYC rejected, audit chain. |
| `pnpm build` | pass. three.js is a separate lazy chunk loaded only by the home hero. |
| `pnpm qa:visual` | Runs against the built server on a throwaway sandbox database: 23 routes (15 public, 8 admin) at 1440/1024/768/390, axe, overflow, console and request checks, keyboard checks, and the 16-step journey at 1440 and 390. |

### The 16-step sandbox journey (visual QA)

1. Sign up: validation errors first, then an account with a state of residence and accepted terms.
2. Amount: below the minimum is refused, a large amount is accepted (no maximum), then a valid 2,500 USDC on Ethereum.
3. Payout method: cash by courier asks for a delivery address; an empty form, then a ZIP outside the area, are refused and a valid address is saved. The journey then continues with a bank transfer.
4. Details: bank account (routing checksum) and refund address.
5. Identity verification (sandbox rules) and a firm quote.
6. Acknowledgements and hold-to-confirm create the order.
7. "I've sent it" is recorded, and the order still waits for the deposit.
8. The sandbox deposit monitor reports the exact deposit through a signed webhook.
9. Final confirmations: the order becomes ready for payout.
10. The customer messages support from the chat widget, linked to the order.
11. An admin signs in and sees the overview.
12. The admin finds the order in the queue.
13. Authorizing the payout without a reason is refused; with a reason it is submitted.
14. The sandbox payout provider reports completion through a signed webhook.
15. The admin replies in the inbox and adds an internal note.
16. The customer sees the completed order and the reply, never the internal note, and the order in their history.

## Not done, and why

- **No real provider is connected.** That needs contracts and credentials. Adapters report `NOT_CONFIGURED` rather than faking results.
- **Real money stays off.** This needs the compliance launch gate (`docs/compliance-readiness.md`) and a reviewed code change.
- **Real cash deliveries** need a contracted carrier, `REAL_MONEY_ENABLED` and the checklist in `docs/compliance-readiness.md` §6. The courier fee ($35 flat) and minimum ($500) are placeholders. **[OWNER INPUT REQUIRED]**
- A database upgrade from migration 1 to 2 was checked by seeding with the previous build and migrating with this one (rows kept, no foreign key errors).
- **Not deployed.** The deployment files are ready, but publishing needs your explicit approval. The Docker image build could not be tested here because this environment has no Docker daemon.
- Email in sandbox goes to a notification outbox (admin sandbox lab) instead of being sent.
- Policy values (spreads, minimums, fees, review threshold, confirmation counts) are placeholders. **[OWNER/COUNSEL INPUT REQUIRED]**
- Legal texts are drafts with placeholders and need counsel review (`LEGAL_REVIEW.md`).
- The main JS chunk is about 555 kB (181 kB gzip), mostly GSAP and Radix. Trimming GSAP plugins is a follow-up.
