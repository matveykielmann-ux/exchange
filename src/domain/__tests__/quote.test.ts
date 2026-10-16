import { describe, expect, it } from 'vitest';
import { ASSET_ORDER, ASSETS, defaultNetwork } from '../assets';
import { PAYOUT_METHODS, payoutFeeCents, wireFeeParts, WIRE_BANK_FEE_CENTS } from '../payout';
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
      const price =
        asset === 'BTC'
          ? 60_000_000_000n
          : asset === 'ETH'
            ? 3_000_000_000n
            : asset === 'SOL'
              ? 150_000_000n
              : asset === 'BNB'
                ? 600_000_000n
                : asset === 'XRP'
                  ? 620_000n
                  : 1_000_000n;
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

  it('has no published minimum: tiny positive amounts quote when eligible', () => {
    expect(PRICING_POLICY.minimumCents).toBe(0n);
    const { issues } = calculateQuote({ ...base, amountAtomic: 1_000n });
    expect(issues.map((i) => i.code)).not.toContain('below_minimum');
    const min = atomicForCents('BTC', 1n, base.referencePriceMicros);
    expect(grossCentsFor('BTC', min, base.referencePriceMicros)).toBeGreaterThanOrEqual(1n);
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

  it('quotes wire as $30 bank fee plus 3% exchange fee', () => {
    const { quote, issues } = calculateQuote({ ...base, payoutMethod: 'wire', amountAtomic: 10_000_000n });
    expect(issues).toEqual([]);
    const parts = wireFeeParts(quote.grossCents);
    expect(parts.bankFeeCents).toBe(WIRE_BANK_FEE_CENTS);
    expect(parts.exchangeFeeCents).toBe(20_400n);
    expect(quote.payoutFeeCents).toBe(parts.totalCents);
  });

  it('flags unsupported asset/network pairs', () => {
    const { issues } = calculateQuote({ ...base, network: 'tron', amountAtomic: 1_000_000n });
    expect(issues.some((i) => i.code === 'unsupported_network')).toBe(true);
  });

  it('supports XRP, SOL and BNB pairs', () => {
    for (const asset of ['XRP', 'SOL', 'BNB'] as const) {
      const { issues } = calculateQuote({
        ...base,
        asset,
        network: defaultNetwork(asset),
        amountAtomic: 1_000_000n,
        referencePriceMicros: asset === 'XRP' ? 620_000n : asset === 'SOL' ? 150_000_000n : 600_000_000n,
      });
      expect(issues.filter((i) => i.code === 'unsupported_network')).toEqual([]);
    }
  });

  it('expires at the TTL boundary', () => {
    const { quote } = calculateQuote({ ...base, amountAtomic: 1_000_000n });
    expect(isQuoteExpired(quote, quote.expiresAt - 1)).toBe(false);
    expect(isQuoteExpired(quote, quote.expiresAt)).toBe(true);
  });
});

describe('payout fees', () => {
  it('charges a 3% exchange fee on ACH and debit, uncapped', () => {
    for (const id of ['ach', 'instant_debit'] as const) {
      expect(payoutFeeCents(PAYOUT_METHODS[id], 50_00n)).toBe(1_50n);
      expect(payoutFeeCents(PAYOUT_METHODS[id], 1_000_000_00n)).toBe(30_000_00n);
    }
    expect(payoutFeeCents(PAYOUT_METHODS.ach, 33_33n)).toBe(1_00n); // 99.99¢ rounds half up
  });

  it('charges $30 + 3% on wire', () => {
    expect(payoutFeeCents(PAYOUT_METHODS.wire, 50_00n)).toBe(30_00n + 1_50n);
    expect(payoutFeeCents(PAYOUT_METHODS.wire, 1_000_00n)).toBe(30_00n + 30_00n);
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

  it('flags zero amounts and applies wire fees on buy at 2%', () => {
    expect(calculateBuyQuote({ ...buy, cashCents: 0n, quotedFeeCents: 0n }).issues.map((i) => i.code)).toEqual(['zero_amount']);
    const wire = calculateBuyQuote({ ...buy, cashCents: 1_000_00n, payIn: 'wire' });
    expect(wire.issues).toEqual([]);
    // $30 bank + 2% of $1000 = $20
    expect(wire.quote.payoutFeeCents).toBe(WIRE_BANK_FEE_CENTS + 20_00n);
  });

  it('charges 2% exchange fee on card buy', () => {
    const card = calculateBuyQuote({ ...buy, cashCents: 1_000_00n, payIn: 'card' });
    expect(card.issues).toEqual([]);
    expect(card.quote.payoutFeeCents).toBe(20_00n);
  });
});
