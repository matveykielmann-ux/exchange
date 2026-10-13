import { describe, expect, it } from 'vitest';
import { ASSET_ORDER, ASSETS, defaultNetwork } from '../assets';
import { PAYOUT_METHODS, payoutFeeCents } from '../payout';
import { atomicForCents, calculateQuote, grossCentsFor, isQuoteExpired, PRICING_POLICY, spreadBpsFor } from '../quote';

const base = {
  asset: 'BTC' as const,
  network: 'bitcoin' as const,
  payoutMethod: 'ach' as const,
  referencePriceMicros: 68_000_000_000n,
  now: 1_000,
};

describe('calculateQuote', () => {
  it('computes a fully itemized quote', () => {
    const { quote, issues } = calculateQuote({ ...base, amountAtomic: 10_000_000n }); // 0.1 BTC
    expect(issues).toEqual([]);
    expect(quote.grossCents).toBe(680_000n);
    expect(quote.spreadBps).toBe(100);
    expect(quote.spreadCents).toBe(6_800n);
    expect(quote.payoutFeeCents).toBe(0n);
    expect(quote.netCents).toBe(673_200n);
    expect(quote.source).toBe('mock');
    expect(quote.expiresAt - quote.createdAt).toBe(PRICING_POLICY.quoteTtlMs);
  });

  it('always reconciles to the cent (property check over many inputs)', () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 2000; i++) {
      const asset = ASSET_ORDER[Math.floor(rnd() * ASSET_ORDER.length)]!;
      const method = (['ach', 'wire', 'instant_debit'] as const)[Math.floor(rnd() * 3)]!;
      const price = asset === 'BTC' ? 60_000_000_000n : asset === 'ETH' ? 3_000_000_000n : 1_000_000n;
      const amount = BigInt(Math.floor(rnd() * 1e9)) * 10n ** BigInt(Math.max(0, ASSETS[asset].decimals - 8));
      const { quote } = calculateQuote({
        asset,
        network: defaultNetwork(asset),
        payoutMethod: method,
        amountAtomic: amount,
        referencePriceMicros: price,
        now: 0,
      });
      expect(quote.grossCents - quote.spreadCents - quote.payoutFeeCents).toBe(quote.netCents);
    }
  });

  it('applies tiered spreads by asset class', () => {
    expect(spreadBpsFor('BTC', 9_999_99n)).toBe(100);
    expect(spreadBpsFor('BTC', 10_000_00n)).toBe(75);
    expect(spreadBpsFor('USDC', 500_00n)).toBe(30);
    expect(spreadBpsFor('USDC', 20_000_00n)).toBe(20);
  });

  it('flags amounts below the minimum with the equivalent asset amount', () => {
    const { issues } = calculateQuote({ ...base, amountAtomic: 1_000n });
    expect(issues[0]).toMatchObject({ code: 'below_minimum', minimumCents: 50_00n });
    const min = atomicForCents('BTC', 50_00n, base.referencePriceMicros);
    expect(grossCentsFor('BTC', min, base.referencePriceMicros)).toBeGreaterThanOrEqual(50_00n);
    expect(grossCentsFor('BTC', min - 1n, base.referencePriceMicros)).toBeLessThan(50_00n);
  });

  it('routes amounts above the online maximum to the large-transaction desk', () => {
    const { issues } = calculateQuote({ ...base, amountAtomic: 100_000_000n }); // 1 BTC = $68k
    expect(issues).toEqual([{ code: 'above_retail_maximum', maximumCents: PRICING_POLICY.retailMaximumCents }]);
  });

  it('flags payout methods that cannot take the amount, and the disabled courier', () => {
    expect(calculateQuote({ ...base, payoutMethod: 'wire', amountAtomic: 1_000_000n }).issues[0]).toMatchObject({
      code: 'payout_ineligible',
    });
    expect(calculateQuote({ ...base, payoutMethod: 'courier_cash', amountAtomic: 1_000_000n }).issues[0]).toMatchObject({
      code: 'payout_ineligible',
    });
  });

  it('flags unsupported asset/network pairs', () => {
    const { issues } = calculateQuote({ ...base, network: 'tron', amountAtomic: 1_000_000n });
    expect(issues.some((i) => i.code === 'unsupported_network')).toBe(true);
  });

  it('expires at the TTL boundary', () => {
    const { quote } = calculateQuote({ ...base, amountAtomic: 1_000_000n });
    expect(isQuoteExpired(quote, quote.expiresAt - 1)).toBe(false);
    expect(isQuoteExpired(quote, quote.expiresAt)).toBe(true);
  });
});

describe('payout fees', () => {
  it('clamps percentage fees to their min and max', () => {
    const card = PAYOUT_METHODS.instant_debit;
    expect(payoutFeeCents(card, 50_00n)).toBe(1_00n); // 1.5% of $50 = $0.75 → min $1
    expect(payoutFeeCents(card, 1_000_00n)).toBe(15_00n);
    expect(payoutFeeCents(card, 5_000_00n)).toBe(25_00n); // 1.5% of $5,000 = $75 → max $25
    expect(payoutFeeCents(PAYOUT_METHODS.wire, 10_000_00n)).toBe(25_00n);
    expect(payoutFeeCents(PAYOUT_METHODS.ach, 10_000_00n)).toBe(0n);
  });
  it('keeps courier cash delivery disabled', () => {
    expect(PAYOUT_METHODS.courier_cash.availability.available).toBe(false);
  });
});
