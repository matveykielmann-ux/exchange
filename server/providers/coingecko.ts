/**
 * Reference prices from the CoinGecko public API (server side only; the
 * browser never calls CoinGecko). One request fetches all four assets and is
 * cached for `cacheMs`; concurrent callers share one in-flight request. A 429
 * pauses requests for the Retry-After period (at least a minute). While
 * CoinGecko is unreachable the last good price keeps serving until it is
 * older than the quote stale limit; after that the call fails and the site
 * shows "rate unavailable". It never invents a number.
 *
 * CoinGecko is an aggregated, indicative source. Rules §5 names Binance,
 * Coinbase, OKX and Kraken; see README_DEPLOY.md → Exchange rates.
 */
import { ASSET_ORDER, type AssetCode } from '@/domain/assets';
import type { AppConfig } from '../config';
import type { Logger } from '../logger';
import { ProviderError, type ProviderInfo, type RateProvider, type ReferencePrice } from './types';

export const COINGECKO_IDS: Record<AssetCode, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'ripple',
  SOL: 'solana',
  BNB: 'binancecoin',
};

/** A cached price older than this is never served (matches the quote stale check). */
const MAX_AGE_MS = 60_000;
/** CoinGecko itself reporting a price this old means its feed for that coin is stuck. */
const UPSTREAM_MAX_AGE_MS = 10 * 60_000;
const MIN_PAUSE_MS = 60_000;

export interface CoinGeckoOptions {
  settings: NonNullable<AppConfig['coingecko']>;
  /** sandbox: orders stay sandbox orders, only the price is real. production: quotes are marked live. */
  mode: AppConfig['mode'];
  log: Logger;
  now: () => number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** "80823.449581" → micros, truncating past 6 decimals. No floating-point arithmetic. */
export function coingeckoUsdToMicros(n: unknown): bigint | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(String(n));
  if (!m) return null; // exponent notation: not a plausible price for these assets
  return BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? '').slice(0, 6).padEnd(6, '0'));
}

export function createCoinGeckoRates(o: CoinGeckoOptions): RateProvider {
  const { apiKey, plan, cacheMs } = o.settings;
  const doFetch = o.fetchImpl ?? fetch;
  const base = plan === 'pro' ? 'https://pro-api.coingecko.com/api/v3/' : 'https://api.coingecko.com/api/v3/';
  const url = new URL('simple/price', base);
  url.searchParams.set('ids', ASSET_ORDER.map((a) => COINGECKO_IDS[a]).join(','));
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('precision', '6');
  url.searchParams.set('include_last_updated_at', 'true');

  const cache = new Map<AssetCode, { micros: bigint; fetchedAt: number }>();
  let lastFetch = 0;
  let pausedUntil = 0;
  let inflight: Promise<void> | null = null;
  let lastError: string | null = null;

  const info = (): ProviderInfo => ({
    key: 'rates',
    label: 'Exchange rates',
    state: o.mode === 'sandbox' ? 'sandbox' : 'configured',
    detail:
      `CoinGecko ${apiKey ? `${plan} API key` : 'public API (no key)'}, cached ${cacheMs / 1000}s` +
      (o.mode === 'sandbox' ? '; orders remain sandbox orders' : '') +
      (lastError ? `. Last error: ${lastError}` : '.'),
  });

  async function refresh(): Promise<void> {
    const started = o.now();
    lastFetch = started;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers[plan === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = apiKey;
    let res: Response;
    try {
      res = await doFetch(url, { headers, signal: AbortSignal.timeout(o.timeoutMs ?? 8_000), redirect: 'error' });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw new ProviderError('rates', timeout ? 'CoinGecko request timed out.' : 'CoinGecko could not be reached.', true);
    }
    o.log.info('provider request', { provider: 'rates', vendor: 'coingecko', status: res.status, ms: o.now() - started });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const pause = Math.max(MIN_PAUSE_MS, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0);
      pausedUntil = o.now() + Math.min(pause, 15 * 60_000);
      throw new ProviderError('rates', 'CoinGecko rate limit reached.', true, 429);
    }
    if (!res.ok) throw new ProviderError('rates', `CoinGecko responded ${res.status}.`, res.status >= 500, res.status);
    let body: Record<string, { usd?: unknown; last_updated_at?: unknown } | undefined>;
    try {
      body = (await res.json()) as typeof body;
    } catch {
      throw new ProviderError('rates', 'CoinGecko returned invalid JSON.', true);
    }
    const fetchedAt = o.now();
    for (const asset of ASSET_ORDER) {
      const row = body?.[COINGECKO_IDS[asset]];
      const micros = coingeckoUsdToMicros(row?.usd);
      const updated = typeof row?.last_updated_at === 'number' ? row.last_updated_at * 1000 : null;
      if (micros === null || (updated !== null && fetchedAt - updated > UPSTREAM_MAX_AGE_MS)) {
        o.log.warn('coingecko price rejected', { asset });
        continue;
      }
      cache.set(asset, { micros, fetchedAt });
    }
  }

  async function ensureFresh(): Promise<void> {
    if (inflight) return inflight;
    const t = o.now();
    if (t - lastFetch < cacheMs || t < pausedUntil) return;
    inflight ??= refresh()
      .then(() => {
        lastError = null;
      })
      .catch((e: unknown) => {
        lastError = e instanceof Error ? e.message : 'unknown error';
        o.log.warn('coingecko refresh failed', { error: lastError });
      })
      .finally(() => {
        inflight = null;
      });
    await inflight;
  }

  return {
    info,
    async getReferencePrice(asset: AssetCode): Promise<ReferencePrice> {
      await ensureFresh();
      const hit = cache.get(asset);
      if (!hit || o.now() - hit.fetchedAt > MAX_AGE_MS) throw new ProviderError('rates', lastError ?? 'No recent CoinGecko price.', true);
      return {
        asset,
        priceMicros: hit.micros,
        asOf: hit.fetchedAt,
        source: o.mode === 'sandbox' ? 'sandbox' : 'live',
        feed: 'coingecko',
      };
    },
  };
}
