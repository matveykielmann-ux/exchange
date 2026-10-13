/**
 * Persistent support conversations. Messages are stored in the database
 * (append-only) and pushed to connected clients over server-sent events after
 * commit. Staff can write internal notes that customers never receive.
 * A client-generated message id makes retries after a network failure safe.
 */
import type { Actor, AppContext } from '../context';
import { badRequest, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { audit } from './audit';
import { maskEmail } from './format';
import { notify } from './notifications';

export type ConversationStatus = 'open' | 'pending' | 'resolved';

interface ConversationRow {
  id: string;
  customer_id: string;
  order_id: string | null;
  subject: string;
  status: ConversationStatus;
  assigned_operator_id: string | null;
  created_at: number;
  updated_at: number;
  last_message_at: number;
  customer_last_read_at: number;
  staff_last_read_at: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  author_id: string | null;
  author_kind: 'customer' | 'staff' | 'system';
  body: string;
  internal: number;
  client_message_id: string | null;
  created_at: number;
}

function messageView(m: MessageRow, staffView: boolean) {
  return {
    id: m.id,
    authorKind: m.author_kind,
    ...(staffView ? { authorId: m.author_id } : {}),
    body: m.body,
    internal: m.internal === 1,
    clientMessageId: m.client_message_id,
    createdAt: m.created_at,
  };
}

function unreadFor(ctx: AppContext, c: ConversationRow, staffView: boolean): number {
  const since = staffView ? c.staff_last_read_at : c.customer_last_read_at;
  const kinds = staffView ? "('customer')" : "('staff','system')";
  return ctx.db.get<{ n: number }>(
    `SELECT count(*) AS n FROM support_messages WHERE conversation_id = ? AND created_at > ? AND author_kind IN ${kinds} ${staffView ? '' : 'AND internal = 0'}`,
    [c.id, since],
  )!.n;
}

function conversationView(ctx: AppContext, c: ConversationRow, staffView: boolean) {
  const last = ctx.db.get<MessageRow>(
    `SELECT * FROM support_messages WHERE conversation_id = ? ${staffView ? '' : 'AND internal = 0'} ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    [c.id],
  );
  const order = c.order_id
    ? ctx.db.get<{ reference: string; status: string }>('SELECT reference, status FROM orders WHERE id = ?', [c.order_id])
    : null;
  const base = {
    id: c.id,
    subject: c.subject,
    status: c.status,
    order: c.order_id && order ? { id: c.order_id, reference: order.reference, status: order.status } : null,
    createdAt: c.created_at,
    lastMessageAt: c.last_message_at,
    lastMessage: last ? { body: last.body.slice(0, 140), authorKind: last.author_kind, internal: last.internal === 1 } : null,
    unread: unreadFor(ctx, c, staffView),
  };
  if (!staffView) return base;
  const customer = ctx.db.get<{ email: string; full_name: string | null }>(
    'SELECT u.email, p.full_name FROM users u LEFT JOIN customer_profiles p ON p.user_id = u.id WHERE u.id = ?',
    [c.customer_id],
  );
  return {
    ...base,
    customer: { id: c.customer_id, email: maskEmail(customer?.email ?? ''), name: customer?.full_name ?? '' },
    assignedOperatorId: c.assigned_operator_id,
  };
}

function publish(ctx: AppContext, c: Pick<ConversationRow, 'id' | 'customer_id'>, message: MessageRow | null) {
  ctx.db.afterCommit(() => {
    if (message) {
      ctx.bus.publish([{ staff: true }], { type: 'message.created', data: { conversationId: c.id, message: messageView(message, true) } });
      if (!message.internal)
        ctx.bus.publish([{ userId: c.customer_id }], {
          type: 'message.created',
          data: { conversationId: c.id, message: messageView(message, false) },
        });
    }
    ctx.bus.publish([{ userId: c.customer_id }, { staff: true }], { type: 'conversation.updated', data: { conversationId: c.id } });
  });
}

function insertMessage(
  ctx: AppContext,
  c: ConversationRow,
  m: { authorId: string | null; kind: MessageRow['author_kind']; body: string; internal: boolean; clientMessageId: string | null },
): MessageRow {
  const body = m.body.trim();
  if (!body) throw badRequest('Write a message.', { field: 'body' });
  if (body.length > 4000) throw badRequest('Messages can be up to 4,000 characters.', { field: 'body' });
  if (m.clientMessageId) {
    const dup = ctx.db.get<MessageRow>('SELECT * FROM support_messages WHERE conversation_id = ? AND client_message_id = ?', [
      c.id,
      m.clientMessageId,
    ]);
    if (dup) return dup; // Retry of a message that was already stored.
  }
  const row: MessageRow = {
    id: newId('msg'),
    conversation_id: c.id,
    author_id: m.authorId,
    author_kind: m.kind,
    body,
    internal: m.internal ? 1 : 0,
    client_message_id: m.clientMessageId,
    created_at: ctx.clock.now(),
  };
  ctx.db.run(
    'INSERT INTO support_messages (id, conversation_id, author_id, author_kind, body, internal, client_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [row.id, row.conversation_id, row.author_id, row.author_kind, row.body, row.internal, row.client_message_id, row.created_at],
  );
  if (!m.internal) {
    // A customer message reopens a resolved conversation; a staff reply marks it pending (waiting on the customer).
    const status: ConversationStatus =
      m.kind === 'customer' ? 'open' : m.kind === 'staff' ? 'pending' : c.status === 'resolved' ? 'open' : c.status;
    ctx.db.run('UPDATE support_conversations SET last_message_at = ?, updated_at = ?, status = ? WHERE id = ?', [
      row.created_at,
      row.created_at,
      status,
      c.id,
    ]);
  }
  if (m.kind === 'customer') ctx.db.run('UPDATE support_conversations SET customer_last_read_at = ? WHERE id = ?', [row.created_at, c.id]);
  if (m.kind === 'staff') ctx.db.run('UPDATE support_conversations SET staff_last_read_at = ? WHERE id = ?', [row.created_at, c.id]);
  publish(ctx, c, row);
  return row;
}

/* ---------- Customer ---------- */

function ownConversation(ctx: AppContext, userId: string, id: string): ConversationRow {
  const c = ctx.db.get<ConversationRow>('SELECT * FROM support_conversations WHERE id = ? AND customer_id = ?', [id, userId]);
  if (!c) throw notFound('Conversation not found.');
  return c;
}

export function listCustomerConversations(ctx: AppContext, userId: string) {
  return ctx.db
    .all<ConversationRow>('SELECT * FROM support_conversations WHERE customer_id = ? ORDER BY last_message_at DESC LIMIT 100', [userId])
    .map((c) => conversationView(ctx, c, false));
}

export function createConversation(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  input: { subject: string; body: string; orderId: string | null; clientMessageId: string | null },
) {
  if (input.orderId && !ctx.db.get('SELECT 1 FROM orders WHERE id = ? AND user_id = ?', [input.orderId, userId]))
    throw badRequest('Choose one of your own orders.', { field: 'orderId' });
  const now = ctx.clock.now();
  const c: ConversationRow = {
    id: newId('cnv'),
    customer_id: userId,
    order_id: input.orderId,
    subject: input.subject,
    status: 'open',
    assigned_operator_id: null,
    created_at: now,
    updated_at: now,
    last_message_at: now,
    customer_last_read_at: now,
    staff_last_read_at: 0,
  };
  return ctx.db.tx(() => {
    ctx.db.run(
      'INSERT INTO support_conversations (id, customer_id, order_id, subject, status, created_at, updated_at, last_message_at, customer_last_read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [c.id, userId, c.order_id, c.subject, 'open', now, now, now, now],
    );
    insertMessage(ctx, c, {
      authorId: userId,
      kind: 'customer',
      body: input.body,
      internal: false,
      clientMessageId: input.clientMessageId,
    });
    audit(ctx, actor, { action: 'support.conversation_created', targetType: 'conversation', targetId: c.id });
    return getCustomerConversation(ctx, userId, c.id);
  });
}

export function getCustomerConversation(ctx: AppContext, userId: string, id: string) {
  const c = ownConversation(ctx, userId, id);
  const messages = ctx.db.all<MessageRow>(
    'SELECT * FROM support_messages WHERE conversation_id = ? AND internal = 0 ORDER BY created_at, rowid',
    [id],
  );
  return { ...conversationView(ctx, c, false), messages: messages.map((m) => messageView(m, false)) };
}

export function postCustomerMessage(ctx: AppContext, userId: string, id: string, body: string, clientMessageId: string | null) {
  return ctx.db.tx(() => {
    const c = ownConversation(ctx, userId, id);
    return messageView(insertMessage(ctx, c, { authorId: userId, kind: 'customer', body, internal: false, clientMessageId }), false);
  });
}

export function markCustomerRead(ctx: AppContext, userId: string, id: string) {
  ownConversation(ctx, userId, id);
  ctx.db.run('UPDATE support_conversations SET customer_last_read_at = ? WHERE id = ?', [ctx.clock.now(), id]);
}

/** Opens (or reuses) the order's conversation and posts a message from the team, e.g. an information request. */
export function postSystemMessage(ctx: AppContext, actor: Actor, customerId: string, orderId: string, subject: string, body: string) {
  let c = ctx.db.get<ConversationRow>(
    'SELECT * FROM support_conversations WHERE customer_id = ? AND order_id = ? ORDER BY created_at DESC LIMIT 1',
    [customerId, orderId],
  );
  if (!c) {
    const now = ctx.clock.now();
    c = {
      id: newId('cnv'),
      customer_id: customerId,
      order_id: orderId,
      subject: subject.slice(0, 140),
      status: 'pending',
      assigned_operator_id: actor.id,
      created_at: now,
      updated_at: now,
      last_message_at: now,
      customer_last_read_at: 0,
      staff_last_read_at: now,
    };
    ctx.db.run(
      'INSERT INTO support_conversations (id, customer_id, order_id, subject, status, assigned_operator_id, created_at, updated_at, last_message_at, staff_last_read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [c.id, customerId, orderId, c.subject, 'pending', actor.id, now, now, now, now],
    );
  }
  insertMessage(ctx, c, { authorId: actor.id, kind: 'staff', body, internal: false, clientMessageId: null });
}

/* ---------- Staff ---------- */

export function inbox(
  ctx: AppContext,
  staffId: string,
  f: {
    status: ConversationStatus | 'all';
    q: string | null;
    assigned: 'me' | 'unassigned' | 'any';
    unread?: boolean;
    page: number;
    pageSize: number;
  },
) {
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (f.status !== 'all') {
    where.push('c.status = :status');
    params.status = f.status;
  }
  if (f.assigned === 'me') {
    where.push('c.assigned_operator_id = :me');
    params.me = staffId;
  } else if (f.assigned === 'unassigned') where.push('c.assigned_operator_id IS NULL');
  if (f.unread)
    where.push(
      "EXISTS (SELECT 1 FROM support_messages m WHERE m.conversation_id = c.id AND m.author_kind = 'customer' AND m.created_at > c.staff_last_read_at)",
    );
  if (f.q) {
    where.push("(c.subject LIKE :q ESCAPE '\\' OR u.email LIKE :q ESCAPE '\\' OR o.reference LIKE :q ESCAPE '\\' OR c.id = :exact)");
    params.q = `%${f.q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    params.exact = f.q;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM support_conversations c JOIN users u ON u.id = c.customer_id LEFT JOIN orders o ON o.id = c.order_id';
  const total = ctx.db.get<{ n: number }>(`SELECT count(*) AS n ${from} ${clause}`, params)!.n;
  const rows = ctx.db.all<ConversationRow>(`SELECT c.* ${from} ${clause} ORDER BY c.last_message_at DESC LIMIT :limit OFFSET :offset`, {
    ...params,
    limit: f.pageSize,
    offset: (f.page - 1) * f.pageSize,
  });
  return { total, page: f.page, pageSize: f.pageSize, items: rows.map((c) => conversationView(ctx, c, true)) };
}

function anyConversation(ctx: AppContext, id: string): ConversationRow {
  const c = ctx.db.get<ConversationRow>('SELECT * FROM support_conversations WHERE id = ?', [id]);
  if (!c) throw notFound('Conversation not found.');
  return c;
}

export function getStaffConversation(ctx: AppContext, id: string) {
  const c = anyConversation(ctx, id);
  const messages = ctx.db.all<MessageRow>('SELECT * FROM support_messages WHERE conversation_id = ? ORDER BY created_at, rowid', [id]);
  const orders = ctx.db.all<{ id: string; reference: string; status: string; created_at: number }>(
    'SELECT id, reference, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    [c.customer_id],
  );
  const profile = ctx.db.get<{ kyc_status: string; state_of_residence: string | null }>(
    'SELECT kyc_status, state_of_residence FROM customer_profiles WHERE user_id = ?',
    [c.customer_id],
  );
  return {
    ...conversationView(ctx, c, true),
    messages: messages.map((m) => messageView(m, true)),
    customerContext: {
      kycStatus: profile?.kyc_status ?? 'unverified',
      stateOfResidence: profile?.state_of_residence ?? null,
      recentOrders: orders.map((o) => ({ id: o.id, reference: o.reference, status: o.status, createdAt: o.created_at })),
    },
  };
}

export function staffReply(ctx: AppContext, actor: Actor, id: string, body: string, internal: boolean, clientMessageId: string | null) {
  return ctx.db.tx(() => {
    const c = anyConversation(ctx, id);
    const m = insertMessage(ctx, c, { authorId: actor.id, kind: 'staff', body, internal, clientMessageId });
    if (!c.assigned_operator_id) ctx.db.run('UPDATE support_conversations SET assigned_operator_id = ? WHERE id = ?', [actor.id, id]);
    audit(ctx, actor, {
      action: internal ? 'support.internal_note' : 'support.reply',
      targetType: 'conversation',
      targetId: id,
      data: { messageId: m.id },
    });
    if (!internal) {
      const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [c.customer_id])!.email;
      notify(ctx, { userId: c.customer_id, to: email, template: 'support_reply', vars: { subject: c.subject } });
    }
    return messageView(m, true);
  });
}

export function setConversationStatus(ctx: AppContext, actor: Actor, id: string, status: ConversationStatus) {
  ctx.db.tx(() => {
    const c = anyConversation(ctx, id);
    ctx.db.run('UPDATE support_conversations SET status = ?, updated_at = ? WHERE id = ?', [status, ctx.clock.now(), id]);
    audit(ctx, actor, { action: `support.status_${status}`, targetType: 'conversation', targetId: id, data: { from: c.status } });
    publish(ctx, c, null);
  });
}

export function assignConversation(ctx: AppContext, actor: Actor, id: string, operatorId: string | null) {
  if (
    operatorId &&
    !ctx.db.get("SELECT 1 FROM users WHERE id = ? AND role IN ('support','reviewer','admin','owner') AND status = 'active'", [operatorId])
  )
    throw badRequest('Assign to an active staff member.', { field: 'operatorId' });
  ctx.db.tx(() => {
    const c = anyConversation(ctx, id);
    ctx.db.run('UPDATE support_conversations SET assigned_operator_id = ?, updated_at = ? WHERE id = ?', [operatorId, ctx.clock.now(), id]);
    audit(ctx, actor, {
      action: 'support.assigned',
      targetType: 'conversation',
      targetId: id,
      data: { from: c.assigned_operator_id, to: operatorId },
    });
    publish(ctx, c, null);
  });
}

export function markStaffRead(ctx: AppContext, id: string) {
  anyConversation(ctx, id);
  ctx.db.run('UPDATE support_conversations SET staff_last_read_at = ? WHERE id = ?', [ctx.clock.now(), id]);
}
