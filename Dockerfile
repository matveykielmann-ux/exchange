# Arcvale: one image serving the API and the built web app.
# Build:  docker build -t arcvale:$(git rev-parse --short HEAD) .
# The runtime stage has no npm packages: the server bundle uses only Node built-ins (node:http, node:sqlite, node:crypto).

FROM node:22.22.0-bookworm-slim AS build
WORKDIR /app
ENV CI=true
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22.22.0-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    STATIC_DIR=/app/dist
# The database defaults to /app/data/arcvale-<APP_MODE>.db, on the /app/data volume.
WORKDIR /app
# tini forwards SIGTERM so the server can finish in-flight requests and close the database cleanly.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data /app/backups \
  && chown -R node:node /app/data /app/backups
COPY --from=build --chown=root:root /app/dist ./dist
COPY --from=build --chown=root:root /app/dist-server ./dist-server
COPY --from=build --chown=root:root /app/package.json ./package.json
USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--disable-warning=ExperimentalWarning", "dist-server/main.js"]
