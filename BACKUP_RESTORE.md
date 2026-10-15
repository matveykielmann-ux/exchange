# Backup and restore

CryptoBit Exchange uses **SQLite** (WAL mode) on a Docker volume (`arcvale-data` → `/app/data/arcvale-<mode>.db`). One database serves both the customer site and the CRM.

## What to back up

| Asset | Where | Notes |
| --- | --- | --- |
| Database | `/app/data/arcvale-production.db` (+ WAL/SHM while running) | Use the CLI `backup` command (`VACUUM INTO`) — never copy the live file with `cp` while the app is writing. |
| Config (without secrets in the archive) | Host copy of `.env.production` template keys only, or a sealed secret store | Do **not** put `SESSION_SECRET` / `DATA_ENCRYPTION_KEY` in an open tarball. |
| Uploaded documents | Application DB metadata only today | Sandbox discards upload bytes after checksum; production refuses document storage (`NOT_CONFIGURED`) until a document provider exists. There is no separate uploads directory to sync yet. |

## Nightly backup (VPS)

From the repo root on the server:

```bash
./deploy/scripts/backup.sh
# cron example:
# 15 3 * * * cd /opt/cryptobit && ./deploy/scripts/backup.sh >> /var/log/cryptobit-backup.log 2>&1
```

Produces `backups/arcvale-<UTC>.db.gz` + `.sha256`, verifies the audit hash chain, prunes files older than `KEEP_DAYS` (default 14).

Copy `backups/` off the server (object storage or another host). A backup that only exists on the same disk is not a backup.

## Restore

```bash
./deploy/scripts/restore.sh backups/arcvale-YYYYMMDDTHHMMSSZ.db.gz
```

The script stops the app, keeps the current DB as `backups/pre-restore-<UTC>.db`, restores, restarts, and checks `/api/ready` plus the audit chain.

Sandbox instance:

```bash
DB_FILE=arcvale-sandbox.db ./deploy/scripts/restore.sh …
```

## After a failed upgrade

1. `ARCVALE_IMAGE_TAG=<previous> docker compose --env-file .env.production up -d app`
2. If the new image applied a migration, restore the pre-upgrade `.db.gz` from `upgrade.sh` / `backups/` before expecting the old image to open the new schema.

Migrations are forward-only; see [`docs/migrations.md`](docs/migrations.md).

## Disk space

Monitor free space on the Docker volume and `backups/`. Keep enough room for at least one full DB copy plus WAL growth. The backup script fails closed if the volume is full.
