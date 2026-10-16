/**
 * Which actions the order card offers, and in what order. The server decides
 * what is allowed (AdminOrderDetail.actions, with a reason for anything that
 * isn't); this only arranges the allowed ones into one primary action, at most
 * one secondary action and a "More" menu, so the operator sees the next step
 * instead of every button at once.
 */
import { formatUsd } from '@/domain/money';
import type { OrderStatus } from '@/domain/order';
import { t } from '@/i18n';
import { formatAsset } from '@/lib/format';
import type { ActionAvailability, OrderActionKey } from '@/services/adminTypes';
import type { OrderView } from '@/services/types';

/** "notify" is a message to the customer with a status-specific template; it uses the `message` action. */
export type CardAction = OrderActionKey | 'notify';

export interface ActionPlan {
  primary: CardAction | null;
  secondary: CardAction | null;
  more: CardAction[];
  /** What the order is waiting for when there is nothing for the operator to do. */
  waitingFor: string | null;
}

interface OrderLike {
  status: OrderStatus;
  onHold: boolean;
  direction?: 'sell' | 'buy';
  payIn?: 'courier_cash' | 'wire' | 'card' | null;
  payoutMethod?: string;
  courierFeePending?: boolean;
  /** Sell: a pending refund waits for the customer's refund address. */
  refundAddressNeeded?: boolean;
}

/** Preferred primary and secondary action for each situation, before checking what the server allows. */
function preferred(o: OrderLike): [CardAction[], CardAction[]] {
  if (o.onHold) return [['release_hold'], ['reject', 'notify']];
  const needsCourierFee =
    o.courierFeePending && (o.payoutMethod === 'courier_cash' || o.payIn === 'courier_cash');
  switch (o.status) {
    case 'compliance_review':
      return [
        ['approve', 'reject'],
        ['reject', 'request_info'],
      ];
    case 'ready_for_payout':
      return [
        ['record_manual_payout', 'authorize_payout'],
        ['authorize_payout', 'reject'],
      ];
    case 'failed':
      return [['retry_payout'], ['refund']];
    case 'refund_pending':
      return [['record_manual_refund', 'resubmit_refund'], ['resubmit_refund', 'notify']];
    case 'created':
      if (o.payIn === 'wire') return [['issue_wire_instructions'], ['notify', 'reject']];
      if (o.payIn === 'card') return [['issue_card_payin_instructions'], ['notify', 'reject']];
      return needsCourierFee ? [['set_courier_fee'], ['notify', 'reject']] : [['notify'], ['reject']];
    case 'awaiting_deposit':
      return needsCourierFee
        ? [['set_courier_fee'], ['confirm_deposit_manual', 'notify', 'reject']]
        : [['confirm_deposit_manual'], ['notify', 'reject']];
    case 'deposit_observed':
    case 'confirming':
      return [['confirm_deposit_manual'], ['notify', 'reject']];
    default:
      return [[], ['notify']];
  }
}

export const WAITING: Partial<Record<OrderStatus, string>> = {
  created: 'Waiting for payment instructions to be issued',
  awaiting_deposit: 'Waiting for the customer’s payment — then confirm receipt manually',
  deposit_observed: 'Verify the deposit, then confirm it manually or wait for monitoring',
  confirming: 'Verify the deposit, then confirm it manually or wait for monitoring',
  deposit_confirmed: 'Checks are running before payout',
  payout_submitted: 'Waiting for the automatic payout provider',
  payout_processing: 'Waiting for the automatic payout provider',
  refund_pending: 'Record the refund after funds are returned, or wait for the provider',
  completed: 'Completed. Nothing to do.',
  refunded: 'Refunded. Nothing to do.',
  rejected: 'Rejected. Nothing to do.',
  cancelled: 'Cancelled by the customer. Nothing to do.',
  expired: 'Expired: no payment arrived in time. Nothing to do.',
};

/** Actions that stay in the "More" menu even when allowed, in this order. */
const MENU_ORDER: CardAction[] = [
  'set_courier_fee',
  'issue_wire_instructions',
  'issue_card_payin_instructions',
  'confirm_deposit_manual',
  'request_info',
  'notify',
  'hold',
  'release_hold',
  'flag',
  'reject',
  'record_manual_payout',
  'authorize_payout',
  'retry_payout',
  'refund',
  'record_manual_refund',
  'resubmit_refund',
  'assign',
  'note',
];

export function actionPlan(o: OrderLike, available: readonly ActionAvailability[]): ActionPlan {
  const ok = new Set<CardAction>(available.filter((a) => !a.unavailable).map((a) => a.action));
  // A message to the customer is possible whenever messaging is.
  if (ok.has('message')) ok.add('notify');
  const [primaryPrefs, secondaryPrefs] = preferred(o);
  const primary = primaryPrefs.find((a) => ok.has(a)) ?? null;
  const secondary = secondaryPrefs.find((a) => ok.has(a) && a !== primary) ?? null;
  const more = MENU_ORDER.filter((a) => ok.has(a) && a !== primary && a !== secondary);
  const waitingFor = primary
    ? null
    : o.onHold
      ? null
      : o.refundAddressNeeded
        ? 'Waiting for the customer’s refund address'
        : o.payIn === 'wire' && o.status === 'created'
          ? 'Waiting for wire instructions to be issued'
          : o.payIn === 'card' && o.status === 'created'
            ? 'Waiting for card payment instructions to be issued'
            : (WAITING[o.status] ?? null);
  return { primary, secondary, more, waitingFor };
}

/** The queue has no action list: this is the label of the step an order is waiting on, for the row button. */
export function queueNextStep(o: OrderLike): { label: string; urgent: boolean } {
  if (o.onHold) return { label: 'Release hold', urgent: true };
  switch (o.status) {
    case 'created':
      if (o.payIn === 'wire') return { label: 'Issue wire credentials', urgent: true };
      if (o.payIn === 'card') return { label: 'Issue card payment instructions', urgent: true };
      if (o.courierFeePending) return { label: 'Set courier fee', urgent: true };
      return { label: 'Assign credentials', urgent: true };
    case 'compliance_review':
      return { label: 'Review order', urgent: true };
    case 'ready_for_payout':
      return { label: 'Record payout', urgent: true };
    case 'awaiting_deposit':
    case 'deposit_observed':
    case 'confirming':
      return { label: 'Confirm deposit', urgent: true };
    case 'failed':
      return { label: 'Resolve payout', urgent: true };
    case 'refund_pending':
      return { label: 'Check refund', urgent: true };
    default:
      return { label: 'Open order', urgent: false };
  }
}

/** Button labels for the card. */
export const ACTION_LABEL: Record<CardAction, string> = {
  approve: 'Confirm',
  confirm_deposit_manual: 'Confirm deposit manually',
  authorize_payout: 'Send to payout provider',
  record_manual_payout: 'Record manual payout',
  reject: 'Reject',
  request_info: 'Request information',
  notify: 'Send notification',
  message: 'Send notification',
  hold: 'Put on hold',
  release_hold: 'Release hold',
  flag: 'Send to compliance review',
  retry_payout: 'Retry payout',
  refund: 'Start refund',
  resubmit_refund: 'Resubmit refund to provider',
  record_manual_refund: 'Record manual refund',
  assign: 'Assign',
  note: 'Add internal note',
  set_courier_fee: 'Set courier fee',
  issue_wire_instructions: 'Issue wire credentials',
  issue_card_payin_instructions: 'Issue card payment instructions',
};

/** What each confirming action does, shown in its dialog. */
export const ACTION_EXPLAIN: Partial<Record<CardAction, string>> = {
  approve: 'The review is approved and the order moves to payout. Payout still needs its own confirmation.',
  confirm_deposit_manual:
    'Records that you verified the deposit yourself (explorer, bank statement, or cash desk). A customer TXID or receipt alone is not enough. Marked as operator-recorded (manual), not a provider webhook.',
  authorize_payout:
    'The payout instruction is sent to the configured automatic payout provider. The order is completed only when that provider reports the payout as done. Prefer Record manual payout when you pay from your own accounts.',
  issue_wire_instructions:
    'Assigns bank credentials to this order, shows them to the customer, and opens the deposit window. Editing the credential set later never rewrites this order’s snapshot.',
  issue_card_payin_instructions:
    'Saves a real external payment-page URL and/or instructions from your processor on this order. Does not create a fake payment page. The customer pays off-site; you confirm receipt separately.',
  record_manual_payout:
    'Records that the payout was completed through an explicit operational procedure (not a provider webhook). For buy→crypto, enter the actual outgoing TXID. For sell→USD, enter the bank/desk evidence. Marked as operator-recorded, not provider-verified.',
  reject: 'The order is rejected. If the customer’s funds were already received, a refund is started under Section 9 of the Service Rules.',
  hold: 'Nothing moves this order toward a payout until the hold is released. Provider reports are still recorded.',
  release_hold: 'Processing continues from the current status.',
  flag: 'The order goes to compliance review before any payout.',
  retry_payout: 'The order goes back to “ready for payout”; confirm the payout again to resend it.',
  refund: 'A refund of the received funds is started instead of a payout.',
  resubmit_refund: 'The refund instruction is sent to the automatic provider again with the same idempotency key.',
  record_manual_refund:
    'Records that you actually returned the funds. Requires a reason and evidence. Marked as operator-recorded, not a provider webhook. Do not mark completed until the return is done.',
  set_courier_fee:
    'Sets the courier delivery or collection cost for this order and recalculates the quote. The customer must accept the updated amount before the exchange continues. There is no published flat courier tariff.',
};

/** Default reasons recorded in the audit log; the operator can edit them. */
export const DEFAULT_REASON: Partial<Record<CardAction, string>> = {
  approve: 'Review completed, checks passed.',
  confirm_deposit_manual: 'Deposit verified independently; confirming manually.',
  authorize_payout: 'Deposit final and checks complete.',
  record_manual_payout: 'Payout sent from operating account.',
  record_manual_refund: 'Refund / return completed from operating account.',
  release_hold: 'Checks completed.',
  retry_payout: 'Retrying after the provider failure.',
  resubmit_refund: 'Resubmitting the refund.',
  set_courier_fee: 'Courier fee quoted for this order.',
  issue_wire_instructions: 'Default bank credential set issued for this order.',
  issue_card_payin_instructions: 'External processor payment page issued for this order.',
};

export const REJECT_REASONS = [
  'Verification or compliance checks not passed',
  'The amount received does not match the order',
  'No payment received',
  'At the customer’s request',
  'Other',
];

/** Message templates offered for the order's current stage. The operator can edit the text before sending. */
export function notifyTemplates(status: OrderStatus, onHold: boolean): { id: string; label: string; body: string }[] {
  const tpl = (id: string, label: string, body: string) => ({ id, label, body });
  const list = [];
  if (onHold)
    list.push(
      tpl('hold', 'Order on hold', 'Your order {ref} is on hold while our team checks it. We will contact you if we need anything.'),
    );
  if (status === 'created' || status === 'awaiting_deposit')
    list.push(
      tpl(
        'reminder',
        'Payment reminder',
        'We are still waiting for the payment for order {ref}. Send exactly the amount shown on the order page, on the network shown, before the window closes.',
      ),
    );
  if (['deposit_observed', 'confirming', 'deposit_confirmed', 'compliance_review'].includes(status))
    list.push(
      tpl(
        'received',
        'Payment received',
        'We have received the payment for order {ref}. It is being checked; we will update you when the payout is sent.',
      ),
    );
  if (['ready_for_payout', 'payout_submitted', 'payout_processing'].includes(status))
    list.push(
      tpl('processing', 'Payout in progress', 'The payout for order {ref} is being processed. Timing is an estimate, not a guarantee.'),
    );
  if (status === 'completed')
    list.push(tpl('done', 'Order completed', 'Order {ref} is completed. Thank you for using CryptoBit Exchange.'));
  if (status === 'rejected' || status === 'refund_pending' || status === 'refunded')
    list.push(
      tpl('rejected', 'Order not completed', 'We could not complete order {ref}. Contact us on Telegram or in your messages for details.'),
    );
  list.push(tpl('custom', 'Custom message', ''));
  return list;
}

/** What the customer sends and receives, in their own terms. */
export function exchangeSides(o: Pick<OrderView, 'direction' | 'payIn' | 'asset' | 'amountAtomic' | 'networkLabel' | 'quote' | 'payout'>) {
  return o.direction === 'buy'
    ? {
        sends: formatUsd(o.quote.grossCents),
        sendsNote: o.payIn === 'wire' ? t('Bank wire') : t('Cash by courier'),
        receives: formatAsset(o.amountAtomic, o.asset),
        receivesNote: o.networkLabel,
      }
    : {
        sends: formatAsset(o.amountAtomic, o.asset),
        sendsNote: o.networkLabel,
        receives: formatUsd(o.quote.netCents),
        receivesNote: t(o.payout.methodName),
      };
}

/** Result shown after each action succeeds. */
export const SUCCESS: Partial<Record<CardAction, string>> = {
  approve: 'Confirmed. The order moved on to payout.',
  confirm_deposit_manual: 'Deposit confirmed manually. Marked as operator-verified, not a provider report.',
  authorize_payout: 'Payout instruction sent to the payout provider.',
  record_manual_payout: 'Manual payout recorded with evidence. Marked as operator-recorded, not provider-verified.',
  reject: 'The order was rejected.',
  request_info: 'The request was sent to the customer’s messages.',
  notify: 'The message was sent to the customer’s messages and account notifications.',
  hold: 'The order is on hold.',
  release_hold: 'The hold was released.',
  flag: 'The order was sent to compliance review.',
  retry_payout: 'The payout will be retried.',
  refund: 'The refund was started.',
  resubmit_refund: 'The refund was sent to the provider again.',
  record_manual_refund: 'Manual refund recorded with evidence. Marked as operator-recorded, not provider-verified.',
  assign: 'Assignment saved.',
  note: 'Note added.',
  set_courier_fee: 'Courier fee set. The customer must accept the updated quote.',
  issue_wire_instructions: 'Wire credentials issued to the customer.',
  issue_card_payin_instructions: 'Card payment instructions issued to the customer.',
};

/** How a notification's delivery is described in the order history. */
export const NOTIFY_STATUS: Record<string, string> = {
  sandbox_captured: 'recorded (sandbox: no email sent)',
  queued: 'email queued',
  sent: 'email sent',
  failed: 'email failed',
  not_configured: 'email not configured: account only',
};
