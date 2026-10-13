# Architecture

Arcvale is a crypto-to-USD exchange: a React web app, a Node API server with a SQLite database, and provider adapters. **Real-money movement is disabled in code** (`REAL_MONEY_ENABLED = false` in `src/config/runtime.ts`). The server runs in one of two modes:

- **Sandbox** (`APP_MODE=sandbox`) is deterministic and works end to end. Simulated providers send signed webhooks, and a sandbox lab plus a scenario runner are included.
- **Production** (`APP_MODE=production`) uses real adapters only. Each one is `NOT_CONFIGURED` until credentials exist, and any adapter that moves money is `DISABLED_BY_POLICY` while real money is off.

## Stack

| Choice | Why |
|---|---|
| React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 8, React Router 7 | Fast, standard toolchain. Routes are lazy-loaded. |
| Plain CSS with design tokens (`src/styles/*.css`) plus Tailwind v4 only for shadcn/ui parts | Small, auditable design system that maps to `docs/design-spec.md`. |
| three.js (lazy chunk) | 3D coin hero. It never loads on other routes, and it falls back to an SVG when WebGL is not available. |
| Node 22 server with **no runtime npm dependencies** | `node:http`, `node:sqlite`, `node:crypto` (scrypt, AES-256-GCM, HMAC, TOTP). Vite bundles it to `dist-server/`. Small attack surface and simple container. |
| SQLite (WAL) | One-VPS deployment. Integer and text money columns with CHECK constraints, append-only triggers on ledgers. |
| Vitest (`web` and `server` projects), Playwright + axe | Unit, API and integration tests, plus real-browser QA of the whole sandbox journey. |

## Layers

```
src/                    web app
  config/               brand, REAL_MONEY_ENABLED=false, feature flags (courier off)
  domain/               pure business rules shared with the server (no React, no I/O)
    money.ts            bigint money: cents, USD micros, atomic units
    assets.ts           assets × networks, confirmation policy, address checks
    quote.ts            pricing policy and calculateQuote (reconciles to the cent)
    order.ts            order state machine: statuses, event table, who may raise each event
    payout.ts, identity.ts, validation.ts, usStates.ts
  services/             api.ts (HTTP client for the server), types.ts, adminTypes.ts
  state/                auth session, server config, live updates (SSE with polling fallback)
  pages/, admin/, components/

server/
  config.ts             environment schema; fails closed on bad or unsafe values
  app.ts, main.ts       composition root, listen, graceful shutdown
  http/                 router (sessions, CSRF, roles, rate limits, body limits, safe errors), static files with CSP
  db/                   migrations (append-only, checksummed), database wrapper
  services/             orders, quotes, operations (staff actions), webhooks, sandbox, support, customers, auth, admin, audit, notifications
  providers/            types, registry, sandbox/ simulators, production/ adapters, signed HTTP client, webhook signatures
  cli.ts                check-config, migrate, create-user, seed, scenarios, backup, verify-audit
```

**Dependency rule:** `src/domain` imports nothing from React, the server or services. The server imports `src/domain` so the browser and the server apply the same rules. UI code reaches the server only through `useServices()`.

## Money

- All amounts are `bigint`: USD **cents**, prices in **USD micros**, crypto in **atomic units**. The API sends them as decimal strings, and `src/services/api.ts` converts them. Floating point is never used for money.
- `calculateQuote` rounds every line to cents before subtracting, so `gross − spread − fee = net` exactly (property-tested).
- Policy values (spreads, limits, TTLs, review threshold) are **placeholders**. `MANUAL_REVIEW_THRESHOLD_USD` is configurable.

## Order lifecycle (server-enforced)

16 statuses: `created, awaiting_deposit, deposit_observed, confirming, deposit_confirmed, compliance_review, ready_for_payout, payout_submitted, payout_processing, completed, rejected, failed, cancelled, expired, refund_pending, refunded`.

```
created ─▶ awaiting_deposit ─(provider)▶ deposit_observed ─▶ confirming ─(provider)▶ deposit_confirmed
deposit_confirmed ─screening clear▶ ready_for_payout      ─flag / threshold▶ compliance_review ─approve▶ ready_for_payout
ready_for_payout ─operator authorizes (reason)▶ payout_submitted ─(provider)▶ payout_processing ─(provider)▶ completed
payout_* ─(provider) failed▶ failed ─operator retry▶ payout_submitted   |   failed / rejected ─operator refund▶ refund_pending ─(provider)▶ refunded
awaiting_deposit ─customer▶ cancelled   ─deadline▶ expired   ;   a deposit to an expired / cancelled / rejected order ▶ refund_pending path
```

Rules:

- `applyOrderEvent` in `server/services/orders.ts` is the **only** way an order changes. It checks the table in `src/domain/order.ts` and `EVENT_ACTORS` (who may raise each event), bumps a version for optimistic concurrency, appends an `order_events` row (the timeline is built from these), and writes the audit log, all in one transaction.
- **Only providers** can move money states: deposit observed, confirmed, payout processing, completed or failed, and refund completed. Their events arrive as signed, de-duplicated webhooks (`server/services/webhooks.ts`). In sandbox mode the simulator signs its events and goes through the same function.
- "I've sent it" from the customer is recorded but changes nothing about the deposit. The browser never confirms a deposit. A staff click never completes a payout: authorize-payout only submits the instruction.
- Every staff action requires a reason (minimum length enforced) and writes an audit event. The audit log is append-only and hash-chained (`verify-audit`).
- Quotes are stored server-side when issued and snapshotted onto the order. Snapshots cannot change. A quote is single-use and expires.
- Late or mismatched deposits are never paid at the locked rate. They go to review or refund.
- Orders at or above the review threshold, and any screening flag, go to `compliance_review` before payout.

## Auth, roles and security

- Passwords are hashed with scrypt. Sessions are 256-bit random tokens in an `HttpOnly; SameSite=Lax` (and `Secure` over https) cookie. Only an HMAC of the token is stored. Sessions have a fixed lifetime (`SESSION_TTL_HOURS`) and are revoked on a password change or reset.
- CSRF uses a per-session token sent back in `X-CSRF-Token`, plus an `Origin` check on every mutation. Only signature-authenticated webhooks are exempt.
- Roles: `customer < support < reviewer < admin < owner`. The router checks roles on every route, and the UI hides what the server would refuse. Admins can grant roles up to reviewer; only owners grant admin or owner. Production requires staff TOTP (`REQUIRE_STAFF_MFA`).
- Rate limits: per-IP limits on auth, quotes, orders, chat, live events and webhooks. Accounts lock after 5 failed sign-ins.
- Payout details and TOTP secrets are encrypted with AES-256-GCM. Card numbers are never accepted (provider tokens only) and CVV is never accepted. Staff views mask PII.
- Errors come back as `{ error: { code, message } }` with safe messages. Stack traces are never sent. Logs are structured JSON without secrets.
- The CSP is `script-src 'self'` with no third-party origins. The saved-theme bootstrap is a same-origin file (`public/theme-init.js`), so no inline script is needed.

## Live updates and support chat

- `GET /api/events` is a server-sent events stream per user. Events: `order.updated`, `conversation.updated`, `message.created`, `notification.created`. Staff get queue-wide events. The client shows the connection state and falls back to polling while the stream is down.
- Conversations and messages live in the database (append-only messages). The client sends a `clientMessageId`, so a retry cannot duplicate a message. Internal staff notes are never returned to customers.

## Providers

The provider interfaces are in `server/providers/types.ts`. The production JSON contract, webhook format and signature scheme are in [`providers.md`](providers.md). Every outbound call has a timeout, bounded retries with backoff, an idempotency key and structured logs.

## Legal documents

14 versioned documents in `src/content/legal/`, served at `/legal/*`. Sign-up records acceptance of the required versions (`legal_acceptances`, append-only). Open items are in `LEGAL_REVIEW.md`.

## Deployment

See [`../README_DEPLOY.md`](../README_DEPLOY.md): Dockerfile, `compose.yaml`, Caddy, backups and upgrades.
