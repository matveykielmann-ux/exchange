/**
 * Exact decimal arithmetic for money. Every amount is a bigint in the smallest
 * unit (cents for USD, the asset's atomic unit for crypto), so floating-point
 * errors cannot occur. Prices are USD micros (1e-6 USD) per whole asset unit.
 */

export type Cents = bigint;
export type Micros = bigint;
export type AtomicAmount = bigint;

export const MICROS_PER_CENT = 10_000n;

export type ParseResult = { ok: true; value: bigint } | { ok: false; reason: 'empty' | 'invalid' | 'too_many_decimals' };

/**
 * Parses a user-entered decimal string ("1,250.5") into smallest units of
 * `decimals` precision, allowing at most `maxFraction` typed fraction digits.
 */
export function parseDecimal(input: string, decimals: number, maxFraction: number = decimals): ParseResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  // Commas are accepted only as US thousands separators ("12,500.25"). A decimal
  // comma ("0,05") is rejected rather than silently read as 5.
  if (trimmed.includes(',') && !/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(trimmed)) return { ok: false, reason: 'invalid' };
  const cleaned = trimmed.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return { ok: false, reason: 'invalid' };
  const [whole = '', fraction = ''] = cleaned.split('.');
  if (fraction.length > Math.min(maxFraction, decimals)) return { ok: false, reason: 'too_many_decimals' };
  const digits = (whole || '0') + fraction.padEnd(decimals, '0');
  return { ok: true, value: BigInt(digits) };
}

export function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats smallest units as a grouped decimal string. Trailing zeros beyond
 * `minFraction` are trimmed; digits beyond `maxFraction` are truncated (never
 * rounded up, so we never display more than the true amount).
 */
export function formatUnits(
  value: bigint,
  decimals: number,
  { minFraction = 0, maxFraction = decimals }: { minFraction?: number; maxFraction?: number } = {},
): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = pow10(decimals);
  const whole = abs / base;
  let fraction = (abs % base).toString().padStart(decimals, '0').slice(0, maxFraction);
  fraction = fraction.replace(/0+$/, '');
  if (fraction.length < minFraction) fraction = fraction.padEnd(minFraction, '0');
  const body = groupThousands(whole.toString()) + (fraction ? `.${fraction}` : '');
  return negative ? `-${body}` : body;
}

/** `whole`: drop the cents when they are zero ("$25,000"), for policy limits and headings. */
export function formatUsd(cents: Cents, { sign = false, whole = false }: { sign?: boolean; whole?: boolean } = {}): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const minFraction = whole && abs % 100n === 0n ? 0 : 2;
  const body = '$' + formatUnits(abs, 2, { minFraction, maxFraction: 2 });
  if (negative) return `−${body}`; // U+2212 minus for typographic alignment
  return sign && cents > 0n ? `+${body}` : body;
}

/** USD micros → cents, truncating fractions of a cent. */
export function microsToCentsFloor(micros: Micros): Cents {
  return micros / MICROS_PER_CENT;
}

/** Integer division rounding half away from zero (for non-negative inputs). */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Formats a basis-point value as a percent string, e.g. 75n → "0.75%". */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
