# External integrations — configuration guide

Production adapters live under `server/providers/production/`. Missing credentials → state `not_configured` → money-moving / dependent actions are **refused** (never simulated). Full HTTP contract: [`../providers.md`](../providers.md).

Validate after edits:

```bash
docker compose --env-file .env.production up -d app
docker compose --env-file .env.production exec -T app \
  node --disable-warning=ExperimentalWarning dist-server/cli.js check-config
curl -fsS https://YOUR_DOMAIN/api/ready
# Admin → System page also lists provider states
```

## Reference prices (not settlement)

| Item | Detail |
| --- | --- |
| Purpose | Indicative BTC/ETH/USDT/USDC/XRP/SOL/BNB USD prices for quotes |
| Env | `RATES_SOURCE=coingecko` (default), optional `COINGECKO_API_KEY`, `COINGECKO_API_PLAN=demo\|pro`, `COINGECKO_CACHE_SECONDS` |
| Where to get credentials | https://www.coingecko.com/en/api (optional Demo/Pro key) |
| Config check | `check-config` shows `rates configured` with CoinGecko detail |
| Availability | `GET /api/prices` on the customer origin; failure → “Rate unavailable” (no fabricated fallback) |
| Before activation | Outbound HTTPS from VPS to `api.coingecko.com` (or pro host) |
| Manual | None for public demo tier; keep keys out of git |

Alternative: `RATES_PROVIDER_URL` + `RATES_PROVIDER_API_KEY` for a contracted rates API (`docs/providers.md`). Do **not** treat either feed as proof of executed trades.

---

## Custody / deposit infrastructure

| Item | Detail |
| --- | --- |
| Env | `CUSTODY_PROVIDER_URL`, `CUSTODY_PROVIDER_API_KEY`, `CUSTODY_PROVIDER_WEBHOOK_SECRET` (≥32 chars) |
| Where to get | Your contracted custody / wallet infrastructure vendor |
| Config check | `check-config` → `custody configured` (otherwise **incomplete / not_configured**) |
| Availability | Vendor health/sandbox; webhook `POST /api/webhooks/custody` with `X-Arcvale-Signature` (legacy header name — keep) |
| Scenarios before activation | Deposit address issuance, observed → confirmed chain, refund path on vendor sandbox |
| Manual | Map vendor API to the generic contract in `server/providers/production/` if shapes differ; never paste private keys into CryptoBit Exchange |

Until configured: deposit address issuance and refunds that need custody stay blocked.

---

## Blockchain monitoring

Deposit confirmations arrive as **signed custody webhooks** (`deposit.observed`, `deposit.confirmations`, `deposit.confirmed`), not from a separate env block. Monitoring is part of the custody vendor integration above.

---

## Bank payouts (ACH / wire)

| Item | Detail |
| --- | --- |
| Env | `BANK_PAYOUT_PROVIDER_URL`, `BANK_PAYOUT_PROVIDER_API_KEY`, `BANK_PAYOUT_PROVIDER_WEBHOOK_SECRET` |
| Where to get | Contracted bank/payout rail |
| Config check | `bankPayout configured` |
| Availability | Vendor sandbox + webhook `POST /api/webhooks/bankPayout` |
| Scenarios | Successful payout, failed payout, duplicate webhook id |
| Manual | CRM wire credential sets for **buy** flows are configured in-app under `/admin/credentials` (not these env vars) |

---

## Card payouts

| Item | Detail |
| --- | --- |
| Env | `CARD_PAYOUT_PROVIDER_URL`, `CARD_PAYOUT_PROVIDER_API_KEY`, `CARD_PAYOUT_PROVIDER_WEBHOOK_SECRET` |
| Where to get | Instant-debit / card payout vendor |
| Config check | `cardPayout configured` |
| Note | Card PANs never enter CryptoBit Exchange; destination is a provider token |
| Scenarios | Same as bank payouts via `POST /api/webhooks/cardPayout` |

---

## Cash / courier

| Item | Detail |
| --- | --- |
| Env | `CASH_PROVIDER_URL`, `CASH_PROVIDER_API_KEY`, `CASH_PROVIDER_WEBHOOK_SECRET` |
| Feature flag | `FEATURE_FLAGS.courierCashDelivery` (already on in product); still needs provider |
| Config check | `cash configured` |
| Scenarios | ZIP availability, delivery create, `payout.*` webhooks from source `cash` |
| Manual | Compliance § for cash in `../compliance-readiness.md`; courier fee acceptance is in-app |

---

## KYC

| Path | Detail |
| --- | --- |
| Document KYC (built-in) | Customer uploads ID/selfie/address; files AES-GCM encrypted in SQLite; reviewer workflow in CRM. **No extra env** beyond `DATA_ENCRYPTION_KEY`. |
| Hosted KYC vendor | `KYC_PROVIDER_URL`, `KYC_PROVIDER_API_KEY`, `KYC_PROVIDER_WEBHOOK_SECRET` → `POST /api/webhooks/identity` |
| Config check | `identity configured` only when vendor env is set; document path works without it |
| Manual | Screening still recommended before approval |

---

## AML screening

| Item | Detail |
| --- | --- |
| Env | `SCREENING_PROVIDER_URL`, `SCREENING_PROVIDER_API_KEY` |
| Config check | `screening configured` |
| Used for | Address/person screening hooks in verification / payout flows |
| Manual | Define review policy when result is `review` / `blocked` |

---

## Email / notifications

| Item | Detail |
| --- | --- |
| Env | `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` |
| Config check | `email configured` |
| Availability | Send a test message via vendor dashboard / adapter |
| Manual | SPF/DKIM/DMARC at the DNS provider for `EMAIL_FROM` domain |

In-app support chat does **not** use file attachments; order documents use `FILES_DIR`.

---

## Incomplete integrations

Any adapter still showing `not_configured` in `check-config` or `/api/ready` is **incomplete**. Dependent money operations remain safely blocked. Do not invent providers or toggle production into sandbox simulation.
