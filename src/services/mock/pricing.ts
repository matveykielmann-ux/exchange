/**
 * Mock reference prices. ILLUSTRATIVE VALUES ONLY — not market data. Prices
 * drift deterministically per 15-second bucket so the calculator visibly
 * refreshes without any network calls.
 */
import type { AssetCode } from '@/domain/assets';
import { PRICING_POLICY } from '@/domain/quote';
import type { PricingProvider, ReferencePrice } from '../types';
import { delay, type MockOptions } from './util';

export const MOCK_BASE_PRICE_MICROS: Record<AssetCode, bigint> = {
  BTC: 68_420_150_000n,
  ETH: 3_412_800_000n,
  USDT: 999_800n,
  USDC: 1_000_000n,
};

/** Max drift in basis points, per asset class. */
const DRIFT_BPS: Record<AssetCode, number> = { BTC: 40, ETH: 50, USDT: 2, USDC: 1 };

function hash(n: number): number {
  // Small deterministic integer hash → [0, 1)
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function mockPriceAt(asset: AssetCode, time: number): bigint {
  const bucket = Math.floor(time / PRICING_POLICY.indicativeRefreshMs);
  const seed = bucket * 31 + asset.charCodeAt(0) * 7 + asset.length;
  const driftBps = Math.round((hash(seed) * 2 - 1) * DRIFT_BPS[asset]);
  const base = MOCK_BASE_PRICE_MICROS[asset];
  return base + (base * BigInt(driftBps)) / 10_000n;
}

export function createMockPricing(opts: MockOptions): PricingProvider {
  return {
    getReferencePrice(asset) {
      return delay<ReferencePrice>(opts, () => {
        const now = opts.now();
        return { asset, priceMicros: mockPriceAt(asset, now), asOf: now, source: 'mock' };
      });
    },
  };
}
