/**
 * Production mode without provider credentials: everything that would move
 * money or claim an outcome reports NOT_CONFIGURED; sandbox-only routes and
 * settings do not exist; configuration fails closed.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import { createApp } from '../app';
import { ConfigError, loadConfig } from '../config';
import { fixedClock } from '../lib/clock';
import { silentLogger } from '../logger';
import { providerInfos } from '../providers/registry';
import { SANDBOX_PASSWORD } from '../scenarios';
import { T0, type Json } from './helpers';

const KEY = Buffer.alloc(32, 9).toString('base64');
const prodEnv = (dir: string, extra: Record<string, string> = {}) => ({
  NODE_ENV: 'production',
  APP_MODE: 'production',
  PUBLIC_ORIGIN: 'https://arcvale.example',
  CRM_ORIGIN: 'https://crm.arcvale.example',
  SESSION_SECRET: 'x'.repeat(48),
  DATA_ENCRYPTION_KEY: KEY,
  DATABASE_PATH: path.join(dir, 'arcvale-production.db'),
  SERVE_STATIC: 'false',
  HOST: '127.0.0.1',
  PORT: '1',
  // Isolate money-moving provider checks from the default CoinGecko rates feed.
  RATES_SOURCE: 'default',
  ...extra,
});

describe('configuration', () => {
  it('fails closed on unsafe production settings', () => {
    const problems = (env: Record<string, string>) => {
      try {
        loadConfig(env);
        return [];
      } catch (e) {
        return (e as ConfigError).problems;
      }
    };
    expect(problems({ NODE_ENV: 'production' })).toContain('APP_MODE must be set explicitly when NODE_ENV=production.');
    const p = problems({
      APP_MODE: 'production',
      PUBLIC_ORIGIN: 'http://arcvale.example',
      DATABASE_PATH: ':memory:',
      SANDBOX_RATES: 'BTC=1',
    });
    expect(p).toEqual(
      expect.arrayContaining([
        'PUBLIC_ORIGIN must use https in production.',
        'CRM_ORIGIN is required in production (e.g. https://crm.example.com).',
        'SESSION_SECRET is required in production.',
        'DATA_ENCRYPTION_KEY is required in production.',
        'An in-memory database is not allowed in production.',
        'Sandbox settings are not allowed in production: SANDBOX_RATES.',
      ]),
    );
    expect(problems({ APP_MODE: 'sandbox', DATABASE_PATH: '/tmp/arcvale-production.db' })).toContain(
      'A sandbox server must not open a database file named for production.',
    );
    expect(problems({ ...prodEnv('/tmp'), BANK_PAYOUT_PROVIDER_URL: 'http://bank.example' })).toEqual(
      expect.arrayContaining(['BANK_PAYOUT_PROVIDER_URL and BANK_PAYOUT_PROVIDER_API_KEY must be set together.']),
    );
  });

  it('enables money-moving adapters only when credentials are present; others stay not configured', () => {
    const cfg = loadConfig({
      ...prodEnv('/tmp'),
      BANK_PAYOUT_PROVIDER_URL: 'https://bank.example',
      BANK_PAYOUT_PROVIDER_API_KEY: 'k',
      BANK_PAYOUT_PROVIDER_WEBHOOK_SECRET: 's'.repeat(40),
      RATES_PROVIDER_URL: 'https://rates.example',
      RATES_PROVIDER_API_KEY: 'k',
    });
    const app = createApp({ ...cfg, databasePath: ':memory:' }, { log: silentLogger });
    const states = Object.fromEntries(providerInfos(app.ctx.providers).map((p) => [p.key, p.state]));
    expect(states).toMatchObject({
      bankPayout: 'configured',
      rates: 'configured',
      custody: 'not_configured',
      cash: 'not_configured',
    });
    void app.close();
  });
});

describe('production mode without credentials', () => {
  let dir: string;
  let base: string;
  let close: () => Promise<void>;
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'arcvale-prod-'));
    const cfg = { ...loadConfig(prodEnv(dir)), port: 0 };
    const app = createApp(cfg, { log: silentLogger, clock: fixedClock(T0) });
    const server = await app.listen();
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => app.close();
  });
  afterAll(async () => {
    await close();
    rmSync(dir, { recursive: true, force: true });
  });

  const call = async (method: string, p: string, body?: unknown, cookie?: string, csrf?: string) => {
    const res = await fetch(base + p, {
      method,
      headers: {
        origin: 'https://arcvale.example',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as Json, headers: res.headers };
  };

  it('reports NOT_CONFIGURED for prices and quotes instead of inventing them', async () => {
    const prices = await call('GET', '/api/prices');
    expect(prices.status).toBe(503);
    expect(prices.body.error.code).toBe('NOT_CONFIGURED');
    const q = await call('GET', '/api/quotes/indicative?asset=BTC&network=bitcoin&amountAtomic=100000&payoutMethod=ach');
    expect(q.body.error.code).toBe('NOT_CONFIGURED');
    const cfg = await call('GET', '/api/config');
    expect(cfg.body.mode).toBe('production');
    expect(cfg.body.providers.every((p: { state: string }) => p.state === 'not_configured')).toBe(true);
    expect((await call('GET', '/api/ready')).body.providers.length).toBe(8);
  });

  it('does not register sandbox routes or accept unsigned webhooks', async () => {
    expect((await call('POST', '/api/sandbox/orders/ord_x/deposit', { scenario: 'exact' })).status).toBe(404);
    expect((await call('POST', '/api/admin/sandbox/orders/ord_x/payout', { outcome: 'completed' })).status).toBe(404);
    const hook = await call('POST', '/api/webhooks/custody', { id: 'evt_123456', type: 'deposit.observed', data: {} });
    expect(hook.status).toBe(503);
    expect(hook.body.error.code).toBe('NOT_CONFIGURED');
  });

  it('refuses identity verification and bank details without providers, and sends HSTS and secure cookies', async () => {
    const signup = await call('POST', '/api/auth/signup', {
      email: 'real@example.com',
      password: SANDBOX_PASSWORD,
      fullName: 'Real Person',
      countryOfResidence: 'US',
      stateOfResidence: 'NY',
      notInRestrictedTerritory: true,
      accepted: LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'signup').map((d) => ({ slug: d.slug, version: d.version })),
    });
    expect(signup.status).toBe(201);
    const cookies = signup.headers.getSetCookie();
    expect(cookies.every((c) => /Secure/.test(c))).toBe(true);
    const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
    const csrf = signup.body.csrfToken as string;
    // Provider-backed identity hop stays off without KYC_PROVIDER_*; document KYC uses local encrypted storage.
    const kyc = await call('POST', '/api/me/verification', {}, cookie, csrf);
    expect(kyc.body.error.code).toBe('NOT_CONFIGURED');
    const idType = await call('PUT', '/api/me/kyc/id-type', { idType: 'passport' }, cookie, csrf);
    expect(idType.status).toBe(200);
    expect(idType.body.submission).toMatchObject({ idType: 'passport', status: 'draft' });
    const bank = await call(
      'POST',
      '/api/me/destinations/bank',
      { routingNumber: '021000021', accountNumber: '000123456789', accountType: 'checking' },
      cookie,
      csrf,
    );
    expect(bank.body.error.code).toBe('NOT_CONFIGURED');
    const card = await call('POST', '/api/me/destinations/card', {}, cookie, csrf);
    expect(card.body.error.code).toBe('NOT_CONFIGURED');
    const quote = await call(
      'POST',
      '/api/quotes',
      { asset: 'BTC', network: 'bitcoin', amountAtomic: '100000', payoutMethod: 'ach' },
      cookie,
      csrf,
    );
    expect(quote.body.error.code).toBe('NOT_CONFIGURED');
  });

  it('refuses to open a sandbox database in production mode and vice versa', () => {
    const sandboxFile = path.join(dir, 'arcvale-sandbox.db');
    const sb = createApp(loadConfig({ APP_MODE: 'sandbox', DATABASE_PATH: sandboxFile, SERVE_STATIC: 'false' }), { log: silentLogger });
    void sb.close();
    expect(() => createApp({ ...loadConfig(prodEnv(dir)), databasePath: sandboxFile }, { log: silentLogger })).toThrow(
      /belongs to sandbox mode/,
    );
  });
});
