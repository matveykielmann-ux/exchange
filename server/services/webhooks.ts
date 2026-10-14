/**
 * Provider webhook ingestion: the only entry point for deposit, payout,
 * refund and verification outcomes. Each delivery is
 * 1. authenticated (HMAC signature with timestamp tolerance),
 * 2. de-duplicated by (provider, event id) — a repeated delivery changes nothing,
 * 3. applied through the order state machine inside one transaction together
 *    with the webhook record, so a crash can't leave half an update.
 * The sandbox simulator signs its events and calls the same function.
 */
import type { Actor, AppContext } from '../context';
import { ApiError, notConfigured } from '../http/errors';
import { newId } from '../lib/clock';
import { webhookSecret } from '../providers/registry';
import { verifyWebhookSignature } from '../providers/signature';
import { WEBHOOK_EVENT_SOURCES, type ProviderEvent, type WebhookSource } from '../providers/types';
import { audit } from './audit';
import { applyVerificationResult } from './customers';
import { notify } from './notifications';
import { afterDepositConfirmed, applyOrderEvent, getOrderRow } from './orders';
import { formatUsd } from '@/domain/money';
import { formatAssetPlain } from './format';

export type WebhookOutcome = { status: 'processed' | 'duplicate' | 'rejected'; eventId: string; error?: string };

const SOURCES: readonly WebhookSource[] = ['custody', 'identity', 'bankPayout', 'cardPayout', 'cash'];
export const isWebhookSource = (s: string): s is WebhookSource => (SOURCES as readonly string[]).includes(s);

function parseEvent(raw: Buffer): ProviderEvent {
  let body: unknown;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new ApiError(400, 'invalid_input', 'Malformed JSON.');
  }
  const e = body as Partial<ProviderEvent>;
  if (
    !e ||
    typeof e.id !== 'string' ||
    !/^[\w.:-]{6,128}$/.test(e.id) ||
    typeof e.type !== 'string' ||
    !(e.type in WEBHOOK_EVENT_SOURCES) ||
    typeof e.data !== 'object' ||
    !e.data
  )
    throw new ApiError(400, 'invalid_input', 'Unrecognized event.');
  return e as ProviderEvent;
}

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !v || v.length > 200) throw new ApiError(400, 'invalid_input', `Event field ${name} is invalid.`);
  return v;
};
const count = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1_000_000)
    throw new ApiError(400, 'invalid_input', 'Event confirmations are invalid.');
  return v;
};

function emailOf(ctx: AppContext, userId: string) {
  return ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
}

/** Deposits and refunds of a sell come from custody; the cash collected for a buy (and its return) from the cash provider. */
function orderForSource(ctx: AppContext, source: WebhookSource, orderId: unknown) {
  const order = getOrderRow(ctx, str(orderId, 'orderId'));
  const expected: WebhookSource = order.direction === 'buy' ? 'cash' : 'custody';
  if (source !== expected)
    throw new ApiError(400, 'invalid_input', `This event for a ${order.direction} order is not accepted from ${source}.`);
  return order;
}

function applyEvent(ctx: AppContext, source: WebhookSource, e: ProviderEvent, actor: Actor) {
  switch (e.type) {
    case 'deposit.observed': {
      const order = orderForSource(ctx, source, e.data.orderId);
      const amount = str(e.data.amountAtomic, 'amountAtomic');
      if (!/^\d{1,40}$/.test(amount)) throw new ApiError(400, 'invalid_input', 'Event amount is invalid.');
      const confirmations = count(e.data.confirmations);
      ctx.db.run(
        'INSERT INTO deposit_observations (id, order_id, provider, provider_event_id, tx_hash, amount_atomic, confirmations, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newId('obs'), order.id, source, e.id, str(e.data.txHash, 'txHash'), amount, confirmations, ctx.clock.now()],
      );
      applyOrderEvent(
        ctx,
        order.id,
        { type: 'DEPOSIT_OBSERVED', txHash: e.data.txHash, amountAtomic: BigInt(amount), confirmations },
        actor,
      );
      return;
    }
    case 'deposit.confirmations':
      applyOrderEvent(
        ctx,
        orderForSource(ctx, source, e.data.orderId).id,
        { type: 'CONFIRMATIONS_UPDATED', confirmations: count(e.data.confirmations) },
        actor,
      );
      return;
    case 'deposit.confirmed': {
      const id = orderForSource(ctx, source, e.data.orderId).id;
      applyOrderEvent(ctx, id, { type: 'DEPOSIT_CONFIRMED', confirmations: count(e.data.confirmations) }, actor);
      afterDepositConfirmed(ctx, id);
      return;
    }
    case 'refund.completed': {
      const id = orderForSource(ctx, source, e.data.orderId).id;
      const txHash = str(e.data.txHash, 'txHash');
      const o = applyOrderEvent(ctx, id, { type: 'REFUND_COMPLETED', txHash }, actor);
      ctx.db.run("UPDATE refunds SET status = 'completed', tx_hash = ?, updated_at = ? WHERE order_id = ?", [txHash, ctx.clock.now(), id]);
      notify(ctx, {
        userId: o.user_id,
        to: emailOf(ctx, o.user_id),
        template: 'refund_completed',
        vars: { reference: o.reference, txHash },
      });
      return;
    }
    case 'payout.processing':
    case 'payout.completed':
    case 'payout.failed': {
      const ref = str(e.data.providerRef, 'providerRef');
      const pi = ctx.db.get<{ id: string; order_id: string }>(
        'SELECT id, order_id FROM payout_instructions WHERE provider = ? AND provider_ref = ?',
        [source, ref],
      );
      if (!pi) throw new ApiError(404, 'not_found', 'No payout with that provider reference.');
      const event =
        e.type === 'payout.processing'
          ? ({ type: 'PAYOUT_PROCESSING', providerRef: ref } as const)
          : e.type === 'payout.completed'
            ? ({ type: 'PAYOUT_COMPLETED', providerRef: ref } as const)
            : ({ type: 'PAYOUT_FAILED', providerRef: ref, reason: str(e.data.reason, 'reason') } as const);
      const o = applyOrderEvent(ctx, pi.order_id, event, actor);
      const status = e.type === 'payout.processing' ? 'processing' : e.type === 'payout.completed' ? 'completed' : 'failed';
      ctx.db.run('UPDATE payout_instructions SET status = ?, failure_reason = ?, updated_at = ? WHERE id = ?', [
        status,
        e.type === 'payout.failed' ? e.data.reason : null,
        ctx.clock.now(),
        pi.id,
      ]);
      if (e.type === 'payout.completed')
        notify(
          ctx,
          o.direction === 'buy'
            ? {
                userId: o.user_id,
                to: emailOf(ctx, o.user_id),
                template: 'buy_completed',
                vars: { reference: o.reference, amount: formatAssetPlain(BigInt(o.amount_atomic), o.asset) },
              }
            : {
                userId: o.user_id,
                to: emailOf(ctx, o.user_id),
                template: 'order_completed',
                vars: { reference: o.reference, amount: formatUsd(BigInt(o.net_cents)) },
              },
        );
      if (e.type === 'payout.failed')
        notify(ctx, { userId: o.user_id, to: emailOf(ctx, o.user_id), template: 'order_failed', vars: { reference: o.reference } });
      return;
    }
    case 'verification.updated': {
      const status = e.data.status;
      if (!['pending', 'approved', 'needs_info', 'rejected'].includes(status))
        throw new ApiError(400, 'invalid_input', 'Unknown verification status.');
      applyVerificationResult(ctx, str(e.data.providerRef, 'providerRef'), status, e.data.detail ?? null, actor);
      return;
    }
  }
}

export function ingestWebhook(
  ctx: AppContext,
  source: WebhookSource,
  signature: string | undefined,
  rawBody: Buffer,
  opts: { sandbox?: boolean } = {},
): WebhookOutcome {
  const secret = webhookSecret(ctx.config, source);
  if (!secret) throw notConfigured(`Webhooks for ${source}`);
  const check = verifyWebhookSignature(secret, signature, rawBody, ctx.clock.now());
  if (!check.ok) {
    ctx.log.warn('webhook signature rejected', { source, reason: check.reason });
    throw new ApiError(401, 'invalid_signature', 'Webhook signature verification failed.');
  }
  const event = parseEvent(rawBody);
  if (!WEBHOOK_EVENT_SOURCES[event.type].includes(source))
    throw new ApiError(400, 'invalid_input', `${event.type} is not accepted from ${source}.`);
  const actor: Actor = { type: opts.sandbox ? 'sandbox' : 'provider', id: source, role: null, ip: null };
  const payload = rawBody.toString('utf8');

  const existing = ctx.db.get<{ id: string; status: string }>(
    'SELECT id, status FROM provider_webhook_events WHERE provider = ? AND event_id = ?',
    [source, event.id],
  );
  if (existing && existing.status !== 'failed') return { status: 'duplicate', eventId: event.id };

  try {
    ctx.db.tx(() => {
      if (existing) ctx.db.run("UPDATE provider_webhook_events SET status = 'received', error = NULL WHERE id = ?", [existing.id]);
      else
        ctx.db.run(
          "INSERT INTO provider_webhook_events (id, provider, event_id, event_type, signature_valid, status, payload, received_at) VALUES (?, ?, ?, ?, 1, 'received', ?, ?)",
          [newId('whk'), source, event.id, event.type, payload, ctx.clock.now()],
        );
      applyEvent(ctx, source, event, actor);
      ctx.db.run("UPDATE provider_webhook_events SET status = 'processed', processed_at = ? WHERE provider = ? AND event_id = ?", [
        ctx.clock.now(),
        source,
        event.id,
      ]);
    });
    return { status: 'processed', eventId: event.id };
  } catch (e) {
    const permanent = e instanceof ApiError || (e instanceof Error && 'code' in e && (e as { code: string }).code === 'invalid_transition');
    const message = e instanceof Error ? e.message : String(e);
    ctx.db.tx(() => {
      if (existing)
        ctx.db.run('UPDATE provider_webhook_events SET status = ?, error = ? WHERE id = ?', [
          permanent ? 'rejected' : 'failed',
          message.slice(0, 500),
          existing.id,
        ]);
      else
        ctx.db.run(
          'INSERT INTO provider_webhook_events (id, provider, event_id, event_type, signature_valid, status, payload, error, received_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)',
          [newId('whk'), source, event.id, event.type, permanent ? 'rejected' : 'failed', payload, message.slice(0, 500), ctx.clock.now()],
        );
      audit(ctx, actor, {
        action: 'webhook.rejected',
        targetType: 'webhook',
        targetId: event.id,
        reason: message.slice(0, 200),
        data: { type: event.type, source },
      });
    });
    if (!permanent) throw e; // 500 → the provider retries; the retry is processed because status is 'failed'.
    return { status: 'rejected', eventId: event.id, error: message };
  }
}
