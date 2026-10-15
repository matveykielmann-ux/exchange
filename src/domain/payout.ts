/**
 * Payout methods and their fee schedules. Timings are estimates only —
 * real timing depends on payout providers and receiving banks, none of which
 * are contracted.
 */
import { FEATURE_FLAGS } from '@/config/runtime';
import { divRoundHalfUp, formatBps, formatUsd, type Cents } from './money';

export type PayoutMethodId = 'ach' | 'wire' | 'instant_debit' | 'courier_cash';

export type FeeSchedule =
  | { kind: 'none' }
  | { kind: 'flat'; cents: Cents }
  | { kind: 'percent'; bps: number; minCents: Cents | null; maxCents: Cents | null }
  /** Bank processing fee (flat) plus the exchange fee (percent), used for wire. */
  | { kind: 'flat_plus_percent'; flatCents: Cents; bps: number }
  /** No schedule: an operator quotes the fee per order before the customer accepts the final terms. */
  | { kind: 'quoted' };

/** The exchange fee on ACH and debit (owner decision, 2026-10-15). There is no spread. */
export const EXCHANGE_FEE: FeeSchedule = { kind: 'percent', bps: 300, minCents: null, maxCents: null };

/** Wire: published bank processing fee + 3% exchange fee (owner decision). */
export const WIRE_BANK_FEE_CENTS: Cents = 30_00n;
export const WIRE_FEE: FeeSchedule = { kind: 'flat_plus_percent', flatCents: WIRE_BANK_FEE_CENTS, bps: 300 };

export type Availability = { available: true } | { available: false; reason: string };

export interface PayoutMethod {
  id: PayoutMethodId;
  name: string;
  summary: string;
  timingEstimate: string;
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
    fee: EXCHANGE_FEE,
    minCents: 0n,
    availability: { available: true },
  },
  wire: {
    id: 'wire',
    name: 'Domestic wire',
    summary: 'To a US bank account. Suited to larger amounts.',
    timingEstimate: 'Estimated same or next business day',
    fee: WIRE_FEE,
    minCents: 0n,
    availability: { available: true },
  },
  instant_debit: {
    id: 'instant_debit',
    name: 'Debit card',
    summary: 'Push to an eligible US Visa or Mastercard debit card.',
    timingEstimate: 'Estimated within 30 minutes; can take longer',
    fee: EXCHANGE_FEE,
    minCents: 0n,
    availability: { available: true },
  },
  courier_cash: {
    id: 'courier_cash',
    name: 'Cash by courier',
    summary: 'US dollars in cash, handed to you at your address after an ID check.',
    timingEstimate: 'Estimated 1–2 business days after your deposit is final',
    // No published tariff: delivery cost depends on the order and is set by an operator.
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
export function payoutFeeCents(method: PayoutMethod, grossCents: Cents, quotedFeeCents?: Cents | null): Cents | null {
  const fee = method.fee;
  switch (fee.kind) {
    case 'none':
      return 0n;
    case 'flat':
      return fee.cents;
    case 'quoted':
      return quotedFeeCents === undefined || quotedFeeCents === null ? null : quotedFeeCents;
    case 'flat_plus_percent': {
      const pct = divRoundHalfUp(grossCents * BigInt(fee.bps), 10_000n);
      return fee.flatCents + pct;
    }
    case 'percent': {
      const raw = divRoundHalfUp(grossCents * BigInt(fee.bps), 10_000n);
      if (fee.minCents !== null && raw < fee.minCents) return fee.minCents;
      if (fee.maxCents !== null && raw > fee.maxCents) return fee.maxCents;
      return raw;
    }
  }
}

/** Separate bank processing vs exchange fee for wire quotes (UI). */
export function wireFeeParts(grossCents: Cents): { bankFeeCents: Cents; exchangeFeeCents: Cents; totalCents: Cents } {
  const exchangeFeeCents = divRoundHalfUp(grossCents * 300n, 10_000n);
  return {
    bankFeeCents: WIRE_BANK_FEE_CENTS,
    exchangeFeeCents,
    totalCents: WIRE_BANK_FEE_CENTS + exchangeFeeCents,
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
      return `${formatUsd(fee.flatCents)} bank processing fee + ${fee.bps / 100}% exchange fee`;
    case 'percent': {
      const caps = [fee.minCents !== null && `min ${formatUsd(fee.minCents)}`, fee.maxCents !== null && `max ${formatUsd(fee.maxCents)}`];
      const c = caps.filter(Boolean).join(', ');
      return c ? `${formatBps(fee.bps)} (${c})` : `${fee.bps / 100}%`;
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
export function payoutOptions(grossCents: Cents | null): PayoutOption[] {
  return PAYOUT_ORDER.map((id) => {
    const method = PAYOUT_METHODS[id];
    if (grossCents === null) return { method, eligibility: { eligible: false, reason: 'Enter an amount first.' }, feeCents: null };
    return { method, eligibility: payoutEligibility(method, grossCents), feeCents: payoutFeeCents(method, grossCents) };
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
