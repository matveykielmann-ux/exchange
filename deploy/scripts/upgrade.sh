#!/usr/bin/env bash
# Upgrade to a git ref with a backup first and a tagged image to roll back to.
#   ./deploy/scripts/upgrade.sh <git-ref>
# Rollback: ARCVALE_IMAGE_TAG=<previous tag> docker compose --env-file .env.production up -d app
# (and restore the pre-upgrade backup if the new version ran migrations the old one does not understand).
set -euo pipefail

ref="${1:?Usage: upgrade.sh <git-ref>}"
previous="$(docker compose --env-file .env.production images app --format json 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["Tag"] if d else "")' || true)"

./deploy/scripts/backup.sh
git fetch --tags origin
git checkout --detach "$ref"
tag="$(git rev-parse --short HEAD)"
ARCVALE_IMAGE_TAG="$tag" docker compose --env-file .env.production build app
ARCVALE_IMAGE_TAG="$tag" docker compose --env-file .env.production up -d app
for i in $(seq 1 30); do
  if docker compose --env-file .env.production exec -T app node -e "fetch('http://127.0.0.1:8787/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "Upgraded to ${tag}. Previous image tag: ${previous:-unknown}"
    exit 0
  fi
  sleep 2
done
echo "New version is not ready. Roll back with: ARCVALE_IMAGE_TAG=${previous:-<previous>} docker compose --env-file .env.production up -d app" >&2
exit 1
