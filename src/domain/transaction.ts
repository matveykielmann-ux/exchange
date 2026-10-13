/**
 * Transaction lifecycle as an explicit state machine. Every status change goes
 * through `applyEvent`, which rejects transitions the table does not allow —
 * a later blockchain monitor or payout webhook cannot push a transaction into
 * an impossible state (e.g. paying out before the deposit is final).
 */
import { NETWORKS } from './assets';
import type { AtomicAmount } from './money';
import type { PayoutMethodId } from './payout';
import type { Quote } from './quote';

export type TransactionStatus =
  | 'awaiting_deposit'
  | 'deposit_detected'
  | 'confirming'
  | 'compliance_review'
  | 'payout_processing'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded'
  | 'payout_failed';

export type TransactionEvent =
  | { type: 'DEPOSIT_DETECTED'; txHash: string; amountAtomic: AtomicAmount }
  | { type: 'CONFIRMATION'; count: number }
  | { type: 'REVIEW_REQUIRED'; reason: string }
  | { type: 'REVIEW_CLEARED' }
  | { type: 'REVIEW_REJECTED'; reason: string }
  | { type: 'PAYOUT_SETTLED'; reference: string }
  | { type: 'PAYOUT_FAILED'; reason: string }
  | { type: 'RETRY_PAYOUT' }
  | { type: 'WINDOW_EXPIRED' }
  | { type: 'CUSTOMER_CANCELLED' }
  | { type: 'REFUND_SENT'; txHash: string };

export type TransactionEventType = TransactionEvent['type'];

export interface PayoutDestination {
  method: PayoutMethodId;
  label: string;
  last4: string;
}

export interface TransactionLogEntry {
  at: number;
  type: TransactionEventType | 'CREATED';
  status: TransactionStatus;
  detail: string;
}

export interface Transaction {
  id: string;
  source: 'mock';
  customerEmail: string;
  createdAt: number;
  updatedAt: number;
  status: TransactionStatus;
  quote: Quote;
  destination: PayoutDestination;
  refundAddress: string;
  /** Deliberately invalid placeholder — see design-spec §8. */
  depositAddress: string;
  depositDeadline: number;
  confirmations: { count: number; required: number };
  depositTxHash: string | null;
  payoutReference: string | null;
  /** Set when pre-deposit screening asks for a manual review before payout. */
  reviewReason: string | null;
  log: TransactionLogEntry[];
}

export const TERMINAL_STATUSES: ReadonlySet<TransactionStatus> = new Set(['completed', 'expired', 'cancelled', 'refunded']);

/** Allowed transitions: status → event type → next status (or a resolver). */
const TRANSITIONS: Partial<
  Record<
    TransactionStatus,
    Partial<Record<TransactionEventType, TransactionStatus | ((tx: Transaction, e: TransactionEvent) => TransactionStatus)>>
  >
> = {
  awaiting_deposit: {
    DEPOSIT_DETECTED: 'deposit_detected',
    WINDOW_EXPIRED: 'expired',
    CUSTOMER_CANCELLED: 'cancelled',
  },
  deposit_detected: {
    CONFIRMATION: (tx, e) => confirmationOutcome(tx, e),
  },
  confirming: {
    CONFIRMATION: (tx, e) => confirmationOutcome(tx, e),
    REVIEW_REQUIRED: 'compliance_review',
  },
  compliance_review: {
    REVIEW_CLEARED: 'payout_processing',
    REVIEW_REJECTED: 'refund_pending',
  },
  payout_processing: {
    REVIEW_REQUIRED: 'compliance_review',
    PAYOUT_SETTLED: 'completed',
    PAYOUT_FAILED: 'payout_failed',
  },
  payout_failed: {
    RETRY_PAYOUT: 'payout_processing',
  },
  refund_pending: {
    REFUND_SENT: 'refunded',
  },
};

function confirmationOutcome(tx: Transaction, e: TransactionEvent): TransactionStatus {
  if (e.type !== 'CONFIRMATION') return tx.status;
  return e.count >= tx.confirmations.required ? 'payout_processing' : 'confirming';
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: TransactionStatus,
    readonly event: TransactionEventType,
  ) {
    super(`Event ${event} is not allowed while a transaction is ${from}`);
    this.name = 'InvalidTransitionError';
  }
}

export function allowedEvents(status: TransactionStatus): TransactionEventType[] {
  return Object.keys(TRANSITIONS[status] ?? {}) as TransactionEventType[];
}

export function canApply(status: TransactionStatus, type: TransactionEventType): boolean {
  return allowedEvents(status).includes(type);
}

function describe(e: TransactionEvent, tx: Transaction): string {
  switch (e.type) {
    case 'DEPOSIT_DETECTED':
      return `Deposit seen on ${NETWORKS[tx.quote.network].name}.`;
    case 'CONFIRMATION':
      return `${Math.min(e.count, tx.confirmations.required)} of ${tx.confirmations.required} confirmations.`;
    case 'REVIEW_REQUIRED':
      return `Held for review: ${e.reason}`;
    case 'REVIEW_CLEARED':
      return 'Review cleared.';
    case 'REVIEW_REJECTED':
      return `Review not cleared: ${e.reason} A refund to your refund address will be prepared.`;
    case 'PAYOUT_SETTLED':
      return `Payout sent. Reference ${e.reference}.`;
    case 'PAYOUT_FAILED':
      return `Payout returned: ${e.reason}`;
    case 'RETRY_PAYOUT':
      return 'Payout retried.';
    case 'WINDOW_EXPIRED':
      return 'No deposit arrived before the deadline. The quote has expired.';
    case 'CUSTOMER_CANCELLED':
      return 'You cancelled this exchange before sending funds.';
    case 'REFUND_SENT':
      return 'Refund sent to your refund address.';
  }
}

export function applyEvent(tx: Transaction, event: TransactionEvent, now: number): Transaction {
  const rule = TRANSITIONS[tx.status]?.[event.type];
  if (!rule) throw new InvalidTransitionError(tx.status, event.type);
  const next = typeof rule === 'function' ? rule(tx, event) : rule;

  const updated: Transaction = { ...tx, status: next, updatedAt: now };
  if (event.type === 'DEPOSIT_DETECTED') updated.depositTxHash = event.txHash;
  if (event.type === 'CONFIRMATION') {
    updated.confirmations = { ...tx.confirmations, count: Math.min(event.count, tx.confirmations.required) };
  }
  if (event.type === 'PAYOUT_SETTLED') updated.payoutReference = event.reference;
  if (event.type === 'REVIEW_CLEARED') updated.reviewReason = null;
  updated.log = [...tx.log, { at: now, type: event.type, status: next, detail: describe(event, tx) }];
  return updated;
}

/* ---------- Customer-facing presentation ---------- */

export type StepState = 'done' | 'current' | 'upcoming' | 'failed';

export interface TimelineStep {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
}

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  awaiting_deposit: 'Awaiting your deposit',
  deposit_detected: 'Deposit detected',
  confirming: 'Confirming on network',
  compliance_review: 'Under review',
  payout_processing: 'Sending your payout',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
  payout_failed: 'Payout needs attention',
};

export type StatusTone = 'info' | 'success' | 'warn' | 'danger' | 'neutral';

export function statusTone(status: TransactionStatus): StatusTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'expired':
    case 'cancelled':
    case 'refunded':
      return 'neutral';
    case 'payout_failed':
    case 'refund_pending':
      return 'danger';
    case 'compliance_review':
      return 'warn';
    default:
      return 'info';
  }
}

export function timelineFor(tx: Transaction): TimelineStep[] {
  const reached = (s: TransactionStatus) => tx.log.some((l) => l.status === s);
  const { count, required } = tx.confirmations;

  const steps: TimelineStep[] = [
    { key: 'quote', label: 'Quote locked', state: 'done' },
    {
      key: 'deposit',
      label: 'Deposit received',
      state: tx.depositTxHash ? 'done' : tx.status === 'awaiting_deposit' ? 'current' : 'failed',
    },
    {
      key: 'confirm',
      label: 'Network confirmations',
      state: count >= required ? 'done' : tx.depositTxHash ? 'current' : 'upcoming',
      detail: `${count} of ${required}`,
    },
  ];

  if (reached('compliance_review')) {
    steps.push({
      key: 'review',
      label: 'Compliance review',
      state: tx.status === 'compliance_review' ? 'current' : tx.status === 'refund_pending' || tx.status === 'refunded' ? 'failed' : 'done',
    });
  }

  if (tx.status === 'refund_pending' || tx.status === 'refunded') {
    steps.push({ key: 'refund', label: 'Refund', state: tx.status === 'refunded' ? 'done' : 'current' });
    return steps;
  }

  steps.push({
    key: 'payout',
    label: 'Payout sent',
    state:
      tx.status === 'payout_failed'
        ? 'failed'
        : tx.status === 'completed'
          ? 'done'
          : tx.status === 'payout_processing'
            ? 'current'
            : 'upcoming',
  });

  if (tx.status === 'expired' || tx.status === 'cancelled') {
    // Nothing after the deposit step applies; mark remaining steps as not reached.
    return steps.map((s) => (s.key === 'quote' ? s : { ...s, state: s.key === 'deposit' ? 'failed' : 'upcoming' }));
  }
  return steps;
}
