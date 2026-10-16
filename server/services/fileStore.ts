/**
 * Encrypted on-disk storage for order attachments (ID photos, payment receipts,
 * admin verification files, refund attachments). Metadata lives in SQLite
 * (`order_documents`); ciphertext lives under FILES_DIR and is never served
 * as a static path — only through authorized API handlers.
 *
 * KYC identity files stay in the database (`kyc_files.content_enc`); this
 * module is for order-linked blobs that would otherwise bloat SQLite.
 */
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { AppContext } from '../context';
import { notFound } from '../http/errors';
import { decrypt, encrypt } from '../lib/crypto';

const SAFE_ID = /^[a-z][a-z0-9_]*$/i;

function orderRelPath(documentId: string): string {
  if (!SAFE_ID.test(documentId)) throw new Error('Invalid document id for storage path.');
  return path.join('order', `${documentId}.enc`);
}

export function absoluteFilePath(ctx: AppContext, documentId: string): string {
  return path.join(ctx.config.filesDir, orderRelPath(documentId));
}

/** Create the files root (and order/ subdirectory) with restrictive permissions. */
export function ensureFilesDir(ctx: AppContext): void {
  mkdirSync(ctx.config.filesDir, { recursive: true, mode: 0o700 });
  mkdirSync(path.join(ctx.config.filesDir, 'order'), { recursive: true, mode: 0o700 });
}

/**
 * Encrypt and write bytes for an order document. Uses a temp file then rename
 * so a crash mid-write does not leave a truncated object under the final name.
 */
export function writeOrderFile(ctx: AppContext, documentId: string, bytes: Buffer): void {
  ensureFilesDir(ctx);
  const dest = absoluteFilePath(ctx, documentId);
  const tmp = `${dest}.tmp-${process.pid}`;
  const payload = encrypt(ctx.config.dataEncryptionKey, bytes.toString('base64'));
  try {
    writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmp, dest);
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore cleanup errors */
    }
    throw e;
  }
}

export function readOrderFile(ctx: AppContext, documentId: string): Buffer {
  const dest = absoluteFilePath(ctx, documentId);
  if (!existsSync(dest)) throw notFound('Stored file not found.');
  const payload = readFileSync(dest, 'utf8');
  const b64 = decrypt(ctx.config.dataEncryptionKey, payload);
  return Buffer.from(b64, 'base64');
}

export function orderFileExists(ctx: AppContext, documentId: string): boolean {
  return existsSync(absoluteFilePath(ctx, documentId));
}

/** Best-effort cleanup when a DB insert fails after the file was written. */
export function deleteOrderFile(ctx: AppContext, documentId: string): void {
  try {
    const dest = absoluteFilePath(ctx, documentId);
    if (existsSync(dest)) unlinkSync(dest);
  } catch {
    /* orphan files are cleaned by ops if needed */
  }
}
