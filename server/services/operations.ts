/**
 * Operator actions on orders. Every action requires a role (checked in the
 * route), a reason where it matters, and writes an audit record.
 *
 * Authorization is separate from execution: "Authorize payout" records the
 * decision and submits an instruction to the payout provider with an
 * idempotency key. The order only becomes payout_submitted when the provider
 * accepts it, and only becomes completed or failed when the provider reports
 * so by webhook. Nobody can click an order to "completed".
 */
import { PAYOUT_METHODS } from '@/domain/payout';
import type { OrderStatus } from '@/domain/order';
import { formatUsd } from '@/domain/money';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, notConfigured, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { isUsable } from '../providers/registry';
import { ProviderError, ProviderNotConfiguredError, type PayoutProvider } from '../providers/types';
import { audit } from './audit';
import { payoutDetails } from './customers';
import { notify } from './notifications';
import { applyOrderEvent, getOrderRow, openReview, type OrderRow } from './orders';
import { postSystemMessage } from './support';
import { formatAssetPlain } from './format';

const STAFF = ['support', 'reviewer', 'admin', 'owner'];

const requireReason = (reason: string | undefined | null) => {
  const r = reason?.trim();
  if (!r || r.length < 4)
    throw badRequest('Give a reason (at least 4 characters). It is recorded in the audit trail.', { field: 'reason' });
  return r.slice(0, 500);
};

function emailOf(ctx: AppContext, userId: string) {
  return ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
}

export function assignOrder(ctx: AppContext, actor: Actor, orderId: string, operatorId: string | null) {
  const order = getOrderRow(ctx, orderId);
  if (operatorId) {
    const op = ctx.db.get<{ role: string; status: string }>('SELECT role, status FROM users WHERE id = ?', [operatorId]);
    if (!op || !STAFF.includes(op.role) || op.status !== 'active')
      throw badRequest('Assign to an active staff member.', { field: 'operatorId' });
  }
  ctx.db.tx(() => {
    ctx.db.run('UPDATE orders SET assigned_operator_id = ?, updated_at = ? WHERE id = ?', [operatorId, ctx.clock.now(), orderId]);
    audit(ctx, actor, {
      action: 'order.assigned',
      targetType: 'order',
      targetId: orderId,
      data: { from: order.assigned_operator_id, to: operatorId },
    });
  });
  ctx.db.afterCommit(() => ctx.bus.publish([{ staff: true }], { type: 'order.updated', data: { orderId } }));
}

export function addNote(ctx: AppContext, actor: Actor, orderId: string, body: string) {
  getOrderRow(ctx, orderId);
  const id = newId('note');
  ctx.db.tx(() => {
    ctx.db.run('INSERT INTO operator_notes (id, order_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)', [
      id,
      orderId,
      actor.id,
      body,
      ctx.clock.now(),
    ]);
    audit(ctx, actor, { action: 'order.note_added', targetType: 'order', targetId: orderId, data: { noteId: id } });
  });
  return id;
}

export function flagForReview(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  const r = requireReason(reason);
  return ctx.db.tx(() => {
    const o = applyOrderEvent(ctx, orderId, { type: 'REVIEW_REQUIRED', reason: r }, actor);
    if (o.status === 'compliance_review') openReview(ctx, orderId, r, actor.id);
    return o;
  });
}

export function requestInfo(ctx: AppContext, actor: Actor, orderId: string, message: string) {
  const body = message.trim();
  if (body.length < 10) throw badRequest('Write the question for the customer (at least 10 characters).', { field: 'message' });
  return ctx.db.tx(() => {
    const o = applyOrderEvent(ctx, orderId, { type: 'INFO_REQUESTED', message: body }, actor);
    ctx.db.run("UPDATE compliance_reviews SET status = 'info_requested' WHERE order_id = ? AND status = 'open'", [orderId]);
    postSystemMessage(ctx, actor, o.user_id, orderId, `Information requested for order ${o.reference}`, body);
    notify(ctx, { userId: o.user_id, to: emailOf(ctx, o.user_id), template: 'info_requested', vars: { reference: o.reference } });
    return o;
  });
}

export function approveReview(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  const r = requireReason(reason);
  return ctx.db.tx(() => {
    const o = applyOrderEvent(ctx, orderId, { type: 'REVIEW_APPROVED', reason: r }, actor);
    ctx.db.run(
      "UPDATE compliance_reviews SET status = 'approved', decided_by = ?, decision_reason = ?, decided_at = ? WHERE order_id = ? AND status IN ('open','info_requested')",
      [actor.id, r, ctx.clock.now(), orderId],
    );
    return o;
  });
}

export async function rejectOrder(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  const r = requireReason(reason);
  const o = ctx.db.tx(() => {
    const updated = applyOrderEvent(ctx, orderId, { type: 'ORDER_REJECTED', reason: r }, actor);
    ctx.db.run(
      "UPDATE compliance_reviews SET status = 'rejected', decided_by = ?, decision_reason = ?, decided_at = ? WHERE order_id = ? AND status IN ('open','info_requested')",
      [actor.id, r, ctx.clock.now(), orderId],
    );
    return updated;
  });
  if (o.status === 'refund_pending') await submitRefund(ctx, actor, orderId, r);
  return getOrderRow(ctx, orderId);
}

type PayoutKey = 'bankPayout' | 'cardPayout' | 'cash' | 'custody';

/** What leaves us when an order pays out: dollars for a sell, crypto from custody for a buy. */
function payoutProvider(ctx: AppContext, o: OrderRow): { key: PayoutKey; provider: PayoutProvider; name: string } {
  if (o.direction === 'buy') {
    const custody = ctx.providers.custody;
    return {
      key: 'custody',
      name: 'Crypto custody',
      provider: {
        info: () => custody.info(),
        submitPayout: (req) =>
          custody.sendCrypto({
            orderId: req.orderId,
            asset: o.asset,
            network: o.network,
            address: o.refund_address,
            amountAtomic: BigInt(o.amount_atomic),
            idempotencyKey: req.idempotencyKey,
          }),
      },
    };
  }
  const name = PAYOUT_METHODS[o.payout_method].name;
  if (o.payout_method === 'instant_debit') return { key: 'cardPayout', provider: ctx.providers.cardPayout, name };
  if (o.payout_method === 'ach' || o.payout_method === 'wire') return { key: 'bankPayout', provider: ctx.providers.bankPayout, name };
  return { key: 'cash', provider: ctx.providers.cash, name };
}

export async function authorizePayout(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  const r = requireReason(reason);
  const order = getOrderRow(ctx, orderId);
  if (order.status !== 'ready_for_payout')
    throw conflict(`Payouts can be authorized only when an order is ready for payout (it is ${order.status}).`, 'invalid_transition');
  const { key, provider, name } = payoutProvider(ctx, order);

  // Reuse an authorized-but-unsubmitted instruction (e.g. after a provider timeout) so the idempotency key is stable.
  let pi = ctx.db.get<{ id: string; attempt: number; idempotency_key: string; status: string }>(
    "SELECT * FROM payout_instructions WHERE order_id = ? AND status IN ('authorized','not_configured') ORDER BY attempt DESC LIMIT 1",
    [orderId],
  );
  ctx.db.tx(() => {
    applyOrderEvent(ctx, orderId, { type: 'PAYOUT_AUTHORIZED', reason: r }, actor, { expectedStatus: 'ready_for_payout' });
    if (!pi) {
      const attempt =
        (ctx.db.get<{ a: number | null }>('SELECT max(attempt) AS a FROM payout_instructions WHERE order_id = ?', [orderId])?.a ?? 0) + 1;
      const id = newId('pay');
      pi = { id, attempt, idempotency_key: `payout:${orderId}:${attempt}`, status: 'authorized' };
      ctx.db.run(
        `INSERT INTO payout_instructions (id, order_id, attempt, idempotency_key, provider, method, amount_cents, status, authorized_by, authorization_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'authorized', ?, ?, ?, ?)`,
        [
          id,
          orderId,
          attempt,
          pi.idempotency_key,
          key,
          order.direction === 'buy' ? 'crypto_transfer' : order.payout_method,
          order.net_cents,
          actor.id,
          r,
          ctx.clock.now(),
          ctx.clock.now(),
        ],
      );
    }
  });
  const instruction = pi!;

  if (!isUsable(provider.info())) {
    ctx.db.run("UPDATE payout_instructions SET status = 'not_configured', updated_at = ? WHERE id = ?", [ctx.clock.now(), instruction.id]);
    throw notConfigured(`${name} payout provider`);
  }
  try {
    const { providerRef } = await provider.submitPayout({
      orderId,
      method: order.payout_method,
      amountCents: BigInt(order.net_cents),
      destination: payoutDetails(ctx, order.payout_destination_id),
      idempotencyKey: instruction.idempotency_key,
    });
    return ctx.db.tx(() => {
      ctx.db.run("UPDATE payout_instructions SET status = 'submitted', provider_ref = ?, updated_at = ? WHERE id = ?", [
        providerRef,
        ctx.clock.now(),
        instruction.id,
      ]);
      const o = applyOrderEvent(
        ctx,
        orderId,
        { type: 'PAYOUT_SUBMITTED', providerRef, attempt: instruction.attempt },
        { type: 'system', id: null, role: null, ip: null },
      );
      notify(
        ctx,
        o.direction === 'buy'
          ? {
              userId: o.user_id,
              to: emailOf(ctx, o.user_id),
              template: 'buy_transfer_submitted',
              vars: { reference: o.reference, amount: formatAssetPlain(BigInt(o.amount_atomic), o.asset) },
            }
          : {
              userId: o.user_id,
              to: emailOf(ctx, o.user_id),
              template: 'payout_submitted',
              vars: {
                reference: o.reference,
                amount: formatUsd(BigInt(o.net_cents)),
                timing: PAYOUT_METHODS[o.payout_method].timingEstimate,
              },
            },
      );
      return o;
    });
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) {
      ctx.db.run("UPDATE payout_instructions SET status = 'not_configured', updated_at = ? WHERE id = ?", [
        ctx.clock.now(),
        instruction.id,
      ]);
      throw notConfigured(`${name} payout provider`);
    }
    if (e instanceof ProviderError && !e.retryable) {
      // The provider refused the instruction: that is a real provider outcome, so the order fails.
      return ctx.db.tx(() => {
        ctx.db.run("UPDATE payout_instructions SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?", [
          e.message,
          ctx.clock.now(),
          instruction.id,
        ]);
        const o = applyOrderEvent(
          ctx,
          orderId,
          { type: 'PAYOUT_FAILED', providerRef: null, reason: e.message },
          { type: 'system', id: null, role: null, ip: null },
        );
        notify(ctx, { userId: o.user_id, to: emailOf(ctx, o.user_id), template: 'order_failed', vars: { reference: o.reference } });
        return o;
      });
    }
    if (e instanceof ProviderError)
      throw new ApiError(
        502,
        'provider_unavailable',
        'The payout provider did not respond. Nothing was marked as sent; it is safe to try again.',
      );
    throw e;
  }
}

export function retryPayout(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  return applyOrderEvent(ctx, orderId, { type: 'PAYOUT_RETRY_AUTHORIZED', reason: requireReason(reason) }, actor);
}

export async function initiateRefund(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  const r = requireReason(reason);
  applyOrderEvent(ctx, orderId, { type: 'REFUND_INITIATED', reason: r }, actor);
  await submitRefund(ctx, actor, orderId, r);
  return getOrderRow(ctx, orderId);
}

/**
 * Asks the custody provider to return the deposit (sell), or the cash provider
 * to return the collected cash (buy). Safe to call again: the idempotency key
 * is per order.
 */
export async function submitRefund(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  const o = getOrderRow(ctx, orderId);
  const buy = o.direction === 'buy';
  if (o.status !== 'refund_pending')
    throw conflict('Refunds can be submitted only for orders with a pending refund.', 'invalid_transition');
  if (!o.deposit_amount_atomic) throw conflict('There is no observed deposit to refund.');
  let refund = ctx.db.get<{ id: string; idempotency_key: string; status: string }>('SELECT * FROM refunds WHERE order_id = ?', [orderId]);
  if (refund && (refund.status === 'submitted' || refund.status === 'completed')) return refund;
  if (!refund) {
    const id = newId('rfd');
    refund = { id, idempotency_key: `refund:${orderId}`, status: 'initiated' };
    ctx.db.tx(() => {
      ctx.db.run(
        "INSERT INTO refunds (id, order_id, idempotency_key, provider, address, amount_atomic, status, initiated_by, reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'initiated', ?, ?, ?, ?)",
        [
          id,
          orderId,
          refund!.idempotency_key,
          ctx.config.mode === 'sandbox' ? 'sandbox' : buy ? 'cash' : 'custody',
          buy ? 'courier-return' : o.refund_address,
          o.deposit_amount_atomic,
          actor.id,
          reason,
          ctx.clock.now(),
          ctx.clock.now(),
        ],
      );
      audit(ctx, actor, { action: 'refund.initiated', targetType: 'order', targetId: orderId, reason });
      notify(ctx, { userId: o.user_id, to: emailOf(ctx, o.user_id), template: 'refund_started', vars: { reference: o.reference } });
    });
  }
  const r = refund!;
  if (!isUsable((buy ? ctx.providers.cash : ctx.providers.custody).info())) {
    ctx.db.run("UPDATE refunds SET status = 'not_configured', updated_at = ? WHERE id = ?", [ctx.clock.now(), r.id]);
    return { ...r, status: 'not_configured' };
  }
  try {
    let providerRef: string;
    if (buy) {
      const destination = payoutDetails(ctx, o.payout_destination_id);
      if (destination.kind !== 'courier') throw new Error('Collection address is not a courier address.');
      ({ providerRef } = await ctx.providers.cash.requestCashReturn({
        orderId,
        amountCents: BigInt(o.deposit_amount_atomic),
        destination,
        idempotencyKey: r.idempotency_key,
      }));
    } else
      ({ providerRef } = await ctx.providers.custody.requestRefund({
        orderId,
        asset: o.asset,
        network: o.network,
        address: o.refund_address,
        amountAtomic: BigInt(o.deposit_amount_atomic),
        idempotencyKey: r.idempotency_key,
      }));
    ctx.db.run("UPDATE refunds SET status = 'submitted', provider_ref = ?, updated_at = ? WHERE id = ?", [
      providerRef,
      ctx.clock.now(),
      r.id,
    ]);
    audit(ctx, actor, { action: 'refund.submitted', targetType: 'order', targetId: orderId, data: { providerRef } });
    return { ...r, status: 'submitted' };
  } catch (e) {
    ctx.log.warn('refund submission failed', { orderId, error: e instanceof Error ? e.message : String(e) });
    ctx.db.run('UPDATE refunds SET status = ?, updated_at = ? WHERE id = ?', [
      e instanceof ProviderNotConfiguredError ? 'not_configured' : 'failed',
      ctx.clock.now(),
      r.id,
    ]);
    return { ...r, status: 'failed' };
  }
}

/** Explains, for the admin UI, which actions are available and why the others are not. */
export function availableActions(ctx: AppContext, o: OrderRow, role: string) {
  const isReviewer = ['reviewer', 'admin', 'owner'].includes(role);
  const isAdmin = ['admin', 'owner'].includes(role);
  const s: OrderStatus = o.status;
  const payout = payoutProvider(ctx, o).provider.info();
  const refund = ctx.db.get<{ status: string }>('SELECT status FROM refunds WHERE order_id = ?', [o.id]);
  const why = (ok: boolean, roleOk: boolean, roleName: string, stateMsg: string) =>
    ok && roleOk ? null : !roleOk ? `Requires the ${roleName} role.` : stateMsg;
  const list = [
    { action: 'assign', label: 'Assign', unavailable: null },
    { action: 'note', label: 'Add internal note', unavailable: null },
    {
      action: 'flag',
      label: 'Send to compliance review',
      unavailable: why(
        ['awaiting_deposit', 'deposit_observed', 'confirming', 'deposit_confirmed', 'ready_for_payout'].includes(s),
        isReviewer,
        'reviewer',
        'Only before payout is submitted.',
      ),
    },
    {
      action: 'request_info',
      label: 'Request information',
      unavailable: why(s === 'compliance_review', isReviewer, 'reviewer', 'Only during compliance review.'),
    },
    {
      action: 'approve',
      label: 'Approve review',
      unavailable: why(
        s === 'compliance_review' && !o.deposit_exception,
        isReviewer,
        'reviewer',
        o.deposit_exception
          ? 'The deposit is an exception (late, wrong amount or closed order) and can only be refunded.'
          : 'Only during compliance review.',
      ),
    },
    {
      action: 'reject',
      label: o.deposit_tx_hash ? 'Reject and refund' : 'Reject',
      unavailable: why(
        ['created', 'awaiting_deposit', 'deposit_confirmed', 'compliance_review', 'ready_for_payout'].includes(s),
        isReviewer,
        'reviewer',
        'Not possible in the current state.',
      ),
    },
    {
      action: 'authorize_payout',
      label: 'Authorize payout',
      unavailable:
        why(s === 'ready_for_payout', isAdmin, 'admin', 'Only when the order is ready for payout.') ??
        (isUsable(payout) ? null : `Payout provider is ${payout.state.replace(/_/g, ' ')}.`),
    },
    {
      action: 'retry_payout',
      label: 'Retry payout',
      unavailable: why(s === 'failed' && !!o.deposit_tx_hash, isAdmin, 'admin', 'Only after a failed payout.'),
    },
    {
      action: 'refund',
      label: 'Start refund',
      unavailable: why(s === 'failed' && !!o.deposit_tx_hash, isAdmin, 'admin', 'Only after a failed payout.'),
    },
    {
      action: 'resubmit_refund',
      label: 'Resubmit refund to provider',
      unavailable: why(
        s === 'refund_pending' && refund?.status !== 'submitted',
        isAdmin,
        'admin',
        refund?.status === 'submitted' ? 'Refund already submitted; waiting for the provider.' : 'Only while a refund is pending.',
      ),
    },
  ];
  return list;
}

export function orderNotes(ctx: AppContext, orderId: string) {
  return ctx.db
    .all<{
      id: string;
      body: string;
      created_at: number;
      author_id: string;
      email: string;
    }>(
      'SELECT n.id, n.body, n.created_at, n.author_id, u.email FROM operator_notes n JOIN users u ON u.id = n.author_id WHERE n.order_id = ? ORDER BY n.created_at',
      [orderId],
    )
    .map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at, author: { id: n.author_id, email: n.email } }));
}

export function ensureOrder(ctx: AppContext, id: string) {
  const o = ctx.db.get<OrderRow>('SELECT * FROM orders WHERE id = ? OR reference = ?', [id, id]);
  if (!o) throw notFound('Order not found.');
  return o;
}
