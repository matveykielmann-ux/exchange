# Acceptance checklist (integrator ↔ owner)

Use after `./deploy/install.sh`. Mark each row with evidence (command output / screenshot). Do **not** sign “Production ready for real money” while integration or compliance blockers remain.

## A — Technical acceptance

| # | Check | Evidence |
| --- | --- | --- |
| A1 | `./deploy/preflight.sh` has no `BLOCKER` / `FAIL` | paste summary |
| A2 | `https://YOUR_DOMAIN/api/health` → 200 | curl |
| A3 | `https://crm.YOUR_DOMAIN/api/health` → 200 | curl |
| A4 | `https://YOUR_DOMAIN/api/ready` → 200 | curl JSON |
| A5 | Customer homepage on PUBLIC_ORIGIN (no CRM nav) | browser |
| A6 | `/admin` on customer host redirects to CRM_ORIGIN | browser |
| A7 | Owner signs in at CRM with TOTP | CRM login |
| A8 | Customer account cannot open `/api/admin/*` | 401/403 |
| A9 | `check-config` mode=production, CRM origin set, staff MFA on | CLI |
| A10 | `FILES_DIR` on data volume; sample order upload/download ACL | CRM/order |
| A11 | `./deploy/scripts/backup.sh` produces `.db.gz` + `-files.tar.gz` + sha256 | ls backups/ |
| A12 | `./deploy/scripts/restore-drill.sh <backup>` passes `verify-storage` | drill log |
| A13 | `DATA_ENCRYPTION_KEY` stored offline (password manager) | owner attestation |
| A14 | Nightly cron for `backup.sh` + off-site copy plan | crontab / ticket |

## B — Integration acceptance (per contracted provider)

| # | Check | Evidence |
| --- | --- | --- |
| B1 | Each required provider shows `configured` in `check-config` | CLI |
| B2 | Bad webhook signature rejected | 401 from `/api/webhooks/…` |
| B3 | Vendor sandbox: one happy-path order lifecycle | runbook notes |
| B4 | Vendor sandbox: failed payout / needs_info KYC | runbook notes |
| B5 | CoinGecko prices visible; quotes fail closed if feed down | `/api/prices` |

## C — Real-money gate (owner/counsel — not engineering alone)

| # | Check | Evidence |
| --- | --- | --- |
| C1 | [`../compliance-readiness.md`](../compliance-readiness.md) §§ signed | dated sign-off |
| C2 | [`../production-checklist.md`](../production-checklist.md) legal items closed | dated sign-off |
| C3 | Contracts for every money-moving adapter in use | contracts |
| C4 | External uptime monitor on `/api/ready` | monitor URL |

**Verdict language**

- “Technically accepted” = section A complete.
- “Integrations accepted” = A + relevant B rows.
- “Cleared for real money” = A + B + C. Never implied by Docker health alone.
