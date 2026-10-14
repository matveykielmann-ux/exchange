# Production checklist

Every item needs a named owner and a date before Arcvale handles a real customer. The legal and regulatory gate is in [`compliance-readiness.md`](compliance-readiness.md). This list does not replace it. Items marked **[OWNER/COUNSEL INPUT REQUIRED]** cannot be completed by engineering.

## Legal and business (blocking)
- [ ] Every launch-gate item in `compliance-readiness.md` §1–§7 signed off. **[OWNER/COUNSEL INPUT REQUIRED]**
- [ ] The 14 legal documents in `src/content/legal/` reviewed, placeholders replaced, versions bumped, and `LEGAL_REVIEW.md` closed. **[OWNER/COUNSEL INPUT REQUIRED]**
- [ ] Contracts with each provider in `docs/providers.md` (rates, custody, KYC, screening, bank and card payouts, email). **[OWNER/COUNSEL INPUT REQUIRED]**
- [ ] Pricing policy values, limits, fee schedules and `MANUAL_REVIEW_THRESHOLD_USD` approved. **[OWNER/COUNSEL INPUT REQUIRED]**
- [ ] Support hours, escalation contacts and complaint handling defined. **[OWNER/COUNSEL INPUT REQUIRED]**

## Enabling real money (blocking, code change with review)
- [ ] Provider adapters mapped to the contracted vendors, with tests against their sandboxes.
- [ ] `REAL_MONEY_ENABLED` changed in `src/config/runtime.ts` in a reviewed pull request that references the signed-off items above.
- [ ] Courier cash is enabled in the product (owner decision, 2026-10-14). Before real deliveries: contract a carrier (`CASH_PROVIDER_*`), sign off `compliance-readiness.md` §6 and set the courier fee and minimum.

## Infrastructure
- [ ] VPS hardened: SSH keys only, firewall 22/80/443, automatic security updates.
- [ ] `.env.production` filled from `.env.example`, mode 600, secrets generated fresh. `DATA_ENCRYPTION_KEY` stored in the password manager.
- [ ] `check-config` passes with no warnings you have not accepted.
- [ ] HTTPS works, HSTS present, `/api/ready` returns 200.
- [ ] Owner account created with an authenticator app. Staff accounts use least-privilege roles.
- [ ] Nightly `backup.sh` in cron, copies shipped off the server, and a restore tested on another machine.
- [ ] External uptime monitor on `/api/ready` with alerts to a person.
- [ ] Log retention decided and logs shipped if longer than the local rotation.
- [ ] Upgrade and rollback rehearsed with `upgrade.sh` on staging.

## Application
- [ ] `pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build` and `pnpm qa:visual` pass on the release commit.
- [ ] `pnpm server:scenarios` passes (sandbox lifecycle scenarios).
- [ ] Staging run in `APP_MODE=production` against the providers' own sandboxes: one full order, one failed payout, one refund, one rejected review.
- [ ] Webhook secrets configured for every webhook source, and a deliberately bad signature confirmed rejected.
- [ ] No seed accounts, no `SANDBOX_*` variables and no sandbox database on the production host. The server refuses all three.
- [ ] Independent security review or penetration test of auth, admin RBAC, CSRF, rate limits and webhooks.
