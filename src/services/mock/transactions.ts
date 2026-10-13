/**
 * Mock transaction service backed by browser storage. It enforces the same
 * rules a production backend must: ownership checks on every read and write,
 * server-side quote re-verification, expiry, screening, and state-machine
 * transitions only.
 */
import { REAL_MONEY_ENABLED } from '@/config/runtime';
import { NETWORKS } from '@/domain/assets';
import { PAYOUT_METHODS } from '@/domain/payout';
import { calculateQuote, isQuoteExpired, PRICING_POLICY, type Quote } from '@/domain/quote';
import { applyEvent, type Transaction } from '@/domain/transaction';
import { validateRefundAddress } from '@/domain/validation';
import { readStore, writeStore } from '@/lib/storage';
import type { DepositMonitor, ScreeningProvider, TransactionService } from '../types';
import { delay, mockId, MockServiceError, type MockOptions } from './util';

const KEY = 'transactions';

/** Recomputes a quote from its own inputs; any mismatch means it was altered. */
export function verifyQuoteIntegrity(quote: Quote): boolean {
  const { quote: recomputed } = calculateQuote({
    asset: quote.asset,
    network: quote.network,
    amountAtomic: quote.amountAtomic,
    payoutMethod: quote.payoutMethod,
    referencePriceMicros: quote.referencePriceMicros,
    now: quote.createdAt,
  });
  return (
    recomputed.grossCents === quote.grossCents &&
    recomputed.spreadCents === quote.spreadCents &&
    recomputed.payoutFeeCents === quote.payoutFeeCents &&
    recomputed.netCents === quote.netCents &&
    recomputed.spreadBps === quote.spreadBps &&
    quote.expiresAt - quote.createdAt === PRICING_POLICY.quoteTtlMs
  );
}

export function createMockTransactions(
  opts: MockOptions,
  deps: { deposits: DepositMonitor; screening: ScreeningProvider },
): TransactionService {
  const all = () => readStore<Transaction[]>(KEY, []);
  const saveAll = (list: Transaction[]) => writeStore(KEY, list);

  return {
    list(email) {
      return delay(opts, () =>
        all()
          .filter((t) => t.customerEmail === email)
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    },

    get(id, email) {
      return delay(opts, () => all().find((t) => t.id === id && t.customerEmail === email) ?? null);
    },

    async create({ quoteResult, destination, refundAddress, customerEmail }) {
      // Belt and braces: the mock never moves money, and refuses to pretend otherwise.
      if (REAL_MONEY_ENABLED) throw new MockServiceError('Mock services cannot run with real money enabled.', 'misconfigured');
      const { quote, issues } = quoteResult;
      const now = opts.now();
      if (issues.length) throw new MockServiceError('This quote cannot be confirmed. Review the highlighted issues.', 'quote_issues');
      if (isQuoteExpired(quote, now)) throw new MockServiceError('This quote has expired. Get a new quote to continue.', 'quote_expired');
      if (!verifyQuoteIntegrity(quote)) throw new MockServiceError('Quote verification failed. Get a new quote.', 'quote_tampered');
      if (!destination.methods.includes(quote.payoutMethod))
        throw new MockServiceError(`That destination can't receive ${PAYOUT_METHODS[quote.payoutMethod].name} payouts.`, 'bad_destination');
      const addressError = validateRefundAddress(refundAddress, quote.network);
      if (addressError) throw new MockServiceError(addressError, 'invalid_input');

      const screening = await deps.screening.screenAddress(quote.network, refundAddress);
      if (screening.result === 'blocked') throw new MockServiceError('We can’t process this exchange.', 'screening_blocked');

      const tx: Transaction = {
        id: `tx_${mockId(opts, 10).toLowerCase()}`,
        source: 'mock',
        customerEmail,
        createdAt: now,
        updatedAt: now,
        status: 'awaiting_deposit',
        quote,
        destination: { method: quote.payoutMethod, label: destination.label, last4: destination.last4 },
        refundAddress: refundAddress.trim(),
        depositAddress: deps.deposits.createDepositAddress(quote.asset, quote.network),
        depositDeadline: now + PRICING_POLICY.depositWindowMs,
        confirmations: { count: 0, required: NETWORKS[quote.network].confirmationsRequired },
        depositTxHash: null,
        payoutReference: null,
        reviewReason: screening.result === 'review' ? 'Refund address requires manual screening review.' : null,
        log: [{ at: now, type: 'CREATED', status: 'awaiting_deposit', detail: 'Quote confirmed. Waiting for your deposit.' }],
      };
      return delay(opts, () => {
        saveAll([tx, ...all()]);
        return tx;
      });
    },

    dispatch(id, email, event) {
      return delay(opts, () => {
        const list = all();
        const idx = list.findIndex((t) => t.id === id && t.customerEmail === email);
        const current = list[idx];
        if (!current) throw new MockServiceError('Transaction not found.', 'not_found');
        const next = applyEvent(current, event, opts.now());
        list[idx] = next;
        saveAll(list);
        return next;
      });
    },
  };
}
