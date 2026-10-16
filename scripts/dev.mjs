// Sandbox-only development watcher (simulated money-moving providers + sandbox DB).
// Owner-operated / production dual-host: ./deploy/run-local-production.sh or `pnpm start:local-prod`.
// This script refuses to open a production-named database so demos cannot mutate ops data by accident.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const databasePath = process.env.DATABASE_PATH ?? './data/arcvale-sandbox.db';
if (/production/i.test(databasePath)) {
  console.error('pnpm dev is sandbox-only and refuses DATABASE_PATH containing "production".');
  console.error('Use ./deploy/run-local-production.sh (or pnpm start:local-prod) for APP_MODE=production.');
  process.exit(2);
}

const env = {
  ...process.env,
  APP_MODE: 'sandbox',
  DATABASE_PATH: databasePath,
  SERVE_STATIC: 'false',
  // Live market prices via CoinGecko (no fabricated fallback). Override with RATES_SOURCE=default for offline.
  RATES_SOURCE: process.env.RATES_SOURCE ?? 'coingecko',
  COINGECKO_CACHE_SECONDS: process.env.COINGECKO_CACHE_SECONDS ?? '30',
};
const children = [];
const run = (cmd, args, extra = {}) => {
  const c = spawn(cmd, args, { stdio: 'inherit', env: { ...env, ...extra }, shell: process.platform === 'win32' });
  children.push(c);
  return c;
};

run('pnpm', ['exec', 'vite', 'build', '-c', 'vite.server.config.ts', '--watch', '--logLevel', 'warn']);
const waitForBuild = setInterval(() => {
  if (!existsSync('dist-server/main.js')) return;
  clearInterval(waitForBuild);
  run('node', ['--disable-warning=ExperimentalWarning', '--watch-path=dist-server', 'dist-server/main.js']);
  run('pnpm', ['exec', 'vite']);
}, 300);

const stop = () => {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
