/**
 * Webhook signatures: `X-Arcvale-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`.
 * The timestamp is part of the signed payload and must be within the
 * tolerance, which stops replay of old captured requests. Duplicate delivery
 * of a fresh event is handled separately by event-id idempotency.
 */
import { createHmac } from 'node:crypto';
import { safeEqualHex } from '../lib/crypto';

export const SIGNATURE_HEADER = 'x-arcvale-signature';
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signWebhook(secret: string, body: string, nowMs: number): string {
  const t = Math.floor(nowMs / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'mismatch' };

export function verifyWebhookSignature(secret: string, header: string | undefined, body: Buffer | string, nowMs: number): SignatureCheck {
  if (!header) return { ok: false, reason: 'missing' };
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return { ok: false, reason: 'malformed' };
  if (Math.abs(nowMs / 1000 - t) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
  const expected = createHmac('sha256', secret).update(`${t}.`).update(body).digest('hex');
  return safeEqualHex(expected, v1) ? { ok: true } : { ok: false, reason: 'mismatch' };
}
