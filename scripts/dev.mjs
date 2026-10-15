// Development: rebuilds the API server on change and restarts it, and runs the Vite dev server (which proxies /api).
// Sandbox mode only; the server refuses production settings without the required secrets anyway.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const env = {
  ...process.env,
  APP_MODE: process.env.APP_MODE ?? 'sandbox',
  DATABASE_PATH: process.env.DATABASE_PATH ?? './data/arcvale-sandbox.db',
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
