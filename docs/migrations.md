# Database migrations

The schema lives in `server/db/migrations.ts` as an ordered list. Migrations run automatically when the server starts (`createApp`). They can also run explicitly:

```bash
node dist-server/cli.js migration-status   # applied and pending
node dist-server/cli.js migrate            # apply pending
```

Rules:

- **Append only.** Never edit a migration that has shipped. Each applied migration is stored with a checksum, and an edited one is detected and refused at start. Add a new migration instead.
- Each migration runs in a transaction, so a failure leaves the database at the previous version.
- **Forward only.** There are no down migrations. To roll back a release that migrated, restore the pre-upgrade backup (`deploy/scripts/upgrade.sh` takes one automatically) and run the previous image.
- Money columns: USD cents are `INTEGER` with range checks. Crypto atomic amounts and USD-micro prices are digit-only `TEXT`, because 18-decimal amounts overflow 64-bit integers. Code converts both to `bigint`. Never use `REAL` for money.
- Ledger-like tables (order events, deposit observations, operator notes, support messages, audit log, legal acceptances) are append-only through triggers. The audit log is hash-chained; check it with `verify-audit`.
- The first migration records the database's mode (`sandbox` or `production`). A database never opens in the other mode.
- Write migrations to be safe on a live database: add nullable columns or columns with defaults, backfill in code, and tighten constraints in a later migration.
