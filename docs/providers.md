# Provider integration contract

Arcvale talks to outside providers only through the adapters in `server/providers/`. Sandbox mode uses `sandbox/` (deterministic simulators). Production mode uses `production/`, a generic JSON-over-HTTPS contract described below. When a vendor is contracted, its API is mapped onto this contract in that adapter. Nothing else in the server changes.

## States

Each provider reports one state on `/api/ready`, in `check-config` and on the admin System page:

| State | Meaning |
| --- | --- |
| `sandbox` | Simulated (sandbox mode only). |
| `configured` | Credentials present; calls go to the provider. |
| `not_configured` | No credentials. Every action that needs it is refused with a clear `not_configured` error. Nothing is faked. |
| `disabled_by_policy` | Credentials present, but a code-level gate is off: `REAL_MONEY_ENABLED` (custody, bank and card payouts, cash) or `FEATURE_FLAGS.courierCashDelivery` (cash). |

## Transport (all providers)

- Base URL `<PREFIX>_URL` (https only), `Authorization: Bearer <PREFIX>_API_KEY`, JSON bodies. Money is sent as strings or integers: `amountCents` (integer), `amountAtomic` and `priceUsd` (decimal strings). There are no floats.
- Every write carries an `Idempotency-Key` header. Providers must treat a repeated key as the same request.
- 10 s timeout per attempt and up to 3 attempts with exponential backoff (300 ms, 600 ms) on network errors, 408, 425, 429 and 5xx. Other 4xx fail at once. Redirects are refused.
- Each call is logged with provider, method, path, status, attempt and duration. Bodies and keys are never logged.

| Provider | Env prefix | Calls |
| --- | --- | --- |
| Rates | `RATES_PROVIDER` | `GET v1/prices/{asset}` (BTC, ETH, USDT, USDC) → `{ priceUsd: "68420.15", asOf: ISO-8601 }` |
| Custody (deposits, refunds) | `CUSTODY_PROVIDER` | `POST v1/deposit-addresses {reference, asset, network, expectedAmountAtomic}` → `{id, address, memo?}`; `POST v1/refunds {reference, asset, network, address, amountAtomic}` → `{id}` |
| Identity (KYC) | `KYC_PROVIDER` | `POST v1/verifications {reference, email, fullName, level}` → `{id, status: pending, approved, needs_info or rejected; hostedUrl?}` |
| Screening | `SCREENING_PROVIDER` | `POST v1/screen/address {network, address}`, `POST v1/screen/person {...}` → `{result: clear, review or blocked; note}` |
| Bank payouts | `BANK_PAYOUT_PROVIDER` | `POST v1/payouts {reference, method: ach or wire, amountCents, currency: "USD", destination}` → `{id}` |
| Card payouts | `CARD_PAYOUT_PROVIDER` | Same as bank payouts, `method: instant_debit`. `destination` is the provider's card token. Card numbers never reach Arcvale. |
| Cash | `CASH_PROVIDER` | `GET v1/availability?zip=` (disabled by feature flag) |
| Email | `EMAIL_PROVIDER` + `EMAIL_FROM` | `POST v1/messages {from, to, subject, text}` → `{id}` |

## Webhooks (inbound)

Outcomes such as funds received, deposit confirmed, payout sent or refund completed are accepted **only** from signed provider webhooks, never from the browser or a staff click.

- Endpoint: `POST /api/webhooks/{source}` where source is custody, identity, bankPayout or cardPayout, at most 256 KB, rate-limited.
- Header: `X-Arcvale-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`. The secret is `<PREFIX>_WEBHOOK_SECRET` (≥ 32 chars). Timestamps older or newer than 5 minutes are rejected (replay protection).
- Body: `{ "id": "<unique event id>", "type": "<event type>", "data": { ... } }`. A repeated `id` from the same source returns `duplicate` and changes nothing.
- Each delivery is stored in the webhook log (admin System page) with its outcome. Processing and the order change commit in one transaction.

| Event type | Source | `data` |
| --- | --- | --- |
| `deposit.observed` | custody | `orderId, txHash, amountAtomic, confirmations` |
| `deposit.confirmations` | custody | `orderId, confirmations` |
| `deposit.confirmed` | custody | `orderId, confirmations` |
| `refund.completed` | custody | `orderId, txHash` |
| `payout.processing` / `payout.completed` | bankPayout, cardPayout | `providerRef` |
| `payout.failed` | bankPayout, cardPayout | `providerRef, reason` |
| `verification.updated` | identity | `providerRef, status, detail?` |

Each event moves an order only through `applyOrderEvent` in `server/services/orders.ts`, which enforces the state table in `src/domain/order.ts`. An event that does not fit the current state is rejected and logged, not forced.

## Before connecting a real vendor

1. Contracts, licensing and the items in `docs/compliance-readiness.md` and `docs/production-checklist.md` signed off.
2. Map the vendor's API in the adapter. Keep the contract above, and add adapter tests with recorded responses.
3. Verify the vendor's own webhook signature scheme in the adapter, or put a verifying relay in front of it.
4. Test against the vendor's sandbox with `APP_MODE=production` on a non-public staging host.
