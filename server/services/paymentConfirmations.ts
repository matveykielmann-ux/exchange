/**
 * Customer payment confirmations (receipt / TXID / wire reference) and refund
 * requests via support. Submitting a confirmation never auto-credits a deposit
 * or completes a payout — staff must review.
 */
import { createHash } from 'node:crypto';
import { validateTxHash } from '@/domain/validation';
import { validateWireReference } from '@/domain/wire';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, forbidden } from '../http/errors';
import { newId } from '../lib/clock';
import { audit } from './audit';
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES, cleanName, decodeUpload, type DocumentType } from './documents';
import { applyOrderEvent, customerOrder, getOrderRow, orderDocuments } from './orders';
import { notify } from './notifications';

export type ConfirmationStatus = 'submitted' | 'approved' | 'needs_info' | 'rejected';
export type RefundRequestStatus = 'submitted' | 'needs_kyc' | 'needs_info' | 'approved' | 'rejected' | 'cancelled';

type ConfirmationRow = {
  id: string;
  order_id: string;
  kind: string;
  txid: string | null;
  wire_reference: string | null;
  comment: string | null;
  document_id: string | null;
  status: ConfirmationStatus;
  staff_note: string | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  created_at: number;
};

function confirmationView(r: ConfirmationRow) {
  return {
    id: r.id,
    orderId: r.order_id,
    kind: r.kind as 'crypto_txid' | 'wire_reference' | 'receipt',
    txid: r.txid,
    wireReference: r.wire_reference,
    comment: r.comment,
    documentId: r.document_id,
    status: r.status,
    staffNote: r.staff_note,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  };
}

export function listPaymentConfirmations(ctx: AppContext, orderId: string) {
  return ctx.db.all<ConfirmationRow>('SELECT * FROM payment_confirmations WHERE order_id = ? ORDER BY created_at DESC', [orderId]).map(confirmationView);
}

function insertReceiptDocument(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  orderId: string,
  file: { fileName: string; contentType: DocumentType; dataBase64: string },
  kind: 'payment_receipt' | 'refund_attachment' | 'admin_attachment',
  message?: string | null,
) {
  const { bytes, detected } = decodeUpload(file, { maxBytes: DOCUMENT_MAX_BYTES, allowed: DOCUMENT_TYPES });
  const id = newId('doc');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  ctx.db.run(
    `INSERT INTO order_documents
      (id, order_id, user_id, kind, file_name, content_type, size_bytes, sha256, stored, created_at, visibility, message, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'owner_staff', ?, ?)`,
    [id, orderId, userId, kind, cleanName(file.fileName), detected, bytes.length, sha256, ctx.clock.now(), message ?? null, actor.id],
  );
  return id;
}

function kycVerified(ctx: AppContext, userId: string): boolean {
  const p = ctx.db.get<{ kyc_status: string }>('SELECT kyc_status FROM customer_profiles WHERE user_id = ?', [userId]);
  return p?.kyc_status === 'verified';
}

/** Customer submits payment proof. Does not move the order to a confirmed deposit. */
export function submitPaymentConfirmation(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  orderId: string,
  input: {
    txid?: string | null;
    wireReference?: string | null;
    comment?: string | null;
    file?: { fileName: string; contentType: DocumentType; dataBase64: string } | null;
  },
) {
  const o = customerOrder(ctx, userId, orderId);
  if (!['created', 'awaiting_deposit', 'deposit_observed', 'confirming', 'compliance_review'].includes(o.status))
    throw conflict('Payment confirmation is not available for this order status.', 'invalid_transition');

  const wire = o.direction === 'buy' && o.payout_method === 'wire';
  const crypto = o.direction !== 'buy';
  const txid = input.txid?.trim() || null;
  const wireRef = input.wireReference?.trim() || null;
  const comment = input.comment?.trim() || null;
  if (!txid && !wireRef && !input.file) throw badRequest('Provide a TXID, a bank reference, or a receipt file.');

  if (crypto && txid) {
    const err = validateTxHash(txid, o.network);
    if (err) throw badRequest(err, { field: 'txid' });
  }
  if (wire && wireRef) {
    const err = validateWireReference(wireRef);
    if (err) throw badRequest(err, { field: 'wireReference' });
  }
  if (!crypto && txid) throw badRequest('Transaction hashes apply to crypto deposits only.', { field: 'txid' });
  if (!wire && wireRef) throw badRequest('Bank references apply to wire orders only.', { field: 'wireReference' });

  const kind = txid ? 'crypto_txid' : wireRef ? 'wire_reference' : 'receipt';
  const id = newId('payc');
  if (input.file && orderDocuments(ctx, o.id).filter((d) => d.kind === 'payment_receipt').length >= 5)
    throw conflict('Too many receipt uploads on this order.', 'too_many_documents');
  let documentId: string | null = null;
  ctx.db.tx(() => {
    if (input.file) documentId = insertReceiptDocument(ctx, actor, userId, o.id, input.file, 'payment_receipt', comment);
    ctx.db.run(
      `INSERT INTO payment_confirmations
        (id, order_id, user_id, kind, txid, wire_reference, comment, document_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      [id, o.id, userId, kind, txid, wireRef, comment, documentId, ctx.clock.now()],
    );
    audit(ctx, actor, {
      action: 'order.payment_confirmation_submitted',
      targetType: 'order',
      targetId: o.id,
      data: { confirmationId: id, kind, hasFile: !!documentId },
    });
  });
  // Separate from the insert tx so we do not nest order transitions.
  if ((txid || wireRef) && !o.customer_reported_sent_at) {
    try {
      applyOrderEvent(ctx, o.id, { type: 'CUSTOMER_REPORTED_SENT', txHash: txid ?? wireRef }, actor);
    } catch {
      /* confirmation row remains even if the status event is not applicable */
    }
  }
  ctx.bus.publish([{ userId: o.user_id }, { staff: true }], { type: 'order.updated', data: { orderId: o.id, status: o.status } });
  return listPaymentConfirmations(ctx, o.id);
}

export function reviewPaymentConfirmation(
  ctx: AppContext,
  actor: Actor,
  confirmationId: string,
  input: { status: Exclude<ConfirmationStatus, 'submitted'>; staffNote?: string | null },
) {
  if (actor.type !== 'operator') throw forbidden('Staff only.');
  const row = ctx.db.get<ConfirmationRow>('SELECT * FROM payment_confirmations WHERE id = ?', [confirmationId]);
  if (!row) throw new ApiError(404, 'not_found', 'Payment confirmation not found.');
  const note = input.staffNote?.trim() || null;
  if (input.status === 'rejected' && !note) throw badRequest('Provide a reason when rejecting a confirmation.', { field: 'staffNote' });
  ctx.db.tx(() => {
    ctx.db.run(`UPDATE payment_confirmations SET status = ?, staff_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`, [
      input.status,
      note,
      actor.id,
      ctx.clock.now(),
      confirmationId,
    ]);
    audit(ctx, actor, {
      action: 'order.payment_confirmation_reviewed',
      targetType: 'order',
      targetId: row.order_id,
      reason: note,
      data: { confirmationId, status: input.status },
    });
    const o = getOrderRow(ctx, row.order_id);
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
    notify(ctx, {
      userId: o.user_id,
      to: email,
      template: 'status_changed',
      vars: {
        reference: o.reference,
        status: input.status,
        stage: 'Payment confirmation reviewed',
        detail: note ?? '',
      },
      orderId: o.id,
    });
  });
  return confirmationView(ctx.db.get<ConfirmationRow>('SELECT * FROM payment_confirmations WHERE id = ?', [confirmationId])!);
}

/** Admin attaches a message / file for additional verification. */
export function postOrderMessage(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  input: {
    body: string;
    file?: { fileName: string; contentType: DocumentType; dataBase64: string } | null;
  },
) {
  if (actor.type !== 'operator') throw forbidden('Staff only.');
  const o = getOrderRow(ctx, orderId);
  const body = input.body.trim();
  if (!body) throw badRequest('Enter a message for the customer.', { field: 'body' });
  const id = newId('omsg');
  ctx.db.tx(() => {
    let documentId: string | null = null;
    if (input.file) documentId = insertReceiptDocument(ctx, actor, o.user_id, o.id, input.file, 'admin_attachment', body);
    ctx.db.run(
      `INSERT INTO order_messages (id, order_id, author_id, author_role, body, document_id, created_at)
       VALUES (?, ?, ?, 'admin', ?, ?, ?)`,
      [id, o.id, actor.id, body, documentId, ctx.clock.now()],
    );
    if (o.status !== 'compliance_review') {
      try {
        applyOrderEvent(ctx, o.id, { type: 'INFO_REQUESTED', message: body }, actor);
      } catch {
        /* transition may be unavailable for this status */
      }
    }
    audit(ctx, actor, {
      action: 'order.additional_verification_message',
      targetType: 'order',
      targetId: o.id,
      data: { messageId: id, hasFile: !!documentId },
    });
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
    notify(ctx, {
      userId: o.user_id,
      to: email,
      template: 'info_requested',
      vars: { reference: o.reference },
      orderId: o.id,
    });
  });
  return listOrderMessages(ctx, orderId);
}

export function listOrderMessages(ctx: AppContext, orderId: string) {
  return ctx.db
    .all<{
      id: string;
      order_id: string;
      author_id: string | null;
      author_role: string;
      body: string;
      document_id: string | null;
      created_at: number;
    }>('SELECT * FROM order_messages WHERE order_id = ? ORDER BY created_at', [orderId])
    .map((m) => ({
      id: m.id,
      orderId: m.order_id,
      authorId: m.author_id,
      authorRole: m.author_role,
      body: m.body,
      documentId: m.document_id,
      createdAt: m.created_at,
    }));
}

export function submitRefundRequest(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  orderId: string,
  input: {
    reason: string;
    file?: { fileName: string; contentType: DocumentType; dataBase64: string } | null;
  },
) {
  const o = customerOrder(ctx, userId, orderId);
  const reason = input.reason.trim();
  if (!reason) throw badRequest('Explain why you are requesting a refund.', { field: 'reason' });
  const existing = ctx.db.get<{ id: string; status: string }>(
    `SELECT id, status FROM refund_requests WHERE order_id = ? AND status NOT IN ('rejected','cancelled') ORDER BY created_at DESC LIMIT 1`,
    [o.id],
  );
  if (existing) throw conflict('A refund request is already open for this order.', 'duplicate_refund_request');
  if (o.status === 'refunded') throw conflict('This order was already refunded.', 'already_refunded');

  const status: RefundRequestStatus = kycVerified(ctx, userId) ? 'submitted' : 'needs_kyc';
  const id = newId('rreq');
  ctx.db.tx(() => {
    let documentId: string | null = null;
    if (input.file) documentId = insertReceiptDocument(ctx, actor, userId, o.id, input.file, 'refund_attachment', reason);
    const now = ctx.clock.now();
    ctx.db.run(
      `INSERT INTO refund_requests
        (id, order_id, user_id, reason, status, document_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, o.id, userId, reason, status, documentId, now, now],
    );
    audit(ctx, actor, {
      action: 'order.refund_requested',
      targetType: 'order',
      targetId: o.id,
      data: { requestId: id, status },
    });
  });
  return getRefundRequest(ctx, id);
}

export function getRefundRequest(ctx: AppContext, id: string) {
  const r = ctx.db.get<{
    id: string;
    order_id: string;
    user_id: string;
    reason: string;
    status: RefundRequestStatus;
    staff_note: string | null;
    document_id: string | null;
    reviewed_by: string | null;
    reviewed_at: number | null;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM refund_requests WHERE id = ?', [id]);
  if (!r) throw new ApiError(404, 'not_found', 'Refund request not found.');
  return {
    id: r.id,
    orderId: r.order_id,
    userId: r.user_id,
    reason: r.reason,
    status: r.status,
    staffNote: r.staff_note,
    documentId: r.document_id,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listRefundRequestsForOrder(ctx: AppContext, orderId: string) {
  return ctx.db
    .all<{ id: string }>('SELECT id FROM refund_requests WHERE order_id = ? ORDER BY created_at DESC', [orderId])
    .map((r) => getRefundRequest(ctx, r.id));
}

export function reviewRefundRequest(
  ctx: AppContext,
  actor: Actor,
  requestId: string,
  input: { status: Exclude<RefundRequestStatus, 'submitted' | 'needs_kyc'>; staffNote?: string | null },
) {
  if (actor.type !== 'operator') throw forbidden('Staff only.');
  const r = getRefundRequest(ctx, requestId);
  const note = input.staffNote?.trim() || null;
  if ((input.status === 'rejected' || input.status === 'needs_info') && !note)
    throw badRequest('Provide a note for the customer.', { field: 'staffNote' });
  if (input.status === 'approved' && !kycVerified(ctx, r.userId))
    throw conflict('Complete KYC before approving a refund.', 'kyc_required');
  ctx.db.tx(() => {
    ctx.db.run(
      `UPDATE refund_requests SET status = ?, staff_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
      [input.status, note, actor.id, ctx.clock.now(), ctx.clock.now(), requestId],
    );
    audit(ctx, actor, {
      action: 'order.refund_request_reviewed',
      targetType: 'order',
      targetId: r.orderId,
      reason: note,
      data: { requestId, status: input.status },
    });
  });
  return getRefundRequest(ctx, requestId);
}
