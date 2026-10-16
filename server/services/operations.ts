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
import { networkLabel } from '@/domain/assets';
import { PAYOUT_METHODS } from '@/domain/payout';
import { HOLDABLE_STATUSES, type OrderStatus } from '@/domain/order';
import { formatUsd, type Cents } from '@/domain/money';
import { requoteWithCourierFee } from '@/domain/quote';
import { validateRefundAddress, validateTxHash } from '@/domain/validation';
import { validateWireReference } from '@/domain/wire';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, notConfigured, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { isUsable } from '../providers/registry';
import { ProviderError, ProviderNotConfiguredError, type PayoutProvider } from '../providers/types';
import { audit } from './audit';
import { payoutDetails } from './customers';
import { notify } from './notifications';
import {
  afterDepositConfirmed,
  applyOrderEvent,
  customerOrder,
  getOrderRow,
  insertEvent,
  issueBuyCashCollection,
  issueSellDepositInstructions,
  openReview,
  screenAddress,
  type OrderRow,
} from './orders';
import { postSystemMessage } from './support';
import { formatAssetPlain } from './format';
import { quoteFromRow, type QuoteRow } from './quotes';

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
            address: o.refund_address!,
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
      // A buy pays out crypto to the receiving wallet (see payoutProvider), so its saved destination (none for a wire) is unused.
      destination: order.direction === 'buy' ? (undefined as never) : payoutDetails(ctx, order.payout_destination_id!),
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

/**
 * Records that a payout was completed outside a configured provider (wire desk,
 * cash handover, or another explicit operational procedure). Requires a reason
 * and an evidence reference. The customer timeline states clearly that this is
 * an operator-recorded confirmation, not a provider webhook.
 */
/**
 * Staff confirms that funds were actually received after independent verification
 * (blockchain explorer, bank statement, cash desk). Customer TXID uploads never
 * call this. Marked `manual` and never confused with provider webhooks.
 */
export function confirmDepositManual(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  input: { txHash: string; amountAtomic: string; comment: string; reason?: string | null },
) {
  const order = getOrderRow(ctx, orderId);
  if (order.on_hold === 1) throw conflict('Release the hold before confirming a deposit.', 'invalid_transition');
  if (!['awaiting_deposit', 'deposit_observed', 'confirming'].includes(order.status))
    throw conflict(`Deposits can be confirmed manually only while awaiting payment (it is ${order.status}).`, 'invalid_transition');
  if (!ctx.db.get('SELECT 1 FROM deposit_instructions WHERE order_id = ?', [orderId]))
    throw conflict('Issue deposit or payment instructions before confirming receipt.', 'credentials_required');

  const comment = (input.comment ?? '').trim();
  if (comment.length < 4)
    throw badRequest('Describe what you verified (at least 4 characters).', { field: 'comment' });
  const reason = (input.reason ?? '').trim() || comment;

  const amountRaw = (input.amountAtomic ?? '').trim();
  if (!/^\d{1,40}$/.test(amountRaw) || amountRaw === '0')
    throw badRequest('Enter the verified amount in atomic units (positive integer).', { field: 'amountAtomic' });
  const amountAtomic = BigInt(amountRaw);

  let txHash = (input.txHash ?? '').trim();
  if (order.direction === 'sell') {
    const err = validateTxHash(txHash, order.network);
    if (err) throw badRequest(err, { field: 'txHash' });
  } else if (order.payout_method === 'wire') {
    if (!txHash) txHash = `wire:${order.reference}`;
    else {
      const err = validateWireReference(txHash);
      if (err) throw badRequest(err, { field: 'txHash' });
    }
  } else if (order.payout_method === 'instant_debit') {
    // Card pay-in: processor payment id / desk log — not a blockchain hash.
    if (!txHash) txHash = `card:${order.reference}`;
    if (txHash.length < 4) throw badRequest('Enter the processor payment id (at least 4 characters).', { field: 'txHash' });
  } else {
    // Cash: desk log / collection id is enough; TXID is not a blockchain hash.
    if (!txHash) txHash = `cash:${order.reference}`;
    if (txHash.length < 4) throw badRequest('Enter a collection or desk reference (at least 4 characters).', { field: 'txHash' });
  }

  // Match against the assigned deposit address when this is a crypto sell.
  if (order.direction === 'sell') {
    const dep = ctx.db.get<{ address: string }>('SELECT address FROM deposit_instructions WHERE order_id = ?', [orderId]);
    if (!dep?.address) throw conflict('No deposit address is assigned to this order.', 'credentials_required');
  }

  const already = ctx.db.get("SELECT 1 FROM order_events WHERE order_id = ? AND type IN ('DEPOSIT_CONFIRMED','MANUAL_DEPOSIT_CONFIRMED')", [
    orderId,
  ]);
  if (already) throw conflict('This deposit was already confirmed.', 'already_confirmed');

  const now = ctx.clock.now();
  try {
    ctx.db.run(
      'INSERT INTO deposit_observations (id, order_id, provider, provider_event_id, tx_hash, amount_atomic, confirmations, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newId('obs'),
        orderId,
        'manual',
        `manual-deposit:${orderId}`,
        txHash,
        amountRaw,
        order.confirmations_required,
        now,
      ],
    );
  } catch {
    throw conflict('This deposit was already confirmed.', 'already_confirmed');
  }
  applyOrderEvent(ctx, orderId, { type: 'MANUAL_DEPOSIT_CONFIRMED', txHash, amountAtomic, comment }, actor, { reason });
  audit(ctx, actor, {
    action: 'order.deposit_confirmed_manual',
    targetType: 'order',
    targetId: orderId,
    reason,
    data: {
      txHash,
      amountAtomic: amountRaw,
      network: order.network,
      asset: order.asset,
      comment,
      confirmationKind: 'manual',
    },
  });
  return afterDepositConfirmed(ctx, orderId);
}

/** Record that a refund was actually sent, when no refund provider webhook will arrive. */
export function recordManualRefund(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  input: { reason: string; evidenceRef: string; evidenceNote?: string | null },
) {
  const reason = requireReason(input.reason);
  const evidenceRef = input.evidenceRef.trim();
  if (evidenceRef.length < 4)
    throw badRequest('Provide an evidence reference (at least 4 characters): TXID, bank reference, or desk log id.', {
      field: 'evidenceRef',
    });
  const evidenceNote = (input.evidenceNote ?? '').trim().slice(0, 2000) || null;
  const order = getOrderRow(ctx, orderId);
  if (order.status !== 'refund_pending')
    throw conflict(`Manual refund can be recorded only while a refund is pending (it is ${order.status}).`, 'invalid_transition');
  if (order.direction === 'sell' && !order.refund_address)
    throw conflict('Waiting for the customer’s refund address before recording a refund.', 'invalid_transition');

  const existing = ctx.db.get<{ id: string; status: string }>('SELECT id, status FROM refunds WHERE order_id = ?', [orderId]);
  if (existing?.status === 'completed') throw conflict('This refund was already completed.', 'already_completed');

  const address =
    order.direction === 'buy'
      ? order.payout_method === 'wire'
        ? 'wire-return-to-sender'
        : 'courier-return'
      : order.refund_address!;
  const txHash = `manual:${evidenceRef.slice(0, 120)}`;

  return ctx.db.tx(() => {
    const now = ctx.clock.now();
    if (!existing) {
      ctx.db.run(
        `INSERT INTO refunds (id, order_id, idempotency_key, provider, address, amount_atomic, status, provider_ref, tx_hash, initiated_by, reason, created_at, updated_at)
         VALUES (?, ?, ?, 'manual', ?, ?, 'completed', ?, ?, ?, ?, ?, ?)`,
        [newId('rfd'), orderId, `manual-refund:${orderId}`, address, order.deposit_amount_atomic, txHash, txHash, actor.id, reason, now, now],
      );
    } else {
      ctx.db.run("UPDATE refunds SET status = 'completed', provider_ref = ?, tx_hash = ?, updated_at = ? WHERE id = ?", [
        txHash,
        txHash,
        now,
        existing.id,
      ]);
    }
    const o = applyOrderEvent(
      ctx,
      orderId,
      { type: 'MANUAL_REFUND_RECORDED', reason, evidenceRef: evidenceRef.slice(0, 200) },
      actor,
      { expectedStatus: 'refund_pending', reason },
    );
    audit(ctx, actor, {
      action: 'refund.recorded_manual',
      targetType: 'order',
      targetId: orderId,
      reason,
      data: { evidenceRef: evidenceRef.slice(0, 200), evidenceNote, completionKind: 'manual' },
    });
    notify(ctx, {
      userId: o.user_id,
      to: emailOf(ctx, o.user_id),
      template: 'refund_completed',
      vars: { reference: o.reference, txHash },
    });
    return o;
  });
}

export function recordManualPayout(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  input: {
    reason: string;
    evidenceRef: string;
    evidenceNote?: string | null;
    /** Optional actual amount paid in cents (sell) or left at quoted net when omitted. */
    amountCents?: number | string | null;
  },
) {
  const reason = requireReason(input.reason);
  const evidenceRef = input.evidenceRef.trim();
  if (evidenceRef.length < 4)
    throw badRequest('Provide an evidence reference (at least 4 characters): bank reference, receipt id, TXID, or desk log id.', {
      field: 'evidenceRef',
    });
  const evidenceNote = (input.evidenceNote ?? '').trim().slice(0, 2000) || null;
  const order = getOrderRow(ctx, orderId);
  if (order.status !== 'ready_for_payout')
    throw conflict(`Manual payout can be recorded only when an order is ready for payout (it is ${order.status}).`, 'invalid_transition');
  if (order.on_hold === 1) throw conflict('Release the hold before recording a payout.', 'invalid_transition');
  if (order.payout_provider_ref)
    throw conflict('A provider payout is already in progress for this order.', 'invalid_transition');

  let amountCents = order.net_cents;
  if (input.amountCents !== undefined && input.amountCents !== null && input.amountCents !== '') {
    const n = Number(input.amountCents);
    if (!Number.isInteger(n) || n <= 0 || n > 100_000_000_00)
      throw badRequest('Enter the actual payout amount in US cents as a positive whole number.', { field: 'amountCents' });
    amountCents = n;
  }

  const { key } = payoutProvider(ctx, order);
  return ctx.db.tx(() => {
    const attempt =
      (ctx.db.get<{ a: number | null }>('SELECT max(attempt) AS a FROM payout_instructions WHERE order_id = ?', [orderId])?.a ?? 0) + 1;
    const id = newId('pay');
    const now = ctx.clock.now();
    ctx.db.run(
      `INSERT INTO payout_instructions (
         id, order_id, attempt, idempotency_key, provider, method, amount_cents, status,
         provider_ref, authorized_by, authorization_reason, completion_kind, evidence_ref, evidence_note,
         recorded_by, completed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orderId,
        attempt,
        `manual-payout:${orderId}:${attempt}`,
        key,
        order.direction === 'buy' ? 'crypto_transfer' : order.payout_method,
        amountCents,
        `manual:${evidenceRef.slice(0, 120)}`,
        actor.id,
        reason,
        evidenceRef.slice(0, 200),
        evidenceNote,
        actor.id,
        now,
        now,
        now,
      ],
    );
    const o = applyOrderEvent(
      ctx,
      orderId,
      { type: 'MANUAL_PAYOUT_RECORDED', reason, evidenceRef: evidenceRef.slice(0, 200) },
      actor,
      { expectedStatus: 'ready_for_payout', reason },
    );
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
    return o;
  });
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
  const wire = buy && o.payout_method === 'wire';
  if (o.status !== 'refund_pending')
    throw conflict('Refunds can be submitted only for orders with a pending refund.', 'invalid_transition');
  if (!o.deposit_amount_atomic) throw conflict('There is no observed deposit to refund.');
  if (!buy && !o.refund_address) {
    // The refund address is asked for only now, once: the refund is submitted when the customer gives it.
    const asked = ctx.db.get("SELECT 1 FROM notifications WHERE order_id = ? AND template = 'refund_address_needed'", [orderId]);
    if (!asked)
      ctx.db.tx(() => {
        audit(ctx, actor, { action: 'refund.awaiting_address', targetType: 'order', targetId: orderId, reason });
        notify(ctx, {
          userId: o.user_id,
          to: emailOf(ctx, o.user_id),
          template: 'refund_address_needed',
          orderId,
          vars: { reference: o.reference, network: networkLabel(o.asset, o.network) },
        });
      });
    return { id: null, idempotency_key: null, status: 'awaiting_address' };
  }
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
          ctx.config.mode === 'sandbox' ? 'sandbox' : wire ? 'bankPayout' : buy ? 'cash' : 'custody',
          wire ? 'wire-return-to-sender' : buy ? 'courier-return' : o.refund_address,
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
  // Wire buys: the wire goes back to the account it came from. There is no contracted bank, so only the sandbox can
  // record a (simulated) return; anywhere else it stays not configured.
  if (wire && ctx.config.mode !== 'sandbox') {
    ctx.db.run("UPDATE refunds SET status = 'not_configured', updated_at = ? WHERE id = ?", [ctx.clock.now(), r.id]);
    return { ...r, status: 'not_configured' };
  }
  if (!isUsable((wire ? ctx.providers.bankPayout : buy ? ctx.providers.cash : ctx.providers.custody).info())) {
    ctx.db.run("UPDATE refunds SET status = 'not_configured', updated_at = ? WHERE id = ?", [ctx.clock.now(), r.id]);
    return { ...r, status: 'not_configured' };
  }
  try {
    let providerRef: string;
    if (wire) providerRef = `sbx_wire_return_${orderId.replace(/^ord_/, '')}`;
    else if (buy) {
      const destination = payoutDetails(ctx, o.payout_destination_id!);
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
        address: o.refund_address!,
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

/** Pauses an order: nothing moves it toward a payout until the hold is released. The customer is told. */
export function placeHold(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  return applyOrderEvent(ctx, orderId, { type: 'HOLD_PLACED', reason: requireReason(reason) }, actor);
}

export function releaseHold(ctx: AppContext, actor: Actor, orderId: string, reason: string) {
  const r = requireReason(reason);
  return ctx.db.tx(() => {
    applyOrderEvent(ctx, orderId, { type: 'HOLD_RELEASED', reason: r }, actor);
    // A deposit confirmed during the hold now goes on to screening or review, as it would have.
    return afterDepositConfirmed(ctx, orderId);
  });
}

/**
 * A message from the team to the customer about an order, in the order's
 * support conversation (the same chat the customer already uses). The
 * customer gets an in-account notice. `askForInfo` marks it as a request for
 * more information; during compliance review that is also an order event.
 */
export function messageCustomer(ctx: AppContext, actor: Actor, orderId: string, message: string, { askForInfo = false } = {}) {
  const body = message.trim();
  if (body.length < 2) throw badRequest('Write a message for the customer.', { field: 'message' });
  const o = getOrderRow(ctx, orderId);
  if (askForInfo && o.status === 'compliance_review') return requestInfo(ctx, actor, orderId, body);
  return ctx.db.tx(() => {
    postSystemMessage(
      ctx,
      actor,
      o.user_id,
      orderId,
      askForInfo ? `Information requested for order ${o.reference}` : `Order ${o.reference}`,
      body,
    );
    notify(ctx, {
      userId: o.user_id,
      to: emailOf(ctx, o.user_id),
      template: askForInfo ? 'info_requested' : 'staff_message',
      orderId,
      vars: { reference: o.reference },
    });
    audit(ctx, actor, {
      action: askForInfo ? 'order.info_requested_message' : 'order.customer_messaged',
      targetType: 'order',
      targetId: orderId,
    });
    return o;
  });
}

/** Explains, for the admin UI, which actions are available and why the others are not. */
export function availableActions(ctx: AppContext, o: OrderRow, role: string) {
  const isReviewer = ['reviewer', 'admin', 'owner'].includes(role);
  const isAdmin = ['admin', 'owner'].includes(role);
  const s: OrderStatus = o.status;
  const payout = payoutProvider(ctx, o).provider.info();
  const refund = ctx.db.get<{ status: string }>('SELECT status FROM refunds WHERE order_id = ?', [o.id]);
  const held = o.on_hold === 1;
  const why = (ok: boolean, roleOk: boolean, roleName: string, stateMsg: string) =>
    ok && roleOk ? null : !roleOk ? `Requires the ${roleName} role.` : stateMsg;
  const notHeld = (msg: string | null) => msg ?? (held ? 'The order is on hold. Release the hold first.' : null);
  const list = [
    {
      action: 'assign',
      label: o.direction === 'sell' && o.payout_method === 'instant_debit' ? 'Take into processing' : 'Assign',
      unavailable: null,
    },
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
      unavailable: why(!['completed', 'refunded'].includes(s), true, 'support', 'Not possible on a closed order.'),
    },
    { action: 'message', label: 'Message the customer', unavailable: null },
    {
      action: 'hold',
      label: 'Put on hold',
      unavailable: why(
        HOLDABLE_STATUSES.includes(s) && o.on_hold !== 1,
        isReviewer,
        'reviewer',
        o.on_hold === 1 ? 'Already on hold.' : 'Not possible in the current state.',
      ),
    },
    {
      action: 'release_hold',
      label: 'Release hold',
      unavailable: why(o.on_hold === 1, isReviewer, 'reviewer', 'The order is not on hold.'),
    },
    {
      action: 'approve',
      label: 'Approve review',
      unavailable: notHeld(
        why(
          s === 'compliance_review' && !o.deposit_exception,
          isReviewer,
          'reviewer',
          o.deposit_exception
            ? 'The deposit is an exception (late, wrong amount or closed order) and can only be refunded.'
            : 'Only during compliance review.',
        ),
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
      action: 'confirm_deposit_manual',
      label: 'Confirm deposit manually',
      unavailable: notHeld(
        why(
          ['awaiting_deposit', 'deposit_observed', 'confirming'].includes(s) &&
            !!ctx.db.get('SELECT 1 FROM deposit_instructions WHERE order_id = ?', [o.id]),
          isAdmin,
          'admin',
          !['awaiting_deposit', 'deposit_observed', 'confirming'].includes(s)
            ? 'Only while waiting for or verifying a deposit.'
            : 'Issue deposit or payment instructions before confirming receipt.',
        ),
      ),
    },
    {
      action: 'authorize_payout',
      label: 'Authorize payout (provider)',
      unavailable:
        notHeld(why(s === 'ready_for_payout', isAdmin, 'admin', 'Only when the order is ready for payout.')) ??
        (isUsable(payout) ? null : `Automatic payout provider is ${payout.state.replace(/_/g, ' ')}. Use Record manual payout instead.`),
    },
    {
      action: 'record_manual_payout',
      label: o.direction === 'sell' && o.payout_method === 'instant_debit' ? 'Record card payout' : 'Record manual payout',
      unavailable: notHeld(
        why(
          s === 'ready_for_payout' && !o.payout_provider_ref,
          isAdmin,
          'admin',
          o.payout_provider_ref
            ? 'A provider payout is already in progress.'
            : 'Only when the order is ready for payout and no provider payout is in progress.',
        ),
      ),
    },
    {
      action: 'issue_card_payin_instructions',
      label: 'Issue card payment instructions',
      unavailable: why(
        o.direction === 'buy' && o.payout_method === 'instant_debit' && s === 'created',
        ['support', 'reviewer', 'admin', 'owner'].includes(role),
        'support',
        o.direction === 'buy' && o.payout_method === 'instant_debit'
          ? 'Card payment instructions were already issued.'
          : 'Only for card pay-in orders waiting for instructions.',
      ),
    },
    {
      action: 'retry_payout',
      label: 'Retry payout',
      unavailable: notHeld(why(s === 'failed' && !!o.deposit_tx_hash, isAdmin, 'admin', 'Only after a failed payout.')),
    },
    {
      action: 'refund',
      label: 'Start refund',
      unavailable: why(s === 'failed' && !!o.deposit_tx_hash, isAdmin, 'admin', 'Only after a failed payout.'),
    },
    {
      action: 'resubmit_refund',
      label: 'Resubmit refund to provider',
      unavailable: (() => {
        if (s === 'refund_pending' && o.direction === 'sell' && !o.refund_address)
          return 'Waiting for the customer’s refund address.';
        if (refund?.status === 'submitted') return why(false, isAdmin, 'admin', 'Refund already submitted; waiting for the provider.');
        const refundProvider =
          o.direction === 'buy'
            ? o.payout_method === 'wire'
              ? ctx.providers.bankPayout
              : ctx.providers.cash
            : ctx.providers.custody;
        if (s === 'refund_pending' && !isUsable(refundProvider.info()))
          return 'Automatic refund provider is not configured. Use Record manual refund instead.';
        return why(s === 'refund_pending' && refund?.status !== 'submitted', isAdmin, 'admin', 'Only while a refund is pending.');
      })(),
    },
    {
      action: 'record_manual_refund',
      label: 'Record manual refund',
      unavailable: why(
        s === 'refund_pending' && !(o.direction === 'sell' && !o.refund_address) && refund?.status !== 'completed',
        isAdmin,
        'admin',
        s !== 'refund_pending'
          ? 'Only while a refund is pending.'
          : o.direction === 'sell' && !o.refund_address
            ? 'Waiting for the customer’s refund address.'
            : 'This refund was already completed.',
      ),
    },
    {
      action: 'set_courier_fee',
      label: 'Set courier fee',
      unavailable: why(
        o.payout_method === 'courier_cash' && o.courier_fee_pending === 1 && ['created', 'awaiting_deposit'].includes(s),
        isReviewer,
        'reviewer',
        o.payout_method !== 'courier_cash'
          ? 'Only for cash-by-courier orders.'
          : o.courier_fee_pending !== 1
            ? 'Courier fee is already set.'
            : 'Only before the deposit window progresses.',
      ),
    },
  ];
  return list;
}

/**
 * Operator quotes the courier delivery/collection cost for this order and
 * recalculates net payout (and crypto amount for buys). The customer must
 * accept the priced terms before deposit/collection proceeds.
 */
export function setCourierFee(ctx: AppContext, actor: Actor, orderId: string, feeCentsRaw: number | string, reason: string) {
  const r = requireReason(reason);
  const o = getOrderRow(ctx, orderId);
  if (o.payout_method !== 'courier_cash') throw conflict('Only cash-by-courier orders have a courier fee.', 'invalid_transition');
  if (o.courier_fee_pending !== 1) throw conflict('The courier fee for this order is already set.', 'courier_fee_set');
  if (!['created', 'awaiting_deposit'].includes(o.status))
    throw conflict('The courier fee can only be set before the order progresses further.', 'invalid_transition');
  const feeCents = BigInt(feeCentsRaw) as Cents;
  if (feeCents < 0n || feeCents > 100_000_00n) throw badRequest('Enter a courier fee between $0 and $100,000.', { field: 'feeCents' });

  const quoteRow = ctx.db.get<QuoteRow>('SELECT * FROM quotes WHERE id = ?', [o.quote_id]);
  if (!quoteRow) throw notFound('Quote not found.');
  const base = quoteFromRow(quoteRow);
  const now = ctx.clock.now();
  const { quote, issues } = requoteWithCourierFee(base, feeCents, now);
  if (issues.some((i) => i.code !== 'courier_fee_pending'))
    throw badRequest(issues.find((i) => i.code === 'non_positive_payout') ? 'That fee leaves no payout.' : 'That fee cannot be applied.');

  ctx.db.tx(() => {
    ctx.db.run(
      `UPDATE orders SET payout_fee_cents = ?, net_cents = ?, amount_atomic = ?, courier_fee_pending = 0, updated_at = ?
       WHERE id = ? AND courier_fee_pending = 1`,
      [Number(quote.payoutFeeCents), Number(quote.netCents), quote.amountAtomic.toString(), now, orderId],
    );
    ctx.db.run(
      `UPDATE quotes SET payout_fee_cents = ?, net_cents = ?, amount_atomic = ?, effective_rate_micros = ?, issues = ?
       WHERE id = ?`,
      [
        Number(quote.payoutFeeCents),
        Number(quote.netCents),
        quote.amountAtomic.toString(),
        quote.effectiveRateMicros.toString(),
        JSON.stringify(issues.filter((i) => i.code !== 'courier_fee_pending'), (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
        o.quote_id,
      ],
    );
    insertEvent(ctx, orderId, {
      type: 'COURIER_FEE_SET',
      from: o.status,
      to: o.status,
      actor,
      visibility: 'customer',
      detail: `Courier fee set to ${formatUsd(quote.payoutFeeCents)}. Confirm the updated quote to continue.`,
      data: { payoutFeeCents: quote.payoutFeeCents.toString(), netCents: quote.netCents.toString(), reason: r },
    });
    audit(ctx, actor, {
      action: 'order.courier_fee_set',
      targetType: 'order',
      targetId: orderId,
      data: { feeCents: quote.payoutFeeCents.toString(), netCents: quote.netCents.toString(), reason: r },
    });
    notify(ctx, {
      userId: o.user_id,
      to: emailOf(ctx, o.user_id),
      template: 'info_requested',
      vars: { reference: o.reference },
    });
  });
  return getOrderRow(ctx, orderId);
}

/** Customer accepts the operator-quoted courier fee; then deposit/collection can proceed. */
export async function acceptCourierFee(ctx: AppContext, actor: Actor, userId: string, orderId: string) {
  const o = customerOrder(ctx, userId, orderId);
  if (o.payout_method !== 'courier_cash') throw conflict('This order has no courier fee to accept.', 'invalid_transition');
  if (o.courier_fee_pending === 1)
    throw conflict('The courier fee has not been set yet. Wait for an updated quote.', 'courier_fee_pending');
  if (o.courier_fee_accepted_at !== null) throw conflict('You have already accepted the courier fee.', 'courier_fee_accepted');
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    const { changes } = ctx.db.run(
      'UPDATE orders SET courier_fee_accepted_at = ?, updated_at = ? WHERE id = ? AND courier_fee_accepted_at IS NULL AND courier_fee_pending = 0',
      [now, now, orderId],
    );
    if (changes !== 1) throw conflict('You have already accepted the courier fee.', 'courier_fee_accepted');
    insertEvent(ctx, orderId, {
      type: 'COURIER_FEE_ACCEPTED',
      from: o.status,
      to: o.status,
      actor,
      visibility: 'customer',
      detail: 'Courier fee accepted. The exchange can continue.',
      data: { payoutFeeCents: o.payout_fee_cents, netCents: o.net_cents },
    });
    audit(ctx, actor, { action: 'order.courier_fee_accepted', targetType: 'order', targetId: orderId });
  });

  if (o.direction === 'sell') {
    await issueSellDepositInstructions(
      ctx,
      o.id,
      userId,
      {
        asset: o.asset,
        network: o.network,
        amountAtomic: BigInt(o.amount_atomic),
      },
      o.reference,
      o.deposit_deadline,
    );
  } else if (o.payout_destination_id) {
    await issueBuyCashCollection(ctx, o);
  }
  return getOrderRow(ctx, orderId);
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

/**
 * The customer gives the refund address their deposit is returned to. It is asked for
 * only when a refund is pending, can be set once, and is screened like any
 * address we send to. A clear result submits the refund; a flagged one leaves
 * it for an admin to resubmit after review.
 */
export async function setRefundAddress(ctx: AppContext, actor: Actor, userId: string, orderId: string, address: string) {
  const o = customerOrder(ctx, userId, orderId);
  if (o.direction === 'buy') throw conflict('Cash is returned by courier; this order has no refund address.', 'invalid_transition');
  if (o.refund_address) throw conflict('The refund address for this order is already set.', 'refund_address_set');
  if (o.status !== 'refund_pending') throw conflict('A refund address is needed only when a refund is pending.', 'invalid_transition');
  const value = address.trim();
  const error = validateRefundAddress(value, o.network);
  if (error) throw badRequest(error, { field: 'refundAddress' });
  const screening = await screenAddress(ctx, o.network, value);
  if (screening.result === 'blocked') {
    audit(ctx, actor, { action: 'refund.address_blocked', targetType: 'order', targetId: orderId, data: { network: o.network } });
    throw new ApiError(422, 'screening_blocked', 'We can’t send to this address. Contact support if you think this is a mistake.');
  }
  ctx.db.tx(() => {
    const { changes } = ctx.db.run('UPDATE orders SET refund_address = ?, updated_at = ? WHERE id = ? AND refund_address IS NULL', [
      value,
      ctx.clock.now(),
      orderId,
    ]);
    if (changes !== 1) throw conflict('The refund address for this order is already set.', 'refund_address_set');
    insertEvent(ctx, orderId, {
      type: 'REFUND_ADDRESS_PROVIDED',
      from: o.status,
      to: o.status,
      actor,
      visibility: 'customer',
      detail: 'Refund address provided.',
      data: { screening: screening.result },
    });
    if (screening.result === 'review')
      insertEvent(ctx, orderId, {
        type: 'REFUND_ADDRESS_REVIEW',
        from: o.status,
        to: o.status,
        actor,
        visibility: 'internal',
        detail: `Refund address screening: ${screening.note}`,
        data: {},
      });
    audit(ctx, actor, { action: 'refund.address_provided', targetType: 'order', targetId: orderId, data: { screening: screening.result } });
  });
  if (screening.result === 'clear') await submitRefund(ctx, actor, orderId, 'Refund address provided by the customer.');
  return getOrderRow(ctx, orderId);
}
