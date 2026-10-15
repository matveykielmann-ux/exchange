/**
 * Provider interfaces. Business logic depends only on these; each has a
 * deterministic sandbox implementation and a production adapter that talks
 * to a contracted vendor over HTTPS. A production adapter without credentials
 * reports NOT_CONFIGURED and throws ProviderNotConfiguredError on use — it
 * never falls back to sandbox behaviour.
 */
import type { AssetCode, NetworkId } from '@/domain/assets';
import type { PayoutMethodId } from '@/domain/payout';
import type { CourierWindow } from '@/domain/courier';

export type ProviderKey = 'rates' | 'custody' | 'identity' | 'screening' | 'bankPayout' | 'cardPayout' | 'cash' | 'email';

/**
 * sandbox: deterministic test implementation (sandbox mode only).
 * configured: credentials present and the capability may be used.
 * not_configured: credentials missing; operations fail with NOT_CONFIGURED.
 * disabled_by_policy: credentials present, but the capability moves real money and REAL_MONEY_ENABLED is false.
 */
export type ProviderState = 'sandbox' | 'configured' | 'not_configured' | 'disabled_by_policy';

export interface ProviderInfo {
  key: ProviderKey;
  label: string;
  state: ProviderState;
  detail: string;
}

export class ProviderNotConfiguredError extends Error {
  readonly code = 'NOT_CONFIGURED';
  constructor(
    readonly provider: ProviderKey,
    detail?: string,
  ) {
    super(detail ?? `The ${provider} provider is not configured.`);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** A provider call failed. `retryable` errors may be retried with the same idempotency key. */
export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderKey,
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface Provider {
  info(): ProviderInfo;
}

/* ---------- Rates ---------- */
export interface ReferencePrice {
  asset: AssetCode;
  priceMicros: bigint;
  asOf: number;
  source: 'sandbox' | 'live';
}
export interface RateProvider extends Provider {
  getReferencePrice(asset: AssetCode): Promise<ReferencePrice>;
}

/* ---------- Custody: deposit addresses, monitoring (via webhooks), refunds ---------- */
export interface DepositInstructionsRequest {
  orderId: string;
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: bigint;
  idempotencyKey: string;
}
export interface DepositInstructions {
  address: string;
  memo: string | null;
  providerRef: string;
}
export interface RefundRequest {
  orderId: string;
  asset: AssetCode;
  network: NetworkId;
  address: string;
  amountAtomic: bigint;
  idempotencyKey: string;
}
/** Buy orders: crypto sent from custody to the customer's wallet. Settlement arrives as payout.* webhooks from custody. */
export interface CryptoTransferRequest {
  orderId: string;
  asset: AssetCode;
  network: NetworkId;
  address: string;
  amountAtomic: bigint;
  idempotencyKey: string;
}
export interface CustodyProvider extends Provider {
  createDepositInstructions(req: DepositInstructionsRequest): Promise<DepositInstructions>;
  requestRefund(req: RefundRequest): Promise<{ providerRef: string }>;
  sendCrypto(req: CryptoTransferRequest): Promise<{ providerRef: string }>;
}

/* ---------- Identity verification ---------- */
export type VerificationStatus = 'pending' | 'approved' | 'needs_info' | 'rejected';
export interface IdentityProvider extends Provider {
  startVerification(req: {
    userId: string;
    email: string;
    fullName: string;
    level: 'basic' | 'enhanced';
    idempotencyKey: string;
  }): Promise<{ providerRef: string; status: VerificationStatus; hostedUrl: string | null }>;
}

/* ---------- Sanctions and blockchain-analytics screening ---------- */
export interface ScreeningResult {
  result: 'clear' | 'review' | 'blocked';
  note: string;
}
export interface ScreeningProvider extends Provider {
  screenAddress(network: NetworkId, address: string): Promise<ScreeningResult>;
  screenCustomer(req: { fullName: string; email: string; stateOfResidence: string | null }): Promise<ScreeningResult>;
}

/* ---------- Payouts (bank: ACH and wire; card: push to debit) ---------- */
export type PayoutDestinationDetails =
  | { kind: 'bank'; routingNumber: string; accountNumber: string; accountType: 'checking' | 'savings'; holderName: string }
  | { kind: 'card'; providerToken: string; holderName: string }
  | {
      kind: 'courier';
      /** The verified account holder. Cash is released only to this person after an ID check. */
      holderName: string;
      phone: string;
      address: CourierAddress;
      window: CourierWindow;
      preferredDate: string | null;
      instructions: string;
    };

export interface CourierAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export interface PayoutRequest {
  orderId: string;
  method: PayoutMethodId;
  amountCents: bigint;
  destination: PayoutDestinationDetails;
  idempotencyKey: string;
}
/** Only an acknowledgement that the provider accepted the instruction. Settlement arrives by webhook. */
export interface PayoutSubmission {
  providerRef: string;
}
export interface PayoutProvider extends Provider {
  submitPayout(req: PayoutRequest): Promise<PayoutSubmission>;
}

/** Card payouts need a token from the provider's hosted card form; we never see the card number. */
export interface CardTokenizer {
  /** Sandbox only: issues a test token. Production uses the provider's hosted component. */
  createSandboxToken?(holderName: string): Promise<{ providerToken: string; last4: string }>;
}

/* ---------- Cash delivery by courier ---------- */
/** A cash payout is a payout whose destination is a courier delivery; results arrive as payout.* webhooks. */
export interface CashCollectionRequest {
  orderId: string;
  amountCents: bigint;
  /** The courier collects only from the verified account holder, after an ID check. */
  destination: Extract<PayoutDestinationDetails, { kind: 'courier' }>;
  idempotencyKey: string;
}
export interface CashProvider extends PayoutProvider {
  checkAvailability(zip: string): Promise<{ available: boolean; reason: string }>;
  /** Buy orders: the courier collects cash; the result arrives as deposit.* webhooks from cash. */
  scheduleCollection(req: CashCollectionRequest): Promise<{ providerRef: string }>;
  /** Buy orders: returns collected cash; completion arrives as refund.completed from cash. */
  requestCashReturn(req: CashCollectionRequest): Promise<{ providerRef: string }>;
}

/* ---------- Email ---------- */
export interface EmailProvider extends Provider {
  send(req: { to: string; subject: string; text: string; idempotencyKey: string }): Promise<{ providerRef: string }>;
}

export interface Providers {
  rates: RateProvider;
  custody: CustodyProvider;
  identity: IdentityProvider;
  screening: ScreeningProvider;
  bankPayout: PayoutProvider;
  cardPayout: PayoutProvider & CardTokenizer;
  cash: CashProvider;
  email: EmailProvider;
}

/* ---------- Webhooks ---------- */
export type WebhookSource = 'custody' | 'identity' | 'bankPayout' | 'cardPayout' | 'cash';

/**
 * The generic event contract adapters translate vendor webhooks into. The
 * sandbox emits these directly, signed with the sandbox secret.
 */
export type ProviderEvent =
  | {
      id: string;
      type: 'deposit.observed';
      created: number;
      data: { orderId: string; txHash: string; amountAtomic: string; confirmations: number };
    }
  | { id: string; type: 'deposit.confirmations'; created: number; data: { orderId: string; confirmations: number } }
  | { id: string; type: 'deposit.confirmed'; created: number; data: { orderId: string; confirmations: number } }
  | { id: string; type: 'refund.completed'; created: number; data: { orderId: string; txHash: string } }
  | { id: string; type: 'payout.processing'; created: number; data: { providerRef: string } }
  | { id: string; type: 'payout.completed'; created: number; data: { providerRef: string } }
  | { id: string; type: 'payout.failed'; created: number; data: { providerRef: string; reason: string } }
  | {
      id: string;
      type: 'verification.updated';
      created: number;
      data: { providerRef: string; status: VerificationStatus; detail?: string };
    };

/**
 * Which source may send each event type. For deposit.* and refund.completed the
 * order's direction narrows it further: custody for a sell (crypto in), cash
 * for a buy paid in cash (collected by courier), the bank provider for a buy
 * paid by wire. payout.* must match the provider the
 * payout instruction went to (custody sends the crypto of a buy).
 */
export const WEBHOOK_EVENT_SOURCES: Record<ProviderEvent['type'], readonly WebhookSource[]> = {
  'deposit.observed': ['custody', 'cash', 'bankPayout'],
  'deposit.confirmations': ['custody'],
  'deposit.confirmed': ['custody', 'cash', 'bankPayout'],
  'refund.completed': ['custody', 'cash', 'bankPayout'],
  'payout.processing': ['bankPayout', 'cardPayout', 'cash', 'custody'],
  'payout.completed': ['bankPayout', 'cardPayout', 'cash', 'custody'],
  'payout.failed': ['bankPayout', 'cardPayout', 'cash', 'custody'],
  'verification.updated': ['identity'],
};
