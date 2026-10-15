# CryptoBit Exchange product overhaul

Status after the re-audit pass on branch `cursor/complete-exchange-workflow-f51e`.

## Delivered

| Area | Result |
|---|---|
| Sandbox CRM UI | Sandbox Lab pages removed from the product; Overview / Verification MockBadge callouts removed. Sandbox HTTP APIs remain for `APP_MODE=sandbox` only. |
| Staff roles in CRM | Users UI exposes a single Admin staff role (backend ranks still exist for RBAC). |
| Assets | XRP (XRPL), SOL (Solana), BNB (BSC), including destination tags where needed. |
| Brand | Home slogans: “Exchange Without Limits” / “Fast. Secure. Global.” |
| Minimums | No published order minimum (`minimumCents = 0`); Fees, FAQ, Home, cash delivery, and legal fee copy aligned. |
| Fees | 3% exchange fee; wire = $30 bank processing + 3%; courier fee quoted per order by staff. |
| Wire credentials | Buy wire orders stay in `created` until staff assigns a CRM set or custom per-order details. |
| Credentials CRM | Wire sets and deposit wallets under **Credentials & wallets**. |
| Payment confirmation | Customer submit + staff review; does not auto-complete money movement. |
| Additional verification | Staff messages on the order; customer sees them on the order page. |
| Refunds | Customer refund request via support; approval blocked until KYC is verified. |
| Order references | 10-digit numeric references. |
| Service status | Admin **Service status** page. |
| Motion | Status / upload CSS animations (reduced-motion safe). |
| Tests | Domain fee/asset/minimum tests; API coverage for wire wait, custom wire assign, payment confirmation, verification messages, refund review. |

## Intentionally unchanged

- Sandbox provider simulators and `/api/admin/sandbox/*` routes (internal testing only).
- Server-side support / reviewer / owner ranks (CRM collapses them to Admin for day-to-day UI).
- Real-money and provider gates (`REAL_MONEY_ENABLED`, `NOT_CONFIGURED` adapters).

## Follow-ups (non-blocking)

- Orphan i18n strings for old flat-fee / ACH-zero-fee copy in `ru-domain` / `ru-public3`.
- Architecture / deploy docs still mention a Sandbox Lab page and older brand names in places.
- `OrderView` TypeScript types could include payment/refund/message fields without casts.
