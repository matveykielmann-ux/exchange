import { describe, expect, it } from 'vitest';
import { calculateQuote } from '../quote';
import { allowedEvents, applyEvent, InvalidTransitionError, timelineFor, type Transaction } from '../transaction';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  const { quote } = calculateQuote({
    asset: 'ETH',
    network: 'ethereum',
    payoutMethod: 'ach',
    amountAtomic: 10n ** 18n,
    referencePriceMicros: 3_000_000_000n,
    now: 0,
  });
  return {
    id: 'tx_test',
    source: 'mock',
    customerEmail: 'a@example.com',
    createdAt: 0,
    updatedAt: 0,
    status: 'awaiting_deposit',
    quote,
    destination: { method: 'ach', label: 'Checking', last4: '6789' },
    refundAddress: '0x52908400098527886E0F7030069857D2E4169EE7',
    depositAddress: 'MOCK-ETH-ETHEREUM-X-DO-NOT-SEND',
    depositDeadline: 1_800_000,
    confirmations: { count: 0, required: 12 },
    depositTxHash: null,
    depositAmountAtomic: null,
    payoutReference: null,
    reviewReason: null,
    log: [{ at: 0, type: 'CREATED', status: 'awaiting_deposit', detail: '' }],
    ...overrides,
  };
}

describe('transaction state machine', () => {
  it('walks the happy path to completed', () => {
    let tx = makeTx();
    tx = applyEvent(tx, { type: 'DEPOSIT_DETECTED', txHash: 'h', amountAtomic: tx.quote.amountAtomic }, 1);
    expect(tx.status).toBe('deposit_detected');
    tx = applyEvent(tx, { type: 'CONFIRMATION', count: 4 }, 2);
    expect(tx.status).toBe('confirming');
    tx = applyEvent(tx, { type: 'CONFIRMATION', count: 15 }, 3);
    expect(tx.status).toBe('payout_processing');
    expect(tx.confirmations.count).toBe(12); // clamped to required
    tx = applyEvent(tx, { type: 'PAYOUT_SETTLED', reference: 'R1' }, 4);
    expect(tx.status).toBe('completed');
    expect(tx.payoutReference).toBe('R1');
    expect(tx.log).toHaveLength(5);
    expect(allowedEvents('completed')).toEqual([]);
  });

  it('refuses impossible transitions', () => {
    const tx = makeTx();
    expect(() => applyEvent(tx, { type: 'PAYOUT_SETTLED', reference: 'x' }, 1)).toThrow(InvalidTransitionError);
    const done = makeTx({ status: 'completed' });
    expect(() => applyEvent(done, { type: 'CUSTOMER_CANCELLED' }, 1)).toThrow(InvalidTransitionError);
    const confirming = makeTx({ status: 'confirming', depositTxHash: 'h' });
    expect(() => applyEvent(confirming, { type: 'CUSTOMER_CANCELLED' }, 1)).toThrow(/not allowed/);
  });

  it('handles review hold, rejection and refund', () => {
    let tx = makeTx({ status: 'payout_processing', depositTxHash: 'h', confirmations: { count: 12, required: 12 } });
    tx = applyEvent(tx, { type: 'REVIEW_REQUIRED', reason: 'r' }, 1);
    expect(tx.status).toBe('compliance_review');
    tx = applyEvent(tx, { type: 'REVIEW_REJECTED', reason: 'r' }, 2);
    expect(tx.status).toBe('refund_pending');
    tx = applyEvent(tx, { type: 'REFUND_SENT', txHash: 'rf' }, 3);
    expect(tx.status).toBe('refunded');
    expect(timelineFor(tx).find((s) => s.key === 'refund')?.state).toBe('done');
  });

  it('supports payout failure and retry', () => {
    let tx = makeTx({ status: 'payout_processing', depositTxHash: 'h', confirmations: { count: 12, required: 12 } });
    tx = applyEvent(tx, { type: 'PAYOUT_FAILED', reason: 'returned' }, 1);
    expect(timelineFor(tx).find((s) => s.key === 'payout')?.state).toBe('failed');
    tx = applyEvent(tx, { type: 'RETRY_PAYOUT' }, 2);
    expect(tx.status).toBe('payout_processing');
  });

  it('never pays out a late or mismatched deposit at the locked rate', () => {
    const tx = makeTx();
    expect(applyEvent(tx, { type: 'DEPOSIT_DETECTED', txHash: 'h', amountAtomic: 1n }, 1).status).toBe('refund_pending');
    expect(applyEvent(tx, { type: 'DEPOSIT_DETECTED', txHash: 'h', amountAtomic: tx.quote.amountAtomic }, tx.depositDeadline).status).toBe(
      'refund_pending',
    );
    const expired = applyEvent(tx, { type: 'WINDOW_EXPIRED' }, 1);
    expect(applyEvent(expired, { type: 'DEPOSIT_DETECTED', txHash: 'h', amountAtomic: tx.quote.amountAtomic }, 2).status).toBe(
      'refund_pending',
    );
  });

  it('only accepts increasing confirmation counts', () => {
    const tx = makeTx({ status: 'confirming', depositTxHash: 'h', confirmations: { count: 5, required: 12 } });
    expect(() => applyEvent(tx, { type: 'CONFIRMATION', count: 5 }, 1)).toThrow(InvalidTransitionError);
    expect(() => applyEvent(tx, { type: 'CONFIRMATION', count: 3 }, 1)).toThrow(InvalidTransitionError);
  });

  it('holds flagged transactions for review before payout', () => {
    const tx = makeTx({ status: 'confirming', depositTxHash: 'h', confirmations: { count: 5, required: 12 }, reviewReason: 'flag' });
    const held = applyEvent(tx, { type: 'CONFIRMATION', count: 12 }, 1);
    expect(held.status).toBe('compliance_review');
    expect(() => applyEvent(held, { type: 'PAYOUT_SETTLED', reference: 'x' }, 2)).toThrow(InvalidTransitionError);
    const cleared = applyEvent(held, { type: 'REVIEW_CLEARED' }, 2);
    expect(cleared.status).toBe('payout_processing');
    expect(cleared.reviewReason).toBeNull();
  });

  it('expires or cancels only before a deposit', () => {
    expect(applyEvent(makeTx(), { type: 'WINDOW_EXPIRED' }, 1).status).toBe('expired');
    const cancelled = applyEvent(makeTx(), { type: 'CUSTOMER_CANCELLED' }, 1);
    expect(cancelled.status).toBe('cancelled');
    expect(timelineFor(cancelled).find((s) => s.key === 'deposit')?.state).toBe('failed');
  });
});
