import {
  ActorNotAllowedError,
  InvalidOrderTransitionError,
  ORDER_STATUSES,
  allowedOrderEvents,
  orderStatusLabel,
  orderSteps,
  postDepositEvent,
  transition,
  type OrderEvent,
  type OrderMachineState,
  type OrderStatus,
} from '../order';

const NOW = 1_000_000;
const base = (over: Partial<OrderMachineState> = {}): OrderMachineState => ({
  status: 'awaiting_deposit',
  quotedAmountAtomic: 1000n,
  depositDeadline: NOW + 60_000,
  confirmationsRequired: 3,
  confirmationsCount: 0,
  depositTxHash: null,
  depositAmountAtomic: null,
  depositException: null,
  reviewReason: null,
  payoutProviderRef: null,
  refundTxHash: null,
  ...over,
});
const observed: OrderEvent = { type: 'DEPOSIT_OBSERVED', txHash: '0xa', amountAtomic: 1000n, confirmations: 0 };

describe('order state machine', () => {
  it('ignores "I sent it" for status purposes', () => {
    expect(transition(base(), { type: 'CUSTOMER_REPORTED_SENT', txHash: null }, 'customer', NOW).status).toBe('awaiting_deposit');
  });

  it('only lets providers report deposits, confirmations and payout results', () => {
    expect(() => transition(base(), observed, 'customer', NOW)).toThrow(ActorNotAllowedError);
    expect(() => transition(base(), observed, 'operator', NOW)).toThrow(ActorNotAllowedError);
    expect(() => transition(base({ status: 'confirming' }), { type: 'DEPOSIT_CONFIRMED', confirmations: 3 }, 'operator', NOW)).toThrow(
      ActorNotAllowedError,
    );
    expect(() => transition(base({ status: 'payout_submitted' }), { type: 'PAYOUT_COMPLETED', providerRef: 'p' }, 'operator', NOW)).toThrow(
      ActorNotAllowedError,
    );
    expect(transition(base(), observed, 'provider', NOW).status).toBe('deposit_observed');
  });

  it('flags late, short and closed-order deposits as exceptions that can only be refunded', () => {
    expect(transition(base(), { ...observed, amountAtomic: 900n }, 'provider', NOW).patch.depositException).toBe('amount_mismatch');
    expect(transition(base(), observed, 'provider', NOW + 60_000).patch.depositException).toBe('late');
    expect(transition(base({ status: 'expired' }), observed, 'provider', NOW).patch.depositException).toBe('late');
    expect(transition(base({ status: 'cancelled' }), observed, 'provider', NOW).patch.depositException).toBe('order_closed');
    const s = base({ status: 'compliance_review', depositException: 'amount_mismatch', depositTxHash: '0xa' });
    expect(() => transition(s, { type: 'REVIEW_APPROVED', reason: 'ok' }, 'operator', NOW)).toThrow(/cannot be paid at the locked rate/);
    expect(transition(s, { type: 'ORDER_REJECTED', reason: 'mismatch' }, 'operator', NOW).status).toBe('refund_pending');
  });

  it('requires strictly increasing confirmations and the full count to confirm', () => {
    const s = base({ status: 'deposit_observed', depositTxHash: '0xa', confirmationsCount: 1 });
    expect(() => transition(s, { type: 'CONFIRMATIONS_UPDATED', confirmations: 1 }, 'provider', NOW)).toThrow(InvalidOrderTransitionError);
    expect(() => transition(s, { type: 'DEPOSIT_CONFIRMED', confirmations: 2 }, 'provider', NOW)).toThrow(/needs 3 confirmations/);
    expect(transition(s, { type: 'DEPOSIT_CONFIRMED', confirmations: 3 }, 'provider', NOW).status).toBe('deposit_confirmed');
  });

  it('routes confirmed deposits to review when flagged or above the threshold', () => {
    expect(postDepositEvent({ depositException: null, reviewReason: null }, { manualReviewRequired: null }).type).toBe('SCREENING_CLEARED');
    expect(postDepositEvent({ depositException: null, reviewReason: null }, { manualReviewRequired: 'big' })).toEqual({
      type: 'REVIEW_REQUIRED',
      reason: 'big',
    });
    expect(postDepositEvent({ depositException: 'late', reviewReason: null }, { manualReviewRequired: null }).type).toBe('REVIEW_REQUIRED');
    expect(() =>
      transition(base({ status: 'deposit_confirmed', reviewReason: 'x' }), { type: 'SCREENING_CLEARED' }, 'system', NOW),
    ).toThrow();
  });

  it('never lets an operator authorization complete a payout', () => {
    const s = base({ status: 'ready_for_payout', depositTxHash: '0xa' });
    expect(transition(s, { type: 'PAYOUT_AUTHORIZED', reason: 'ok' }, 'operator', NOW).status).toBe('ready_for_payout');
    expect(() => transition(s, { type: 'PAYOUT_SUBMITTED', providerRef: 'p', attempt: 1 }, 'operator', NOW)).toThrow(ActorNotAllowedError);
    const submitted = base({ status: 'payout_submitted', payoutProviderRef: 'p1' });
    expect(() => transition(submitted, { type: 'PAYOUT_COMPLETED', providerRef: 'other' }, 'provider', NOW)).toThrow(/does not match/);
    expect(transition(submitted, { type: 'PAYOUT_COMPLETED', providerRef: 'p1' }, 'provider', NOW).status).toBe('completed');
  });

  it('requires a reason to reject and refunds held funds', () => {
    expect(() => transition(base(), { type: 'ORDER_REJECTED', reason: '  ' }, 'operator', NOW)).toThrow(/needs a reason/);
    expect(transition(base(), { type: 'ORDER_REJECTED', reason: 'kyc' }, 'operator', NOW).status).toBe('rejected');
  });

  it('accepts nothing in terminal states', () => {
    const terminal: OrderStatus[] = ['completed', 'refunded'];
    for (const s of terminal) expect(allowedOrderEvents(s)).toEqual([]);
    // Every status is either listed in the table or terminal.
    for (const s of ORDER_STATUSES) expect(Array.isArray(allowedOrderEvents(s))).toBe(true);
  });

  it('builds the progress rail from persisted events only', () => {
    const steps = orderSteps(
      'confirming',
      [
        { type: 'ORDER_CREATED', toStatus: 'created', createdAt: 1, detail: '' },
        { type: 'DEPOSIT_OBSERVED', toStatus: 'deposit_observed', createdAt: 2, detail: '' },
      ],
      {
        count: 1,
        required: 3,
      },
    );
    expect(steps.find((s) => s.key === 'deposit')?.state).toBe('done');
    expect(steps.some((s) => s.key === 'paid' && s.state === 'done')).toBe(false);
  });
});

describe('buy orders', () => {
  it('use cash-and-crypto words for the same statuses and steps', () => {
    expect(orderStatusLabel('awaiting_deposit', 'buy')).toBe('Awaiting cash collection');
    expect(orderStatusLabel('awaiting_deposit')).toBe('Awaiting deposit');
    expect(orderStatusLabel('completed', 'buy')).toBe('Completed');
    const steps = orderSteps('awaiting_deposit', [], { count: 0, required: 1 }, 'buy');
    expect(steps.map((s) => s.label)).toEqual([
      'Request created',
      'Cash collected',
      'Cash counted and verified',
      'Crypto transfer submitted',
      'Completed',
    ]);
    expect(steps[1]!.state).toBe('current');
  });
});
