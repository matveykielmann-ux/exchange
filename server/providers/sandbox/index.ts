/**
 * Deterministic sandbox providers. Same inputs → same outputs: prices follow a
 * fixed schedule (or SANDBOX_RATES), deposit addresses derive from the order
 * id and are invalid on every chain, and outcomes are chosen by documented
 * fixtures rather than randomness. These are only constructed in sandbox mode.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { AssetCode } from '@/domain/assets';
import { PRICING_POLICY } from '@/domain/quote';
import { FEATURE_FLAGS } from '@/config/runtime';
import type { AppConfig } from '../../config';
import { ProviderError, type Providers, type ProviderInfo, type ProviderKey } from '../types';

export const SANDBOX_BASE_PRICE_MICROS: Record<AssetCode, bigint> = {
  BTC: 68_420_150_000n,
  ETH: 3_412_800_000n,
  USDT: 999_800n,
  USDC: 1_000_000n,
  XRP: 620_000n,
  SOL: 148_500_000n,
  BNB: 595_200_000n,
};
const DRIFT_BPS: Record<AssetCode, number> = {
  BTC: 40,
  ETH: 50,
  USDT: 2,
  USDC: 1,
  XRP: 60,
  SOL: 70,
  BNB: 55,
};

function unitHash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Deterministic test price for a moment in time: drifts per 15-second bucket within a few basis points. */
export function sandboxPriceAt(asset: AssetCode, time: number, fixed?: bigint): bigint {
  if (fixed !== undefined) return fixed;
  const bucket = Math.floor(time / PRICING_POLICY.indicativeRefreshMs);
  const drift = Math.round((unitHash(bucket * 31 + asset.charCodeAt(0) * 7 + asset.length) * 2 - 1) * DRIFT_BPS[asset]);
  const base = SANDBOX_BASE_PRICE_MICROS[asset];
  return base + (base * BigInt(drift)) / 10_000n;
}

const short = (s: string, n = 10) => createHash('sha256').update(s).digest('hex').slice(0, n).toUpperCase();

/** Screening fixtures (documented in README_DEPLOY.md → Sandbox). */
export const SANDBOX_FIXTURES = {
  reviewAddress: '0x000000000000000000000000000000000000bEEF',
  blockedAddress: '0x000000000000000000000000000000000000dEaD',
  /** A full name containing this word gets "needs more information" from identity verification. */
  kycNeedsInfoWord: 'Review',
  /** A full name containing this word is rejected by identity verification. */
  kycRejectWord: 'Reject',
  /** A payout holder name containing this word is declined synchronously by the payout provider. */
  payoutDeclineWord: 'Decline',
  /** Courier cash delivery does not serve ZIP codes starting with this prefix. */
  courierUnavailableZipPrefix: '999',
} as const;

const info = (key: ProviderKey, label: string): ProviderInfo => ({
  key,
  label,
  state: 'sandbox',
  detail: 'Deterministic sandbox implementation. No real funds or data leave this server.',
});

export function createSandboxProviders(config: AppConfig, now: () => number): Providers {
  return {
    rates: {
      info: () => info('rates', 'Exchange rates'),
      async getReferencePrice(asset) {
        const t = now();
        return { asset, priceMicros: sandboxPriceAt(asset, t, config.sandbox.rates[asset]), asOf: t, source: 'sandbox' };
      },
    },
    custody: {
      info: () => info('custody', 'Deposit addresses and monitoring'),
      async createDepositInstructions(req) {
        // Deliberately invalid on every chain: MOCK- prefix, -DO-NOT-SEND suffix, hyphens.
        return {
          address: `MOCK-${req.asset}-${req.network.toUpperCase()}-${short(req.orderId)}-DO-NOT-SEND`,
          memo: null,
          providerRef: `sbx_dep_${short(req.idempotencyKey, 16).toLowerCase()}`,
        };
      },
      async requestRefund(req) {
        return { providerRef: `sbx_rfd_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
      async sendCrypto(req) {
        // Nothing is broadcast: the sandbox only acknowledges the instruction.
        return { providerRef: `sbx_out_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
    },
    identity: {
      info: () => info('identity', 'Identity verification'),
      async startVerification(req) {
        const name = req.fullName;
        const status = name.includes(SANDBOX_FIXTURES.kycRejectWord)
          ? 'rejected'
          : name.includes(SANDBOX_FIXTURES.kycNeedsInfoWord)
            ? 'needs_info'
            : 'approved';
        return { providerRef: `sbx_kyc_${short(req.idempotencyKey, 16).toLowerCase()}`, status, hostedUrl: null };
      },
    },
    screening: {
      info: () => info('screening', 'Sanctions and address screening'),
      async screenAddress(_network, address) {
        const a = address.toLowerCase();
        if (a === SANDBOX_FIXTURES.blockedAddress.toLowerCase()) return { result: 'blocked', note: 'Sandbox fixture: blocked address.' };
        if (a === SANDBOX_FIXTURES.reviewAddress.toLowerCase())
          return { result: 'review', note: 'Sandbox fixture: address needs manual review.' };
        return { result: 'clear', note: 'Sandbox screening: no matches.' };
      },
      async screenCustomer({ fullName }) {
        if (fullName.includes('Sanctioned')) return { result: 'blocked', note: 'Sandbox fixture: sanctioned name.' };
        return { result: 'clear', note: 'Sandbox screening: no matches.' };
      },
    },
    bankPayout: {
      info: () => info('bankPayout', 'Bank payouts (ACH and wire)'),
      async submitPayout(req) {
        if (req.destination.holderName.includes(SANDBOX_FIXTURES.payoutDeclineWord))
          throw new ProviderError('bankPayout', 'Sandbox fixture: payout declined by the provider.', false, 422);
        return { providerRef: `sbx_po_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
    },
    cardPayout: {
      info: () => info('cardPayout', 'Debit card payouts'),
      async submitPayout(req) {
        if (req.destination.holderName.includes(SANDBOX_FIXTURES.payoutDeclineWord))
          throw new ProviderError('cardPayout', 'Sandbox fixture: card payout declined by the provider.', false, 422);
        return { providerRef: `sbx_po_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
      async createSandboxToken() {
        return { providerToken: `tok_sbx_${randomBytes(12).toString('hex')}`, last4: '0000' };
      },
    },
    cash: {
      info: () =>
        FEATURE_FLAGS.courierCashDelivery
          ? info('cash', 'Cash delivery by courier')
          : { key: 'cash', label: 'Cash delivery by courier', state: 'not_configured', detail: 'Disabled by feature flag.' },
      async checkAvailability(zip) {
        if (!FEATURE_FLAGS.courierCashDelivery) return { available: false, reason: 'Cash delivery is switched off.' };
        if (zip.startsWith(SANDBOX_FIXTURES.courierUnavailableZipPrefix))
          return { available: false, reason: 'Sandbox fixture: the courier does not serve this area.' };
        return { available: true, reason: 'Sandbox courier serves this area.' };
      },
      async submitPayout(req) {
        if (req.destination.holderName.includes(SANDBOX_FIXTURES.payoutDeclineWord))
          throw new ProviderError('cash', 'Sandbox fixture: cash delivery declined by the carrier.', false, 422);
        return { providerRef: `sbx_cash_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
      async scheduleCollection(req) {
        if (!FEATURE_FLAGS.courierCashDelivery) throw new ProviderError('cash', 'Cash collection is switched off.', false, 422);
        if (req.destination.address.zip.startsWith(SANDBOX_FIXTURES.courierUnavailableZipPrefix))
          throw new ProviderError('cash', 'Sandbox fixture: the courier does not serve this area.', false, 422);
        return { providerRef: `sbx_col_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
      async requestCashReturn(req) {
        return { providerRef: `sbx_ret_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
    },
    email: {
      info: () => info('email', 'Email delivery'),
      async send(req) {
        return { providerRef: `sbx_msg_${short(req.idempotencyKey, 16).toLowerCase()}` };
      },
    },
  };
}
