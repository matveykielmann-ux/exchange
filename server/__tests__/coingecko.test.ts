/**
 * CoinGecko reference prices: one cached request for all assets, Retry-After
 * respected on 429, the last good price served only while fresh, and a
 * ProviderError (shown as "rate unavailable") instead of an invented number.
 */
import { loadConfig, testConfig } from '../config';
import { silentLogger } from '../logger';
import { coingeckoUsdToMicros, createCoinGeckoRates } from '../providers/coingecko';
import { ProviderError } from '../providers/types';
import { T0 } from './helpers';

const BODY = {
  bitcoin: { usd: 80823.449581, last_updated_at: T0 / 1000 },
  ethereum: { usd: 2359.5, last_updated_at: T0 / 1000 },
  tether: { usd: 0.999029, last_updated_at: T0 / 1000 },
  'usd-coin': { usd: 1, last_updated_at: T0 / 1000 },
};

function setup(settings: { apiKey?: string | null; plan?: 'demo' | 'pro' } = {}) {
  let t = T0;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  let next: () => Response = () => Response.json(BODY);
  const fetchImpl = (async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), headers: init.headers as Record<string, string> });
    return next();
  }) as unknown as typeof fetch;
  const rates = createCoinGeckoRates({
    settings: { apiKey: settings.apiKey ?? null, plan: settings.plan ?? 'demo', cacheMs: 30_000 },
    mode: 'sandbox',
    log: silentLogger,
    now: () => t,
    fetchImpl,
  });
  return {
    rates,
    calls,
    advance: (ms: number) => (t += ms),
    respond: (fn: () => Response) => (next = fn),
  };
}

describe('CoinGecko rates', () => {
  it('parses prices to micros without floating point', () => {
    expect(coingeckoUsdToMicros(80823.449581)).toBe(80_823_449_581n);
    expect(coingeckoUsdToMicros(0.999029)).toBe(999_029n);
    expect(coingeckoUsdToMicros(1)).toBe(1_000_000n);
    expect(coingeckoUsdToMicros(1.23456789)).toBe(1_234_567n);
    expect(coingeckoUsdToMicros(1e-7)).toBeNull();
    expect(coingeckoUsdToMicros('80000')).toBeNull();
    expect(coingeckoUsdToMicros(0)).toBeNull();
  });

  it('fetches all assets in one request and caches it', async () => {
    const s = setup();
    const btc = await s.rates.getReferencePrice('BTC');
    const eth = await s.rates.getReferencePrice('ETH');
    expect(btc).toMatchObject({ priceMicros: 80_823_449_581n, asOf: T0, source: 'sandbox', feed: 'coingecko' });
    expect(eth.priceMicros).toBe(2_359_500_000n);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]!.url).toContain('ids=bitcoin%2Cethereum%2Ctether%2Cusd-coin');
    s.advance(29_000);
    await s.rates.getReferencePrice('USDT');
    expect(s.calls).toHaveLength(1);
    s.advance(2_000);
    await s.rates.getReferencePrice('USDT');
    expect(s.calls).toHaveLength(2);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const s = setup();
    await Promise.all(['BTC', 'ETH', 'USDT', 'USDC'].map((a) => s.rates.getReferencePrice(a as 'BTC')));
    expect(s.calls).toHaveLength(1);
  });

  it('sends the API key header for the chosen plan', async () => {
    const demo = setup({ apiKey: 'CG-demo' });
    await demo.rates.getReferencePrice('BTC');
    expect(demo.calls[0]!.headers['x-cg-demo-api-key']).toBe('CG-demo');
    expect(demo.calls[0]!.url).toMatch(/^https:\/\/api\.coingecko\.com\//);
    const pro = setup({ apiKey: 'CG-pro', plan: 'pro' });
    await pro.rates.getReferencePrice('BTC');
    expect(pro.calls[0]!.headers['x-cg-pro-api-key']).toBe('CG-pro');
    expect(pro.calls[0]!.url).toMatch(/^https:\/\/pro-api\.coingecko\.com\//);
  });

  it('pauses on 429, serves the cached price while fresh, then reports unavailable', async () => {
    const s = setup();
    await s.rates.getReferencePrice('BTC');
    s.respond(() => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }));
    s.advance(31_000);
    // Refresh hits 429, but the 31-second-old price is still fresh enough to serve.
    expect((await s.rates.getReferencePrice('BTC')).asOf).toBe(T0);
    expect(s.calls).toHaveLength(2);
    s.advance(30_000);
    await expect(s.rates.getReferencePrice('BTC')).rejects.toBeInstanceOf(ProviderError);
    expect(s.calls).toHaveLength(2); // still paused by Retry-After
    s.respond(() => Response.json(BODY));
    s.advance(90_000); // past the 120 s pause
    expect((await s.rates.getReferencePrice('BTC')).priceMicros).toBe(80_823_449_581n);
    expect(s.calls).toHaveLength(3);
  });

  it('never invents a price when CoinGecko is unreachable from the start', async () => {
    const s = setup();
    s.respond(() => {
      throw new TypeError('fetch failed');
    });
    await expect(s.rates.getReferencePrice('BTC')).rejects.toThrow('CoinGecko could not be reached.');
    expect(s.rates.info().detail).toContain('could not be reached');
  });

  it('rejects a coin whose upstream price is stuck', async () => {
    const s = setup();
    s.respond(() => Response.json({ ...BODY, ethereum: { usd: 2000, last_updated_at: T0 / 1000 - 3600 } }));
    await expect(s.rates.getReferencePrice('ETH')).rejects.toBeInstanceOf(ProviderError);
    expect((await s.rates.getReferencePrice('BTC')).priceMicros).toBe(80_823_449_581n);
  });
});

describe('RATES_SOURCE configuration', () => {
  it('is off by default and parses CoinGecko settings', () => {
    expect(testConfig().coingecko).toBeNull();
    expect(testConfig({}, { RATES_SOURCE: 'coingecko', COINGECKO_API_KEY: 'CG-x', COINGECKO_CACHE_SECONDS: '20' }).coingecko).toEqual({
      apiKey: 'CG-x',
      plan: 'demo',
      cacheMs: 20_000,
    });
  });

  it('rejects conflicting or invalid settings', () => {
    const problems = (env: Record<string, string>) => {
      try {
        loadConfig({ APP_MODE: 'sandbox', DATABASE_PATH: ':memory:', ...env });
        return [];
      } catch (e) {
        return (e as { problems: string[] }).problems;
      }
    };
    expect(problems({ RATES_SOURCE: 'binance' })).toEqual([expect.stringContaining('RATES_SOURCE')]);
    expect(problems({ RATES_SOURCE: 'coingecko', COINGECKO_CACHE_SECONDS: '5' })).toEqual([
      expect.stringContaining('COINGECKO_CACHE_SECONDS'),
    ]);
    expect(problems({ RATES_SOURCE: 'coingecko', COINGECKO_API_PLAN: 'pro' })).toEqual([expect.stringContaining('COINGECKO_API_KEY')]);
    expect(problems({ RATES_SOURCE: 'coingecko', SANDBOX_RATES: 'BTC=1' })).toEqual([expect.stringContaining('SANDBOX_RATES')]);
  });
});
