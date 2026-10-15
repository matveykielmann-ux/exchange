/**
 * End-to-end pricing with CoinGecko as the active rates provider: /api/prices,
 * indicative and firm quotes share one feed; cache, failures, stale rejection,
 * and no fabricated fallback; firm quotes expire and match displayed prices.
 */
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { testConfig } from '../config';
import { silentLogger } from '../logger';
import { createCoinGeckoRates } from '../providers/coingecko';
import { createSandboxProviders } from '../providers/sandbox';
import { PRICING_POLICY } from '@/domain/quote';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import { SANDBOX_PASSWORD } from '../scenarios';
import { T0, type Json } from './helpers';

const BODY = {
  bitcoin: { usd: 80823.449581, last_updated_at: T0 / 1000 },
  ethereum: { usd: 2359.5, last_updated_at: T0 / 1000 },
  tether: { usd: 0.999029, last_updated_at: T0 / 1000 },
  'usd-coin': { usd: 1, last_updated_at: T0 / 1000 },
  ripple: { usd: 0.62, last_updated_at: T0 / 1000 },
  solana: { usd: 148.5, last_updated_at: T0 / 1000 },
  binancecoin: { usd: 595.2, last_updated_at: T0 / 1000 },
};

type Harness = {
  base: string;
  close: () => Promise<void>;
  clock: { now: () => number; advance: (ms: number) => void };
  calls: string[];
  setRespond: (fn: () => Response) => void;
};

async function boot(): Promise<Harness> {
  let t = T0;
  let respond: () => Response = () => Response.json(BODY);
  const calls: string[] = [];
  const fetchImpl = (async (url: URL) => {
    calls.push(String(url));
    return respond();
  }) as unknown as typeof fetch;

  const config = testConfig({ port: 0, host: '127.0.0.1' }, { RATES_SOURCE: 'coingecko', COINGECKO_CACHE_SECONDS: '30' });
  const clock = {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
  const app = createApp(config, { clock, log: silentLogger });
  const sandbox = createSandboxProviders(config, () => t);
  app.ctx.providers = {
    ...sandbox,
    rates: createCoinGeckoRates({
      settings: config.coingecko!,
      mode: 'sandbox',
      log: silentLogger,
      now: () => t,
      fetchImpl,
    }),
  };
  const server = await app.listen();
  const addr = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${addr.port}`,
    close: () => app.close(),
    clock,
    calls,
    setRespond: (fn) => {
      respond = fn;
    },
  };
}

async function http(base: string, method: string, path: string, body?: unknown, cookie?: string, csrf?: string) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(method !== 'GET' ? { origin: 'http://localhost:5173' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Json, headers: res.headers };
}

describe('CoinGecko pricing pipeline', () => {
  let env: Harness;
  beforeEach(async () => {
    env = await boot();
  });
  afterEach(async () => {
    await env.close();
  });

  it('serves /api/prices and indicative quotes from the same CoinGecko feed', async () => {
    const prices = await http(env.base, 'GET', '/api/prices');
    expect(prices.status).toBe(200);
    expect(prices.body.prices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ asset: 'BTC', priceMicros: '80823449581', feed: 'coingecko', source: 'sandbox' }),
        expect.objectContaining({ asset: 'ETH', feed: 'coingecko' }),
        expect.objectContaining({ asset: 'USDT', feed: 'coingecko' }),
        expect.objectContaining({ asset: 'USDC', feed: 'coingecko' }),
      ]),
    );
    expect(env.calls).toHaveLength(1);

    const q = await http(env.base, 'GET', '/api/quotes/indicative?asset=BTC&network=bitcoin&amountAtomic=10000000&payoutMethod=ach');
    expect(q.status).toBe(200);
    expect(q.body.quote.referencePriceMicros).toBe('80823449581');
    expect(q.body.price.feed).toBe('coingecko');
    expect(env.calls).toHaveLength(1); // 30s cache
  });

  it('refreshes after the cache window', async () => {
    await http(env.base, 'GET', '/api/prices');
    expect(env.calls).toHaveLength(1);
    env.clock.advance(29_000);
    await http(env.base, 'GET', '/api/prices');
    expect(env.calls).toHaveLength(1);
    env.clock.advance(2_000);
    env.setRespond(() =>
      Response.json({
        bitcoin: { usd: 81000, last_updated_at: env.clock.now() / 1000 },
        ethereum: { usd: 2400, last_updated_at: env.clock.now() / 1000 },
        tether: { usd: 1, last_updated_at: env.clock.now() / 1000 },
        'usd-coin': { usd: 1, last_updated_at: env.clock.now() / 1000 },
      }),
    );
    const prices = await http(env.base, 'GET', '/api/prices');
    expect(env.calls).toHaveLength(2);
    expect(prices.status).toBe(200);
    expect(prices.body.prices.find((p: { asset: string }) => p.asset === 'BTC').priceMicros).toBe('81000000000');
  });

  it('rejects a stale upstream coin without fabricating a price', async () => {
    env.setRespond(() =>
      Response.json({
        ...BODY,
        ethereum: { usd: 2000, last_updated_at: T0 / 1000 - 3600 },
      }),
    );
    const eth = await http(
      env.base,
      'GET',
      '/api/quotes/indicative?asset=ETH&network=ethereum&amountAtomic=1500000000000000000&payoutMethod=ach',
    );
    expect(eth.status).toBe(503);
    expect(['provider_unavailable', 'price_stale']).toContain(eth.body.error.code);

    const btc = await http(env.base, 'GET', '/api/quotes/indicative?asset=BTC&network=bitcoin&amountAtomic=10000000&payoutMethod=ach');
    expect(btc.status).toBe(200);
    expect(btc.body.quote.referencePriceMicros).toBe('80823449581');
  });

  it('does not fall back to fabricated prices when CoinGecko fails', async () => {
    env.setRespond(() => {
      throw new TypeError('fetch failed');
    });
    const prices = await http(env.base, 'GET', '/api/prices');
    expect(prices.status).toBe(503);
    expect(['provider_unavailable', 'price_stale']).toContain(prices.body.error.code);

    const indicative = await http(
      env.base,
      'GET',
      '/api/quotes/indicative?asset=BTC&network=bitcoin&amountAtomic=10000000&payoutMethod=ach',
    );
    expect(indicative.status).toBe(503);

    const signup = await http(env.base, 'POST', '/api/auth/signup', {
      email: `nofeed-${env.clock.now()}@example.test`,
      password: SANDBOX_PASSWORD,
      fullName: 'No Feed',
      countryOfResidence: 'US',
      stateOfResidence: 'NY',
      notInRestrictedTerritory: true,
      accepted: LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'signup').map((d) => ({ slug: d.slug, version: d.version })),
    });
    expect(signup.status).toBe(201);
    const cookie = signup.headers.getSetCookie().map((c: string) => c.split(';')[0]).join('; ');
    const csrf = signup.body.csrfToken as string;
    const firm = await http(
      env.base,
      'POST',
      '/api/quotes',
      { asset: 'BTC', network: 'bitcoin', amountAtomic: '10000000', payoutMethod: 'ach' },
      cookie,
      csrf,
    );
    expect(firm.status).toBe(503);
    expect(['provider_unavailable', 'price_stale']).toContain(firm.body.error.code);
  });

  it('respects 429 backoff and reports unavailable after the cached price ages out', async () => {
    await http(env.base, 'GET', '/api/prices');
    env.setRespond(() => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }));
    env.clock.advance(31_000);
    const cached = await http(env.base, 'GET', '/api/prices');
    expect(cached.status).toBe(200);
    env.clock.advance(40_000);
    const unavailable = await http(env.base, 'GET', '/api/prices');
    expect(unavailable.status).toBe(503);
  });

  it('issues a firm quote that matches the displayed reference price and rejects it after TTL', async () => {
    const signup = await http(env.base, 'POST', '/api/auth/signup', {
      email: `price-${env.clock.now()}@example.test`,
      password: SANDBOX_PASSWORD,
      fullName: 'Price Tester',
      countryOfResidence: 'US',
      stateOfResidence: 'NY',
      notInRestrictedTerritory: true,
      accepted: LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'signup').map((d) => ({ slug: d.slug, version: d.version })),
    });
    expect(signup.status).toBe(201);
    const cookie = signup.headers.getSetCookie().map((c: string) => c.split(';')[0]).join('; ');
    const csrf = signup.body.csrfToken as string;

    const indicative = await http(
      env.base,
      'GET',
      '/api/quotes/indicative?asset=BTC&network=bitcoin&amountAtomic=10000000&payoutMethod=ach',
      undefined,
      cookie,
    );
    expect(indicative.status).toBe(200);
    const ref = indicative.body.quote.referencePriceMicros as string;

    const firm = await http(
      env.base,
      'POST',
      '/api/quotes',
      { asset: 'BTC', network: 'bitcoin', amountAtomic: '10000000', payoutMethod: 'ach' },
      cookie,
      csrf,
    );
    expect(firm.status).toBe(201);
    expect(firm.body.quote.referencePriceMicros).toBe(ref);
    expect(firm.body.quote.expiresAt - firm.body.quote.createdAt).toBe(PRICING_POLICY.quoteTtlMs);

    const bank = await http(
      env.base,
      'POST',
      '/api/me/destinations/bank',
      { routingNumber: '011000015', accountNumber: '123456789', accountType: 'checking', label: 'Checking' },
      cookie,
      csrf,
    );
    expect(bank.status).toBe(201);
    const destinationId = bank.body.id as string;

    env.clock.advance(PRICING_POLICY.quoteTtlMs + 1);
    const order = await http(
      env.base,
      'POST',
      '/api/orders',
      {
        quoteId: firm.body.quote.id,
        destinationId,
        accepted: LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'order').map((d) => ({ slug: d.slug, version: d.version })),
      },
      cookie,
      csrf,
    );
    expect(order.status).toBe(409);
    expect(order.body.error.code).toBe('quote_expired');
  });
});
