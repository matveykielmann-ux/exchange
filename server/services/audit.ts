/**
 * Append-only, hash-chained audit trail. Each row stores the hash of the
 * previous row, so deleting or editing a row (which triggers also block)
 * breaks the chain and verifyAuditChain reports where.
 */
import { createHash } from 'node:crypto';
import type { Actor, AppContext } from '../context';

export interface AuditInput {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  data?: Record<string, unknown>;
}

const GENESIS = '0'.repeat(64);

function digest(prev: string, row: Record<string, unknown>): string {
  return createHash('sha256').update(prev).update(JSON.stringify(row)).digest('hex');
}

const stringify = (d: unknown) => JSON.stringify(d ?? {}, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));

export function audit(ctx: Pick<AppContext, 'db' | 'clock'>, actor: Actor, input: AuditInput): void {
  const prev = ctx.db.get<{ hash: string }>('SELECT hash FROM audit_events ORDER BY id DESC LIMIT 1')?.hash ?? GENESIS;
  const row = {
    at: ctx.clock.now(),
    actor_type: actor.type,
    actor_id: actor.id,
    actor_role: actor.role,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    reason: input.reason ?? null,
    ip: actor.ip,
    data: stringify(input.data),
  };
  ctx.db.run(
    `INSERT INTO audit_events (at, actor_type, actor_id, actor_role, action, target_type, target_id, reason, ip, data, prev_hash, hash)
     VALUES (:at, :actor_type, :actor_id, :actor_role, :action, :target_type, :target_id, :reason, :ip, :data, :prev_hash, :hash)`,
    { ...row, prev_hash: prev, hash: digest(prev, row) },
  );
}

export function verifyAuditChain(ctx: Pick<AppContext, 'db'>): { ok: true; count: number } | { ok: false; brokenAtId: number } {
  let prev = GENESIS;
  let count = 0;
  for (const r of ctx.db.all<Record<string, unknown> & { id: number; prev_hash: string; hash: string }>(
    'SELECT * FROM audit_events ORDER BY id',
  )) {
    const row = {
      at: r.at,
      actor_type: r.actor_type,
      actor_id: r.actor_id,
      actor_role: r.actor_role,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      reason: r.reason,
      ip: r.ip,
      data: r.data,
    };
    if (r.prev_hash !== prev || digest(prev, row) !== r.hash) return { ok: false, brokenAtId: r.id };
    prev = r.hash;
    count++;
  }
  return { ok: true, count };
}
