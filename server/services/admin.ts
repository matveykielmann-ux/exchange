/**
 * Admin read models: dashboard metrics, the request queue, users, audit log,
 * webhook log. Every figure is computed from database records at request time.
 */
import { NEEDS_OPERATOR, ORDER_STATUSES, orderStage, STAGE_STATUSES, type OrderStage, type OrderStatus } from '@/domain/order';
import { REAL_MONEY_ENABLED, FEATURE_FLAGS } from '@/config/runtime';
import type { Actor, AppContext } from '../context';
import { badRequest, conflict, forbidden, notFound } from '../http/errors';
import type { Role } from '../http/router';
import { providerInfos } from '../providers/registry';
import { audit, verifyAuditChain } from './audit';
import { migrationStatus } from '../db/database';
import { maskEmail } from './format';
import { displayAmountAtomic, type OrderRow } from './orders';

const DAY = 86_400_000;

export function overview(ctx: AppContext) {
  const now = ctx.clock.now();
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of ctx.db.all<{ status: OrderStatus; n: number }>('SELECT status, count(*) AS n FROM orders GROUP BY status'))
    byStatus[r.status] = r.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const overdue = overdueClause(now);
  const overdueCount = ctx.db.get<{ n: number }>(`SELECT count(*) AS n FROM orders o WHERE ${overdue.sql}`, overdue.params)!.n;
  const openConversations = ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM support_conversations WHERE status != 'resolved'")!.n;
  const needsAction = ctx.db.get<{ n: number }>(`SELECT count(*) AS n FROM orders o WHERE ${NEEDS_ACTION_SQL}`)!.n;
  const onHold = ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM orders WHERE on_hold = 1')!.n;
  const unreadConversations = ctx.db.get<{ n: number }>(
    "SELECT count(*) AS n FROM support_conversations c WHERE status != 'resolved' AND EXISTS (SELECT 1 FROM support_messages m WHERE m.conversation_id = c.id AND m.author_kind = 'customer' AND m.created_at > c.staff_last_read_at)",
  )!.n;

  // Processing time: request created → provider-reported completion, completed orders in the last 30 days.
  const durations = ctx.db
    .all<{ ms: number }>(
      `SELECT (e.created_at - o.created_at) AS ms FROM orders o JOIN order_events e ON e.order_id = o.id AND e.type = 'PAYOUT_COMPLETED'
       WHERE o.status = 'completed' AND e.created_at >= ? ORDER BY ms`,
      [now - 30 * DAY],
    )
    .map((r) => r.ms);
  const median = durations.length ? durations[Math.floor(durations.length / 2)]! : null;
  const reviewAges = ctx.db
    .all<{ created_at: number }>("SELECT created_at FROM compliance_reviews WHERE status IN ('open','info_requested')")
    .map((r) => now - r.created_at);

  const createdLast7 = ctx.db.all<{ day: string; n: number }>(
    "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, count(*) AS n FROM orders WHERE created_at >= ? GROUP BY day ORDER BY day",
    [now - 7 * DAY],
  );

  return {
    generatedAt: now,
    totals: {
      total,
      needsReview: byStatus.compliance_review,
      awaitingDeposit: byStatus.awaiting_deposit + byStatus.created,
      awaitingConfirmation: byStatus.deposit_observed + byStatus.confirming + byStatus.deposit_confirmed,
      awaitingPayout: byStatus.ready_for_payout + byStatus.payout_submitted + byStatus.payout_processing,
      failedOrOverdue: byStatus.failed + byStatus.refund_pending + overdueCount,
      completed: byStatus.completed,
      /** Waiting on a person: review, payout authorization, a failed payout, a pending refund, or a hold. */
      needsAction,
      onHold,
      openConversations,
      unreadConversations,
    },
    byStatus,
    processing: {
      completedLast30Days: durations.length,
      medianMinutesToComplete: median === null ? null : Math.round(median / 60_000),
      oldestOpenReviewMinutes: reviewAges.length ? Math.round(Math.max(...reviewAges) / 60_000) : null,
    },
    createdLast7Days: createdLast7,
  };
}

/** Orders waiting on a person (see NEEDS_OPERATOR), including any order an operator has put on hold. */
const NEEDS_ACTION_SQL = `(o.status IN (${[...NEEDS_OPERATOR].map((s) => `'${s}'`).join(',')}) OR o.on_hold = 1)`;

/** Orders that have waited too long on the network, a provider, or a person. Thresholds are operational placeholders. */
function overdueClause(now: number) {
  return {
    sql: `((o.status = 'awaiting_deposit' AND o.deposit_deadline <= :now)
        OR (o.status IN ('payout_submitted','payout_processing') AND o.updated_at <= :payoutStale)
        OR (o.status = 'compliance_review' AND o.updated_at <= :reviewStale)
        OR (o.status = 'ready_for_payout' AND o.updated_at <= :readyStale))`,
    params: { now, payoutStale: now - 3 * DAY, reviewStale: now - DAY, readyStale: now - 4 * 3_600_000 },
  };
}

export interface QueueFilter {
  q: string | null;
  statuses: OrderStatus[];
  /** Pipeline stages (New, Awaiting Payment, …); combined with OR, then AND-ed with `statuses`. */
  stages: OrderStage[];
  payoutMethod: string | null;
  minNetCents: number | null;
  maxNetCents: number | null;
  from: number | null;
  to: number | null;
  review: 'open' | 'any';
  assigned: 'me' | 'unassigned' | 'any';
  overdue: boolean;
  /** Only orders waiting on a person. */
  attention: boolean;
  /** 'attention': orders waiting on a person first, then everything else by most recent update. */
  sort: 'created_at' | 'updated_at' | 'net_cents' | 'priority' | 'attention';
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function priorityOf(o: Pick<OrderRow, 'status' | 'updated_at' | 'deposit_deadline'>, now: number): 'high' | 'medium' | 'low' {
  if (o.status === 'failed' || o.status === 'refund_pending') return 'high';
  if (o.status === 'compliance_review') return now - o.updated_at > DAY ? 'high' : 'medium';
  if (o.status === 'awaiting_deposit' && o.deposit_deadline <= now) return 'high';
  if ((o.status === 'payout_submitted' || o.status === 'payout_processing') && now - o.updated_at > 3 * DAY) return 'high';
  if (NEEDS_OPERATOR.has(o.status)) return 'medium';
  return 'low';
}

export function queue(ctx: AppContext, staffId: string, f: QueueFilter) {
  const now = ctx.clock.now();
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (f.q) {
    where.push(
      "(o.id = :exact OR o.reference = :exactUpper OR u.email LIKE :like ESCAPE '\\' OR p.full_name LIKE :like ESCAPE '\\' OR o.deposit_tx_hash = :exact OR o.payout_provider_ref = :exact)",
    );
    params.exact = f.q;
    params.exactUpper = f.q.toUpperCase();
    params.like = `%${f.q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
  }
  if (f.statuses.length) {
    where.push(`o.status IN (${f.statuses.map((_, i) => `:s${i}`).join(',')})`);
    f.statuses.forEach((s, i) => (params[`s${i}`] = s));
  }
  if (f.stages.length) {
    const parts: string[] = [];
    f.stages.forEach((stage, i) => {
      if (stage === 'on_hold') {
        parts.push("(o.on_hold = 1 OR o.status = 'failed')");
        return;
      }
      const list = STAGE_STATUSES[stage];
      list.forEach((st, j) => (params[`g${i}_${j}`] = st));
      parts.push(`(o.on_hold = 0 AND o.status IN (${list.map((_, j) => `:g${i}_${j}`).join(',')}))`);
    });
    where.push(`(${parts.join(' OR ')})`);
  }
  if (f.payoutMethod) {
    where.push('o.payout_method = :method');
    params.method = f.payoutMethod;
  }
  if (f.minNetCents !== null) {
    where.push('o.net_cents >= :minNet');
    params.minNet = f.minNetCents;
  }
  if (f.maxNetCents !== null) {
    where.push('o.net_cents <= :maxNet');
    params.maxNet = f.maxNetCents;
  }
  if (f.from !== null) {
    where.push('o.created_at >= :from');
    params.from = f.from;
  }
  if (f.to !== null) {
    where.push('o.created_at < :to');
    params.to = f.to;
  }
  if (f.review === 'open')
    where.push("EXISTS (SELECT 1 FROM compliance_reviews r WHERE r.order_id = o.id AND r.status IN ('open','info_requested'))");
  if (f.assigned === 'me') {
    where.push('o.assigned_operator_id = :me');
    params.me = staffId;
  } else if (f.assigned === 'unassigned') where.push('o.assigned_operator_id IS NULL');
  if (f.attention) where.push(NEEDS_ACTION_SQL);
  if (f.overdue) {
    const od = overdueClause(now);
    where.push(od.sql);
    Object.assign(params, od.params);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN customer_profiles p ON p.user_id = o.user_id';
  const total = ctx.db.get<{ n: number }>(`SELECT count(*) AS n ${from} ${clause}`, params)!.n;
  const priorityExpr = `CASE WHEN o.status IN ('failed','refund_pending') THEN 0 WHEN o.status = 'compliance_review' THEN 1 WHEN o.status = 'ready_for_payout' THEN 2 ELSE 3 END`;
  const order =
    f.sort === 'priority'
      ? `${priorityExpr} ${f.dir === 'asc' ? 'DESC' : 'ASC'}, o.updated_at ASC`
      : f.sort === 'attention'
        ? `CASE WHEN ${NEEDS_ACTION_SQL} THEN 0 ELSE 1 END, o.updated_at DESC`
        : `o.${f.sort} ${f.dir.toUpperCase()}`;
  const rows = ctx.db.all<OrderRow & { email: string; full_name: string | null; assigned_email: string | null }>(
    `SELECT o.*, u.email, p.full_name, a.email AS assigned_email ${from} LEFT JOIN users a ON a.id = o.assigned_operator_id ${clause} ORDER BY ${order}, o.id LIMIT :limit OFFSET :offset`,
    { ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize },
  );
  return {
    total,
    page: f.page,
    pageSize: f.pageSize,
    items: rows.map((o) => ({
      id: o.id,
      reference: o.reference,
      source: o.source,
      direction: o.direction,
      status: o.status,
      stage: orderStage(o.status, o.on_hold === 1),
      onHold: o.on_hold === 1,
      priority: priorityOf(o, now),
      customer: { id: o.user_id, email: maskEmail(o.email), name: o.full_name ?? '' },
      asset: o.asset,
      network: o.network,
      amountAtomic: displayAmountAtomic(o),
      grossCents: String(o.gross_cents),
      netCents: String(o.net_cents),
      payoutMethod: o.payout_method,
      assignedTo: o.assigned_operator_id ? { id: o.assigned_operator_id, email: o.assigned_email } : null,
      depositException: o.deposit_exception,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    })),
  };
}

/** "jo•••@example.com" — enough to recognise, not enough to harvest. */
export { maskEmail } from './format';

export function customerSummary(ctx: AppContext, userId: string) {
  const u = ctx.db.get<{ email: string; created_at: number; status: string }>('SELECT email, created_at, status FROM users WHERE id = ?', [
    userId,
  ])!;
  const p = ctx.db.get<{
    full_name: string;
    phone: string | null;
    state_of_residence: string | null;
    kyc_status: string;
    kyc_level: string;
  }>('SELECT * FROM customer_profiles WHERE user_id = ?', [userId]);
  const stats = ctx.db.get<{ n: number; completed: number }>(
    "SELECT count(*) AS n, sum(status = 'completed') AS completed FROM orders WHERE user_id = ?",
    [userId],
  )!;
  return {
    id: userId,
    email: maskEmail(u.email),
    name: p?.full_name ?? '',
    phone: p?.phone ? `•••-•••-${p.phone.replace(/\D/g, '').slice(-4)}` : null,
    stateOfResidence: p?.state_of_residence ?? null,
    kycStatus: p?.kyc_status ?? 'unverified',
    kycLevel: p?.kyc_level ?? 'none',
    accountStatus: u.status,
    memberSince: u.created_at,
    orders: { total: stats.n, completed: stats.completed ?? 0 },
  };
}

export function staffList(ctx: AppContext) {
  return ctx.db.all<{ id: string; email: string; role: Role }>(
    "SELECT id, email, role FROM users WHERE role IN ('support','reviewer','admin','owner') AND status = 'active' ORDER BY email",
  );
}

export function listUsers(ctx: AppContext, f: { q: string | null; role: Role | null; page: number; pageSize: number }) {
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (f.q) {
    where.push("(u.email LIKE :q ESCAPE '\\' OR p.full_name LIKE :q ESCAPE '\\' OR u.id = :exact)");
    params.q = `%${f.q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    params.exact = f.q;
  }
  if (f.role) {
    where.push('u.role = :role');
    params.role = f.role;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM users u LEFT JOIN customer_profiles p ON p.user_id = u.id';
  const total = ctx.db.get<{ n: number }>(`SELECT count(*) AS n ${from} ${clause}`, params)!.n;
  const rows = ctx.db.all<{
    id: string;
    email: string;
    role: Role;
    status: string;
    totp_enabled: number;
    created_at: number;
    full_name: string | null;
    kyc_status: string | null;
  }>(
    `SELECT u.id, u.email, u.role, u.status, u.totp_enabled, u.created_at, p.full_name, p.kyc_status ${from} ${clause} ORDER BY u.created_at DESC LIMIT :limit OFFSET :offset`,
    { ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize },
  );
  return {
    total,
    page: f.page,
    pageSize: f.pageSize,
    items: rows.map((r) => ({
      id: r.id,
      email: r.role === 'customer' ? maskEmail(r.email) : r.email,
      name: r.full_name ?? '',
      role: r.role,
      status: r.status,
      totpEnabled: r.totp_enabled === 1,
      kycStatus: r.kyc_status,
      createdAt: r.created_at,
    })),
  };
}

const ROLE_RANK: Record<Role, number> = { customer: 0, support: 1, reviewer: 2, admin: 3, owner: 4 };

/**
 * Role changes. Admins may grant up to reviewer; only owners may grant admin
 * or owner. Nobody changes their own role, and the last owner can't be demoted.
 */
export function changeRole(ctx: AppContext, actor: Actor & { role: string }, targetId: string, role: Role, reason: string) {
  if (!reason || reason.trim().length < 4) throw badRequest('Give a reason for the role change.', { field: 'reason' });
  if (actor.id === targetId) throw forbidden('You cannot change your own role.');
  const target = ctx.db.get<{ role: Role }>('SELECT role FROM users WHERE id = ?', [targetId]);
  if (!target) throw notFound('User not found.');
  const actorRank = ROLE_RANK[actor.role as Role] ?? 0;
  if (actorRank < ROLE_RANK.owner && (ROLE_RANK[role] >= ROLE_RANK.admin || ROLE_RANK[target.role] >= ROLE_RANK.admin))
    throw forbidden('Only an owner can grant or remove admin and owner roles.');
  if (target.role === 'owner' && role !== 'owner') {
    const owners = ctx.db.get<{ n: number }>("SELECT count(*) AS n FROM users WHERE role = 'owner' AND status = 'active'")!.n;
    if (owners <= 1) throw conflict('This is the last owner account.');
  }
  ctx.db.tx(() => {
    ctx.db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, ctx.clock.now(), targetId]);
    // New privileges take effect on the next sign-in.
    ctx.db.run('DELETE FROM sessions WHERE user_id = ?', [targetId]);
    audit(ctx, actor, { action: 'user.role_changed', targetType: 'user', targetId, reason, data: { from: target.role, to: role } });
  });
}

export function setUserStatus(
  ctx: AppContext,
  actor: Actor & { role: string },
  targetId: string,
  status: 'active' | 'disabled',
  reason: string,
) {
  if (!reason || reason.trim().length < 4) throw badRequest('Give a reason.', { field: 'reason' });
  if (actor.id === targetId) throw forbidden('You cannot disable your own account.');
  const target = ctx.db.get<{ role: Role }>('SELECT role FROM users WHERE id = ?', [targetId]);
  if (!target) throw notFound('User not found.');
  if (ROLE_RANK[target.role] >= ROLE_RANK[actor.role as Role])
    throw forbidden('You can only change accounts with a lower role than yours.');
  ctx.db.tx(() => {
    ctx.db.run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, ctx.clock.now(), targetId]);
    if (status === 'disabled') ctx.db.run('DELETE FROM sessions WHERE user_id = ?', [targetId]);
    audit(ctx, actor, { action: `user.${status}`, targetType: 'user', targetId, reason });
  });
}

export function auditLog(
  ctx: AppContext,
  f: { targetType: string | null; targetId: string | null; actorId: string | null; action: string | null; page: number; pageSize: number },
) {
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (f.targetType) {
    where.push('target_type = :tt');
    params.tt = f.targetType;
  }
  if (f.targetId) {
    where.push('target_id = :tid');
    params.tid = f.targetId;
  }
  if (f.actorId) {
    where.push('actor_id = :aid');
    params.aid = f.actorId;
  }
  if (f.action) {
    where.push("action LIKE :action ESCAPE '\\'");
    params.action = `${f.action.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = ctx.db.get<{ n: number }>(`SELECT count(*) AS n FROM audit_events ${clause}`, params)!.n;
  const items = ctx.db
    .all<{
      id: number;
      at: number;
      actor_type: string;
      actor_id: string | null;
      actor_role: string | null;
      action: string;
      target_type: string | null;
      target_id: string | null;
      reason: string | null;
      ip: string | null;
      data: string;
      hash: string;
    }>(`SELECT * FROM audit_events ${clause} ORDER BY id DESC LIMIT :limit OFFSET :offset`, {
      ...params,
      limit: f.pageSize,
      offset: (f.page - 1) * f.pageSize,
    })
    .map((r) => ({
      id: r.id,
      at: r.at,
      actor: { type: r.actor_type, id: r.actor_id, role: r.actor_role },
      action: r.action,
      target: r.target_type ? { type: r.target_type, id: r.target_id } : null,
      reason: r.reason,
      ip: r.ip,
      data: JSON.parse(r.data) as Record<string, unknown>,
      hash: r.hash.slice(0, 12),
    }));
  return { total, page: f.page, pageSize: f.pageSize, items };
}

export function webhookLog(ctx: AppContext, page: number, pageSize: number) {
  const total = ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM provider_webhook_events')!.n;
  const items = ctx.db
    .all<{
      id: string;
      provider: string;
      event_id: string;
      event_type: string;
      status: string;
      error: string | null;
      received_at: number;
      processed_at: number | null;
    }>(
      'SELECT id, provider, event_id, event_type, status, error, received_at, processed_at FROM provider_webhook_events ORDER BY received_at DESC LIMIT ? OFFSET ?',
      [pageSize, (page - 1) * pageSize],
    )
    .map((w) => ({
      id: w.id,
      provider: w.provider,
      eventId: w.event_id,
      type: w.event_type,
      status: w.status,
      error: w.error,
      receivedAt: w.received_at,
      processedAt: w.processed_at,
    }));
  return { total, page, pageSize, items };
}

export function systemStatus(ctx: AppContext) {
  const migrations = migrationStatus(ctx.db);
  const chain = verifyAuditChain(ctx);
  return {
    mode: ctx.config.mode,
    realMoneyEnabled: REAL_MONEY_ENABLED,
    featureFlags: FEATURE_FLAGS,
    providers: providerInfos(ctx.providers),
    database: { applied: migrations.applied.length, pending: migrations.pending.map((m) => m.name) },
    auditChain: chain,
    liveConnections: ctx.bus.connectionCount,
    requireStaffMfa: ctx.config.requireStaffMfa,
    manualReviewThresholdCents: ctx.config.manualReviewThresholdCents.toString(),
    warnings: ctx.config.warnings,
    notifications: ctx.db.all<{ status: string; n: number }>('SELECT status, count(*) AS n FROM notifications GROUP BY status'),
  };
}

export function largeDeskRequests(ctx: AppContext, page: number, pageSize: number) {
  const total = ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM large_desk_requests')!.n;
  const items = ctx.db
    .all<
      Record<string, unknown> & { approximate_usd_cents: number; email: string }
    >('SELECT * FROM large_desk_requests ORDER BY created_at DESC LIMIT ? OFFSET ?', [pageSize, (page - 1) * pageSize])
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      asset: r.asset,
      network: r.network,
      approximateUsdCents: String(r.approximate_usd_cents),
      customerType: r.customer_type,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      timing: r.timing,
      notes: r.notes,
      status: r.status,
      createdAt: r.created_at,
    }));
  return { total, page, pageSize, items };
}

export function sandboxNotifications(ctx: AppContext, limit = 50) {
  return ctx.db
    .all<{
      id: string;
      recipient: string;
      template: string;
      subject: string;
      body: string;
      status: string;
      created_at: number;
    }>('SELECT id, recipient, template, subject, body, status, created_at FROM notifications ORDER BY created_at DESC LIMIT ?', [limit])
    .map((n) => ({
      id: n.id,
      recipient: n.recipient,
      template: n.template,
      subject: n.subject,
      body: n.body,
      status: n.status,
      createdAt: n.created_at,
    }));
}
