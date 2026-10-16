/**
 * Payout methods and their fee schedules. Timings are estimates only —
 * real timing depends on payout providers and receiving banks, none of which
 * are contracted.
 *
 * Owner fee model (2026-03-01 package):
 * - Sell crypto → USD: 3% CryptoBit exchange fee
 * - Buy crypto with USD: 2% CryptoBit exchange fee
 * - Domestic wire: estimated $30 bank processing fee (bank’s charge, not CryptoBit revenue)
 * - Cash by courier: delivery cost quoted per order (no published flat tariff)
 */
import { FEATURE_FLAGS } from '@/config/runtime';
import { divRoundHalfUp, formatUsd, type Cents } from './money';

/** sell: crypto → USD. buy: USD → crypto. Defined here to avoid a cycle with quote.ts. */
export type FeeDirection = 'sell' | 'buy';

export type PayoutMethodId = 'ach' | 'wire' | 'instant_debit' | 'courier_cash';

export type FeeSchedule =
  | { kind: 'none' }
  | { kind: 'flat'; cents: Cents }
  | { kind: 'percent'; bps: number; minCents: Cents | null; maxCents: Cents | null }
  /** Bank processing fee (flat) plus the exchange fee (percent), used for wire. */
  | { kind: 'flat_plus_percent'; flatCents: Cents; bps: number }
  /** No schedule: an operator quotes the fee per order before the customer accepts the final terms. */
  | { kind: 'quoted' };

/** Sell (crypto → USD): 3% CryptoBit exchange fee. */
export const SELL_EXCHANGE_FEE_BPS = 300;
/** Buy (USD → crypto): 2% CryptoBit exchange fee. */
export const BUY_EXCHANGE_FEE_BPS = 200;

/** Estimated domestic wire bank processing fee (bank’s charge; not CryptoBit commission). */
export const WIRE_BANK_FEE_CENTS: Cents = 30_00n;

export function exchangeFeeBps(direction: FeeDirection = 'sell'): number {
  return direction === 'buy' ? BUY_EXCHANGE_FEE_BPS : SELL_EXCHANGE_FEE_BPS;
}

export function exchangeFeeCents(grossCents: Cents, direction: FeeDirection = 'sell'): Cents {
  return divRoundHalfUp(grossCents * BigInt(exchangeFeeBps(direction)), 10_000n);
}

/** Fee schedule for UI labels; percent uses sell bps as the default display for sell flows. */
export function feeScheduleFor(methodId: PayoutMethodId, direction: FeeDirection = 'sell'): FeeSchedule {
  if (methodId === 'courier_cash') return { kind: 'quoted' };
  const bps = exchangeFeeBps(direction);
  if (methodId === 'wire') return { kind: 'flat_plus_percent', flatCents: WIRE_BANK_FEE_CENTS, bps };
  return { kind: 'percent', bps, minCents: null, maxCents: null };
}

export type Availability = { available: true } | { available: false; reason: string };

export interface PayoutMethod {
  id: PayoutMethodId;
  name: string;
  summary: string;
  timingEstimate: string;
  /**
   * Default schedule for sell quotes (legacy shape). Prefer feeScheduleFor(direction).
   */
  fee: FeeSchedule;
  /**
   * When set, the fee is not a fixed published tariff. Shown on customer fee schedules.
   */
  feeStatus?: 'quoted_individually';
  /** Minimum gross USD value the method accepts. 0 = no published minimum. */
  minCents: Cents;
  availability: Availability;
}

export const PAYOUT_METHODS: Record<PayoutMethodId, PayoutMethod> = {
  ach: {
    id: 'ach',
    name: 'Bank transfer (ACH)',
    summary: 'To a US checking or savings account.',
    timingEstimate: 'Estimated 1–3 business days',
    fee: feeScheduleFor('ach', 'sell'),
    minCents: 0n,
    availability: { available: true },
  },
  wire: {
    id: 'wire',
    name: 'Domestic wire',
    summary: 'To a US bank account. Suited to larger amounts.',
    timingEstimate: 'Estimated same or next business day',
    fee: feeScheduleFor('wire', 'sell'),
    minCents: 0n,
    availability: { available: true },
  },
  instant_debit: {
    id: 'instant_debit',
    name: 'Debit card',
    summary: 'Push to an eligible US Visa or Mastercard debit card.',
    timingEstimate: 'Estimated within 30 minutes; can take longer',
    fee: feeScheduleFor('instant_debit', 'sell'),
    minCents: 0n,
    availability: { available: true },
  },
  courier_cash: {
    id: 'courier_cash',
    name: 'Cash by courier',
    summary: 'US dollars in cash, handed to you at your address after an ID check.',
    timingEstimate: 'Estimated 1–2 business days after your deposit is final',
    fee: { kind: 'quoted' },
    feeStatus: 'quoted_individually',
    minCents: 0n,
    availability: FEATURE_FLAGS.courierCashDelivery
      ? { available: true }
      : {
          available: false,
          reason: 'Not offered. Requires verified licensing, cash-reporting controls, a contracted carrier and local legal review.',
        },
  },
};

export const PAYOUT_ORDER: PayoutMethodId[] = ['ach', 'wire', 'instant_debit', 'courier_cash'];

/**
 * Fee in cents for a method and gross value.
 * For `quoted` methods, pass `quotedFeeCents` once an operator has set it; otherwise returns null
 * (do not invent a number).
 */
function applyFeeSchedule(schedule: FeeSchedule, grossCents: Cents, quotedFeeCents?: Cents | null): Cents | null {
  switch (schedule.kind) {
    case 'none':
      return 0n;
    case 'flat':
      return schedule.cents;
    case 'quoted':
      return quotedFeeCents === undefined || quotedFeeCents === null ? null : quotedFeeCents;
    case 'flat_plus_percent': {
      const pct = divRoundHalfUp(grossCents * BigInt(schedule.bps), 10_000n);
      return schedule.flatCents + pct;
    }
    case 'percent': {
      const raw = divRoundHalfUp(grossCents * BigInt(schedule.bps), 10_000n);
      if (schedule.minCents !== null && raw < schedule.minCents) return schedule.minCents;
      if (schedule.maxCents !== null && raw > schedule.maxCents) return schedule.maxCents;
      return raw;
    }
  }
}

/** True when method.fee is the stock sell schedule for that method id (no custom clamps). */
function isStockSellFee(method: PayoutMethod): boolean {
  const stock = feeScheduleFor(method.id, 'sell');
  if (method.fee.kind !== stock.kind) return false;
  if (method.fee.kind === 'percent' && stock.kind === 'percent') {
    return method.fee.bps === stock.bps && method.fee.minCents === stock.minCents && method.fee.maxCents === stock.maxCents;
  }
  if (method.fee.kind === 'flat_plus_percent' && stock.kind === 'flat_plus_percent') {
    return method.fee.flatCents === stock.flatCents && method.fee.bps === stock.bps;
  }
  if (method.fee.kind === 'quoted') return true;
  return false;
}

export function payoutFeeCents(
  method: PayoutMethod,
  grossCents: Cents,
  quotedFeeCents?: Cents | null,
  direction: FeeDirection = 'sell',
): Cents | null {
  if (method.fee.kind === 'quoted') {
    return applyFeeSchedule(method.fee, grossCents, quotedFeeCents);
  }
  const schedule = isStockSellFee(method) ? feeScheduleFor(method.id, direction) : method.fee;
  return applyFeeSchedule(schedule, grossCents, quotedFeeCents);
}

/** Separate bank processing vs exchange fee for wire quotes (UI). */
export function wireFeeParts(
  grossCents: Cents,
  direction: FeeDirection = 'sell',
): { bankFeeCents: Cents; exchangeFeeCents: Cents; totalCents: Cents } {
  const exch = exchangeFeeCents(grossCents, direction);
  return {
    bankFeeCents: WIRE_BANK_FEE_CENTS,
    exchangeFeeCents: exch,
    totalCents: WIRE_BANK_FEE_CENTS + exch,
  };
}

export function describeFee(fee: FeeSchedule, status?: PayoutMethod['feeStatus']): string {
  switch (fee.kind) {
    case 'none':
      return 'No payout fee';
    case 'quoted':
      return 'Calculated individually based on the order parameters';
    case 'flat': {
      const base = `${formatUsd(fee.cents)} flat`;
      return status === 'quoted_individually' ? `${base} (calculated individually)` : base;
    }
    case 'flat_plus_percent':
      return `${formatUsd(fee.flatCents)} estimated bank wire fee + ${fee.bps / 100}% exchange fee`;
    case 'percent': {
      const caps = [fee.minCents !== null && `min ${formatUsd(fee.minCents)}`, fee.maxCents !== null && `max ${formatUsd(fee.maxCents)}`];
      const c = caps.filter(Boolean).join(', ');
      return c ? `${fee.bps / 100}% (${c})` : `${fee.bps / 100}%`;
    }
  }
}

export type PayoutEligibility = { eligible: true } | { eligible: false; reason: string };

export function payoutEligibility(method: PayoutMethod, grossCents: Cents): PayoutEligibility {
  if (!method.availability.available) return { eligible: false, reason: method.availability.reason };
  if (method.minCents > 0n && grossCents < method.minCents)
    return { eligible: false, reason: `Requires at least ${formatUsd(method.minCents, { whole: true })}.` };
  return { eligible: true };
}

export interface PayoutOption {
  method: PayoutMethod;
  eligibility: PayoutEligibility;
  /** Null when the method is quoted individually and no fee has been set yet. */
  feeCents: Cents | null;
}

/** Every payout method with its eligibility and fee for a given sale value (null = no amount yet). */
export function payoutOptions(grossCents: Cents | null, direction: FeeDirection = 'sell'): PayoutOption[] {
  return PAYOUT_ORDER.map((id) => {
    const method = PAYOUT_METHODS[id];
    if (grossCents === null) return { method, eligibility: { eligible: false, reason: 'Enter an amount first.' }, feeCents: null };
    return { method, eligibility: payoutEligibility(method, grossCents), feeCents: payoutFeeCents(method, grossCents, null, direction) };
  });
}

/** What the fee line on a quote is called for this method. */
export function feeLineLabel(id: PayoutMethodId): string {
  if (id === 'courier_cash') return 'Courier fee';
  if (id === 'wire') return 'Fees (bank + exchange)';
  return 'Exchange fee';
}

/** Short label for a computed fee, e.g. "No fee" or "$25.00 fee". */
export function feeLabel(feeCents: Cents): string {
  return feeCents === 0n ? 'No fee' : `${formatUsd(feeCents)} fee`;
}

/** @deprecated Use SELL_EXCHANGE_FEE_BPS / BUY_EXCHANGE_FEE_BPS. Kept for transitional imports. */
export const EXCHANGE_FEE: FeeSchedule = { kind: 'percent', bps: SELL_EXCHANGE_FEE_BPS, minCents: null, maxCents: null };
/** @deprecated Use feeScheduleFor('wire', direction). */
export const WIRE_FEE: FeeSchedule = feeScheduleFor('wire', 'sell');
