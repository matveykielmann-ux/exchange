/**
 * In-memory `Services` for component tests. Quotes come from the pure domain
 * calculator at fixed prices; everything else is an inert stub. Tests that
 * need server behavior belong in server/__tests__.
 */
import { calculateBuyQuote, calculateQuote, PRICING_POLICY } from '@/domain/quote';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import type { AssetCode } from '@/domain/assets';
import type { Services } from '@/services/types';

const PRICES: Record<AssetCode, bigint> = {
  XRP: 620_000n,
  SOL: 148_500_000n,
  BNB: 595_200_000n,
  BTC: 68_000_000_000n,
  ETH: 3_200_000_000n,
  USDT: 1_000_000n,
  USDC: 1_000_000n,
};

const unused = () => Promise.reject(new Error('Not available in component tests.'));

export function createFakeServices(overrides: Partial<Services> = {}): Services {
  const listeners = new Set<() => void>();
  const quote = async (i: Parameters<Services['quotes']['indicative']>[0], firm: boolean) => {
    const common = { referencePriceMicros: PRICES[i.asset], now: Date.now(), source: 'sandbox' as const };
    const r = i.direction === 'buy' ? calculateBuyQuote({ ...i, ...common }) : calculateQuote({ ...i, ...common });
    return { ...r, firm, price: { asset: i.asset, priceMicros: PRICES[i.asset], asOf: Date.now(), source: 'sandbox' as const } };
  };
  const base: Services = {
    config: {
      mode: 'sandbox',
      realMoneyEnabled: false,
      featureFlags: { courierCashDelivery: false },
      sandboxAutopilotStepMs: 0,
      providers: [],
      policy: {
        quoteTtlMs: PRICING_POLICY.quoteTtlMs,
        depositWindowMs: PRICING_POLICY.depositWindowMs,
        indicativeRefreshMs: PRICING_POLICY.indicativeRefreshMs,
        minimumCents: PRICING_POLICY.minimumCents,
        largeDeskFromCents: PRICING_POLICY.largeDeskFromCents,
      },
      legal: LEGAL_DOCUMENTS.map((d) => ({ slug: d.slug, title: d.title, version: d.version, acceptance: d.acceptance })),
    },
    session: {
      current: () => null,
      mfaVerified: () => false,
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
    auth: {
      signUp: unused,
      signIn: unused,
      verifyMfa: unused,
      signOut: async () => undefined,
      requestPasswordReset: unused,
      confirmPasswordReset: unused,
      changePassword: unused,
      beginTotp: unused,
      confirmTotp: unused,
      disableTotp: unused,
      sessions: async () => [],
      revokeOtherSessions: async () => 0,
      refresh: async () => null,
    },
    pricing: {
      prices: async () =>
        (Object.keys(PRICES) as AssetCode[]).map((asset) => ({
          asset,
          priceMicros: PRICES[asset],
          asOf: Date.now(),
          source: 'sandbox' as const,
        })),
    },
    quotes: { indicative: (i) => quote(i, false), firm: (i) => quote(i, true) },
    account: {
      profile: unused,
      updateProfile: unused,
      startVerification: unused,
      kyc: { get: unused, setIdType: unused, upload: unused, file: unused, submit: unused },
      destinations: async () => [],
      addBankAccount: unused,
      addCard: unused,
      addCourierAddress: unused,
      removeDestination: unused,
      notifications: async () => ({ notifications: [], unread: 0 }),
      markNotificationsRead: async () => 0,
      acceptances: async () => [],
    },
    orders: {
      create: unused,
      list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      get: unused,
      cancel: unused,
      reportSent: unused,
      acceptCourierFee: unused,
      setRefundAddress: unused,
      uploadDocument: unused,
      submitPaymentConfirmation: unused,
      requestRefund: unused,
    },
    support: { list: async () => [], create: unused, get: unused, send: unused, markRead: async () => undefined },
    live: { subscribe: () => () => undefined, state: () => 'offline', onState: () => () => undefined },
    largeDesk: { submit: unused },
    cash: { availability: async (zip) => ({ available: false, reason: 'Cash delivery is not offered.', zip }) },
    admin: new Proxy({} as Services['admin'], { get: () => unused }),
  };
  return { ...base, ...overrides };
}
