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
  config/               brand, REAL_MONEY_ENABLED=false, feature flags (courier on)
  domain/               pure business rules shared with the server (no React, no I/O)
    money.ts            bigint money: cents, USD micros, atomic units
    assets.ts           assets × networks, confirmation policy, address checks
    quote.ts            pricing policy and calculateQuote (reconciles to the cent)
    order.ts            order state machine: statuses, event table, who may raise each event
    payout.ts, courier.ts, identity.ts, validation.ts, usStates.ts
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
- Policy values (spreads, minimums, fees, TTLs, review threshold) are **placeholders**. There is no maximum per order (owner decision, 2026-10-14). `MANUAL_REVIEW_THRESHOLD_USD` is configurable.

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
- A transaction hash the customer submits is format-checked and recorded for review but changes nothing about the deposit. The browser never confirms a deposit. A staff click never completes a payout: authorize-payout only submits the instruction.
- Every staff action requires a reason (minimum length enforced) and writes an audit event. The audit log is append-only and hash-chained (`verify-audit`).
- Quotes are stored server-side when issued and snapshotted onto the order. Snapshots cannot change. A quote is single-use and expires.
- Late or mismatched deposits are never paid at the locked rate. They go to review or refund.
- Orders at or above the review threshold, and any screening flag, go to `compliance_review` before payout.
- **Hold.** A reviewer or above can put an open order on hold (`HOLD_PLACED`) and release it (`HOLD_RELEASED`), each with a reason. The status does not change; `orders.on_hold` is set and the events in `BLOCKED_WHILE_ON_HOLD` (screening clearance, review approval, payout authorization, submission and retry) are refused. Provider reports are still recorded; a deposit confirmed during a hold is screened when the hold is released.
- **Stages.** For the CRM and the customer summary, each status belongs to one stage (`orderStage` in `src/domain/order.ts`): New, Awaiting Payment, Payment Review, Processing, Completed, On Hold (held, or a failed payout waiting on an operator), Rejected, Cancelled (also expired), Refund Review, Refunded. The detailed status stays the source of truth.
- **Notices.** Every customer-visible status change, hold or release creates a `status_changed` notification unless the code raising the event sends its own notice. Notifications are linked to their order and have a read state; the account page and the header bell show them, and the CRM shows each order's notification history.

## Cash by courier

Courier delivery reuses the payout states: payout submitted means the courier is scheduled, processing means out for delivery, completed means delivered, failed means the handoff did not happen. The customer saves a courier address (`POST /api/me/destinations/courier`) as a `payout_destinations` row of kind `courier`, encrypted, after the carrier confirms the ZIP is served. Cash goes only to the verified account holder after an ID check; the recipient is never typed in. Results arrive as `payout.*` webhooks from source `cash`. Staff see the address on the order; support staff see it masked.

## Auth, roles and security

- Passwords are hashed with scrypt. Sessions are 256-bit random tokens in an `HttpOnly; SameSite=Lax` (and `Secure` over https) cookie. Only an HMAC of the token is stored. Sessions have a fixed lifetime (`SESSION_TTL_HOURS`) and are revoked on a password change or reset.
- CSRF uses a per-session token sent back in `X-CSRF-Token`, plus an `Origin` check on every mutation. Only signature-authenticated webhooks are exempt.
- Staff sign in at `/admin/login` (`staffOnly`), which refuses customer accounts with the same answer as a wrong password. The owner is the master account; staff accounts are created only by the CLI or an owner, never by public sign-up.
- Roles: `customer < support < reviewer < admin < owner`. The router checks roles on every route, and the UI hides what the server would refuse. Admins can grant roles up to reviewer; only owners grant admin or owner. Production requires staff TOTP (`REQUIRE_STAFF_MFA`).
- Rate limits: per-IP limits on auth, quotes, orders, chat, live events and webhooks. Accounts lock after 5 failed sign-ins.
- Exchanging needs an account: `/exchange` is behind sign-in, and the server requires a session for firm quotes and orders.
- Payout details (including courier addresses) and TOTP secrets are encrypted with AES-256-GCM. Card numbers are never accepted (provider tokens only) and CVV is never accepted. Staff views mask PII.
- Errors come back as `{ error: { code, message } }` with safe messages. Stack traces are never sent. Logs are structured JSON without secrets.
- The CSP is `script-src 'self'` with no third-party origins and no inline scripts. The site has one dark brand theme, so no theme bootstrap script is needed.

## CRM (staff workspace)

- `/admin/orders` is the home screen: quick filters with counts (needs action, awaiting payment, in progress, completed, rejected or cancelled), search, and a compact table (order, customer, exchange, amount, status, next step). Orders waiting on a person come first (`sort=attention`). Rarely used filters sit under "Filters".
- An order opens as a side panel (`?open=<id>`; `/admin/orders/:id` is the same card on its own page): essentials with one primary and at most one secondary action for the current status, customer and operation details, a short merged history (events, notifications with delivery state, internal notes), and the rest (payments, reviews, conversations, audit link, sandbox lab) under "More details". `src/admin/orderActions.ts` decides the arrangement; the server's `actions` list decides what is allowed.
- Every confirming action opens a dialog with a recorded reason. Order actions send `expectedStatus`; the server refuses them with `409 stale_status` when the order has moved on, so two operators can't act on different versions of the same order.
- Statistics, audit log, users and roles, system and the sandbox lab are under "Administration" in the sidebar.

## Interface language

EN (default) and RU. `src/i18n`: English source text is passed to `t()`, which looks it up in the Russian dictionary (`ru*.ts`, plus `RU_PATTERNS` for server texts with values) and falls back to English. The choice is stored in `localStorage` (`cryptobit.lang`) and on `<html lang>`; switching re-renders the app. Server messages, order-event texts and domain labels stay English on the server and are translated where they are shown; notifications are rebuilt from their template and stored values (`src/i18n/notifications.ts`). Legal documents are English only. `src/i18n/i18n.test.ts` fails when a string passed to `t()` has no Russian entry.

## Live updates and support chat

- `GET /api/events` is a server-sent events stream per user. Events: `order.updated`, `conversation.updated`, `message.created`, `notification.created`. Staff get queue-wide events. The client shows the connection state and falls back to polling while the stream is down.
- Conversations and messages live in the database (append-only messages). The client sends a `clientMessageId`, so a retry cannot duplicate a message. Internal staff notes are never returned to customers.

## Providers

The provider interfaces are in `server/providers/types.ts`. The production JSON contract, webhook format and signature scheme are in [`providers.md`](providers.md). Every outbound call has a timeout, bounded retries with backoff, an idempotency key and structured logs.

## Legal documents

14 versioned documents in `src/content/legal/`, served at `/legal/*`. Sign-up records acceptance of the required versions (`legal_acceptances`, append-only). Open items are in `LEGAL_REVIEW.md`.

## Deployment

See [`../README_DEPLOY.md`](../README_DEPLOY.md): Dockerfile, `compose.yaml`, Caddy, backups and upgrades.
