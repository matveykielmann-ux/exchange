# Legal content review register

## Purpose and status

This register tracks unresolved facts and decisions in the customer-facing legal documents in `src/content/legal/`.

- **Status:** Owner package v3.0.0, **owner-declared effective date 2026-03-01**. Documents were synchronized with product behavior under the owner decisions of 2026-10-16 (applied in-repo). **This is not a claim of counsel approval.**
- **Canonical source:** `src/content/legal/source/CRYPTOBIT_EXCHANGE_SERVICE_RULES.md` (SHA-256 checked in tests). Other pages quote it with `{ type: 'rules' }` blocks where applicable.
- **Audience:** the owner, a designated compliance officer, and qualified counsel.
- **Full audit table:** see `CRYPTOBIT_LEGAL_REVIEW.md` (updated with this package).

## Documents

| #   | Slug                  | Title                                                     | Acceptance                 | effectiveDate |
| --- | --------------------- | --------------------------------------------------------- | -------------------------- | ------------- |
| 1   | `terms`               | Service Rules (public offer)                              | Each order                 | 2026-03-01    |
| 2   | `privacy`             | Privacy Policy                                            | Sign-up                    | 2026-03-01    |
| 3   | `e-sign`              | Electronic Communications Consent                         | Sign-up                    | 2026-03-01    |
| 4   | `cookies`             | Cookie Policy                                             | None (informational)       | 2026-03-01    |
| 5   | `risk`                | Risk Disclosure                                           | Each order                 | 2026-03-01    |
| 6   | `crypto-transactions` | Cryptocurrency Transaction and Irreversibility Disclosure | Each order                 | 2026-03-01    |
| 7   | `fees`                | Fee and Exchange-Rate Disclosure                          | Each order                 | 2026-03-01    |
| 8   | `refunds`             | Cancellation, Rejection and Refund Policy                 | Each order                 | 2026-03-01    |
| 9   | `kyc-aml`             | Identity Verification and AML/KYC Notice                  | None (informational)       | 2026-03-01    |
| 10  | `sanctions`           | Sanctions and Restricted-Jurisdiction Notice              | None (informational)       | 2026-03-01    |
| 11  | `complaints`          | Complaints and Support Policy                             | None (informational)       | 2026-03-01    |
| 12  | `cash-delivery`       | Cash Delivery and Pickup Terms                            | None                       | 2026-03-01    |
| 13  | `accessibility`       | Accessibility Statement                                   | None (informational)       | 2026-03-01    |
| 14  | `contact`             | Contact and Legal Notices                                 | None (informational)       | 2026-03-01    |

**Re-acceptance:** signup/order document versions bumped to 3.0.0. Customers who accepted older versions will be asked to accept the new versions on the next signup/order acceptance flow. No acceptances were backdated.

## Classification of items

### Resolved by owner business decision (2026-03-01 package)

| ID | Topic | Resolution |
| --- | --- | --- |
| LR-34 / CLA-04 | Rate fixation | Locked on order confirm; 60s quote TTL; 30m deposit window; late deposit → manual review + new quote consent |
| LR-35 / CLA-09 | Proof of sending | TXID tip only; status follows actual processing / manual verify |
| LR-36 / CLA-06 | Return fees | Manual support returns; return exchange fee if collected; Service bears bank/network costs; no fixed 5%/100 USDT/network table |
| LR-37 / CLA-07 | Amount mismatch | Manual review; new quote with consent or return — no silent reprice |
| LR-38 / CLA-10 | Networks table | Synced to `assets.ts` |
| LR-39 | Contacts | Telegram + in-app only; fake email removed |
| LR-42 / CLA-08 | Cancel after send | Support-only after funds sent |
| LR-43 | Typos | Fixed in owner Rules source |
| LR-48 / CLA-25 | Effective date | Owner-declared `2026-03-01` (not counsel approval) |
| CLA-05 / fees | Commission | Sell 3% / buy 2%; wire $30 = bank estimate not CryptoBit revenue; courier individual |
| CLA-11 | Market data | CoinGecko only as connected source |
| CLA-16 / card privacy | PAN storage | Encrypt at rest + audited CRM reveal; no tokenization “never store” claim |
| CLA-17 / signup | Residence | US state (50 states); no country field |
| CLA-03 / wallets | Custody wording | CRM/operator wallets + explorers; no false “no own wallets / verified providers only” |
| Password | Min length | 8 characters |
| KYC gate | Order placement | Allowed before KYC; payout/refund may still require verification |

### Synced with code

Fee engine (`SELL_EXCHANGE_FEE_BPS` / `BUY_EXCHANGE_FEE_BPS`), quote TTL/window, assets confirmations, manual CRM deposit/payout/refund, card pay-in/out, courier quoted fee, signup/password/KYC gate, legal page metadata and draft-banner logic.

### Still requires confirmed fact or document (do not invent)

| ID | Topic | Who |
| --- | --- | --- |
| LR-18 | Registered / mailing address | Owner |
| LR-04 / 32 / 33 | FinCEN MSB, state licenses, NMLS | Owner + Counsel |
| LR-11 / 20 | Named contracted providers | Owner + Provider |
| LR-40 | Owner-supplied full AML/CTF + Privacy (if distinct from current notices) | Owner |
| LR-21 / 22 | Retention schedule; hosting locations | Owner + Counsel |
| LR-12 | Trademark clearance CryptoBit Exchange | Owner + Counsel |
| LR-30 / 47 / 49 | Real cash delivery compliance gate | Owner + Counsel + Compliance |
| LR-26 | Cookie expiry inventory vs production (incl. `arcvale_*` names) | Tech + Owner |

### Still requires legal / counsel evaluation

| ID | Topic |
| --- | --- |
| LR-03 / 09 | Principal vs agent; customer-fund segregation |
| LR-05 / 10 / 29 | State disclosures; Reg E / Remittance; complaint timelines |
| LR-16 / 23 / 24 / 25 / 46 | Change notice; GLBA/CCPA; privacy contact; E-SIGN / paper copies; Panama vs US e-comms |
| LR-17 | Unclaimed property / dormancy |
| LR-19 / 27 | Biometrics; KYC tiers |
| LR-44 | Which sanctions lists to name |
| LR-31 | Accessibility evaluation |

### Not current product / deferred

- Automatic custody webhooks as the only deposit path (manual CRM remains primary when providers are absent).
- Real cash until `docs/compliance-readiness.md` §6 signed off.
- Claims of licensing, insurance, FDIC/SIPC coverage, PCI DSS certification — **not made**.

## How to update

1. Edit `src/content/legal/` (or replace Service Rules Markdown + `SERVICE_RULES_SHA256`).
2. Bump `version`, set `lastUpdated`; change `effectiveDate` only with an explicit owner/counsel decision.
3. Do not invent addresses, licenses, providers, or counsel approval.
4. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
