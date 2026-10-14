/**
 * Idempotency keys for customer writes that must not happen twice (creating
 * an order). The first request with a key runs and its response is stored;
 * a retry with the same key and body gets the stored response; the same key
 * with a different body is rejected.
 */
import { createHash } from 'node:crypto';
import type { AppContext } from '../context';
import { ApiError, badRequest } from '../http/errors';
import { jsonStringify, type Reply } from '../http/router';

const TTL_MS = 24 * 3_600_000;

export async function withIdempotency(
  ctx: AppContext,
  scope: string,
  key: string | undefined,
  body: unknown,
  run: () => Promise<Reply>,
): Promise<Reply> {
  if (!key) return run();
  if (!/^[\w-]{8,128}$/.test(key)) throw badRequest('Idempotency-Key must be 8–128 letters, digits, - or _.');
  const hash = createHash('sha256').update(jsonStringify(body)).digest('hex');
  const now = ctx.clock.now();
  ctx.db.run('DELETE FROM idempotency_keys WHERE expires_at <= ?', [now]);
  const existing = ctx.db.get<{ request_hash: string; status_code: number | null; response_body: string | null }>(
    'SELECT * FROM idempotency_keys WHERE scope = ? AND key = ?',
    [scope, key],
  );
  if (existing) {
    if (existing.request_hash !== hash)
      throw new ApiError(422, 'idempotency_conflict', 'This Idempotency-Key was already used with a different request.');
    if (existing.status_code === null) throw new ApiError(409, 'request_in_progress', 'The same request is still being processed.');
    return { status: existing.status_code, body: JSON.parse(existing.response_body ?? 'null'), headers: { 'Idempotent-Replayed': 'true' } };
  }
  ctx.db.run('INSERT INTO idempotency_keys (scope, key, request_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [
    scope,
    key,
    hash,
    now,
    now + TTL_MS,
  ]);
  try {
    const reply = await run();
    ctx.db.run('UPDATE idempotency_keys SET status_code = ?, response_body = ? WHERE scope = ? AND key = ?', [
      reply.status ?? 200,
      jsonStringify(reply.body ?? null),
      scope,
      key,
    ]);
    return reply;
  } catch (e) {
    ctx.db.run('DELETE FROM idempotency_keys WHERE scope = ? AND key = ?', [scope, key]);
    throw e;
  }
}
