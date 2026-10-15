import { describe, expect, it } from 'vitest';
import { ASSET_ORDER, ASSETS, defaultNetwork } from '../assets';
import { PAYOUT_METHODS, payoutFeeCents } from '../payout';
import { atomicForCents, calculateBuyQuote, calculateQuote, grossCentsFor, isQuoteExpired, PRICING_POLICY, spreadBpsFor } from '../quote';

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
    // No spread; a 3% exchange fee on ACH.
    expect(quote.spreadBps).toBe(0);
    expect(quote.spreadCents).toBe(0n);
    expect(quote.payoutFeeCents).toBe(20_400n);
    expect(quote.netCents).toBe(659_600n);
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

  it('has no spread for any asset or amount', () => {
    expect(spreadBpsFor('BTC', 9_999_99n)).toBe(0);
    expect(spreadBpsFor('BTC', 10_000_00n)).toBe(0);
    expect(spreadBpsFor('USDC', 20_000_00n)).toBe(0);
  });

  it('flags amounts below the minimum with the equivalent asset amount', () => {
    const { issues } = calculateQuote({ ...base, amountAtomic: 1_000n });
    expect(issues[0]).toMatchObject({ code: 'below_minimum', minimumCents: 50_00n });
    const min = atomicForCents('BTC', 50_00n, base.referencePriceMicros);
    expect(grossCentsFor('BTC', min, base.referencePriceMicros)).toBeGreaterThanOrEqual(50_00n);
    expect(grossCentsFor('BTC', min - 1n, base.referencePriceMicros)).toBeLessThan(50_00n);
  });

  it('has no maximum: large amounts quote cleanly on every payout method', () => {
    for (const payoutMethod of ['ach', 'wire', 'instant_debit'] as const) {
      const { issues } = calculateQuote({ ...base, payoutMethod, amountAtomic: 1_000_000_000n }); // 10 BTC ≈ $684k
      expect(issues).toEqual([]);
    }
    const courier = calculateQuote({
      ...base,
      payoutMethod: 'courier_cash',
      amountAtomic: 1_000_000_000n,
      quotedFeeCents: 50_00n,
    });
    expect(courier.issues).toEqual([]);
    expect(courier.quote.payoutFeeCents).toBe(50_00n);
  });

  it('marks courier fee pending when no operator fee is supplied', () => {
    const { quote, issues } = calculateQuote({ ...base, payoutMethod: 'courier_cash', amountAtomic: 10_000_000n });
    expect(issues.map((i) => i.code)).toContain('courier_fee_pending');
    expect(quote.feePending).toBe(true);
  });

  it('flags payout methods below their minimum', () => {
    expect(calculateQuote({ ...base, payoutMethod: 'wire', amountAtomic: 1_000_000n }).issues[0]).toMatchObject({
      code: 'payout_ineligible',
    });
    expect(
      calculateQuote({ ...base, payoutMethod: 'courier_cash', amountAtomic: 100_000n, quotedFeeCents: 10_00n }).issues[0],
    ).toMatchObject({
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
  it('charges a 3% exchange fee on every method except courier, uncapped', () => {
    for (const id of ['ach', 'wire', 'instant_debit'] as const) {
      expect(payoutFeeCents(PAYOUT_METHODS[id], 50_00n)).toBe(1_50n);
      expect(payoutFeeCents(PAYOUT_METHODS[id], 1_000_000_00n)).toBe(30_000_00n);
    }
    expect(payoutFeeCents(PAYOUT_METHODS.ach, 33_33n)).toBe(1_00n); // 99.99¢ rounds half up
  });

  it('still clamps a percentage fee that has a min and max', () => {
    const fee = { kind: 'percent', bps: 150, minCents: 1_00n, maxCents: 25_00n } as const;
    const m = { ...PAYOUT_METHODS.instant_debit, fee };
    expect(payoutFeeCents(m, 50_00n)).toBe(1_00n);
    expect(payoutFeeCents(m, 5_000_00n)).toBe(25_00n);
  });
  it('quotes courier cash delivery individually (no published flat fee)', () => {
    expect(PAYOUT_METHODS.courier_cash.availability.available).toBe(true);
    expect(PAYOUT_METHODS.courier_cash.fee).toEqual({ kind: 'quoted' });
    expect(payoutFeeCents(PAYOUT_METHODS.courier_cash, 2_000_00n)).toBeNull();
    expect(payoutFeeCents(PAYOUT_METHODS.courier_cash, 2_000_00n, 45_00n)).toBe(45_00n);
  });
});

describe('calculateBuyQuote', () => {
  const buy = { asset: 'USDT' as const, network: 'tron' as const, referencePriceMicros: 1_000_000n, now: 1_000 };

  it('leaves courier fee pending until an operator quotes it', () => {
    const pending = calculateBuyQuote({ ...buy, cashCents: 1_000_00n });
    expect(pending.issues.map((i) => i.code)).toContain('courier_fee_pending');
    expect(pending.quote.feePending).toBe(true);
    expect(pending.quote.payoutFeeCents).toBe(0n);
  });

  it('reconciles cash − spread − courier fee and converts the rest, rounding the crypto down', () => {
    const { quote, issues } = calculateBuyQuote({ ...buy, cashCents: 1_000_00n, quotedFeeCents: 35_00n });
    expect(issues).toEqual([]);
    expect(quote.direction).toBe('buy');
    expect(quote.payoutMethod).toBe('courier_cash');
    expect(quote.grossCents).toBe(1_000_00n);
    expect(quote.spreadBps).toBe(spreadBpsFor('USDT', 1_000_00n));
    expect(quote.payoutFeeCents).toBe(35_00n);
    expect(quote.grossCents - quote.spreadCents - quote.payoutFeeCents).toBe(quote.netCents);
    // $1 per USDT, 6 decimals: one cent is 10,000 atomic units.
    expect(quote.amountAtomic).toBe(quote.netCents * 10_000n);
    expect(quote.expiresAt - quote.createdAt).toBe(PRICING_POLICY.quoteTtlMs);

    const btc = calculateBuyQuote({
      asset: 'BTC',
      network: 'bitcoin',
      referencePriceMicros: 68_000_000_000n,
      now: 1,
      cashCents: 1_234_56n,
      quotedFeeCents: 35_00n,
    });
    const exact = (btc.quote.netCents * 10_000n * 100_000_000n) / 68_000_000_000n;
    expect(btc.quote.amountAtomic).toBe(exact); // floor
  });

  it('flags amounts below the minimum and below the courier minimum', () => {
    expect(calculateBuyQuote({ ...buy, cashCents: 0n, quotedFeeCents: 0n }).issues.map((i) => i.code)).toEqual(['zero_amount']);
    expect(calculateBuyQuote({ ...buy, cashCents: 10_00n, quotedFeeCents: 0n }).issues.map((i) => i.code)).toEqual(['below_minimum']);
    expect(calculateBuyQuote({ ...buy, cashCents: 400_00n, quotedFeeCents: 10_00n }).issues.map((i) => i.code)).toContain(
      'payout_ineligible',
    );
  });
});
