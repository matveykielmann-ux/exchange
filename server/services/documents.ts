/**
 * Documents attached to an order: courier photo ID, payment receipts, admin
 * verification attachments and refund attachments. Files are validated
 * (magic bytes, size, sanitized name), fingerprinted with SHA-256, encrypted
 * with DATA_ENCRYPTION_KEY and written under FILES_DIR. Metadata stays in
 * SQLite (`order_documents.stored = 1`). Content is never served as a static
 * URL — only through authorized download handlers.
 */
import { createHash } from 'node:crypto';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { STAFF_ROLES, type Role } from '../http/router';
import { audit } from './audit';
import { deleteOrderFile, readOrderFile, writeOrderFile } from './fileStore';
import { customerOrder, getOrderRow, orderDocuments } from './orders';

export const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
const MAX_PER_ORDER = 3;

export function sniff(bytes: Buffer): DocumentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

export function cleanName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  return (clean || 'document').slice(0, 120);
}

/**
 * Decodes and checks an uploaded file: valid base64, not empty, within the size
 * limit, and its magic bytes match both an allowed type and the declared type.
 */
export function decodeUpload(
  input: { contentType: string; dataBase64: string },
  { maxBytes, allowed }: { maxBytes: number; allowed: readonly DocumentType[] },
): { bytes: Buffer; detected: DocumentType } {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.dataBase64) || input.dataBase64.length % 4 !== 0)
    throw badRequest('The file could not be read. Choose it again.', { field: 'file' });
  const bytes = Buffer.from(input.dataBase64, 'base64');
  if (!bytes.length) throw badRequest('The file is empty.', { field: 'file' });
  const mb = Math.round(maxBytes / (1024 * 1024));
  if (bytes.length > maxBytes) throw badRequest(`The file is larger than ${mb} MB. Use a smaller photo or scan.`, { field: 'file' });
  const names = allowed.map((t) => (t === 'application/pdf' ? 'PDF' : t === 'image/png' ? 'PNG' : 'JPEG'));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0]!;
  const detected = sniff(bytes);
  if (!detected || !allowed.includes(detected))
    throw new ApiError(415, 'unsupported_media_type', `Upload a ${list} file.`, { field: 'file' });
  if (detected !== input.contentType)
    throw new ApiError(415, 'unsupported_media_type', `The file’s contents don’t match its type. Upload a ${list} file.`, {
      field: 'file',
    });
  return { bytes, detected };
}

export function uploadOrderDocument(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  orderId: string,
  input: { kind: 'id_document'; fileName: string; contentType: DocumentType; dataBase64: string },
) {
  const o = customerOrder(ctx, userId, orderId);
  if (o.payout_method !== 'courier_cash')
    throw conflict('This order has no cash handover, so no ID upload is needed.', 'invalid_transition');
  if (o.status !== 'created' && o.status !== 'awaiting_deposit')
    throw conflict(
      'Upload the ID before the courier visit. This order has moved on; contact support if something changed.',
      'invalid_transition',
    );
  if (orderDocuments(ctx, o.id).length >= MAX_PER_ORDER)
    throw conflict(`An order can have at most ${MAX_PER_ORDER} uploads. Contact support if you need to replace one.`, 'too_many_documents');

  const { bytes, detected } = decodeUpload(input, { maxBytes: DOCUMENT_MAX_BYTES, allowed: DOCUMENT_TYPES });
  const id = newId('doc');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  writeOrderFile(ctx, id, bytes);
  try {
    ctx.db.tx(() => {
      ctx.db.run(
        `INSERT INTO order_documents (id, order_id, user_id, kind, file_name, content_type, size_bytes, sha256, stored, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, o.id, userId, input.kind, cleanName(input.fileName), detected, bytes.length, sha256, ctx.clock.now()],
      );
      audit(ctx, actor, {
        action: 'order.document_uploaded',
        targetType: 'order',
        targetId: o.id,
        data: { documentId: id, kind: input.kind, contentType: detected, sizeBytes: bytes.length, stored: true },
      });
    });
  } catch (e) {
    deleteOrderFile(ctx, id);
    throw e;
  }
  ctx.db.afterCommit(() =>
    ctx.bus.publish([{ userId: o.user_id }, { staff: true }], { type: 'order.updated', data: { orderId: o.id, status: o.status } }),
  );
  return orderDocuments(ctx, o.id);
}

type DocRow = {
  id: string;
  order_id: string;
  user_id: string;
  kind: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  stored: number;
  visibility: string;
  created_at: number;
};

/** Persist a validated upload for payment/refund/admin attachments (caller is already in a tx when needed). */
export function persistOrderAttachment(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  orderId: string,
  file: { fileName: string; contentType: DocumentType; dataBase64: string },
  kind: 'payment_receipt' | 'refund_attachment' | 'admin_attachment',
  message?: string | null,
): string {
  const { bytes, detected } = decodeUpload(file, { maxBytes: DOCUMENT_MAX_BYTES, allowed: DOCUMENT_TYPES });
  const id = newId('doc');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  writeOrderFile(ctx, id, bytes);
  try {
    ctx.db.run(
      `INSERT INTO order_documents
        (id, order_id, user_id, kind, file_name, content_type, size_bytes, sha256, stored, created_at, visibility, message, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'owner_staff', ?, ?)`,
      [id, orderId, userId, kind, cleanName(file.fileName), detected, bytes.length, sha256, ctx.clock.now(), message ?? null, actor.id],
    );
  } catch (e) {
    deleteOrderFile(ctx, id);
    throw e;
  }
  return id;
}

/**
 * Download an order attachment. Customers may open their own `owner_staff`
 * files; any staff role may open order attachments used in operations.
 * Support cannot open KYC identity files (separate handlers).
 */
export function downloadOrderDocument(
  ctx: AppContext,
  actor: Actor,
  opts: { userId: string; role: Role; orderId: string; documentId: string },
) {
  const row = ctx.db.get<DocRow>('SELECT * FROM order_documents WHERE id = ? AND order_id = ?', [opts.documentId, opts.orderId]);
  if (!row) throw notFound('Document not found.');
  const staff = STAFF_ROLES.includes(opts.role);
  if (!staff) {
    if (row.user_id !== opts.userId) throw notFound('Document not found.');
    if (row.visibility === 'staff_only') throw forbidden('This file is only available to staff.');
    customerOrder(ctx, opts.userId, opts.orderId);
  } else {
    getOrderRow(ctx, opts.orderId);
  }
  if (row.stored !== 1) throw conflict('This file was not retained on the server.', 'file_not_stored');
  const bytes = readOrderFile(ctx, row.id);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== row.sha256) throw new ApiError(500, 'internal', 'Stored file failed integrity check.');
  if (staff) {
    audit(ctx, actor, {
      action: 'order.document_viewed',
      targetType: 'order',
      targetId: opts.orderId,
      data: { documentId: row.id, kind: row.kind },
    });
  }
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    dataBase64: bytes.toString('base64'),
  };
}
