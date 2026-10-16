# Information the owner must provide to the integrator

Do not put real credentials into git or chat logs. Prefer a sealed channel / password manager share.

## Required before first install

| Item | Example shape | Why |
| --- | --- | --- |
| Primary domain | `exchange.example.com` | Customer site + ACME |
| CRM hostname | `crm.exchange.example.com` (recommended) | Separate cookie origin for staff |
| ACME contact email | `ops@example.com` | Let's Encrypt notices |
| VPS access | SSH key to Ubuntu/Debian host | Installer runs on the server |
| DNS control | Ability to create two `A` records | TLS cannot issue without this |
| Owner staff email | `you@example.com` | First `owner` account (CLI) |
| Offline vault | Password manager / HSM process | Store `DATA_ENCRYPTION_KEY` forever |

## DNS records the owner (or their DNS provider) must create

Point both names at the **same** VPS IPv4 before or immediately after `install.sh`:

```
YOUR_DOMAIN          A    <VPS_IPV4>
crm.YOUR_DOMAIN      A    <VPS_IPV4>
```

Do not claim DNS is ready until `./deploy/preflight.sh` shows `PASS` for both hosts (or until dig matches the VPS IP).

## Optional before money go-live (contracts)

| Integration | Owner provides | Integrator configures |
| --- | --- | --- |
| Custody / deposits | Vendor contract + API keys + webhook secret | `CUSTODY_PROVIDER_*` |
| Bank payouts | ACH/wire vendor | `BANK_PAYOUT_PROVIDER_*` |
| Card payouts | Instant-debit vendor (tokenised cards) | `CARD_PAYOUT_PROVIDER_*` |
| Cash courier | Carrier contract | `CASH_PROVIDER_*` |
| KYC vendor (optional) | Hosted KYC API | `KYC_PROVIDER_*` (document KYC also works locally encrypted) |
| AML screening | Screening API | `SCREENING_PROVIDER_*` |
| Transactional email | ESP API + from-address | `EMAIL_PROVIDER_*`, `EMAIL_FROM` |
| CoinGecko (prices) | Optional Demo/Pro API key | `COINGECKO_API_KEY` / `COINGECKO_API_PLAN` |

Market prices default to the public CoinGecko API without a key. That feed is **not** settlement infrastructure.

## Explicitly out of scope for the installer

- Changing DNS at the registrar (integrator can only print required records)
- Signing compliance / MSB / licensing documents
- Inventing provider credentials or simulating production money movement
- Rotating `DATA_ENCRYPTION_KEY` on an existing database
