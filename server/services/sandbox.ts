/**
 * Sandbox simulator: stands in for the blockchain and the payout provider.
 * Every simulated outcome is a provider event signed with the sandbox webhook
 * secret and pushed through `ingestWebhook` — the same path, signature check,
 * idempotency and state machine a real provider callback uses. Routes that
 * call this module are only registered in sandbox mode, and each function
 * re-checks the mode.
 */
import type { Actor, AppContext } from '../context';
import { ApiError, conflict, notFound } from '../http/errors';
import { jsonStringify } from '../http/router';
import { signWebhook } from '../providers/signature';
import type { ProviderEvent, WebhookSource } from '../providers/types';
import { audit } from './audit';
import { applyOrderEvent, getOrderRow } from './orders';
import { ingestWebhook, type WebhookOutcome } from './webhooks';

export type DepositScenario = 'exact' | 'short' | 'late';
export type PayoutOutcome = 'processing' | 'completed' | 'failed';

function assertSandbox(ctx: AppContext) {
  if (ctx.config.mode !== 'sandbox') throw new ApiError(404, 'not_found', 'No such endpoint.');
}

function nextEventId(ctx: AppContext, kind: string, key: string) {
  const n = ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM provider_webhook_events WHERE event_id LIKE ?', [
    `sbx_${kind}_${key}_%`,
  ])!.n;
  return `sbx_${kind}_${key}_${n + 1}`;
}

/** Signs and delivers one event through the webhook pipeline. */
export function deliver(
  ctx: AppContext,
  source: WebhookSource,
  event: Omit<ProviderEvent, 'created'> & { created?: number },
): WebhookOutcome {
  assertSandbox(ctx);
  const body = jsonStringify({ ...event, created: event.created ?? Math.floor(ctx.clock.now() / 1000) });
  return ingestWebhook(ctx, source, signWebhook(ctx.config.sandbox.webhookSecret, body, ctx.clock.now()), Buffer.from(body), {
    sandbox: true,
  });
}

function txHash(orderId: string, kind: string) {
  return `sbx_${kind}_${orderId.replace(/^ord_/, '')}`;
}

export function simulateDeposit(ctx: AppContext, actor: Actor, orderId: string, scenario: DepositScenario): WebhookOutcome {
  assertSandbox(ctx);
  const o = getOrderRow(ctx, orderId);
  if (scenario === 'late' && o.status === 'awaiting_deposit') {
    // Close the window first so the deposit arrives after the deadline.
    applyOrderEvent(ctx, orderId, { type: 'DEPOSIT_WINDOW_EXPIRED' }, { type: 'system', id: null, role: null, ip: null });
  }
  const amount = scenario === 'short' ? (BigInt(o.amount_atomic) * 9n) / 10n : BigInt(o.amount_atomic);
  audit(ctx, { ...actor, type: 'sandbox' }, { action: 'sandbox.deposit', targetType: 'order', targetId: orderId, data: { scenario } });
  return deliver(ctx, 'custody', {
    id: nextEventId(ctx, 'dep', orderId),
    type: 'deposit.observed',
    data: { orderId, txHash: txHash(orderId, 'tx'), amountAtomic: amount.toString(), confirmations: 0 },
  });
}

/** Adds confirmations in deterministic steps (a third of the requirement); the last step reports the deposit as confirmed. */
export function simulateConfirmations(ctx: AppContext, actor: Actor, orderId: string, { toFinal = false } = {}): WebhookOutcome[] {
  assertSandbox(ctx);
  const outcomes: WebhookOutcome[] = [];
  audit(ctx, { ...actor, type: 'sandbox' }, { action: 'sandbox.confirmations', targetType: 'order', targetId: orderId, data: { toFinal } });
  for (let guard = 0; guard < 100; guard++) {
    const o = getOrderRow(ctx, orderId);
    if (o.status !== 'deposit_observed' && o.status !== 'confirming') {
      if (!outcomes.length)
        throw conflict(`Confirmations apply only after a deposit is observed (order is ${o.status}).`, 'invalid_transition');
      break;
    }
    const step = Math.max(1, Math.ceil(o.confirmations_required / 3));
    const next = Math.min(o.confirmations_count + step, o.confirmations_required);
    outcomes.push(
      next >= o.confirmations_required
        ? deliver(ctx, 'custody', {
            id: nextEventId(ctx, 'cnf', orderId),
            type: 'deposit.confirmed',
            data: { orderId, confirmations: next },
          })
        : deliver(ctx, 'custody', {
            id: nextEventId(ctx, 'cnt', orderId),
            type: 'deposit.confirmations',
            data: { orderId, confirmations: next },
          }),
    );
    if (!toFinal) break;
  }
  return outcomes;
}

export function simulatePayout(ctx: AppContext, actor: Actor, orderId: string, outcome: PayoutOutcome, reason?: string): WebhookOutcome {
  assertSandbox(ctx);
  const o = getOrderRow(ctx, orderId);
  const pi = ctx.db.get<{ provider: WebhookSource; provider_ref: string | null }>(
    'SELECT provider, provider_ref FROM payout_instructions WHERE order_id = ? AND provider_ref IS NOT NULL ORDER BY attempt DESC LIMIT 1',
    [orderId],
  );
  if (!pi?.provider_ref)
    throw conflict(
      `No payout has been submitted to the provider for this order (it is ${o.status}). Authorize the payout first.`,
      'invalid_transition',
    );
  audit(ctx, { ...actor, type: 'sandbox' }, { action: 'sandbox.payout', targetType: 'order', targetId: orderId, data: { outcome } });
  const id = nextEventId(ctx, 'po', orderId);
  if (outcome === 'failed')
    return deliver(ctx, pi.provider, {
      id,
      type: 'payout.failed',
      data: { providerRef: pi.provider_ref, reason: reason ?? 'Sandbox: receiving bank returned the payment (account closed).' },
    });
  return deliver(ctx, pi.provider, {
    id,
    type: outcome === 'processing' ? 'payout.processing' : 'payout.completed',
    data: { providerRef: pi.provider_ref },
  });
}

export function simulateRefundCompleted(ctx: AppContext, actor: Actor, orderId: string): WebhookOutcome {
  assertSandbox(ctx);
  const o = getOrderRow(ctx, orderId);
  const r = ctx.db.get<{ status: string }>('SELECT status FROM refunds WHERE order_id = ?', [orderId]);
  if (o.status !== 'refund_pending' || r?.status !== 'submitted')
    throw conflict('No refund has been submitted to the provider for this order.', 'invalid_transition');
  audit(ctx, { ...actor, type: 'sandbox' }, { action: 'sandbox.refund_completed', targetType: 'order', targetId: orderId });
  return deliver(ctx, 'custody', {
    id: nextEventId(ctx, 'rfd', orderId),
    type: 'refund.completed',
    data: { orderId, txHash: txHash(orderId, 'refund') },
  });
}

/** Re-delivers the most recent webhook for an order exactly as before (fresh signature, same event id) to exercise idempotency. */
export function replayLastWebhook(ctx: AppContext, actor: Actor, orderId: string): WebhookOutcome {
  assertSandbox(ctx);
  getOrderRow(ctx, orderId);
  const payoutRef = ctx.db.get<{ provider_ref: string }>(
    'SELECT provider_ref FROM payout_instructions WHERE order_id = ? AND provider_ref IS NOT NULL ORDER BY attempt DESC LIMIT 1',
    [orderId],
  );
  const pick = ctx.db.get<{ provider: WebhookSource; payload: string }>(
    'SELECT provider, payload FROM provider_webhook_events WHERE payload LIKE ? OR payload LIKE ? ORDER BY received_at DESC, rowid DESC LIMIT 1',
    [`%${orderId}%`, payoutRef ? `%${payoutRef.provider_ref}%` : orderId],
  );
  if (!pick) throw notFound('No webhook has been delivered for this order yet.');
  audit(ctx, { ...actor, type: 'sandbox' }, { action: 'sandbox.replay_webhook', targetType: 'order', targetId: orderId });
  return ingestWebhook(
    ctx,
    pick.provider,
    signWebhook(ctx.config.sandbox.webhookSecret, pick.payload, ctx.clock.now()),
    Buffer.from(pick.payload),
    { sandbox: true },
  );
}

export function forceExpire(ctx: AppContext, actor: Actor, orderId: string) {
  assertSandbox(ctx);
  audit(ctx, { ...actor, type: 'sandbox' }, { action: 'sandbox.force_expire', targetType: 'order', targetId: orderId });
  return applyOrderEvent(
    ctx,
    orderId,
    { type: 'DEPOSIT_WINDOW_EXPIRED' },
    { type: 'system', id: null, role: null, ip: null },
    { expectedStatus: 'awaiting_deposit' },
  );
}
