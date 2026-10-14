/**
 * Documents a customer uploads for an order: the photo ID the courier checks
 * at a cash handover. This is a demo flow. The file is validated (declared
 * type must match its magic bytes, size limit, sanitized name) and
 * fingerprinted with SHA-256; in sandbox mode the content is then discarded
 * and never written anywhere. There is no document-storage provider yet, so
 * production mode refuses uploads with NOT_CONFIGURED rather than keeping
 * identity documents in the application database.
 */
import { createHash } from 'node:crypto';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, notConfigured } from '../http/errors';
import { newId } from '../lib/clock';
import { audit } from './audit';
import { customerOrder, orderDocuments } from './orders';

export const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
const MAX_PER_ORDER = 3;

function sniff(bytes: Buffer): DocumentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

function cleanName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  return (clean || 'document').slice(0, 120);
}

export function uploadOrderDocument(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  orderId: string,
  input: { kind: 'id_document'; fileName: string; contentType: DocumentType; dataBase64: string },
) {
  const o = customerOrder(ctx, userId, orderId);
  if (ctx.config.mode !== 'sandbox') throw notConfigured('Document storage');
  if (o.payout_method !== 'courier_cash')
    throw conflict('This order has no cash handover, so no ID upload is needed.', 'invalid_transition');
  if (o.status !== 'created' && o.status !== 'awaiting_deposit')
    throw conflict(
      'Upload the ID before the courier visit. This order has moved on; contact support if something changed.',
      'invalid_transition',
    );
  if (orderDocuments(ctx, o.id).length >= MAX_PER_ORDER)
    throw conflict(`An order can have at most ${MAX_PER_ORDER} uploads. Contact support if you need to replace one.`, 'too_many_documents');

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.dataBase64) || input.dataBase64.length % 4 !== 0)
    throw badRequest('The file could not be read. Choose it again.', { field: 'file' });
  const bytes = Buffer.from(input.dataBase64, 'base64');
  if (!bytes.length) throw badRequest('The file is empty.', { field: 'file' });
  if (bytes.length > DOCUMENT_MAX_BYTES) throw badRequest('The file is larger than 4 MB. Use a smaller photo or scan.', { field: 'file' });
  const detected = sniff(bytes);
  if (!detected) throw new ApiError(415, 'unsupported_media_type', 'Upload a JPEG, PNG or PDF file.', { field: 'file' });
  if (detected !== input.contentType)
    throw new ApiError(415, 'unsupported_media_type', 'The file’s contents don’t match its type. Upload a JPEG, PNG or PDF file.', {
      field: 'file',
    });

  const id = newId('doc');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  ctx.db.tx(() => {
    ctx.db.run(
      `INSERT INTO order_documents (id, order_id, user_id, kind, file_name, content_type, size_bytes, sha256, stored, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, o.id, userId, input.kind, cleanName(input.fileName), detected, bytes.length, sha256, ctx.clock.now()],
    );
    audit(ctx, actor, {
      action: 'order.document_uploaded',
      targetType: 'order',
      targetId: o.id,
      data: { documentId: id, kind: input.kind, contentType: detected, sizeBytes: bytes.length, stored: false },
    });
  });
  // Nothing keeps a reference to the content: it is discarded with the request.
  ctx.db.afterCommit(() =>
    ctx.bus.publish([{ userId: o.user_id }, { staff: true }], { type: 'order.updated', data: { orderId: o.id, status: o.status } }),
  );
  return orderDocuments(ctx, o.id);
}
