/**
 * Mock transaction service backed by browser storage. It enforces the same
 * rules a production backend must: ownership checks on every read and write,
 * server-side quote re-verification, expiry, screening, and state-machine
 * transitions only.
 */
import { REAL_MONEY_ENABLED } from '@/config/runtime';
import { NETWORKS } from '@/domain/assets';
import { PAYOUT_METHODS } from '@/domain/payout';
import { PRICING_POLICY, verifyQuote, type Quote } from '@/domain/quote';
import { canConfirmExchange } from '@/domain/identity';
import { applyEvent, type Transaction } from '@/domain/transaction';
import { validateRefundAddress } from '@/domain/validation';
import { readStore, writeStore } from '@/lib/storage';
import type { DepositMonitor, PayoutProvider, ScreeningProvider, TransactionService, VerificationLevel } from '../types';
import { delay, mockId, MockServiceError, type MockOptions } from './util';

const KEY = 'transactions';
const USED_QUOTES_KEY = 'used-quote-ids';

export function createMockTransactions(
  opts: MockOptions,
  deps: {
    deposits: DepositMonitor;
    screening: ScreeningProvider;
    payouts: PayoutProvider;
    priceAt: (asset: Quote['asset'], time: number) => bigint;
    verificationOf: (email: string) => VerificationLevel | null;
  },
): TransactionService {
  const saveAll = (list: Transaction[]) => writeStore(KEY, list);
  /** Loads transactions, expiring any whose deposit window has passed (what a server job would do). */
  const all = () => {
    const now = opts.now();
    let changed = false;
    const list = readStore<Transaction[]>(KEY, []).map((t) => {
      if (t.status !== 'awaiting_deposit' || now < t.depositDeadline) return t;
      changed = true;
      return applyEvent(t, { type: 'WINDOW_EXPIRED' }, t.depositDeadline);
    });
    if (changed) saveAll(list);
    return list;
  };

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

    async create({ quoteResult, destinationId, refundAddress, customerEmail }) {
      // Belt and braces: the mock never moves money, and refuses to pretend otherwise.
      if (REAL_MONEY_ENABLED) throw new MockServiceError('Mock services cannot run with real money enabled.', 'misconfigured');
      const now = opts.now();
      const verified = verifyQuote(quoteResult.quote, deps.priceAt, now);
      if ('error' in verified) {
        if (verified.error === 'expired')
          throw new MockServiceError('This quote has expired. Get a new quote to continue.', 'quote_expired');
        throw new MockServiceError('Quote verification failed. Get a new quote.', 'quote_tampered');
      }
      const { quote, issues } = verified;
      if (issues.length) throw new MockServiceError('This quote cannot be confirmed. Review the highlighted issues.', 'quote_issues');
      const level = deps.verificationOf(customerEmail);
      if (level === null) throw new MockServiceError('Sign in to continue.', 'unauthenticated');
      if (!canConfirmExchange(level)) throw new MockServiceError('Verify your identity before confirming an exchange.', 'kyc_required');
      const addressError = validateRefundAddress(refundAddress, quote.network);
      if (addressError) throw new MockServiceError(addressError, 'invalid_input');
      const [destinations, screening] = await Promise.all([
        deps.payouts.listDestinations(customerEmail),
        deps.screening.screenAddress(quote.network, refundAddress),
      ]);
      const destination = destinations.find((d) => d.id === destinationId);
      if (!destination) throw new MockServiceError('Choose a saved payout destination.', 'bad_destination');
      const used = readStore<string[]>(USED_QUOTES_KEY, []);
      if (used.includes(quote.id)) throw new MockServiceError('This quote has already been used. Get a new quote.', 'quote_reused');
      if (!destination.methods.includes(quote.payoutMethod))
        throw new MockServiceError(`That destination can't receive ${PAYOUT_METHODS[quote.payoutMethod].name} payouts.`, 'bad_destination');

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
        depositAmountAtomic: null,
        payoutReference: null,
        reviewReason: screening.result === 'review' ? 'Refund address requires manual screening review.' : null,
        log: [{ at: now, type: 'CREATED', status: 'awaiting_deposit', detail: 'Quote confirmed. Waiting for your deposit.' }],
      };
      // Record synchronously, before any await, so a double submit can't reuse the quote.
      writeStore(USED_QUOTES_KEY, [quote.id, ...used].slice(0, 500));
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
