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
 *   same webhook path) can report a deposit, confirmations or a provider payout
 *   result. A customer-submitted TXID never moves the order by itself.
 * - An operator can authorize a payout to a configured provider, or explicitly
 *   record a manual payout with evidence (MANUAL_PAYOUT_RECORDED). Provider
 *   completion and manual recording are distinct and never confused.
 * - A deposit that is late, of a different amount, or arrives on a closed
 *   order is never paid at the locked rate; it can only be refunded.
 */
import type { AtomicAmount } from './money';
import type { PayoutMethodId } from './payout';
import type { BuyPayIn, ExchangeDirection } from './quote';

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
  /** Operator-recorded completion with evidence. Not a provider-verified payout. */
  | { type: 'MANUAL_PAYOUT_RECORDED'; reason: string; evidenceRef: string }
  | { type: 'PAYOUT_FAILED'; providerRef: string | null; reason: string }
  | { type: 'PAYOUT_RETRY_AUTHORIZED'; reason: string }
  | { type: 'REFUND_INITIATED'; reason: string }
  | { type: 'REFUND_COMPLETED'; txHash: string }
  | { type: 'HOLD_PLACED'; reason: string }
  | { type: 'HOLD_RELEASED'; reason: string };

export type OrderEventType = OrderEvent['type'];

/**
 * The order fields the state machine reads and may change. For a buy order
 * (cash → crypto) the "deposit" is the cash the courier collects, counted in
 * cents, and the "payout" is the crypto sent to the customer's wallet; the
 * table is the same, only the customer-facing words differ. A buy paid by
 * bank wire works the same way: the "deposit" is the wire received.
 */
export interface OrderMachineState {
  /** Absent means sell. */
  direction?: ExchangeDirection;
  /** Buy orders: how the dollars are paid. Absent means cash by courier. */
  payIn?: BuyPayIn;
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
  /** An operator paused the order. Provider facts are still recorded; nothing moves money until the hold is released. */
  onHold?: boolean;
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
  MANUAL_PAYOUT_RECORDED: ['operator'],
  PAYOUT_FAILED: ['provider', 'system'],
  PAYOUT_RETRY_AUTHORIZED: ['operator'],
  REFUND_INITIATED: ['operator'],
  REFUND_COMPLETED: ['provider'],
  HOLD_PLACED: ['operator'],
  HOLD_RELEASED: ['operator'],
};

/**
 * Events refused while an order is on hold: everything a person or our own
 * system would do to move it toward a payout. Provider reports (deposits,
 * confirmations, payout results) are facts and are always recorded.
 */
export const BLOCKED_WHILE_ON_HOLD: ReadonlySet<OrderEventType> = new Set([
  'SCREENING_CLEARED',
  'REVIEW_APPROVED',
  'PAYOUT_AUTHORIZED',
  'PAYOUT_SUBMITTED',
  'MANUAL_PAYOUT_RECORDED',
  'PAYOUT_RETRY_AUTHORIZED',
]);

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

const isBuy = (s: Pick<OrderMachineState, 'direction'>) => s.direction === 'buy';
const isWire = (s: Pick<OrderMachineState, 'direction' | 'payIn'>) => isBuy(s) && s.payIn === 'wire';
/** Picks the customer-facing wording for the order's direction (and, for a buy, how it is paid). */
const say = (s: Pick<OrderMachineState, 'direction' | 'payIn'>, sell: string, buy: string, wire: string = buy) =>
  isWire(s) ? wire : isBuy(s) ? buy : sell;

/** A buy's pay-in from the order's stored method (the method column holds the pay-in for a buy). */
export function buyPayIn(direction: ExchangeDirection | undefined, method: PayoutMethodId): BuyPayIn | undefined {
  return direction === 'buy' ? (method === 'wire' ? 'wire' : 'courier_cash') : undefined;
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
    detail: isWire(s)
      ? exception === 'late'
        ? 'A wire arrived after the window closed. It cannot be exchanged at the quoted rate and will be reviewed for return.'
        : exception === 'order_closed'
          ? 'A wire arrived for an order that was already closed. It will be reviewed for return.'
          : exception === 'amount_mismatch'
            ? 'The wire received differs from the quoted amount. It cannot be exchanged at the quoted rate and will be reviewed for return.'
            : 'Your wire was received. It is being matched to this order and checked.'
      : isBuy(s)
        ? exception === 'late'
          ? 'Cash was collected after the collection window closed. It cannot be exchanged at the quoted rate and will be reviewed for return.'
          : exception === 'order_closed'
            ? 'Cash was collected for an order that was already closed. It will be reviewed for return.'
            : exception === 'amount_mismatch'
              ? 'The cash collected differs from the quoted amount. It cannot be exchanged at the quoted rate and will be reviewed for return.'
              : 'The courier collected your cash. It is being counted and checked.'
        : exception === 'late'
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
    detail: say(
      s,
      'Your deposit is final on the network.',
      'Your cash was counted and matches the quote.',
      'Your wire was matched to this order and matches the quote.',
    ),
    visibility: 'customer',
  };
};

const screeningCleared: Resolver = (s, e) => {
  if (s.depositException || s.reviewReason)
    throw new InvalidOrderTransitionError(s.status, e.type, 'This order must go through compliance review.');
  return {
    status: 'ready_for_payout',
    patch: {},
    detail: say(s, 'Checks complete. Your payout is being prepared.', 'Checks complete. Your crypto transfer is being prepared.'),
    visibility: 'customer',
  };
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
    detail: say(s, 'Review complete. Your payout is being prepared.', 'Review complete. Your crypto transfer is being prepared.'),
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
      ? say(
          s,
          'We could not complete this exchange. Your deposit will be returned to your refund address under Section 9 of the Service Rules, which sets the return fees.',
          'We could not complete this exchange. Your cash will be returned under Section 9 of the Service Rules, which sets the return fees.',
          'We could not complete this exchange. Your wire will be returned to the sending account under Section 9 of the Service Rules, which sets the return fees.',
        )
      : 'We could not accept this exchange request.',
    visibility: 'customer',
  };
};

const payoutSubmitted: Resolver = (s, e) => {
  const p = ev(e, 'PAYOUT_SUBMITTED');
  return {
    status: 'payout_submitted',
    patch: { payoutProviderRef: p.providerRef },
    detail: say(s, 'Your payout was submitted to the payout provider.', 'Your crypto transfer was submitted to the custody provider.'),
    visibility: 'customer',
  };
};

const payoutRef = (s: OrderMachineState, e: OrderEvent, ref: string) => {
  if (s.payoutProviderRef && s.payoutProviderRef !== ref)
    throw new InvalidOrderTransitionError(s.status, e.type, 'Provider reference does not match the submitted payout.');
};

const payoutProcessing: Resolver = (s, e) => {
  payoutRef(s, e, ev(e, 'PAYOUT_PROCESSING').providerRef);
  return {
    status: 'payout_processing',
    patch: {},
    detail: say(s, 'The payout provider is processing your payout.', 'The custody provider is processing your crypto transfer.'),
    visibility: 'customer',
  };
};

const manualPayoutRecorded: Resolver = (s, e) => {
  const m = ev(e, 'MANUAL_PAYOUT_RECORDED');
  if (!m.reason.trim()) throw new InvalidOrderTransitionError(s.status, e.type, 'A manual payout record needs a reason.');
  const evidence = m.evidenceRef.trim();
  if (evidence.length < 4)
    throw new InvalidOrderTransitionError(s.status, e.type, 'A manual payout record needs an evidence reference (at least 4 characters).');
  if (s.payoutProviderRef)
    throw new InvalidOrderTransitionError(
      s.status,
      e.type,
      'A provider payout is already in progress for this order. Wait for the provider result or resolve the failed attempt first.',
    );
  return {
    status: 'completed',
    patch: { payoutProviderRef: `manual:${evidence.slice(0, 120)}` },
    detail: say(
      s,
      'Your payout was recorded as completed by operations. This is an operator-recorded confirmation, not an automated provider report.',
      'Your crypto transfer was recorded as completed by operations. This is an operator-recorded confirmation, not an automated custody report.',
    ),
    visibility: 'customer',
  };
};

const payoutCompleted: Resolver = (s, e) => {
  payoutRef(s, e, ev(e, 'PAYOUT_COMPLETED').providerRef);
  return {
    status: 'completed',
    patch: {},
    detail: say(
      s,
      'The payout provider reports your payout as completed.',
      'The custody provider reports your crypto transfer as completed.',
    ),
    visibility: 'customer',
  };
};

const payoutFailed: Resolver = (s, e) => {
  const f = ev(e, 'PAYOUT_FAILED');
  if (f.providerRef) payoutRef(s, e, f.providerRef);
  return {
    status: 'failed',
    patch: {},
    detail: say(
      s,
      'Your payout could not be completed. Our team will contact you about next steps.',
      'Your crypto transfer could not be completed. Our team will contact you about next steps.',
    ),
    visibility: 'customer',
  };
};

const holdPlaced: Resolver = (s, e) => {
  if (s.onHold) throw new InvalidOrderTransitionError(s.status, e.type, 'This order is already on hold.');
  if (!ev(e, 'HOLD_PLACED').reason.trim()) throw new InvalidOrderTransitionError(s.status, e.type, 'A hold needs a reason.');
  return {
    status: s.status,
    patch: { onHold: true },
    detail: 'Your order is on hold while our team checks it. We will contact you if we need anything.',
    visibility: 'customer',
  };
};

const holdReleased: Resolver = (s, e) => {
  if (!s.onHold) throw new InvalidOrderTransitionError(s.status, e.type, 'This order is not on hold.');
  return {
    status: s.status,
    patch: { onHold: false },
    detail: 'The hold on your order was released. Processing continues.',
    visibility: 'customer',
  };
};

/** Statuses in which an operator may place or release a hold: open orders that have not paid out or closed. */
export const HOLDABLE_STATUSES: readonly OrderStatus[] = [
  'created',
  'awaiting_deposit',
  'deposit_observed',
  'confirming',
  'deposit_confirmed',
  'compliance_review',
  'ready_for_payout',
  'failed',
  'refund_pending',
];

/** status → event → resolver. Anything not listed is rejected. */
const TABLE: Partial<Record<OrderStatus, Partial<Record<OrderEventType, Resolver>>>> = {
  created: {
    DEPOSIT_INSTRUCTIONS_ISSUED: to('awaiting_deposit', (s) =>
      say(
        s,
        'Deposit instructions issued. Send the exact amount before the deadline.',
        'Cash collection requested from the courier. Have the exact amount ready.',
        'Wire instructions issued. Send the exact amount before the deadline.',
      ),
    ),
    DEPOSIT_INSTRUCTIONS_FAILED: to('failed', (s) =>
      say(
        s,
        'We could not issue deposit instructions for this order. Nothing was sent.',
        'We could not arrange cash collection for this order.',
        'We could not issue wire instructions for this order. Nothing was sent.',
      ),
    ),
    CUSTOMER_CANCELLED: to('cancelled', (s) =>
      say(
        s,
        'You cancelled this order before sending funds.',
        'You cancelled this order before the cash was collected.',
        'You cancelled this order before the wire was received.',
      ),
    ),
    ORDER_REJECTED: orderRejected,
  },
  awaiting_deposit: {
    CUSTOMER_REPORTED_SENT: same((s, e) =>
      isWire(s)
        ? 'You told us you sent the wire. We will update this order when the wire is received; your report alone does not confirm a payment.'
        : ev(e, 'CUSTOMER_REPORTED_SENT').txHash
          ? 'You submitted a transaction hash for review. It is checked against our deposit monitoring; a hash alone does not confirm a deposit.'
          : 'You told us you sent the deposit. We will update this order when the network shows it; your report alone does not confirm a deposit.',
    ),
    CUSTOMER_CANCELLED: to('cancelled', (s) =>
      say(
        s,
        'You cancelled this order before sending funds.',
        'You cancelled this order before the cash was collected.',
        'You cancelled this order before the wire was received.',
      ),
    ),
    DEPOSIT_WINDOW_EXPIRED: to('expired', (s) =>
      say(
        s,
        'No deposit arrived before the deadline. The quote has expired.',
        'The cash was not collected before the deadline. The quote has expired.',
        'No wire was received before the deadline. The quote has expired.',
      ),
    ),
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
    MANUAL_PAYOUT_RECORDED: manualPayoutRecorded,
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
        detail: say(
          s,
          'A refund of your deposit to your refund address has been started.',
          'A return of your cash has been started.',
          'A return of your wire to the sending account has been started.',
        ),
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
      (s) =>
        say(
          s,
          'Your refund was sent to your refund address.',
          'Your cash was returned by courier.',
          'Your wire was returned to the sending account.',
        ),
      (e) => ({ refundTxHash: ev(e, 'REFUND_COMPLETED').txHash }),
    ),
  },
};

for (const status of HOLDABLE_STATUSES) TABLE[status] = { ...TABLE[status], HOLD_PLACED: holdPlaced, HOLD_RELEASED: holdReleased };

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
  if (state.onHold && BLOCKED_WHILE_ON_HOLD.has(event.type))
    throw new InvalidOrderTransitionError(state.status, event.type, 'This order is on hold. Release the hold first.');
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
  created: 'Awaiting deposit instructions',
  awaiting_deposit: 'Awaiting crypto deposit',
  deposit_observed: 'Deposit detected',
  confirming: 'Confirming on blockchain',
  deposit_confirmed: 'Deposit confirmed',
  compliance_review: 'Under review',
  ready_for_payout: 'Awaiting payout',
  payout_submitted: 'Payout submitted',
  payout_processing: 'Payout processing',
  completed: 'Completed',
  rejected: 'Rejected',
  failed: 'Failed — needs intervention',
  cancelled: 'Cancelled',
  expired: 'Expired',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};

/** Buy orders (cash → crypto) reuse the statuses; these are the words a customer sees for them. */
const BUY_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  awaiting_deposit: 'Awaiting cash collection',
  deposit_observed: 'Cash collected',
  confirming: 'Counting cash',
  deposit_confirmed: 'Cash verified',
  ready_for_payout: 'Ready to send crypto',
  payout_submitted: 'Crypto transfer submitted',
  payout_processing: 'Crypto transfer processing',
  refund_pending: 'Cash return pending',
  refunded: 'Cash returned',
};

/** Buy orders paid by bank wire. */
const WIRE_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  ...BUY_STATUS_LABEL,
  created: 'Preparing wire instructions',
  awaiting_deposit: 'Awaiting wire',
  deposit_observed: 'Wire received',
  confirming: 'Matching wire',
  deposit_confirmed: 'Wire verified',
  refund_pending: 'Wire return pending',
  refunded: 'Wire returned',
};

export function orderStatusLabel(status: OrderStatus, direction: ExchangeDirection = 'sell', payIn?: BuyPayIn): string {
  const buyLabels = payIn === 'wire' ? WIRE_STATUS_LABEL : BUY_STATUS_LABEL;
  return (direction === 'buy' ? buyLabels[status] : undefined) ?? ORDER_STATUS_LABEL[status];
}

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
  direction: ExchangeDirection = 'sell',
  payIn?: BuyPayIn,
): OrderStep[] {
  const buy = direction === 'buy';
  const wire = buy && payIn === 'wire';
  const firstAt = (...types: PersistedOrderEvent['type'][]) => events.find((e) => types.includes(e.type))?.createdAt ?? null;
  const reachedReview = events.some((e) => e.toStatus === 'compliance_review');
  const refunding = status === 'refund_pending' || status === 'refunded';
  const closedEarly = (status === 'cancelled' || status === 'expired' || status === 'rejected') && !firstAt('DEPOSIT_OBSERVED');

  const depositAt = firstAt('DEPOSIT_OBSERVED');
  const confirmedAt = firstAt('DEPOSIT_CONFIRMED');
  const submittedAt = firstAt('PAYOUT_SUBMITTED');
  const completedAt = firstAt('PAYOUT_COMPLETED', 'MANUAL_PAYOUT_RECORDED');
  const instructionsAt = firstAt('DEPOSIT_INSTRUCTIONS_ISSUED');

  const steps: OrderStep[] = [
    { key: 'created', label: 'Request created', state: 'done', at: firstAt('ORDER_CREATED') },
    {
      key: 'instructions',
      label: wire ? 'Wire instructions' : buy ? 'Collection arranged' : 'Deposit instructions',
      state: instructionsAt
        ? 'done'
        : status === 'created'
          ? 'current'
          : status === 'failed' && !depositAt
            ? 'failed'
            : 'upcoming',
      at: instructionsAt,
    },
    {
      key: 'deposit',
      label: wire ? 'Wire received' : buy ? 'Cash collected' : 'Deposit detected',
      state: depositAt
        ? 'done'
        : closedEarly
          ? 'failed'
          : status === 'awaiting_deposit'
            ? 'current'
            : 'upcoming',
      at: depositAt,
    },
    {
      key: 'confirm',
      label: wire
        ? 'Wire matched and verified'
        : buy
          ? 'Cash counted and verified'
          : `Confirmations (${Math.min(confirmations.count, confirmations.required)} of ${confirmations.required})`,
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
    steps.push({
      key: 'refund',
      label: wire ? 'Wire return' : buy ? 'Cash return' : 'Refund',
      state: status === 'refunded' ? 'done' : 'current',
      at: firstAt('REFUND_COMPLETED'),
    });
    return steps;
  }
  const manualDone = events.some((e) => e.type === 'MANUAL_PAYOUT_RECORDED');
  steps.push({
    key: 'payout',
    label: manualDone
      ? buy
        ? 'Crypto transfer recorded'
        : 'Payout recorded'
      : buy
        ? 'Crypto transfer submitted'
        : 'Payout submitted',
    state:
      (submittedAt || manualDone) && status !== 'ready_for_payout'
        ? 'done'
        : status === 'ready_for_payout'
          ? 'current'
          : 'upcoming',
    at: submittedAt ?? (manualDone ? completedAt : null),
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

/* ---------- Stages ---------- */

/**
 * The owner-facing pipeline: each detailed status belongs to one stage. The
 * detailed status stays the source of truth; a stage is only a grouping for
 * the CRM, filters and the customer's summary.
 */
export type OrderStage =
  | 'new'
  | 'awaiting_payment'
  | 'payment_review'
  | 'processing'
  | 'completed'
  | 'on_hold'
  | 'rejected'
  | 'cancelled'
  | 'refund_review'
  | 'refunded';

export const ORDER_STAGES: readonly OrderStage[] = [
  'new',
  'awaiting_payment',
  'payment_review',
  'processing',
  'completed',
  'on_hold',
  'rejected',
  'cancelled',
  'refund_review',
  'refunded',
];

/** The main path, in order, for progress indicators. */
export const ORDER_STAGE_PATH: readonly OrderStage[] = ['new', 'awaiting_payment', 'payment_review', 'processing', 'completed'];

export const STAGE_STATUSES: Record<Exclude<OrderStage, 'on_hold'>, readonly OrderStatus[]> = {
  new: ['created'],
  awaiting_payment: ['awaiting_deposit'],
  payment_review: ['deposit_observed', 'confirming', 'deposit_confirmed', 'compliance_review'],
  processing: ['ready_for_payout', 'payout_submitted', 'payout_processing'],
  completed: ['completed'],
  rejected: ['rejected'],
  cancelled: ['cancelled', 'expired'],
  refund_review: ['refund_pending'],
  refunded: ['refunded'],
};

export function orderStage(status: OrderStatus, onHold = false): OrderStage {
  // A failed payout waits on an operator decision (retry or refund), like a hold.
  if (onHold || status === 'failed') return 'on_hold';
  for (const [stage, statuses] of Object.entries(STAGE_STATUSES)) if (statuses.includes(status)) return stage as OrderStage;
  return 'new';
}

export const ORDER_STAGE_LABEL: Record<OrderStage, string> = {
  new: 'New',
  awaiting_payment: 'Awaiting Payment',
  payment_review: 'Payment Review',
  processing: 'Processing',
  completed: 'Completed',
  on_hold: 'On Hold',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  refund_review: 'Refund Review',
  refunded: 'Refunded',
};
