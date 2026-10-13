/**
 * Payout methods and their MOCK fee schedules. Timings are estimates only —
 * real timing depends on payout providers and receiving banks, none of which
 * are contracted.
 */
import { FEATURE_FLAGS } from '@/config/runtime';
import { divRoundHalfUp, type Cents } from './money';

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
  /** Minimum and maximum gross USD value the method accepts. */
  minCents: Cents;
  maxCents: Cents;
  availability: Availability;
  /** Whether the method can be used from the large-transaction desk. */
  largeTransactionEligible: boolean;
}

export const PAYOUT_METHODS: Record<PayoutMethodId, PayoutMethod> = {
  ach: {
    id: 'ach',
    name: 'Bank transfer (ACH)',
    summary: 'To a US checking or savings account.',
    timingEstimate: 'Estimated 1–3 business days',
    fee: { kind: 'none' },
    minCents: 50_00n,
    maxCents: 25_000_00n,
    availability: { available: true },
    largeTransactionEligible: false,
  },
  wire: {
    id: 'wire',
    name: 'Domestic wire',
    summary: 'To a US bank account. Suited to larger amounts.',
    timingEstimate: 'Estimated same or next business day',
    fee: { kind: 'flat', cents: 25_00n },
    minCents: 1_000_00n,
    maxCents: 25_000_00n,
    availability: { available: true },
    largeTransactionEligible: true,
  },
  instant_debit: {
    id: 'instant_debit',
    name: 'Debit card',
    summary: 'Push to an eligible US Visa or Mastercard debit card.',
    timingEstimate: 'Estimated within 30 minutes; can take longer',
    fee: { kind: 'percent', bps: 150, minCents: 1_00n, maxCents: 25_00n },
    minCents: 50_00n,
    maxCents: 5_000_00n,
    availability: { available: true },
    largeTransactionEligible: false,
  },
  courier_cash: {
    id: 'courier_cash',
    name: 'Cash by courier',
    summary: 'In-person cash handoff by an insured courier.',
    timingEstimate: 'Not offered',
    fee: { kind: 'none' },
    minCents: 0n,
    maxCents: 0n,
    availability: FEATURE_FLAGS.courierCashDelivery
      ? { available: true }
      : {
          available: false,
          reason: 'Not offered. Requires verified licensing, cash-reporting controls, an insured carrier and local legal review.',
        },
    largeTransactionEligible: false,
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
      return `$${(Number(fee.cents) / 100).toFixed(2)} flat`;
    case 'percent':
      return `${(fee.bps / 100).toFixed(2)}% (min $${(Number(fee.minCents) / 100).toFixed(2)}, max $${(Number(fee.maxCents) / 100).toFixed(2)})`;
  }
}

export type PayoutEligibility = { eligible: true } | { eligible: false; reason: string };

export function payoutEligibility(method: PayoutMethod, grossCents: Cents): PayoutEligibility {
  if (!method.availability.available) return { eligible: false, reason: method.availability.reason };
  if (grossCents < method.minCents)
    return { eligible: false, reason: `Requires at least $${(Number(method.minCents) / 100).toLocaleString('en-US')}` };
  if (grossCents > method.maxCents)
    return { eligible: false, reason: `Limit is $${(Number(method.maxCents) / 100).toLocaleString('en-US')} per transaction` };
  return { eligible: true };
}
