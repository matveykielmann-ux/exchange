/**
 * Customer notifications. Every message is recorded first, then delivered
 * after the transaction commits:
 * - sandbox: captured in the database only (status sandbox_captured); never sent.
 * - production with an email provider: queued → sent / failed.
 * - production without one: not_configured. Nothing pretends it was sent.
 */
import { BRAND } from '@/config/brand';
import type { AppContext } from '../context';
import { newId } from '../lib/clock';
import { isUsable } from '../providers/registry';

export type Template =
  | 'welcome'
  | 'password_reset'
  | 'order_created'
  | 'buy_order_created'
  | 'buy_transfer_submitted'
  | 'buy_completed'
  | 'buy_cash_verified'
  | 'deposit_confirmed'
  | 'info_requested'
  | 'payout_submitted'
  | 'order_completed'
  | 'order_failed'
  | 'refund_started'
  | 'refund_completed'
  | 'support_reply'
  | 'verification_updated'
  | 'status_changed'
  | 'staff_message';

type Vars = Record<string, string>;

const TEMPLATES: Record<Template, (v: Vars) => { subject: string; body: string }> = {
  welcome: (v) => ({
    subject: `Welcome to ${BRAND.name}`,
    body: `Hi ${v.name},\n\nYour ${BRAND.name} account is ready. Verify your identity from your account page before your first exchange.\n\nIf you did not create this account, contact support.`,
  }),
  password_reset: (v) => ({
    subject: `Reset your ${BRAND.name} password`,
    body: `Use this link within 30 minutes to choose a new password:\n\n${v.url}\n\nIf you did not ask for this, you can ignore this email. Your password has not changed.`,
  }),
  order_created: (v) => ({
    subject: `Order ${v.reference}: send your deposit`,
    body: `We created order ${v.reference}. Send exactly ${v.amount} on ${v.network} before ${v.deadline}. Check the deposit address on the order page; never send to an address from an email.`,
  }),
  buy_order_created: (v) => ({
    subject: `Order ${v.reference}: cash collection requested`,
    body: `We created order ${v.reference} and asked the courier to collect ${v.cash} in cash before ${v.deadline}. The courier collects the cash only from you, after checking your ID. Follow the order on the order page.`,
  }),
  buy_transfer_submitted: (v) => ({
    subject: `Order ${v.reference}: crypto transfer submitted`,
    body: `Your transfer of ${v.amount} for order ${v.reference} was submitted to the custody provider. Timing is an estimate, not a guarantee.`,
  }),
  buy_completed: (v) => ({
    subject: `Order ${v.reference}: completed`,
    body: `The custody provider reports your transfer of ${v.amount} for order ${v.reference} as completed.`,
  }),
  buy_cash_verified: (v) => ({
    subject: `Order ${v.reference}: cash counted`,
    body: `The cash collected for order ${v.reference} was counted and matches the quote. We will update you when your crypto transfer is submitted.`,
  }),
  deposit_confirmed: (v) => ({
    subject: `Order ${v.reference}: deposit confirmed`,
    body: `Your deposit for order ${v.reference} is final on the network. We will update you when your payout is submitted.`,
  }),
  info_requested: (v) => ({
    subject: `Order ${v.reference}: we need more information`,
    body: `Our compliance team needs more information about order ${v.reference}. Open your support messages to reply.`,
  }),
  payout_submitted: (v) => ({
    subject: `Order ${v.reference}: payout submitted`,
    body: `Your payout of ${v.amount} for order ${v.reference} was submitted to the payout provider. ${v.timing}. Timing is an estimate, not a guarantee.`,
  }),
  order_completed: (v) => ({
    subject: `Order ${v.reference}: completed`,
    body: `The payout provider reports your payout of ${v.amount} for order ${v.reference} as completed.`,
  }),
  order_failed: (v) => ({
    subject: `Order ${v.reference}: payout needs attention`,
    body: `Your payout for order ${v.reference} could not be completed. Our team will contact you about next steps.`,
  }),
  refund_started: (v) => ({
    subject: `Order ${v.reference}: refund started`,
    body: `We started returning your deposit for order ${v.reference} to your refund address. Return fees under Section 9 of the Service Rules may be deducted.`,
  }),
  refund_completed: (v) => ({
    subject: `Order ${v.reference}: refund sent`,
    body: `Your refund for order ${v.reference} was sent to your refund address. Transaction: ${v.txHash}.`,
  }),
  support_reply: (v) => ({
    subject: `New reply: ${v.subject}`,
    body: `Our support team replied to “${v.subject}”. Sign in to read and answer it.`,
  }),
  status_changed: (v) => ({
    subject: `Order ${v.reference}: ${v.stage}`,
    body: `Your order ${v.reference} is now: ${v.status}. ${v.detail}`,
  }),
  staff_message: (v) => ({
    subject: `Order ${v.reference}: message from our team`,
    body: `Our team sent you a message about order ${v.reference}. Open your support messages to read and reply.`,
  }),
  verification_updated: (v) => ({
    subject: 'Your identity verification was updated',
    body: `Your identity verification status is now: ${v.status}. Open your account page for details.`,
  }),
};

export function notify(
  ctx: AppContext,
  input: { userId: string | null; to: string; template: Template; vars: Vars; orderId?: string | null },
): string {
  const { subject, body } = TEMPLATES[input.template](input.vars);
  const id = newId('ntf');
  const info = ctx.providers.email.info();
  const status = info.state === 'sandbox' ? 'sandbox_captured' : isUsable(info) ? 'queued' : 'not_configured';
  // Order notices are linked to their order, so the CRM can show each order's notification history.
  const orderId =
    input.orderId ??
    (input.vars.reference
      ? (ctx.db.get<{ id: string }>('SELECT id FROM orders WHERE reference = ?', [input.vars.reference])?.id ?? null)
      : null);
  ctx.db.run(
    'INSERT INTO notifications (id, user_id, channel, recipient, template, subject, body, status, created_at, order_id, vars) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, input.userId, 'email', input.to, input.template, subject, body, status, ctx.clock.now(), orderId, JSON.stringify(input.vars)],
  );
  if (status === 'queued') ctx.db.afterCommit(() => void deliver(ctx, id));
  if (input.userId) {
    const userId = input.userId;
    ctx.db.afterCommit(() => ctx.bus.publish([{ userId }], { type: 'notification.created', data: { id, template: input.template } }));
  }
  return id;
}

async function deliver(ctx: AppContext, id: string) {
  const n = ctx.db.get<{ recipient: string; subject: string; body: string }>(
    'SELECT recipient, subject, body FROM notifications WHERE id = ?',
    [id],
  );
  if (!n) return;
  try {
    const { providerRef } = await ctx.providers.email.send({
      to: n.recipient,
      subject: n.subject,
      text: n.body,
      idempotencyKey: `ntf:${id}`,
    });
    ctx.db.run("UPDATE notifications SET status = 'sent', provider_ref = ?, sent_at = ? WHERE id = ?", [providerRef, ctx.clock.now(), id]);
  } catch (e) {
    ctx.log.warn('notification delivery failed', { notificationId: id, error: e instanceof Error ? e.message : String(e) });
    ctx.db.run("UPDATE notifications SET status = 'failed', error = ? WHERE id = ?", [
      e instanceof Error ? e.message.slice(0, 300) : 'failed',
      id,
    ]);
  }
}

type NotificationRow = {
  id: string;
  template: string;
  subject: string;
  body: string;
  status: string;
  created_at: number;
  order_id: string | null;
  vars: string | null;
  read_at: number | null;
};

const notificationView = (n: NotificationRow & { reference?: string | null }) => ({
  id: n.id,
  template: n.template,
  subject: n.subject,
  body: n.body,
  status: n.status,
  createdAt: n.created_at,
  orderId: n.order_id,
  /** The values the text was built from, so the browser can show it in the customer's language. */
  vars: n.vars ? (JSON.parse(n.vars) as Vars) : {},
  readAt: n.read_at,
});

/** The customer's in-account notifications, newest first, with the unread count. */
export function listNotifications(ctx: AppContext, userId: string, limit = 50) {
  const rows = ctx.db.all<NotificationRow>(
    "SELECT id, template, subject, body, status, created_at, order_id, vars, read_at FROM notifications WHERE user_id = ? AND template <> 'password_reset' ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
  return rows.map(notificationView);
}

export function unreadNotificationCount(ctx: AppContext, userId: string): number {
  return ctx.db.get<{ n: number }>(
    "SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL AND template <> 'password_reset'",
    [userId],
  )!.n;
}

/** Marks the given notifications (or all of them) as read. Only the customer's own rows change. */
export function markNotificationsRead(ctx: AppContext, userId: string, ids: string[] | null) {
  const now = ctx.clock.now();
  if (ids === null) {
    ctx.db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [now, userId]);
    return;
  }
  for (const id of ids.slice(0, 200))
    ctx.db.run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', [now, id, userId]);
}

/** Every notice sent about one order, for the CRM. */
export function orderNotifications(ctx: AppContext, orderId: string) {
  return ctx.db
    .all<NotificationRow>(
      'SELECT id, template, subject, body, status, created_at, order_id, vars, read_at FROM notifications WHERE order_id = ? ORDER BY created_at',
      [orderId],
    )
    .map(notificationView);
}
