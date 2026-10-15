# VPS + CRM subdomain preparation

Local verification completed; **no real VPS or DNS was configured**.

## Commands run

```bash
pnpm typecheck
pnpm lint
pnpm test          # 129 passed
pnpm build
# Dual-host smoke: PUBLIC_ORIGIN=http://localhost:43127 CRM_ORIGIN=http://127.0.0.1:43127
```

## Still required on a real VPS (SSH / DNS)

- Point `A` records for `YOUR_DOMAIN` and `crm.YOUR_DOMAIN`
- Fill `.env.production` with real secrets and domains
- `docker compose --env-file .env.production up -d`
- `create-user` for the first owner
- Nightly backup cron + off-site copy
