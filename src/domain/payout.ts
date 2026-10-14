/**
 * Payout methods and their MOCK fee schedules. Timings are estimates only —
 * real timing depends on payout providers and receiving banks, none of which
 * are contracted.
 */
import { FEATURE_FLAGS } from '@/config/runtime';
import { divRoundHalfUp, formatBps, formatUsd, type Cents } from './money';

export type PayoutMethodId = 'ach' | 'wire' | 'instant_debit' | 'courier_cash';

export type FeeSchedule =
  | { kind: 'none' }
  | { kind: 'flat'; cents: Cents }
  | { kind: 'percent'; bps: number; minCents: Cents; maxCents: Cents };

export type Availability = { available: true } | { available: false; reason: string };

export interface PayoutMethod {
  id: PayoutMethodId;
  name: string;
  summary: string;
  timingEstimate: string;
  fee: FeeSchedule;
  /** Minimum gross USD value the method accepts. There is no maximum (owner decision, 2026-10-14). */
  minCents: Cents;
  availability: Availability;
}

export const PAYOUT_METHODS: Record<PayoutMethodId, PayoutMethod> = {
  ach: {
    id: 'ach',
    name: 'Bank transfer (ACH)',
    summary: 'To a US checking or savings account.',
    timingEstimate: 'Estimated 1–3 business days',
    fee: { kind: 'none' },
    minCents: 50_00n,
    availability: { available: true },
  },
  wire: {
    id: 'wire',
    name: 'Domestic wire',
    summary: 'To a US bank account. Suited to larger amounts.',
    timingEstimate: 'Estimated same or next business day',
    fee: { kind: 'flat', cents: 25_00n },
    minCents: 1_000_00n,
    availability: { available: true },
  },
  instant_debit: {
    id: 'instant_debit',
    name: 'Debit card',
    summary: 'Push to an eligible US Visa or Mastercard debit card.',
    timingEstimate: 'Estimated within 30 minutes; can take longer',
    fee: { kind: 'percent', bps: 150, minCents: 1_00n, maxCents: 25_00n },
    minCents: 50_00n,
    availability: { available: true },
  },
  courier_cash: {
    id: 'courier_cash',
    name: 'Cash by courier',
    summary: 'US dollars in cash, handed to you at your address after an ID check.',
    timingEstimate: 'Estimated 1–2 business days after your deposit is final',
    // Placeholder fee and minimum [OWNER INPUT REQUIRED].
    fee: { kind: 'flat', cents: 35_00n },
    minCents: 500_00n,
    availability: FEATURE_FLAGS.courierCashDelivery
      ? { available: true }
      : {
          available: false,
          reason: 'Not offered. Requires verified licensing, cash-reporting controls, a contracted carrier and local legal review.',
        },
  },
};

export const PAYOUT_ORDER: PayoutMethodId[] = ['ach', 'wire', 'instant_debit', 'courier_cash'];

export function payoutFeeCents(method: PayoutMethod, grossCents: Cents): Cents {
  const fee = method.fee;
  switch (fee.kind) {
    case 'none':
      return 0n;
    case 'flat':
      return fee.cents;
    case 'percent': {
      const raw = divRoundHalfUp(grossCents * BigInt(fee.bps), 10_000n);
      if (raw < fee.minCents) return fee.minCents;
      if (raw > fee.maxCents) return fee.maxCents;
      return raw;
    }
  }
}

export function describeFee(fee: FeeSchedule): string {
  switch (fee.kind) {
    case 'none':
      return 'No payout fee';
    case 'flat':
      return `${formatUsd(fee.cents)} flat`;
    case 'percent':
      return `${formatBps(fee.bps)} (min ${formatUsd(fee.minCents)}, max ${formatUsd(fee.maxCents)})`;
  }
}

export type PayoutEligibility = { eligible: true } | { eligible: false; reason: string };

export function payoutEligibility(method: PayoutMethod, grossCents: Cents): PayoutEligibility {
  if (!method.availability.available) return { eligible: false, reason: method.availability.reason };
  if (grossCents < method.minCents) return { eligible: false, reason: `Requires at least ${formatUsd(method.minCents, { whole: true })}.` };
  return { eligible: true };
}

export interface PayoutOption {
  method: PayoutMethod;
  eligibility: PayoutEligibility;
  feeCents: Cents;
}

/** Every payout method with its eligibility and fee for a given sale value (null = no amount yet). */
export function payoutOptions(grossCents: Cents | null): PayoutOption[] {
  return PAYOUT_ORDER.map((id) => {
    const method = PAYOUT_METHODS[id];
    if (grossCents === null) return { method, eligibility: { eligible: false, reason: 'Enter an amount first.' }, feeCents: 0n };
    return { method, eligibility: payoutEligibility(method, grossCents), feeCents: payoutFeeCents(method, grossCents) };
  });
}

/** Short label for a computed fee, e.g. "No fee" or "$25.00 fee". */
export function feeLabel(feeCents: Cents): string {
  return feeCents === 0n ? 'No fee' : `${formatUsd(feeCents)} fee`;
}
