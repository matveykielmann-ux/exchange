/**
 * Exchange-order lifecycle: the single state machine the server enforces.
 *
 * Every status change is an event with an actor. `transition` validates the
 * event against the table (status × event type), checks which kind of actor
 * may raise it, applies guards, and returns the next status, the fields that
 * change, and a customer-facing description. The server persists the result
 * as an append-only event inside the same database transaction as the status
 * update, so the timeline is always generated from persisted events.
 *
 * Rules this table encodes:
 * - A customer saying "I sent it" is recorded but never moves the order.
 * - Only an authenticated provider event (or the sandbox provider, through the
 *   same webhook path) can report a deposit, confirmations or a payout result.
 * - An operator can authorize a payout, but only the payout provider can make
 *   it "submitted", "processing", "completed" or "failed".
 * - A deposit that is late, of a different amount, or arrives on a closed
 *   order is never paid at the locked rate; it can only be refunded.
 */
import type { AtomicAmount } from './money';

export type OrderStatus =
  | 'created'
  | 'awaiting_deposit'
  | 'deposit_observed'
  | 'confirming'
  | 'deposit_confirmed'
  | 'compliance_review'
  | 'ready_for_payout'
  | 'payout_submitted'
  | 'payout_processing'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refund_pending'
  | 'refunded';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'created',
  'awaiting_deposit',
  'deposit_observed',
  'confirming',
  'deposit_confirmed',
  'compliance_review',
  'ready_for_payout',
  'payout_submitted',
  'payout_processing',
  'completed',
  'rejected',
  'failed',
  'cancelled',
  'expired',
  'refund_pending',
  'refunded',
];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v);
}

/** No further events of any kind are expected. */
export const TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set(['completed', 'refunded']);
/** Closed before any deposit; a deposit that still arrives becomes a refund exception. */
export const CLOSED_PRE_DEPOSIT: ReadonlySet<OrderStatus> = new Set(['rejected', 'cancelled', 'expired']);

export type ActorType = 'customer' | 'operator' | 'provider' | 'system';

export type DepositException = 'amount_mismatch' | 'late' | 'order_closed';

export type OrderEvent =
  | { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }
  | { type: 'DEPOSIT_INSTRUCTIONS_FAILED'; reason: string }
  | { type: 'CUSTOMER_REPORTED_SENT'; txHash: string | null }
  | { type: 'CUSTOMER_CANCELLED' }
  | { type: 'DEPOSIT_WINDOW_EXPIRED' }
  | { type: 'DEPOSIT_OBSERVED'; txHash: string; amountAtomic: AtomicAmount; confirmations: number }
  | { type: 'CONFIRMATIONS_UPDATED'; confirmations: number }
  | { type: 'DEPOSIT_CONFIRMED'; confirmations: number }
  | { type: 'SCREENING_CLEARED' }
  | { type: 'REVIEW_REQUIRED'; reason: string }
  | { type: 'INFO_REQUESTED'; message: string }
  | { type: 'REVIEW_APPROVED'; reason: string }
  | { type: 'ORDER_REJECTED'; reason: string }
  | { type: 'PAYOUT_AUTHORIZED'; reason: string }
  | { type: 'PAYOUT_SUBMITTED'; providerRef: string; attempt: number }
  | { type: 'PAYOUT_PROCESSING'; providerRef: string }
  | { type: 'PAYOUT_COMPLETED'; providerRef: string }
  | { type: 'PAYOUT_FAILED'; providerRef: string | null; reason: string }
  | { type: 'PAYOUT_RETRY_AUTHORIZED'; reason: string }
  | { type: 'REFUND_INITIATED'; reason: string }
  | { type: 'REFUND_COMPLETED'; txHash: string };

export type OrderEventType = OrderEvent['type'];

/** The order fields the state machine reads and may change. */
export interface OrderMachineState {
  status: OrderStatus;
  quotedAmountAtomic: AtomicAmount;
  depositDeadline: number;
  confirmationsRequired: number;
  confirmationsCount: number;
  depositTxHash: string | null;
  depositAmountAtomic: AtomicAmount | null;
  depositException: DepositException | null;
  reviewReason: string | null;
  payoutProviderRef: string | null;
  refundTxHash: string | null;
}

export type OrderPatch = Partial<Omit<OrderMachineState, 'status' | 'quotedAmountAtomic' | 'depositDeadline' | 'confirmationsRequired'>>;

export interface TransitionResult {
  status: OrderStatus;
  patch: OrderPatch;
  /** Plain-language description of what happened, shown on the customer timeline when `visibility` is 'customer'. */
  detail: string;
  visibility: 'customer' | 'internal';
}

export class InvalidOrderTransitionError extends Error {
  readonly code = 'invalid_transition';
  constructor(
    readonly from: OrderStatus,
    readonly event: OrderEventType,
    reason?: string,
  ) {
    super(reason ?? `${event} is not allowed while an order is ${from}.`);
    this.name = 'InvalidOrderTransitionError';
  }
}

export class ActorNotAllowedError extends Error {
  readonly code = 'actor_not_allowed';
  constructor(
    readonly actor: ActorType,
    readonly event: OrderEventType,
  ) {
    super(`A ${actor} cannot raise ${event}.`);
    this.name = 'ActorNotAllowedError';
  }
}

/** Which kind of actor may raise each event. Checked before the transition table. */
export const EVENT_ACTORS: Record<OrderEventType, readonly ActorType[]> = {
  DEPOSIT_INSTRUCTIONS_ISSUED: ['system'],
  DEPOSIT_INSTRUCTIONS_FAILED: ['system'],
  CUSTOMER_REPORTED_SENT: ['customer'],
  CUSTOMER_CANCELLED: ['customer'],
  DEPOSIT_WINDOW_EXPIRED: ['system'],
  DEPOSIT_OBSERVED: ['provider'],
  CONFIRMATIONS_UPDATED: ['provider'],
  DEPOSIT_CONFIRMED: ['provider'],
  SCREENING_CLEARED: ['system'],
  REVIEW_REQUIRED: ['system', 'operator'],
  INFO_REQUESTED: ['operator'],
  REVIEW_APPROVED: ['operator'],
  ORDER_REJECTED: ['operator'],
  PAYOUT_AUTHORIZED: ['operator'],
  PAYOUT_SUBMITTED: ['system'],
  PAYOUT_PROCESSING: ['provider'],
  PAYOUT_COMPLETED: ['provider'],
  PAYOUT_FAILED: ['provider', 'system'],
  PAYOUT_RETRY_AUTHORIZED: ['operator'],
  REFUND_INITIATED: ['operator'],
  REFUND_COMPLETED: ['provider'],
};

type Resolver = (s: OrderMachineState, e: OrderEvent, now: number) => TransitionResult;

const same =
  (detail: (s: OrderMachineState, e: OrderEvent) => string, visibility: TransitionResult['visibility'] = 'customer'): Resolver =>
  (s, e) => ({ status: s.status, patch: {}, detail: detail(s, e), visibility });

const to =
  (
    status: OrderStatus,
    detail: (s: OrderMachineState, e: OrderEvent) => string,
    patch: (e: OrderEvent) => OrderPatch = () => ({}),
  ): Resolver =>
  (s, e) => ({ status, patch: patch(e), detail: detail(s, e), visibility: 'customer' });

function ev<T extends OrderEventType>(e: OrderEvent, type: T): Extract<OrderEvent, { type: T }> {
  if (e.type !== type) throw new Error(`Expected ${type}, got ${e.type}`);
  return e as Extract<OrderEvent, { type: T }>;
}

/* ---------- Resolvers with guards ---------- */

const depositObserved: Resolver = (s, e, now) => {
  const d = ev(e, 'DEPOSIT_OBSERVED');
  if (!Number.isInteger(d.confirmations) || d.confirmations < 0)
    throw new InvalidOrderTransitionError(s.status, e.type, 'Invalid confirmation count.');
  if (d.amountAtomic <= 0n) throw new InvalidOrderTransitionError(s.status, e.type, 'Deposit amount must be positive.');
  const exception: DepositException | null = CLOSED_PRE_DEPOSIT.has(s.status)
    ? s.status === 'expired'
      ? 'late'
      : 'order_closed'
    : now >= s.depositDeadline
      ? 'late'
      : d.amountAtomic !== s.quotedAmountAtomic
        ? 'amount_mismatch'
        : null;
  const confirmations = Math.min(d.confirmations, s.confirmationsRequired);
  return {
    status: 'deposit_observed',
    patch: { depositTxHash: d.txHash, depositAmountAtomic: d.amountAtomic, depositException: exception, confirmationsCount: confirmations },
    detail:
      exception === 'late'
        ? 'A deposit arrived after the deposit window closed. It cannot be paid at the locked rate and will be reviewed for return to your refund address.'
        : exception === 'order_closed'
          ? 'A deposit arrived for an order that was already closed. It will be reviewed for return to your refund address.'
          : exception === 'amount_mismatch'
            ? 'A deposit arrived that differs from the quoted amount. It cannot be paid at the locked rate and will be reviewed for return to your refund address.'
            : 'Your deposit was seen on the network. Waiting for confirmations.',
    visibility: 'customer',
  };
};

const confirmationsUpdated: Resolver = (s, e) => {
  const c = ev(e, 'CONFIRMATIONS_UPDATED').confirmations;
  if (!Number.isInteger(c) || c <= s.confirmationsCount)
    throw new InvalidOrderTransitionError(s.status, e.type, 'Confirmation counts must strictly increase.');
  if (c >= s.confirmationsRequired)
    throw new InvalidOrderTransitionError(s.status, e.type, 'Final confirmations must be reported with DEPOSIT_CONFIRMED.');
  return {
    status: 'confirming',
    patch: { confirmationsCount: c },
    detail: `${c} of ${s.confirmationsRequired} network confirmations.`,
    visibility: 'customer',
  };
};

const depositConfirmed: Resolver = (s, e) => {
  const c = ev(e, 'DEPOSIT_CONFIRMED').confirmations;
  if (!Number.isInteger(c) || c < s.confirmationsRequired)
    throw new InvalidOrderTransitionError(s.status, e.type, `A deposit needs ${s.confirmationsRequired} confirmations to be final.`);
  return {
    status: 'deposit_confirmed',
    patch: { confirmationsCount: s.confirmationsRequired },
    detail: 'Your deposit is final on the network.',
    visibility: 'customer',
  };
};

const screeningCleared: Resolver = (s, e) => {
  if (s.depositException || s.reviewReason)
    throw new InvalidOrderTransitionError(s.status, e.type, 'This order must go through compliance review.');
  return { status: 'ready_for_payout', patch: {}, detail: 'Checks complete. Your payout is being prepared.', visibility: 'customer' };
};

const reviewRequired: Resolver = (s, e) => {
  const reason = ev(e, 'REVIEW_REQUIRED').reason;
  // Before the deposit is final, a review request only flags the order; it moves to review once the deposit is confirmed.
  if (s.status === 'awaiting_deposit' || s.status === 'deposit_observed' || s.status === 'confirming') {
    return { status: s.status, patch: { reviewReason: reason }, detail: `Flagged for review: ${reason}`, visibility: 'internal' };
  }
  return {
    status: 'compliance_review',
    patch: { reviewReason: reason },
    detail: 'Your order is being reviewed by our compliance team. We will contact you if we need anything.',
    visibility: 'customer',
  };
};

const reviewApproved: Resolver = (s, e) => {
  if (s.depositException)
    throw new InvalidOrderTransitionError(
      s.status,
      e.type,
      'A deposit that was late, of a different amount, or sent to a closed order cannot be paid at the locked rate. Reject the order to refund it.',
    );
  return {
    status: 'ready_for_payout',
    patch: { reviewReason: null },
    detail: 'Review complete. Your payout is being prepared.',
    visibility: 'customer',
  };
};

const orderRejected: Resolver = (s, e) => {
  if (!ev(e, 'ORDER_REJECTED').reason.trim()) throw new InvalidOrderTransitionError(s.status, e.type, 'A rejection needs a reason.');
  // Funds already received can only be returned, never kept.
  const fundsHeld = s.depositTxHash !== null;
  return {
    status: fundsHeld ? 'refund_pending' : 'rejected',
    patch: {},
    detail: fundsHeld
      ? 'We could not complete this exchange. Your deposit will be returned to your refund address under Section 9 of the Service Rules, which sets the return fees.'
      : 'We could not accept this exchange request.',
    visibility: 'customer',
  };
};

const payoutSubmitted: Resolver = (_s, e) => {
  const p = ev(e, 'PAYOUT_SUBMITTED');
  return {
    status: 'payout_submitted',
    patch: { payoutProviderRef: p.providerRef },
    detail: 'Your payout was submitted to the payout provider.',
    visibility: 'customer',
  };
};

const payoutRef = (s: OrderMachineState, e: OrderEvent, ref: string) => {
  if (s.payoutProviderRef && s.payoutProviderRef !== ref)
    throw new InvalidOrderTransitionError(s.status, e.type, 'Provider reference does not match the submitted payout.');
};

const payoutProcessing: Resolver = (s, e) => {
  payoutRef(s, e, ev(e, 'PAYOUT_PROCESSING').providerRef);
  return { status: 'payout_processing', patch: {}, detail: 'The payout provider is processing your payout.', visibility: 'customer' };
};

const payoutCompleted: Resolver = (s, e) => {
  payoutRef(s, e, ev(e, 'PAYOUT_COMPLETED').providerRef);
  return { status: 'completed', patch: {}, detail: 'The payout provider reports your payout as completed.', visibility: 'customer' };
};

const payoutFailed: Resolver = (s, e) => {
  const f = ev(e, 'PAYOUT_FAILED');
  if (f.providerRef) payoutRef(s, e, f.providerRef);
  return {
    status: 'failed',
    patch: {},
    detail: 'Your payout could not be completed. Our team will contact you about next steps.',
    visibility: 'customer',
  };
};

/** status → event → resolver. Anything not listed is rejected. */
const TABLE: Partial<Record<OrderStatus, Partial<Record<OrderEventType, Resolver>>>> = {
  created: {
    DEPOSIT_INSTRUCTIONS_ISSUED: to('awaiting_deposit', () => 'Deposit instructions issued. Send the exact amount before the deadline.'),
    DEPOSIT_INSTRUCTIONS_FAILED: to('failed', () => 'We could not issue deposit instructions for this order. Nothing was sent.'),
    CUSTOMER_CANCELLED: to('cancelled', () => 'You cancelled this order before sending funds.'),
    ORDER_REJECTED: orderRejected,
  },
  awaiting_deposit: {
    CUSTOMER_REPORTED_SENT: same(
      () =>
        'You told us you sent the deposit. We will update this order when the network shows it; your report alone does not confirm a deposit.',
    ),
    CUSTOMER_CANCELLED: to('cancelled', () => 'You cancelled this order before sending funds.'),
    DEPOSIT_WINDOW_EXPIRED: to('expired', () => 'No deposit arrived before the deadline. The quote has expired.'),
    DEPOSIT_OBSERVED: depositObserved,
    REVIEW_REQUIRED: reviewRequired,
    ORDER_REJECTED: orderRejected,
  },
  deposit_observed: {
    CONFIRMATIONS_UPDATED: confirmationsUpdated,
    DEPOSIT_CONFIRMED: depositConfirmed,
    REVIEW_REQUIRED: reviewRequired,
  },
  confirming: {
    CONFIRMATIONS_UPDATED: confirmationsUpdated,
    DEPOSIT_CONFIRMED: depositConfirmed,
    REVIEW_REQUIRED: reviewRequired,
  },
  deposit_confirmed: {
    SCREENING_CLEARED: screeningCleared,
    REVIEW_REQUIRED: reviewRequired,
    ORDER_REJECTED: orderRejected,
  },
  compliance_review: {
    INFO_REQUESTED: same(() => 'We asked you for more information. Check your support messages.'),
    REVIEW_APPROVED: reviewApproved,
    ORDER_REJECTED: orderRejected,
  },
  ready_for_payout: {
    PAYOUT_AUTHORIZED: same(() => 'Payout authorized by an operator.', 'internal'),
    PAYOUT_SUBMITTED: payoutSubmitted,
    PAYOUT_FAILED: payoutFailed,
    REVIEW_REQUIRED: reviewRequired,
    ORDER_REJECTED: orderRejected,
  },
  payout_submitted: {
    PAYOUT_PROCESSING: payoutProcessing,
    PAYOUT_COMPLETED: payoutCompleted,
    PAYOUT_FAILED: payoutFailed,
  },
  payout_processing: {
    PAYOUT_COMPLETED: payoutCompleted,
    PAYOUT_FAILED: payoutFailed,
  },
  failed: {
    PAYOUT_RETRY_AUTHORIZED: (s) => {
      if (!s.depositTxHash)
        throw new InvalidOrderTransitionError(s.status, 'PAYOUT_RETRY_AUTHORIZED', 'There is no confirmed deposit to pay out.');
      return {
        status: 'ready_for_payout',
        patch: { payoutProviderRef: null },
        detail: 'Your payout will be retried.',
        visibility: 'customer',
      };
    },
    REFUND_INITIATED: (s) => {
      if (!s.depositTxHash) throw new InvalidOrderTransitionError(s.status, 'REFUND_INITIATED', 'There is no deposit to refund.');
      return {
        status: 'refund_pending',
        patch: {},
        detail: 'A refund of your deposit to your refund address has been started.',
        visibility: 'customer',
      };
    },
  },
  expired: { DEPOSIT_OBSERVED: depositObserved },
  cancelled: { DEPOSIT_OBSERVED: depositObserved },
  rejected: { DEPOSIT_OBSERVED: depositObserved },
  refund_pending: {
    REFUND_COMPLETED: to(
      'refunded',
      () => 'Your refund was sent to your refund address.',
      (e) => ({ refundTxHash: ev(e, 'REFUND_COMPLETED').txHash }),
    ),
  },
};

export function allowedOrderEvents(status: OrderStatus): OrderEventType[] {
  return Object.keys(TABLE[status] ?? {}) as OrderEventType[];
}

export function canRaise(status: OrderStatus, type: OrderEventType, actor: ActorType): boolean {
  return EVENT_ACTORS[type].includes(actor) && allowedOrderEvents(status).includes(type);
}

/** Validates and applies one event. Throws on a disallowed actor, transition or guard. */
export function transition(state: OrderMachineState, event: OrderEvent, actor: ActorType, now: number): TransitionResult {
  if (!EVENT_ACTORS[event.type].includes(actor)) throw new ActorNotAllowedError(actor, event.type);
  const rule = TABLE[state.status]?.[event.type];
  if (!rule) throw new InvalidOrderTransitionError(state.status, event.type);
  return rule(state, event, now);
}

/**
 * What happens once a deposit is final: straight to payout preparation, or to
 * compliance review when screening flagged the order, the deposit is an
 * exception, or the amount crosses the manual-review threshold.
 */
export function postDepositEvent(
  s: Pick<OrderMachineState, 'depositException' | 'reviewReason'>,
  { manualReviewRequired }: { manualReviewRequired: string | null },
): OrderEvent {
  if (s.depositException) return { type: 'REVIEW_REQUIRED', reason: DEPOSIT_EXCEPTION_LABEL[s.depositException] };
  if (s.reviewReason) return { type: 'REVIEW_REQUIRED', reason: s.reviewReason };
  if (manualReviewRequired) return { type: 'REVIEW_REQUIRED', reason: manualReviewRequired };
  return { type: 'SCREENING_CLEARED' };
}

export const DEPOSIT_EXCEPTION_LABEL: Record<DepositException, string> = {
  amount_mismatch: 'Deposit amount differs from the quote.',
  late: 'Deposit arrived after the deposit window.',
  order_closed: 'Deposit arrived for a closed order.',
};

/**
 * Sandbox deposit addresses are deliberately invalid on every chain (prefix
 * MOCK-, suffix -DO-NOT-SEND, contain "-"). In sandbox mode the server and the
 * UI refuse to show anything else.
 */
export function isPreviewDepositAddress(address: string): boolean {
  return address.startsWith('MOCK-') && address.endsWith('-DO-NOT-SEND');
}

/* ---------- Presentation ---------- */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'Request created',
  awaiting_deposit: 'Awaiting deposit',
  deposit_observed: 'Deposit observed',
  confirming: 'Confirming on-chain',
  deposit_confirmed: 'Deposit confirmed',
  compliance_review: 'Compliance review',
  ready_for_payout: 'Ready for payout',
  payout_submitted: 'Payout submitted',
  payout_processing: 'Payout processing',
  completed: 'Completed',
  rejected: 'Rejected',
  failed: 'Failed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};

export type OrderTone = 'info' | 'success' | 'warn' | 'danger' | 'neutral';

export function orderTone(status: OrderStatus): OrderTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'refunded':
    case 'cancelled':
    case 'expired':
    case 'rejected':
      return 'neutral';
    case 'failed':
    case 'refund_pending':
      return 'danger';
    case 'compliance_review':
      return 'warn';
    default:
      return 'info';
  }
}

/** Statuses an operator should look at: something is waiting on a person, not on the network or a provider. */
export const NEEDS_OPERATOR: ReadonlySet<OrderStatus> = new Set(['compliance_review', 'ready_for_payout', 'failed', 'refund_pending']);

export interface PersistedOrderEvent {
  type: OrderEventType | 'ORDER_CREATED';
  toStatus: OrderStatus;
  createdAt: number;
  detail: string;
}

export type OrderStepState = 'done' | 'current' | 'upcoming' | 'failed';
export interface OrderStep {
  key: string;
  label: string;
  state: OrderStepState;
  at: number | null;
}

/** Customer progress rail, derived only from persisted events and the current status. */
export function orderSteps(
  status: OrderStatus,
  events: readonly PersistedOrderEvent[],
  confirmations: { count: number; required: number },
): OrderStep[] {
  const firstAt = (...types: PersistedOrderEvent['type'][]) => events.find((e) => types.includes(e.type))?.createdAt ?? null;
  const reachedReview = events.some((e) => e.toStatus === 'compliance_review');
  const refunding = status === 'refund_pending' || status === 'refunded';
  const closedEarly = (status === 'cancelled' || status === 'expired' || status === 'rejected') && !firstAt('DEPOSIT_OBSERVED');

  const depositAt = firstAt('DEPOSIT_OBSERVED');
  const confirmedAt = firstAt('DEPOSIT_CONFIRMED');
  const submittedAt = firstAt('PAYOUT_SUBMITTED');
  const completedAt = firstAt('PAYOUT_COMPLETED');

  const steps: OrderStep[] = [
    { key: 'created', label: 'Request created', state: 'done', at: firstAt('ORDER_CREATED') },
    {
      key: 'deposit',
      label: 'Deposit observed',
      state: depositAt ? 'done' : closedEarly ? 'failed' : status === 'awaiting_deposit' ? 'current' : 'upcoming',
      at: depositAt,
    },
    {
      key: 'confirm',
      label: `Confirmations (${Math.min(confirmations.count, confirmations.required)} of ${confirmations.required})`,
      state: confirmedAt ? 'done' : depositAt ? 'current' : 'upcoming',
      at: confirmedAt,
    },
  ];
  if (reachedReview) {
    steps.push({
      key: 'review',
      label: 'Compliance review',
      state: status === 'compliance_review' ? 'current' : refunding ? 'failed' : 'done',
      at: events.find((e) => e.toStatus === 'compliance_review')?.createdAt ?? null,
    });
  }
  if (refunding) {
    steps.push({ key: 'refund', label: 'Refund', state: status === 'refunded' ? 'done' : 'current', at: firstAt('REFUND_COMPLETED') });
    return steps;
  }
  steps.push({
    key: 'payout',
    label: 'Payout submitted',
    state: submittedAt && status !== 'ready_for_payout' ? 'done' : status === 'ready_for_payout' ? 'current' : 'upcoming',
    at: submittedAt,
  });
  steps.push({
    key: 'completed',
    label: 'Completed',
    state:
      status === 'completed'
        ? 'done'
        : status === 'failed'
          ? 'failed'
          : status === 'payout_submitted' || status === 'payout_processing'
            ? 'current'
            : 'upcoming',
    at: completedAt,
  });
  return steps;
}
