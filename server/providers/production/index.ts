/**
 * Production provider adapters. They speak a documented generic JSON contract
 * (docs/providers.md) that is adapted to the contracted vendor once one is
 * chosen. Without credentials each adapter is NOT_CONFIGURED. Adapters that
 * move money (custody refunds and deposit addresses, bank and card payouts,
 * cash) are additionally DISABLED_BY_POLICY while REAL_MONEY_ENABLED is false.
 */
import { REAL_MONEY_ENABLED, FEATURE_FLAGS } from '@/config/runtime';
import type { AssetCode } from '@/domain/assets';
import type { AppConfig, ProviderCredentials } from '../../config';
import type { Logger } from '../../logger';
import { createHttpClient, type HttpClient } from '../httpClient';
import {
  ProviderError,
  ProviderNotConfiguredError,
  type ProviderInfo,
  type ProviderKey,
  type Providers,
  type VerificationStatus,
} from '../types';

const LABELS: Record<ProviderKey, string> = {
  rates: 'Exchange rates',
  custody: 'Deposit addresses and monitoring',
  identity: 'Identity verification',
  screening: 'Sanctions and address screening',
  bankPayout: 'Bank payouts (ACH and wire)',
  cardPayout: 'Debit card payouts',
  cash: 'Cash delivery and pickup',
  email: 'Email delivery',
};

const MOVES_MONEY: ReadonlySet<ProviderKey> = new Set(['custody', 'bankPayout', 'cardPayout', 'cash']);

interface Slot {
  info: ProviderInfo;
  client: HttpClient | null;
}

function slot(key: ProviderKey, creds: ProviderCredentials | null, log: Logger, extraGate: string | null = null): Slot {
  if (!creds)
    return {
      info: { key, label: LABELS[key], state: 'not_configured', detail: `Set ${envPrefix(key)}_URL and ${envPrefix(key)}_API_KEY.` },
      client: null,
    };
  if (MOVES_MONEY.has(key) && !REAL_MONEY_ENABLED)
    return {
      info: {
        key,
        label: LABELS[key],
        state: 'disabled_by_policy',
        detail: 'Credentials present, but REAL_MONEY_ENABLED is false in src/config/runtime.ts.',
      },
      client: null,
    };
  if (extraGate) return { info: { key, label: LABELS[key], state: 'disabled_by_policy', detail: extraGate }, client: null };
  return {
    info: { key, label: LABELS[key], state: 'configured', detail: `Configured at ${new URL(creds.url).host}.` },
    client: createHttpClient({ provider: key, baseUrl: creds.url, apiKey: creds.apiKey, log }),
  };
}

export function envPrefix(key: ProviderKey): string {
  return {
    rates: 'RATES_PROVIDER',
    custody: 'CUSTODY_PROVIDER',
    identity: 'KYC_PROVIDER',
    screening: 'SCREENING_PROVIDER',
    bankPayout: 'BANK_PAYOUT_PROVIDER',
    cardPayout: 'CARD_PAYOUT_PROVIDER',
    cash: 'CASH_PROVIDER',
    email: 'EMAIL_PROVIDER',
  }[key];
}

function need(s: Slot): HttpClient {
  if (!s.client)
    throw new ProviderNotConfiguredError(
      s.info.key,
      `${s.info.label}: ${s.info.state === 'not_configured' ? 'not configured' : s.info.detail}`,
    );
  return s.client;
}

/** Parses "68420.15" into USD micros without floating point. */
function usdToMicros(raw: unknown, provider: ProviderKey): bigint {
  if (typeof raw !== 'string' || !/^\d+(\.\d{1,6})?$/.test(raw))
    throw new ProviderError(provider, 'Provider returned an invalid price.', false);
  const [w, f = ''] = raw.split('.');
  return BigInt(w!) * 1_000_000n + BigInt(f.padEnd(6, '0'));
}

function str(v: unknown, provider: ProviderKey, field: string): string {
  if (typeof v !== 'string' || !v || v.length > 256) throw new ProviderError(provider, `Provider response is missing ${field}.`, false);
  return v;
}

export function createProductionProviders(config: AppConfig, log: Logger): Providers {
  const p = config.providers;
  const rates = slot('rates', p.rates, log);
  const custody = slot('custody', p.custody, log);
  const identity = slot('identity', p.identity, log);
  const screening = slot('screening', p.screening, log);
  const bank = slot('bankPayout', p.bankPayout, log);
  const card = slot('cardPayout', p.cardPayout, log);
  const cash = slot(
    'cash',
    p.cash,
    log,
    FEATURE_FLAGS.courierCashDelivery
      ? null
      : 'Disabled by FEATURE_FLAGS.courierCashDelivery until the compliance checklist is signed off.',
  );
  const email = slot('email', p.email, log);

  return {
    rates: {
      info: () => rates.info,
      async getReferencePrice(asset: AssetCode) {
        const r = await need(rates).request<{ priceUsd: string; asOf: string }>('GET', `v1/prices/${asset}`);
        const asOf = Date.parse(r.asOf);
        if (!Number.isFinite(asOf)) throw new ProviderError('rates', 'Provider returned an invalid timestamp.', false);
        return { asset, priceMicros: usdToMicros(r.priceUsd, 'rates'), asOf, source: 'live' };
      },
    },
    custody: {
      info: () => custody.info,
      async createDepositInstructions(req) {
        const r = await need(custody).request<{ id: string; address: string; memo?: string | null }>('POST', 'v1/deposit-addresses', {
          idempotencyKey: req.idempotencyKey,
          body: { reference: req.orderId, asset: req.asset, network: req.network, expectedAmountAtomic: req.amountAtomic },
        });
        return { providerRef: str(r.id, 'custody', 'id'), address: str(r.address, 'custody', 'address'), memo: r.memo ?? null };
      },
      async requestRefund(req) {
        const r = await need(custody).request<{ id: string }>('POST', 'v1/refunds', {
          idempotencyKey: req.idempotencyKey,
          body: { reference: req.orderId, asset: req.asset, network: req.network, address: req.address, amountAtomic: req.amountAtomic },
        });
        return { providerRef: str(r.id, 'custody', 'id') };
      },
    },
    identity: {
      info: () => identity.info,
      async startVerification(req) {
        const r = await need(identity).request<{ id: string; status: VerificationStatus; hostedUrl?: string | null }>(
          'POST',
          'v1/verifications',
          {
            idempotencyKey: req.idempotencyKey,
            body: { reference: req.userId, email: req.email, fullName: req.fullName, level: req.level },
          },
        );
        if (!['pending', 'approved', 'needs_info', 'rejected'].includes(r.status))
          throw new ProviderError('identity', 'Unknown verification status.', false);
        return { providerRef: str(r.id, 'identity', 'id'), status: r.status, hostedUrl: r.hostedUrl ?? null };
      },
    },
    screening: {
      info: () => screening.info,
      async screenAddress(network, address) {
        return need(screening).request('POST', 'v1/screen/address', {
          idempotencyKey: `addr:${network}:${address}`,
          body: { network, address },
        });
      },
      async screenCustomer(req) {
        return need(screening).request('POST', 'v1/screen/person', { idempotencyKey: `person:${req.email}`, body: req });
      },
    },
    bankPayout: {
      info: () => bank.info,
      async submitPayout(req) {
        const r = await need(bank).request<{ id: string }>('POST', 'v1/payouts', {
          idempotencyKey: req.idempotencyKey,
          body: { reference: req.orderId, method: req.method, amountCents: req.amountCents, currency: 'USD', destination: req.destination },
        });
        return { providerRef: str(r.id, 'bankPayout', 'id') };
      },
    },
    cardPayout: {
      info: () => card.info,
      async submitPayout(req) {
        const r = await need(card).request<{ id: string }>('POST', 'v1/payouts', {
          idempotencyKey: req.idempotencyKey,
          body: { reference: req.orderId, method: req.method, amountCents: req.amountCents, currency: 'USD', destination: req.destination },
        });
        return { providerRef: str(r.id, 'cardPayout', 'id') };
      },
    },
    cash: {
      info: () => cash.info,
      async checkAvailability(zip) {
        return need(cash).request('GET', `v1/availability?zip=${encodeURIComponent(zip)}`);
      },
    },
    email: {
      info: () => email.info,
      async send(req) {
        const r = await need(email).request<{ id: string }>('POST', 'v1/messages', {
          idempotencyKey: req.idempotencyKey,
          body: { from: p.email?.from, to: req.to, subject: req.subject, text: req.text },
        });
        return { providerRef: str(r.id, 'email', 'id') };
      },
    },
  };
}
