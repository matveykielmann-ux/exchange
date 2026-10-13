import { describe, expect, it } from 'vitest';
import { divRoundHalfUp, formatBps, formatUnits, formatUsd, parseDecimal } from '../money';

describe('parseDecimal', () => {
  it('parses grouped decimals into smallest units', () => {
    expect(parseDecimal('1,250.5', 2)).toEqual({ ok: true, value: 125050n });
    expect(parseDecimal('.5', 8)).toEqual({ ok: true, value: 50_000_000n });
    expect(parseDecimal('3.', 2)).toEqual({ ok: true, value: 300n });
  });
  it('separates atomic precision from typed precision', () => {
    // 40000 USDT typed with 2-place input must be 40000 × 10^6 atomic units.
    expect(parseDecimal('40000', 6, 2)).toEqual({ ok: true, value: 40_000_000_000n });
    expect(parseDecimal('1.123', 6, 2)).toEqual({ ok: false, reason: 'too_many_decimals' });
  });
  it('rejects malformed input', () => {
    expect(parseDecimal('', 2)).toEqual({ ok: false, reason: 'empty' });
    expect(parseDecimal('.', 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDecimal('1e5', 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDecimal('-1', 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDecimal('1.2.3', 2)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('formatting', () => {
  it('formats units with grouping and truncation (never rounding up)', () => {
    expect(formatUnits(123456789n, 8)).toBe('1.23456789');
    expect(formatUnits(123456789n, 8, { maxFraction: 4 })).toBe('1.2345');
    expect(formatUnits(1_000_000_00n, 2, { minFraction: 2 })).toBe('1,000,000.00');
  });
  it('formats USD with a typographic minus', () => {
    expect(formatUsd(123456n)).toBe('$1,234.56');
    expect(formatUsd(-5n)).toBe('−$0.05');
    expect(formatUsd(0n)).toBe('$0.00');
  });
  it('rounds half up and formats bps', () => {
    expect(divRoundHalfUp(5n, 10n)).toBe(1n);
    expect(divRoundHalfUp(4n, 10n)).toBe(0n);
    expect(formatBps(75)).toBe('0.75%');
  });
});
