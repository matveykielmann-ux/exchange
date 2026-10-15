/**
 * Deterministic sandbox scenarios. Each one drives the real services (the
 * same code the HTTP API calls) through a complete lifecycle with a fixed
 * clock and signed sandbox webhooks, and checks the final state. Used by
 * `pnpm server:scenarios` for QA and by the server test suite.
 */
import { LEGAL_DOCUMENTS } from '@/content/legal';
import type { OrderStatus } from '@/domain/order';
import type { PayoutMethodId } from '@/domain/payout';
import type { AssetCode, NetworkId } from '@/domain/assets';
import type { Actor, AppContext } from './context';
import { SANDBOX_FIXTURES } from './providers/sandbox';
import { createAccount, requiredSignupDocuments, signUp } from './services/auth';
import { addBankAccount, addCard, addCourierAddress, startVerification, updateProfile } from './services/customers';
import * as ops from './services/operations';
import { cancelOrder, createOrder, expireOverdueOrders, getOrderRow, reportSent } from './services/orders';
import { firmQuote } from './services/quotes';
import * as sandbox from './services/sandbox';
import { verifyAuditChain } from './services/audit';
import { ApiError } from './http/errors';
import { PRICING_POLICY } from '@/domain/quote';

export const ORDER_DOCS = () => LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'order').map((d) => ({ slug: d.slug, version: d.version }));
/** Password for every account the scenarios and the sandbox seed create. Sandbox databases only. */
export const SANDBOX_PASSWORD = 'sandbox-pass-2026';
export const TEST_ETH_ADDRESS = '0x52908400098527886E0F7030069857D2E4169EE7';
const meta = { ip: '127.0.0.1', userAgent: 'scenario-runner' };

export interface ScenarioCustomer {
  userId: string;
  actor: Actor;
  bankId: string;
  cardId: string;
}

/** Signs up, verifies and adds a bank account and a test card. */
export async function sandboxCustomer(ctx: AppContext, email: string, fullName = 'Alex Morgan'): Promise<ScenarioCustomer> {
  const { userId } = await signUp(
    ctx,
    {
      email,
      password: SANDBOX_PASSWORD,
      fullName,
      countryOfResidence: 'US',
      stateOfResidence: 'NY',
      notInRestrictedTerritory: true,
      accepted: requiredSignupDocuments(),
    },
    meta,
  );
  const actor: Actor = { type: 'customer', id: userId, role: 'customer', ip: meta.ip };
  updateProfile(ctx, actor, userId, { stateOfResidence: 'NY' });
  await startVerification(ctx, actor, userId);
  const bank = addBankAccount(ctx, actor, userId, {
    label: 'Checking',
    routingNumber: '021000021',
    accountNumber: '000123456789',
    accountType: 'checking',
  });
  const card = await addCard(ctx, actor, userId, 'Test debit card');
  return { userId, actor, bankId: bank.id, cardId: card.id };
}

export async function sandboxOperator(
  ctx: AppContext,
  email: string,
  role: 'support' | 'reviewer' | 'admin' | 'owner' = 'admin',
): Promise<Actor> {
  const id = await createAccount(ctx, { email, password: SANDBOX_PASSWORD, role, fullName: `Sandbox ${role}` });
  return { type: 'operator', id, role, ip: meta.ip };
}

export async function placeOrder(
  ctx: AppContext,
  c: ScenarioCustomer,
  opts: {
    asset?: AssetCode;
    network?: NetworkId;
    amountAtomic?: bigint;
    method?: PayoutMethodId;
    /** null: no refund address up front, as in the web app; it is asked for if a refund is needed. */
    refundAddress?: string | null;
    destinationId?: string;
  } = {},
) {
  const method = opts.method ?? 'ach';
  const { quote } = await firmQuote(ctx, c.userId, {
    asset: opts.asset ?? 'USDC',
    network: opts.network ?? 'ethereum',
    amountAtomic: opts.amountAtomic ?? 2_500_000_000n,
    payoutMethod: method,
  });
  return createOrder(ctx, c.actor, c.userId, {
    quoteId: quote.id,
    destinationId: opts.destinationId ?? (method === 'instant_debit' ? c.cardId : c.bankId),
    refundAddress: opts.refundAddress === undefined ? TEST_ETH_ADDRESS : opts.refundAddress,
    accepted: ORDER_DOCS(),
  });
}

export interface ScenarioResult {
  name: string;
  description: string;
  ok: boolean;
  finalStatus: OrderStatus | null;
  expected: OrderStatus | string;
  steps: string[];
  error?: string;
}

type Step = (msg: string) => void;
interface Scenario {
  name: string;
  description: string;
  expected: OrderStatus | string;
  run(ctx: AppContext, op: Actor, step: Step, n: number): Promise<OrderStatus | string>;
}

const status = (ctx: AppContext, id: string) => getOrderRow(ctx, id).status;

export const SCENARIOS: Scenario[] = [
  {
    name: 'happy-path-ach',
    description: 'Deposit observed, confirmed, screened, payout authorized, provider completes it.',
    expected: 'completed',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `happy${n}@example.test`);
      const o = await placeOrder(ctx, c);
      step(`order ${o.reference} ${status(ctx, o.id)}`);
      reportSent(ctx, c.actor, c.userId, o.id, '0x' + 'ab'.repeat(32));
      step(`customer submitted a tx hash for review: still ${status(ctx, o.id)}`);
      sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      step(`deposit observed: ${status(ctx, o.id)}`);
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      step(`confirmed and screened: ${status(ctx, o.id)}`);
      await ops.authorizePayout(ctx, op, o.id, 'Checks passed; releasing payout.');
      step(`payout authorized: ${status(ctx, o.id)}`);
      sandbox.simulatePayout(ctx, op, o.id, 'processing');
      sandbox.simulatePayout(ctx, op, o.id, 'completed');
      return status(ctx, o.id);
    },
  },
  {
    name: 'courier-cash',
    description: 'Cash by courier: delivery address checked with the carrier, payout to the courier, delivery confirmed by its webhook.',
    expected: 'completed',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `courier${n}@example.test`);
      const address = {
        phone: '212-555-0142',
        line1: '200 Example Street',
        line2: '',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        window: 'any' as const,
        preferredDate: '',
        instructions: '',
      };
      try {
        await addCourierAddress(ctx, c.actor, c.userId, { ...address, zip: `${SANDBOX_FIXTURES.courierUnavailableZipPrefix}01` });
        throw new Error('An address outside the courier area was accepted.');
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        step(`outside the area refused: ${e.message}`);
      }
      const dest = await addCourierAddress(ctx, c.actor, c.userId, address);
      step(`delivery address saved: ${dest.label}`);
      const o = await placeOrder(ctx, c, { method: 'courier_cash', destinationId: dest.id });
      sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      await ops.authorizePayout(ctx, op, o.id, 'Checks passed; courier delivery booked with the carrier.');
      step(`courier scheduled: ${status(ctx, o.id)}`);
      sandbox.simulatePayout(ctx, op, o.id, 'processing');
      sandbox.simulatePayout(ctx, op, o.id, 'completed');
      const provider = ctx.db.get<{ provider: string }>('SELECT provider FROM payout_instructions WHERE order_id = ?', [o.id])!.provider;
      if (provider !== 'cash') throw new Error(`Courier payout went to ${provider}.`);
      return status(ctx, o.id);
    },
  },
  {
    name: 'buy-with-cash',
    description:
      'Cash → crypto: courier collects the cash (signed cash events), operator authorizes, custody sends the crypto (signed custody events).',
    expected: 'completed',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `buyer${n}@example.test`);
      const dest = await addCourierAddress(ctx, c.actor, c.userId, {
        phone: '212-555-0142',
        line1: '200 Example Street',
        line2: '',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        window: 'any',
        preferredDate: '',
        instructions: '',
      });
      const { quote } = await firmQuote(ctx, c.userId, { direction: 'buy', asset: 'USDT', network: 'tron', cashCents: 1_000_00n });
      const o = await createOrder(ctx, c.actor, c.userId, {
        quoteId: quote.id,
        destinationId: dest.id,
        receiveAddress: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
        accepted: ORDER_DOCS(),
      });
      step(`buy order ${o.reference} ${status(ctx, o.id)}`);
      sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      step(`cash collected: ${status(ctx, o.id)}`);
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      step(`cash counted and screened: ${status(ctx, o.id)}`);
      await ops.authorizePayout(ctx, op, o.id, 'Cash verified; sending crypto.');
      sandbox.simulatePayout(ctx, op, o.id, 'processing');
      sandbox.simulatePayout(ctx, op, o.id, 'completed');
      const pi = ctx.db.get<{ provider: string; method: string }>('SELECT provider, method FROM payout_instructions WHERE order_id = ?', [
        o.id,
      ])!;
      if (pi.provider !== 'custody' || pi.method !== 'crypto_transfer')
        throw new Error(`Buy transfer went to ${pi.provider}/${pi.method}.`);
      return status(ctx, o.id);
    },
  },
  {
    name: 'duplicate-webhook',
    description: 'The same signed deposit event is delivered twice; the second is ignored.',
    expected: 'deposit_observed',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `dup${n}@example.test`);
      const o = await placeOrder(ctx, c);
      const first = sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      const again = sandbox.replayLastWebhook(ctx, op, o.id);
      step(`first delivery ${first.status}, replay ${again.status}`);
      if (again.status !== 'duplicate') throw new Error('Replay was not treated as a duplicate.');
      const events = ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM order_events WHERE order_id = ? AND type = 'DEPOSIT_OBSERVED'", [
        o.id,
      ])!.n;
      step(`DEPOSIT_OBSERVED events recorded: ${events}`);
      if (events !== 1) throw new Error('Duplicate delivery created a second event.');
      return status(ctx, o.id);
    },
  },
  {
    name: 'large-amount-review',
    description: 'An order above the manual-review threshold waits for a reviewer before payout.',
    expected: 'completed',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `large${n}@example.test`);
      const o = await placeOrder(ctx, c, { amountAtomic: 12_000_000_000n, method: 'wire' });
      sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      step(`after confirmation: ${status(ctx, o.id)}`);
      ops.addNote(ctx, op, o.id, 'Source of funds reviewed in sandbox.');
      ops.approveReview(ctx, op, o.id, 'Source of funds reviewed.');
      step(`approved: ${status(ctx, o.id)}`);
      await ops.authorizePayout(ctx, op, o.id, 'Approved by review.');
      sandbox.simulatePayout(ctx, op, o.id, 'completed');
      return status(ctx, o.id);
    },
  },
  {
    name: 'payout-failure-retry',
    description: 'The provider returns the payout; an operator retries and it completes.',
    expected: 'completed',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `retry${n}@example.test`);
      const o = await placeOrder(ctx, c);
      sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      await ops.authorizePayout(ctx, op, o.id, 'Checks passed.');
      sandbox.simulatePayout(ctx, op, o.id, 'failed');
      step(`provider returned payout: ${status(ctx, o.id)}`);
      ops.retryPayout(ctx, op, o.id, 'Customer confirmed the account is open.');
      await ops.authorizePayout(ctx, op, o.id, 'Second attempt.');
      sandbox.simulatePayout(ctx, op, o.id, 'completed');
      const attempts = ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM payout_instructions WHERE order_id = ?', [o.id])!.n;
      step(`payout attempts: ${attempts}`);
      return status(ctx, o.id);
    },
  },
  {
    name: 'payout-declined-refund',
    description: 'The payout provider declines the destination; the deposit is refunded.',
    expected: 'refunded',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `decline${n}@example.test`, `Jamie ${SANDBOX_FIXTURES.payoutDeclineWord}`);
      const o = await placeOrder(ctx, c);
      sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      await ops.authorizePayout(ctx, op, o.id, 'Checks passed.');
      step(`provider declined: ${status(ctx, o.id)}`);
      await ops.initiateRefund(ctx, op, o.id, 'Payout destination declined; returning deposit.');
      step(`refund started: ${status(ctx, o.id)}`);
      sandbox.simulateRefundCompleted(ctx, op, o.id);
      return status(ctx, o.id);
    },
  },
  {
    name: 'short-deposit-refund',
    description: 'A deposit of a different amount is never paid at the locked rate; it is reviewed and refunded.',
    expected: 'refunded',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `short${n}@example.test`);
      const o = await placeOrder(ctx, c);
      sandbox.simulateDeposit(ctx, op, o.id, 'short');
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      step(`after confirmation: ${status(ctx, o.id)}`);
      try {
        ops.approveReview(ctx, op, o.id, 'Trying to approve a mismatched deposit.');
        throw new Error('A mismatched deposit was approved.');
      } catch (e) {
        if (!(e instanceof Error) || !/cannot be paid at the locked rate/.test(e.message)) throw e;
        step('approval refused: mismatched deposits can only be refunded');
      }
      await ops.rejectOrder(ctx, op, o.id, 'Deposit amount differs from the quote.');
      sandbox.simulateRefundCompleted(ctx, op, o.id);
      return status(ctx, o.id);
    },
  },
  {
    name: 'late-deposit-refund',
    description: 'A deposit after the window closes is flagged late, reviewed and refunded.',
    expected: 'refunded',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `late${n}@example.test`);
      const o = await placeOrder(ctx, c);
      sandbox.simulateDeposit(ctx, op, o.id, 'late');
      step(`late deposit: ${status(ctx, o.id)} (${getOrderRow(ctx, o.id).deposit_exception})`);
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      await ops.rejectOrder(ctx, op, o.id, 'Deposit arrived after the window closed.');
      sandbox.simulateRefundCompleted(ctx, op, o.id);
      return status(ctx, o.id);
    },
  },
  {
    name: 'refund-address-later',
    description:
      'An order placed without a refund address is rejected after the deposit; the refund waits for the address, then completes.',
    expected: 'refunded',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `later${n}@example.test`);
      const o = await placeOrder(ctx, c, { refundAddress: null });
      sandbox.simulateDeposit(ctx, op, o.id, 'exact');
      sandbox.simulateConfirmations(ctx, op, o.id, { toFinal: true });
      await ops.rejectOrder(ctx, op, o.id, 'Checks not passed.');
      const waiting = ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM refunds WHERE order_id = ?', [o.id])!.n;
      if (waiting !== 0) throw new Error('A refund was submitted without a refund address.');
      step(`after rejection: ${status(ctx, o.id)}, waiting for the refund address`);
      await ops.setRefundAddress(ctx, c.actor, c.userId, o.id, TEST_ETH_ADDRESS);
      step('refund address given, screened and the refund submitted');
      sandbox.simulateRefundCompleted(ctx, op, o.id);
      return status(ctx, o.id);
    },
  },
  {
    name: 'expired-window',
    description: 'No deposit before the deadline: the background job expires the order.',
    expected: 'expired',
    async run(ctx, _op, step, n) {
      const c = await sandboxCustomer(ctx, `expire${n}@example.test`);
      const o = await placeOrder(ctx, c);
      const clock = ctx.clock as AppContext['clock'] & { advance?: (ms: number) => void };
      if (!clock.advance) throw new Error('Scenario needs a controllable clock.');
      clock.advance(PRICING_POLICY.depositWindowMs + 1_000);
      step(`expired by job: ${expireOverdueOrders(ctx)} order(s)`);
      return status(ctx, o.id);
    },
  },
  {
    name: 'expired-quote',
    description: 'A firm quote cannot be accepted after it expires.',
    expected: 'quote_expired',
    async run(ctx, _op, step, n) {
      const c = await sandboxCustomer(ctx, `quote${n}@example.test`);
      const { quote } = await firmQuote(ctx, c.userId, {
        asset: 'ETH',
        network: 'ethereum',
        amountAtomic: 1_000_000_000_000_000_000n,
        payoutMethod: 'ach',
      });
      (ctx.clock as unknown as { advance(ms: number): void }).advance(PRICING_POLICY.quoteTtlMs + 1);
      try {
        await createOrder(ctx, c.actor, c.userId, {
          quoteId: quote.id,
          destinationId: c.bankId,
          refundAddress: TEST_ETH_ADDRESS,
          accepted: ORDER_DOCS(),
        });
      } catch (e) {
        if (e instanceof ApiError) {
          step(`refused: ${e.message}`);
          return e.code;
        }
        throw e;
      }
      return 'accepted';
    },
  },
  {
    name: 'customer-cancel',
    description: 'The customer cancels before sending funds.',
    expected: 'cancelled',
    async run(ctx, _op, _step, n) {
      const c = await sandboxCustomer(ctx, `cancel${n}@example.test`);
      const o = await placeOrder(ctx, c);
      return cancelOrder(ctx, c.actor, c.userId, o.id).status;
    },
  },
  {
    name: 'rejected-request',
    description: 'A reviewer rejects a flagged order before any deposit arrives.',
    expected: 'rejected',
    async run(ctx, op, step, n) {
      const c = await sandboxCustomer(ctx, `reject${n}@example.test`);
      const o = await placeOrder(ctx, c, { refundAddress: SANDBOX_FIXTURES.reviewAddress });
      step(`screening flagged the refund address: review reason "${getOrderRow(ctx, o.id).review_reason}"`);
      await ops.rejectOrder(ctx, op, o.id, 'Refund address failed screening review.');
      return status(ctx, o.id);
    },
  },
  {
    name: 'kyc-rejected',
    description: 'Identity verification rejects the customer; no order can be created.',
    expected: 'kyc_required',
    async run(ctx, _op, step, n) {
      try {
        const c = await sandboxCustomer(ctx, `kyc${n}@example.test`, `Pat ${SANDBOX_FIXTURES.kycRejectWord}`);
        await placeOrder(ctx, c);
      } catch (e) {
        if (e instanceof ApiError) {
          step(`refused: ${e.message}`);
          return e.code;
        }
        throw e;
      }
      return 'accepted';
    },
  },
];

/** Runs scenarios against `ctx` (which must be a sandbox context with a controllable clock). */
export async function runScenarios(ctx: AppContext, only?: string[]): Promise<ScenarioResult[]> {
  if (ctx.config.mode !== 'sandbox') throw new Error('Scenarios run only in sandbox mode.');
  const op = await sandboxOperator(ctx, `scenario-operator-${ctx.clock.now()}@example.test`, 'admin');
  const results: ScenarioResult[] = [];
  let n = 0;
  for (const s of SCENARIOS) {
    if (only?.length && !only.includes(s.name)) continue;
    n++;
    const steps: string[] = [];
    try {
      const final = await s.run(ctx, op, (m) => steps.push(m), n);
      results.push({
        name: s.name,
        description: s.description,
        ok: final === s.expected,
        finalStatus: final as OrderStatus,
        expected: s.expected,
        steps,
      });
    } catch (e) {
      results.push({
        name: s.name,
        description: s.description,
        ok: false,
        finalStatus: null,
        expected: s.expected,
        steps,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  const chain = verifyAuditChain(ctx);
  results.push({
    name: 'audit-chain',
    description: 'The append-only audit log hash chain verifies end to end.',
    ok: chain.ok,
    finalStatus: null,
    expected: 'intact',
    steps: [chain.ok ? `${chain.count} audit events verified` : `chain broken at ${chain.brokenAtId}`],
  });
  return results;
}
