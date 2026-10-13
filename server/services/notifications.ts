/**
 * Customer notifications. Every message is recorded first, then delivered
 * after the transaction commits:
 * - sandbox: captured in the database only (status sandbox_captured); never sent.
 * - production with an email provider: queued → sent / failed.
 * - production without one: not_configured. Nothing pretends it was sent.
 */
import type { AppContext } from '../context';
import { newId } from '../lib/clock';
import { isUsable } from '../providers/registry';

export type Template =
  | 'welcome'
  | 'password_reset'
  | 'order_created'
  | 'deposit_confirmed'
  | 'info_requested'
  | 'payout_submitted'
  | 'order_completed'
  | 'order_failed'
  | 'refund_started'
  | 'refund_completed'
  | 'support_reply'
  | 'verification_updated';

type Vars = Record<string, string>;

const TEMPLATES: Record<Template, (v: Vars) => { subject: string; body: string }> = {
  welcome: (v) => ({
    subject: 'Welcome to Arcvale',
    body: `Hi ${v.name},\n\nYour Arcvale account is ready. Verify your identity from your account page before your first exchange.\n\nIf you did not create this account, contact support.`,
  }),
  password_reset: (v) => ({
    subject: 'Reset your Arcvale password',
    body: `Use this link within 30 minutes to choose a new password:\n\n${v.url}\n\nIf you did not ask for this, you can ignore this email. Your password has not changed.`,
  }),
  order_created: (v) => ({
    subject: `Order ${v.reference}: send your deposit`,
    body: `We created order ${v.reference}. Send exactly ${v.amount} on ${v.network} before ${v.deadline}. Check the deposit address on the order page; never send to an address from an email.`,
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
    body: `We started returning your deposit for order ${v.reference} to your refund address. Network fees may be deducted.`,
  }),
  refund_completed: (v) => ({
    subject: `Order ${v.reference}: refund sent`,
    body: `Your refund for order ${v.reference} was sent to your refund address. Transaction: ${v.txHash}.`,
  }),
  support_reply: (v) => ({
    subject: `New reply: ${v.subject}`,
    body: `Our support team replied to “${v.subject}”. Sign in to read and answer it.`,
  }),
  verification_updated: (v) => ({
    subject: 'Your identity verification was updated',
    body: `Your identity verification status is now: ${v.status}. Open your account page for details.`,
  }),
};

export function notify(ctx: AppContext, input: { userId: string | null; to: string; template: Template; vars: Vars }): string {
  const { subject, body } = TEMPLATES[input.template](input.vars);
  const id = newId('ntf');
  const info = ctx.providers.email.info();
  const status = info.state === 'sandbox' ? 'sandbox_captured' : isUsable(info) ? 'queued' : 'not_configured';
  ctx.db.run(
    'INSERT INTO notifications (id, user_id, channel, recipient, template, subject, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, input.userId, 'email', input.to, input.template, subject, body, status, ctx.clock.now()],
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

export function listNotifications(ctx: AppContext, userId: string, limit = 50) {
  return ctx.db
    .all<{
      id: string;
      template: string;
      subject: string;
      body: string;
      status: string;
      created_at: number;
    }>('SELECT id, template, subject, body, status, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [
      userId,
      limit,
    ])
    .map((n) => ({ id: n.id, template: n.template, subject: n.subject, body: n.body, status: n.status, createdAt: n.created_at }));
}
