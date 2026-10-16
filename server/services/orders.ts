/**
 * Exchange orders. All status changes go through `applyOrderEvent`, which
 * runs the domain state machine and persists the new status, the event and
 * an audit record in one transaction, with optimistic concurrency on the
 * order's version. Nothing else updates orders.status.
 */
import { isValidAddress, NETWORKS, networkLabel, type AssetCode, type NetworkId } from '@/domain/assets';
import { CASH_COLLECTION_WINDOW_MS } from '@/domain/courier';
import { wireLinesFromSnapshot } from '@/domain/credentials';
import { isPreviewWireValue, validateWireReference, WIRE_RECEIPT_WINDOW_MS, wireInstructionsPreview } from '@/domain/wire';
import { formatUsd } from '@/domain/money';
import { PAYOUT_METHODS, payoutEligibility, type PayoutMethodId } from '@/domain/payout';
import { isQuoteExpired, PRICING_POLICY, type ExchangeDirection, type Quote } from '@/domain/quote';
import {
  buyPayIn,
  isPreviewDepositAddress,
  ORDER_STAGE_LABEL,
  orderStage,
  orderStatusLabel,
  orderSteps,
  postDepositEvent,
  transition,
  type ActorType,
  type DepositException,
  type OrderEvent,
  type OrderMachineState,
  type OrderStatus,
} from '@/domain/order';
import { validateRefundAddress, validateTxHash } from '@/domain/validation';
import { SYSTEM, type Actor, type AppContext } from '../context';
import { ApiError, badRequest, conflict, notFound } from '../http/errors';
import { newId, randomDigits } from '../lib/clock';
import { isUsable } from '../providers/registry';
import { ProviderError, ProviderNotConfiguredError, type WebhookSource } from '../providers/types';
import { audit } from './audit';
import {
  defaultWallet,
  defaultWireSet,
  getWallet,
  getWireSet,
  orderWalletSnapshot,
  orderWireSnapshot,
  recordAssignment,
  upsertWalletSnapshot,
  upsertWireSnapshot,
  walletRowToSnapshot,
  wireRowToSnapshot,
} from './credentials';
import { courierDelivery, getProfile, payoutDetails, type DestinationRow } from './customers';
import { notify } from './notifications';
import { hasBlockingQuoteIssues, loadQuote, quoteFromRow, quoteHasCourierFeePending } from './quotes';
import { recordAcceptances, requireAcceptance } from './auth';
import { formatAssetPlain } from './format';

export interface OrderRow {
  id: string;
  reference: string;
  user_id: string;
  quote_id: string;
  status: OrderStatus;
  version: number;
  source: 'sandbox' | 'live';
  /**
   * sell: crypto in, USD out. buy: cash collected by courier or a bank wire, crypto out (refund_address is then the
   * receiving wallet, and payout_method holds the pay-in: courier_cash or wire).
   */
  direction: ExchangeDirection;
  asset: AssetCode;
  network: NetworkId;
  amount_atomic: string;
  reference_price_micros: string;
  gross_cents: number;
  spread_bps: number;
  spread_cents: number;
  payout_fee_cents: number;
  net_cents: number;
  payout_method: PayoutMethodId;
  /** Null only for a buy paid by wire, which has no saved destination (migration 6). */
  payout_destination_id: string | null;
  payout_label: string;
  payout_last4: string;
  /**
   * sell: where crypto is returned if the exchange cannot be completed. Not asked for up front: it stays null
   * until a refund is needed and the customer gives it (set once, migration 5). buy: the receiving wallet.
   */
  refund_address: string | null;
  deposit_deadline: number;
  confirmations_required: number;
  confirmations_count: number;
  deposit_tx_hash: string | null;
  deposit_amount_atomic: string | null;
  deposit_exception: DepositException | null;
  review_reason: string | null;
  payout_provider_ref: string | null;
  refund_tx_hash: string | null;
  assigned_operator_id: string | null;
  customer_reported_sent_at: number | null;
  /** 1 while an operator holds the order (migration 4). */
  on_hold: number;
  /** 1 until an operator sets the per-order courier delivery fee (migration 9). */
  courier_fee_pending: number;
  /** When the customer accepted the priced courier fee (migration 9). */
  courier_fee_accepted_at: number | null;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
}

export interface OrderEventRow {
  id: number;
  order_id: string;
  seq: number;
  type: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: ActorType;
  actor_id: string | null;
  visibility: 'customer' | 'internal';
  detail: string;
  data: string;
  created_at: number;
}

const CLOSED: ReadonlySet<OrderStatus> = new Set(['completed', 'rejected', 'cancelled', 'refunded']);

export function getOrderRow(ctx: AppContext, id: string): OrderRow {
  const row = ctx.db.get<OrderRow>('SELECT * FROM orders WHERE id = ?', [id]);
  if (!row) throw notFound('Order not found.');
  return row;
}

/** Which provider reports the money coming in (and its return): custody for a sell, the cash or bank provider for a buy. */
export function depositSource(o: Pick<OrderRow, 'direction' | 'payout_method'>): WebhookSource {
  if (o.direction !== 'buy') return 'custody';
  return o.payout_method === 'wire' ? 'bankPayout' : 'cash';
}

function machineState(o: OrderRow): OrderMachineState {
  return {
    direction: o.direction,
    payIn: buyPayIn(o.direction, o.payout_method),
    status: o.status,
    // A buy's "deposit" is the cash collected, in cents.
    quotedAmountAtomic: o.direction === 'buy' ? BigInt(o.gross_cents) : BigInt(o.amount_atomic),
    depositDeadline: o.deposit_deadline,
    confirmationsRequired: o.confirmations_required,
    confirmationsCount: o.confirmations_count,
    depositTxHash: o.deposit_tx_hash,
    depositAmountAtomic: o.deposit_amount_atomic === null ? null : BigInt(o.deposit_amount_atomic),
    depositException: o.deposit_exception,
    reviewReason: o.review_reason,
    payoutProviderRef: o.payout_provider_ref,
    refundTxHash: o.refund_tx_hash,
    onHold: o.on_hold === 1,
  };
}

const PATCH_COLUMNS: Record<string, string> = {
  confirmationsCount: 'confirmations_count',
  depositTxHash: 'deposit_tx_hash',
  depositAmountAtomic: 'deposit_amount_atomic',
  depositException: 'deposit_exception',
  reviewReason: 'review_reason',
  payoutProviderRef: 'payout_provider_ref',
  refundTxHash: 'refund_tx_hash',
  onHold: 'on_hold',
};

function eventData(event: OrderEvent): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...event };
  delete rest.type;
  return JSON.parse(JSON.stringify(rest, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export function insertEvent(
  ctx: AppContext,
  orderId: string,
  e: {
    type: string;
    from: OrderStatus | null;
    to: OrderStatus;
    actor: Actor;
    visibility: 'customer' | 'internal';
    detail: string;
    data: Record<string, unknown>;
  },
) {
  const seq = (ctx.db.get<{ s: number | null }>('SELECT max(seq) AS s FROM order_events WHERE order_id = ?', [orderId])?.s ?? 0) + 1;
  ctx.db.run(
    `INSERT INTO order_events (order_id, seq, type, from_status, to_status, actor_type, actor_id, visibility, detail, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      seq,
      e.type,
      e.from,
      e.to,
      e.actor.type === 'sandbox' ? 'provider' : e.actor.type,
      e.actor.id,
      e.visibility,
      e.detail,
      JSON.stringify(e.data),
      ctx.clock.now(),
    ],
  );
}

function domainActor(actor: Actor): ActorType {
  // The sandbox simulator acts as a provider; it reaches here only through the signed webhook path.
  return actor.type === 'sandbox' ? 'provider' : actor.type;
}

/** Events whose customer notice is sent by the code that raises them (with amounts or links), or that would only add noise. */
const SPECIFIC_NOTICE: ReadonlySet<string> = new Set([
  'DEPOSIT_INSTRUCTIONS_ISSUED',
  'CONFIRMATIONS_UPDATED',
  'DEPOSIT_CONFIRMED',
  'MANUAL_DEPOSIT_CONFIRMED',
  'MANUAL_PAYOUT_RECORDED',
  'PAYOUT_COMPLETED',
  'CUSTOMER_CANCELLED',
  'PAYOUT_SUBMITTED',
  'PAYOUT_COMPLETED',
  'PAYOUT_FAILED',
  'REFUND_INITIATED',
  'REFUND_COMPLETED',
  'MANUAL_REFUND_RECORDED',
]);

/** Tells the customer (in their account and by email) that their order moved to a new status or was held or released. */
function notifyStatusChange(ctx: AppContext, o: OrderRow, detail: string) {
  // A rejection with funds held starts a refund, whose own notice says so.
  if (o.status === 'refund_pending') return;
  const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])?.email;
  if (!email) return;
  notify(ctx, {
    userId: o.user_id,
    to: email,
    template: 'status_changed',
    orderId: o.id,
    vars: {
      reference: o.reference,
      stage: ORDER_STAGE_LABEL[orderStage(o.status, o.on_hold === 1)],
      status: orderStatusLabel(o.status, o.direction, buyPayIn(o.direction, o.payout_method), o.payout_method),
      detail,
    },
  });
}

/**
 * The only way an order changes status. Validates the event with the domain
 * state machine, then writes status + event + audit atomically. Throws
 * InvalidOrderTransitionError (→ 409) or ActorNotAllowedError (→ 403).
 */
export function applyOrderEvent(
  ctx: AppContext,
  orderId: string,
  event: OrderEvent,
  actor: Actor,
  opts: { reason?: string | null; expectedStatus?: OrderStatus } = {},
): OrderRow {
  return ctx.db.tx(() => {
    const order = getOrderRow(ctx, orderId);
    if (opts.expectedStatus && order.status !== opts.expectedStatus)
      throw conflict(`This order is now ${order.status}. Reload and try again.`, 'stale_status');
    let result;
    try {
      result = transition(machineState(order), event, domainActor(actor), ctx.clock.now());
    } catch (e) {
      if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'actor_not_allowed')
        throw new ApiError(403, 'actor_not_allowed', e.message);
      throw e;
    }
    const sets = ['status = :status', 'version = version + 1', 'updated_at = :now'];
    const params: Record<string, string | number | null> = {
      status: result.status,
      now: ctx.clock.now(),
      id: orderId,
      version: order.version,
    };
    for (const [k, v] of Object.entries(result.patch)) {
      const col = PATCH_COLUMNS[k];
      if (!col) continue;
      sets.push(`${col} = :${col}`);
      params[col] = typeof v === 'bigint' ? v.toString() : typeof v === 'boolean' ? (v ? 1 : 0) : (v as string | number | null);
    }
    if (CLOSED.has(result.status) && !CLOSED.has(order.status)) sets.push('closed_at = :now');
    if (event.type === 'CUSTOMER_REPORTED_SENT') sets.push('customer_reported_sent_at = :now');
    const { changes } = ctx.db.run(`UPDATE orders SET ${sets.join(', ')} WHERE id = :id AND version = :version`, params);
    if (changes !== 1) throw conflict('This order changed while you were working on it. Reload and try again.', 'version_conflict');
    insertEvent(ctx, orderId, {
      type: event.type,
      from: order.status,
      to: result.status,
      actor,
      visibility: result.visibility,
      detail: result.detail,
      data: { ...eventData(event), ...(opts.reason ? { reason: opts.reason } : {}) },
    });
    audit(ctx, actor, {
      action: `order.${event.type.toLowerCase()}`,
      targetType: 'order',
      targetId: orderId,
      reason: opts.reason ?? ('reason' in event ? (event as { reason: string }).reason : null),
      data: { from: order.status, to: result.status },
    });
    const updated = getOrderRow(ctx, orderId);
    // One notice per change the customer sees in their summary: a new stage, or a hold placed or released.
    const stageChanged = orderStage(order.status, order.on_hold === 1) !== orderStage(updated.status, updated.on_hold === 1);
    if (result.visibility === 'customer' && (stageChanged || 'onHold' in result.patch) && !SPECIFIC_NOTICE.has(event.type))
      notifyStatusChange(ctx, updated, result.detail);
    ctx.db.afterCommit(() =>
      ctx.bus.publish([{ userId: updated.user_id }, { staff: true }], {
        type: 'order.updated',
        data: { orderId, status: updated.status, version: updated.version },
      }),
    );
    return updated;
  });
}

/* ---------- Creating orders ---------- */

/**
 * Screen an address when a screening provider is configured. When it is not,
 * skip quietly so owner-managed manual ops can proceed — do not pretend the
 * provider is connected, and do not invent a pass verdict for display.
 */
export async function screenAddress(
  ctx: AppContext,
  network: NetworkId,
  address: string,
): Promise<{ result: 'clear' | 'review' | 'blocked'; note: string }> {
  if (!isUsable(ctx.providers.screening.info())) {
    return { result: 'clear', note: 'Sanctions screening provider is not configured; operator review applies.' };
  }
  try {
    return await ctx.providers.screening.screenAddress(network, address);
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) {
      return { result: 'clear', note: 'Sanctions screening provider is not configured; operator review applies.' };
    }
    throw new ApiError(503, 'provider_unavailable', 'Screening is temporarily unavailable. Try again shortly.');
  }
}

/**
 * Placement readiness for owner-managed ops: automatic adapters are optional
 * when CRM credentials and admin actions can complete the flow safely.
 */
function assertPlacementReady(_ctx: AppContext, _quote: Quote) {
  /* Manual CRM path is available for all published payout methods, including card. */
}

/** Public order number: digits only. Retries on rare UNIQUE collisions. */
function newReference(ctx: AppContext): string {
  for (let i = 0; i < 12; i++) {
    const ref = randomDigits(10);
    if (!ctx.db.get('SELECT 1 FROM orders WHERE reference = ?', [ref])) return ref;
  }
  throw new ApiError(500, 'internal_error', 'Could not allocate a unique order number.');
}

export async function createOrder(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  input: {
    quoteId: string;
    destinationId: string;
    /** Sell orders, optional: where crypto is returned if the exchange cannot be completed. Asked for later if a refund is needed. */
    refundAddress?: string | null;
    /** Buy orders: the wallet that receives the crypto. */
    receiveAddress?: string | null;
    accepted: { slug: string; version: string }[];
  },
): Promise<OrderRow> {
  const quoteRow = loadQuote(ctx, input.quoteId, userId);
  const quote = quoteFromRow(quoteRow);
  if (quote.direction === 'buy') return createBuyOrder(ctx, actor, userId, quote, quoteRow.used_at, quoteRow.issues, input);
  const now = ctx.clock.now();

  // Automatic custody/payout/screening adapters are optional when CRM wallets
  // and record_manual_payout can complete the exchange (including card payouts).
  assertPlacementReady(ctx, quote);

  if (quoteRow.used_at) throw conflict('This quote has already been used. Get a new quote.', 'quote_used');
  if (isQuoteExpired(quote, now)) throw new ApiError(409, 'quote_expired', 'This quote has expired. Get a new quote to continue.');
  if (hasBlockingQuoteIssues(quoteRow.issues))
    throw new ApiError(422, 'quote_issues', 'This quote cannot be accepted. Change the amount or payout method.');
  const feePending = quoteHasCourierFeePending(quoteRow.issues);
  const eligibility = payoutEligibility(PAYOUT_METHODS[quote.payoutMethod], quote.grossCents);
  if (!eligibility.eligible) throw new ApiError(422, 'method_unavailable', eligibility.reason);

  getProfile(ctx, userId); // ensure profile exists; KYC is not required to place an order

  // The refund address is optional: without one, it is asked for only if funds have to be returned.
  const refundAddress = input.refundAddress?.trim() || null;
  if (refundAddress) {
    const refundError = validateRefundAddress(refundAddress, quote.network);
    if (refundError) throw badRequest(refundError, { field: 'refundAddress' });
  }

  const dest = ctx.db.get<DestinationRow>("SELECT * FROM payout_destinations WHERE id = ? AND user_id = ? AND status = 'active'", [
    input.destinationId,
    userId,
  ]);
  if (!dest) throw badRequest('Choose one of your saved payout destinations.', { field: 'destinationId' });
  if (!(JSON.parse(dest.methods) as string[]).includes(quote.payoutMethod))
    throw badRequest(`That destination can't receive ${PAYOUT_METHODS[quote.payoutMethod].name} payouts.`, { field: 'destinationId' });

  const docs = requireAcceptance(input.accepted, 'order');

  const screening = refundAddress ? await screenAddress(ctx, quote.network, refundAddress) : null;
  if (screening?.result === 'blocked') {
    audit(ctx, actor, { action: 'order.blocked_by_screening', targetType: 'quote', targetId: quote.id, data: { network: quote.network } });
    throw new ApiError(422, 'screening_blocked', 'We can’t process this exchange. Contact support if you think this is a mistake.');
  }

  const id = newId('ord');
  const reference = newReference(ctx);
  const deadline = now + PRICING_POLICY.depositWindowMs;
  const required =
    ctx.config.mode === 'sandbox'
      ? (ctx.config.sandbox.confirmations[quote.network] ?? NETWORKS[quote.network].confirmationsRequired)
      : NETWORKS[quote.network].confirmationsRequired;

  ctx.db.tx(() => {
    // Single use: the conditional update fails if a concurrent request already took this quote.
    const { changes } = ctx.db.run('UPDATE quotes SET used_at = ? WHERE id = ? AND used_at IS NULL', [now, quote.id]);
    if (changes !== 1) throw conflict('This quote has already been used. Get a new quote.', 'quote_used');
    ctx.db.run(
      `INSERT INTO orders (id, reference, user_id, quote_id, status, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps,
         spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address, deposit_deadline,
         confirmations_required, review_reason, courier_fee_pending, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        reference,
        userId,
        quote.id,
        quoteRow.source,
        quote.asset,
        quote.network,
        quote.amountAtomic.toString(),
        quote.referencePriceMicros.toString(),
        Number(quote.grossCents),
        quote.spreadBps,
        Number(quote.spreadCents),
        Number(quote.payoutFeeCents),
        Number(quote.netCents),
        quote.payoutMethod,
        dest.id,
        dest.label,
        dest.last4,
        refundAddress,
        deadline,
        required,
        screening?.result === 'review' ? `Refund address screening: ${screening.note}` : null,
        feePending ? 1 : 0,
        now,
        now,
      ],
    );
    insertEvent(ctx, id, {
      type: 'ORDER_CREATED',
      from: null,
      to: 'created',
      actor,
      visibility: 'customer',
      detail: 'Exchange request created with your accepted quote.',
      data: { quoteId: quote.id },
    });
    recordAcceptances(ctx, userId, docs, 'order', { ip: actor.ip, orderId: id });
    audit(ctx, actor, {
      action: 'order.created',
      targetType: 'order',
      targetId: id,
      data: { quoteId: quote.id, netCents: quote.netCents, method: quote.payoutMethod },
    });
  });

  // Courier fee must be set and accepted before deposit instructions are issued.
  if (feePending) {
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
    notify(ctx, {
      userId,
      to: email,
      template: 'order_created',
      vars: {
        reference,
        amount: formatAssetPlain(quote.amountAtomic, quote.asset),
        network: networkLabel(quote.asset, quote.network),
        deadline: new Date(deadline).toISOString(),
      },
    });
    return getOrderRow(ctx, id);
  }

  await issueSellDepositInstructions(ctx, id, userId, quote, reference, deadline);
  return getOrderRow(ctx, id);
}

/** Issue custody deposit instructions for a sell order (after courier fee is accepted, when applicable). */
export async function issueSellDepositInstructions(
  ctx: AppContext,
  orderId: string,
  userId: string,
  quote: Pick<Quote, 'asset' | 'network' | 'amountAtomic'>,
  reference: string,
  deadline: number,
): Promise<void> {
  if (ctx.db.get('SELECT 1 FROM deposit_instructions WHERE order_id = ?', [orderId])) return;

  // Prefer the CRM default wallet for this asset+network (immutable snapshot on the order).
  const crmWallet = defaultWallet(ctx, quote.asset, quote.network, 'deposit');
  if (crmWallet) {
    ctx.db.tx(() => {
      const snap = walletRowToSnapshot(crmWallet);
      upsertWalletSnapshot(ctx, orderId, snap, SYSTEM, true);
      recordAssignment(ctx, orderId, 'wallet', 'assigned', SYSTEM, null, snap, null);
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newId('dep'),
          orderId,
          'crm',
          `crm_wal_${crmWallet.id.replace(/^wal_/, '')}`,
          snap.address,
          snap.destinationTag ?? null,
          ctx.clock.now(),
        ],
      );
      audit(ctx, SYSTEM, {
        action: 'order.wallet_assigned',
        targetType: 'order',
        targetId: orderId,
        data: { walletId: crmWallet.id, asset: quote.asset, network: quote.network, source: 'default' },
      });
      applyOrderEvent(ctx, orderId, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, SYSTEM);
      const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
      notify(ctx, {
        userId,
        to: email,
        template: 'order_created',
        vars: {
          reference,
          amount: formatAssetPlain(quote.amountAtomic, quote.asset),
          network: networkLabel(quote.asset, quote.network),
          deadline: new Date(deadline).toISOString(),
        },
      });
    });
    return;
  }

  // No CRM wallet: sandbox may still use MOCK custody addresses; production leaves the order without an address.
  if (ctx.config.mode !== 'sandbox') {
    ctx.log.warn('no CRM deposit wallet for pair', { orderId, asset: quote.asset, network: quote.network });
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
    notify(ctx, {
      userId,
      to: email,
      template: 'order_created',
      vars: {
        reference,
        amount: formatAssetPlain(quote.amountAtomic, quote.asset),
        network: networkLabel(quote.asset, quote.network),
        deadline: new Date(deadline).toISOString(),
      },
    });
    return;
  }

  try {
    const instr = await ctx.providers.custody.createDepositInstructions({
      orderId,
      asset: quote.asset,
      network: quote.network,
      amountAtomic: quote.amountAtomic,
      idempotencyKey: `deposit:${orderId}`,
    });
    if (!isPreviewDepositAddress(instr.address))
      throw new Error('Sandbox custody returned an address that could be valid on a real chain.');
    ctx.db.tx(() => {
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newId('dep'), orderId, 'sandbox', instr.providerRef, instr.address, instr.memo, ctx.clock.now()],
      );
      applyOrderEvent(ctx, orderId, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, { type: 'system', id: null, role: null, ip: null });
      const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
      notify(ctx, {
        userId,
        to: email,
        template: 'order_created',
        vars: {
          reference,
          amount: formatAssetPlain(quote.amountAtomic, quote.asset),
          network: networkLabel(quote.asset, quote.network),
          deadline: new Date(deadline).toISOString(),
        },
      });
    });
  } catch (e) {
    ctx.log.error('deposit instructions failed', { orderId, error: e instanceof Error ? e.message : String(e) });
    applyOrderEvent(
      ctx,
      orderId,
      { type: 'DEPOSIT_INSTRUCTIONS_FAILED', reason: e instanceof ProviderError ? e.message : 'Provider error' },
      { type: 'system', id: null, role: null, ip: null },
    );
    throw new ApiError(
      503,
      'provider_unavailable',
      'We could not issue deposit instructions. Nothing was sent; get a new quote and try again.',
    );
  }
}

/**
 * Buy order (cash or wire → crypto). Cash: the courier collects the cash from
 * the verified account holder after an ID check. Wire: the customer sends a
 * bank wire to the instructions shown once they are issued (placeholders in
 * the sandbox; see domain/wire.ts). Once the money is counted or matched
 * (cash or bank provider webhooks) and checks are complete, an operator
 * authorizes the crypto transfer to the customer's wallet. The same state
 * machine and webhook rules apply as for a sell.
 */
async function createBuyOrder(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  quote: Quote,
  usedAt: number | null,
  issuesJson: string,
  input: { destinationId: string; receiveAddress?: string | null; accepted: { slug: string; version: string }[] },
): Promise<OrderRow> {
  const now = ctx.clock.now();
  const wire = quote.payoutMethod === 'wire';
  const card = quote.payoutMethod === 'instant_debit';
  const payIn = buyPayIn('buy', quote.payoutMethod) ?? 'courier_cash';
  // Wire, card, and cash buys can be processed manually via CRM credentials /
  // payment instructions and admin confirmation. Crypto payout uses
  // record_manual_payout when custody is absent.

  if (usedAt) throw conflict('This quote has already been used. Get a new quote.', 'quote_used');
  if (isQuoteExpired(quote, now)) throw new ApiError(409, 'quote_expired', 'This quote has expired. Get a new quote to continue.');
  if (hasBlockingQuoteIssues(issuesJson))
    throw new ApiError(422, 'quote_issues', 'This quote cannot be accepted. Change the amount.');
  const feePending = !wire && !card && quoteHasCourierFeePending(issuesJson);
  const eligibility = payoutEligibility(PAYOUT_METHODS[quote.payoutMethod], quote.grossCents);
  if (!eligibility.eligible) throw new ApiError(422, 'method_unavailable', eligibility.reason);

  getProfile(ctx, userId); // ensure profile exists; KYC is not required to place an order

  const receiveAddress = (input.receiveAddress ?? '').trim();
  if (!receiveAddress)
    throw badRequest(`Enter the ${NETWORKS[quote.network].name} wallet address that receives your ${quote.asset}.`, {
      field: 'receiveAddress',
    });
  if (!isValidAddress(quote.network, receiveAddress))
    throw badRequest(
      `That doesn't look like a ${NETWORKS[quote.network].name} address (expected ${NETWORKS[quote.network].addressExample}).`,
      { field: 'receiveAddress' },
    );

  // Wire/card need no saved destination: customer pays from their own bank/card.
  const dest =
    wire || card
      ? null
      : ctx.db.get<DestinationRow>(
          "SELECT * FROM payout_destinations WHERE id = ? AND user_id = ? AND status = 'active' AND kind = 'courier'",
          [input.destinationId, userId],
        );
  if (!wire && !card && !dest) throw badRequest('Choose the address where the courier collects the cash.', { field: 'destinationId' });

  const docs = requireAcceptance(input.accepted, 'order');

  const screening = await screenAddress(ctx, quote.network, receiveAddress);
  if (screening.result === 'blocked') {
    audit(ctx, actor, { action: 'order.blocked_by_screening', targetType: 'quote', targetId: quote.id, data: { network: quote.network } });
    throw new ApiError(422, 'screening_blocked', 'We can’t process this exchange. Contact support if you think this is a mistake.');
  }

  const id = newId('ord');
  const reference = newReference(ctx);
  const deadline = now + (wire || card ? WIRE_RECEIPT_WINDOW_MS : CASH_COLLECTION_WINDOW_MS);
  const payoutLabel = wire ? 'Bank wire' : card ? 'Card payment' : (dest?.label ?? 'Cash by courier');
  ctx.db.tx(() => {
    const { changes } = ctx.db.run('UPDATE quotes SET used_at = ? WHERE id = ? AND used_at IS NULL', [now, quote.id]);
    if (changes !== 1) throw conflict('This quote has already been used. Get a new quote.', 'quote_used');
    ctx.db.run(
      `INSERT INTO orders (id, reference, user_id, quote_id, status, source, direction, asset, network, amount_atomic, reference_price_micros, gross_cents,
         spread_bps, spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address,
         deposit_deadline, confirmations_required, review_reason, courier_fee_pending, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'created', ?, 'buy', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        id,
        reference,
        userId,
        quote.id,
        quote.source === 'live' ? 'live' : 'sandbox',
        quote.asset,
        quote.network,
        quote.amountAtomic.toString(),
        quote.referencePriceMicros.toString(),
        Number(quote.grossCents),
        quote.spreadBps,
        Number(quote.spreadCents),
        Number(quote.payoutFeeCents),
        Number(quote.netCents),
        quote.payoutMethod,
        dest?.id ?? null,
        payoutLabel,
        dest?.last4 ?? '',
        receiveAddress,
        deadline,
        screening.result === 'review' ? `Receiving address screening: ${screening.note}` : null,
        feePending ? 1 : 0,
        now,
        now,
      ],
    );
    insertEvent(ctx, id, {
      type: 'ORDER_CREATED',
      from: null,
      to: 'created',
      actor,
      visibility: 'customer',
      detail: 'Exchange request created with your accepted quote.',
      data: { quoteId: quote.id, direction: 'buy', payIn },
    });
    recordAcceptances(ctx, userId, docs, 'order', { ip: actor.ip, orderId: id });
    audit(ctx, actor, {
      action: 'order.created',
      targetType: 'order',
      targetId: id,
      data: {
        quoteId: quote.id,
        direction: 'buy',
        payIn,
        grossCents: quote.grossCents,
        amountAtomic: quote.amountAtomic,
      },
    });
  });

  // Wire/card: wait in `created` until an admin issues payment instructions in CRM.
  if (wire || card) return getOrderRow(ctx, id);
  if (!dest) return getOrderRow(ctx, id);
  // Courier collection waits until an operator sets the fee and the customer accepts it.
  if (feePending) return getOrderRow(ctx, id);

  await issueCashCollectionInstructions(ctx, id, userId, dest.id, quote.grossCents, reference, deadline);
  return getOrderRow(ctx, id);
}

/**
 * Arrange cash collection: use the cash provider when configured; otherwise
 * issue CRM/manual collection instructions so the owner can process in CRM.
 */
async function issueCashCollectionInstructions(
  ctx: AppContext,
  orderId: string,
  userId: string,
  destinationId: string,
  grossCents: bigint,
  reference: string,
  deadline: number,
  { notifyCustomer = true }: { notifyCustomer?: boolean } = {},
): Promise<void> {
  if (ctx.db.get('SELECT 1 FROM deposit_instructions WHERE order_id = ?', [orderId])) return;
  const destination = payoutDetails(ctx, destinationId);
  if (destination.kind !== 'courier') throw new Error('Collection address is not a courier address.');

  const notifyCreated = () => {
    if (!notifyCustomer) return;
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
    notify(ctx, {
      userId,
      to: email,
      template: 'buy_order_created',
      vars: { reference, cash: formatUsd(grossCents), deadline: new Date(deadline).toISOString() },
    });
  };

  if (!isUsable(ctx.providers.cash.info())) {
    ctx.db.tx(() => {
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newId('dep'), orderId, 'crm', `crm_cash_${orderId.replace(/^ord_/, '')}`, 'courier-collection-manual', null, ctx.clock.now()],
      );
      applyOrderEvent(ctx, orderId, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, SYSTEM);
      notifyCreated();
    });
    return;
  }

  try {
    const { providerRef } = await ctx.providers.cash.scheduleCollection({
      orderId,
      amountCents: grossCents,
      destination,
      idempotencyKey: `collection:${orderId}`,
    });
    ctx.db.tx(() => {
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newId('dep'),
          orderId,
          ctx.config.mode === 'sandbox' ? 'sandbox' : 'cash',
          providerRef,
          'courier-collection',
          null,
          ctx.clock.now(),
        ],
      );
      applyOrderEvent(ctx, orderId, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, SYSTEM);
      notifyCreated();
    });
  } catch (e) {
    ctx.log.error('cash collection request failed', { orderId, error: e instanceof Error ? e.message : String(e) });
    applyOrderEvent(
      ctx,
      orderId,
      { type: 'DEPOSIT_INSTRUCTIONS_FAILED', reason: e instanceof ProviderError ? e.message : 'Provider error' },
      SYSTEM,
    );
    if (e instanceof ProviderError && !e.retryable) throw new ApiError(422, 'collection_unavailable', e.message);
    throw new ApiError(503, 'provider_unavailable', 'We could not arrange cash collection. Get a new quote and try again.');
  }
}

/** After the customer accepts a courier fee on a buy order, issue collection instructions. */
export async function issueBuyCashCollection(ctx: AppContext, o: OrderRow): Promise<void> {
  if (!o.payout_destination_id) return;
  await issueCashCollectionInstructions(
    ctx,
    o.id,
    o.user_id,
    o.payout_destination_id,
    BigInt(o.gross_cents),
    o.reference,
    o.deposit_deadline,
    { notifyCustomer: false },
  );
}

/**
 * Wire buys: issue CRM bank credentials (snapshot) and move the order to
 * awaiting deposit. Requires an active wire credential set. Editing the set
 * later never changes this order's snapshot.
 */
export function issueWireInstructions(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  opts: { wireSetId?: string | null } = {},
): OrderRow {
  const o = getOrderRow(ctx, orderId);
  if (o.direction !== 'buy' || o.payout_method !== 'wire') throw conflict('Only wire orders have wire instructions.', 'invalid_transition');
  if (o.status !== 'created') throw conflict(`Wire instructions were already issued (the order is ${o.status}).`, 'invalid_transition');

  const set = opts.wireSetId ? getWireSet(ctx, opts.wireSetId) : defaultWireSet(ctx, 'USD');
  if (!set || set.status !== 'active')
    throw new ApiError(
      422,
      'credentials_unavailable',
      'No active bank credential set is available. Add or activate one in CRM → Credentials before issuing wire instructions.',
    );

  const snap = wireRowToSnapshot(set);
  return ctx.db.tx(() => {
    upsertWireSnapshot(ctx, o.id, snap, actor, true);
    recordAssignment(ctx, o.id, 'wire', 'assigned', actor, null, snap, null);
    ctx.db.run(
      'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newId('dep'), o.id, 'crm', `crm_wire_${o.id.replace(/^ord_/, '')}`, 'wire-credentials', o.reference, ctx.clock.now()],
    );
    audit(ctx, actor, {
      action: 'order.wire_instructions_issued',
      targetType: 'order',
      targetId: o.id,
      data: { wireSetId: set.id, name: set.name },
    });
    const updated = applyOrderEvent(ctx, o.id, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, SYSTEM);
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
    notify(ctx, {
      userId: o.user_id,
      to: email,
      template: 'buy_wire_instructions',
      orderId: o.id,
      vars: { reference: o.reference, cash: formatUsd(BigInt(o.gross_cents)), deadline: new Date(o.deposit_deadline).toISOString() },
    });
    return updated;
  });
}

/**
 * Card buys: issue an external payment-page URL and/or payment instructions.
 * Does not collect card data in-app. Moves created → awaiting_deposit.
 */
export function issueCardPayInInstructions(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  input: { paymentUrl?: string | null; instructions?: string | null; providerRef?: string | null },
): OrderRow {
  const o = getOrderRow(ctx, orderId);
  if (o.direction !== 'buy' || o.payout_method !== 'instant_debit')
    throw conflict('Only card pay-in orders accept card payment instructions.', 'invalid_transition');
  if (o.status !== 'created')
    throw conflict(`Card payment instructions were already issued (the order is ${o.status}).`, 'invalid_transition');

  const paymentUrl = (input.paymentUrl ?? '').trim();
  const instructions = (input.instructions ?? '').trim();
  const providerRef = (input.providerRef ?? '').trim() || null;
  if (!paymentUrl && !instructions)
    throw badRequest('Provide a payment page URL and/or payment instructions from your processor.', { field: 'paymentUrl' });
  if (paymentUrl) {
    let parsed: URL;
    try {
      parsed = new URL(paymentUrl);
    } catch {
      throw badRequest('Enter a valid https payment page URL.', { field: 'paymentUrl' });
    }
    if (parsed.protocol !== 'https:') throw badRequest('Payment page URLs must use https.', { field: 'paymentUrl' });
    if (paymentUrl.length > 2000) throw badRequest('Payment URL is too long.', { field: 'paymentUrl' });
  }
  if (instructions.length > 4000) throw badRequest('Instructions are too long.', { field: 'instructions' });

  return ctx.db.tx(() => {
    ctx.db.run(
      `INSERT INTO order_card_payin_snapshots
         (order_id, payment_url, instructions, provider_ref, assigned_by, assigned_at, revealed_to_customer)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [o.id, paymentUrl || null, instructions || null, providerRef, actor.id, ctx.clock.now()],
    );
    ctx.db.run(
      'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        newId('dep'),
        o.id,
        'crm',
        providerRef ?? `crm_card_${o.id.replace(/^ord_/, '')}`,
        paymentUrl || 'card-payin-instructions',
        o.reference,
        ctx.clock.now(),
      ],
    );
    audit(ctx, actor, {
      action: 'order.card_payin_instructions_issued',
      targetType: 'order',
      targetId: o.id,
      data: { hasUrl: !!paymentUrl, hasInstructions: !!instructions, providerRef },
    });
    const updated = applyOrderEvent(ctx, o.id, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, SYSTEM);
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
    notify(ctx, {
      userId: o.user_id,
      to: email,
      template: 'buy_card_payin_instructions',
      orderId: o.id,
      vars: { reference: o.reference, cash: formatUsd(BigInt(o.gross_cents)), deadline: new Date(o.deposit_deadline).toISOString() },
    });
    return updated;
  });
}

export function orderCardPayInSnapshot(ctx: AppContext, orderId: string) {
  return (
    ctx.db.get<{
      order_id: string;
      payment_url: string | null;
      instructions: string | null;
      provider_ref: string | null;
      assigned_by: string | null;
      assigned_at: number;
      revealed_to_customer: number;
    }>('SELECT * FROM order_card_payin_snapshots WHERE order_id = ?', [orderId]) ?? null
  );
}

/** Staff: assign or replace wire credentials on an order (replace needs confirm + reason once revealed). */
export function assignWireCredentials(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  wireSetId: string,
  opts: { confirmReplace?: boolean; reason?: string | null } = {},
): OrderRow {
  const o = getOrderRow(ctx, orderId);
  if (o.direction !== 'buy' || o.payout_method !== 'wire') throw conflict('Only wire buy orders accept bank credentials.', 'invalid_transition');
  if (o.status === 'created') return issueWireInstructions(ctx, actor, orderId, { wireSetId });

  const set = getWireSet(ctx, wireSetId);
  if (set.status !== 'active') throw conflict('That credential set is suspended.', 'invalid_status');
  const existing = orderWireSnapshot(ctx, orderId);
  if (existing?.revealedToCustomer && !opts.confirmReplace)
    throw conflict(
      'The customer already has wire instructions. Confirm replacement and provide a reason to overwrite the snapshot.',
      'confirm_replace_required',
    );
  if (existing?.revealedToCustomer && !opts.reason?.trim())
    throw badRequest('Enter a reason for replacing issued credentials.', { field: 'reason' });

  const snap = wireRowToSnapshot(set);
  return ctx.db.tx(() => {
    upsertWireSnapshot(ctx, o.id, snap, actor, true);
    recordAssignment(ctx, o.id, 'wire', existing ? 'replaced' : 'assigned', actor, existing, snap, opts.reason?.trim() || null);
    audit(ctx, actor, {
      action: existing ? 'order.wire_credentials_replaced' : 'order.wire_credentials_assigned',
      targetType: 'order',
      targetId: o.id,
      reason: opts.reason?.trim() || null,
      data: { wireSetId, name: set.name },
    });
    return getOrderRow(ctx, o.id);
  });
}

/**
 * Staff: issue or replace wire credentials entered for this order only
 * (not saved as a reusable CRM set). Snapshot is still immutable on the order.
 */
export function assignCustomWireCredentials(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  input: {
    beneficiary: string;
    bankName: string;
    accountNumber?: string | null;
    routingNumber?: string | null;
    swiftBic?: string | null;
    bankAddress?: string | null;
    instructions?: string | null;
    confirmReplace?: boolean;
    reason?: string | null;
  },
): OrderRow {
  const o = getOrderRow(ctx, orderId);
  if (o.direction !== 'buy' || o.payout_method !== 'wire') throw conflict('Only wire buy orders accept bank credentials.', 'invalid_transition');
  const beneficiary = input.beneficiary.trim();
  const bankName = input.bankName.trim();
  if (!beneficiary) throw badRequest('Enter the payment beneficiary.', { field: 'beneficiary' });
  if (!bankName) throw badRequest('Enter the bank name.', { field: 'bankName' });
  const accountNumber = input.accountNumber?.trim() || null;
  const routingNumber = input.routingNumber?.trim() || null;
  const swiftBic = input.swiftBic?.trim() || null;
  if (!accountNumber && !routingNumber && !swiftBic)
    throw badRequest('Provide an account number, routing number, or SWIFT/BIC.', { field: 'accountNumber' });

  const existing = orderWireSnapshot(ctx, orderId);
  const revealed = !!existing?.revealedToCustomer || o.status !== 'created';
  if (existing?.revealedToCustomer && !input.confirmReplace)
    throw conflict(
      'The customer already has wire instructions. Confirm replacement and provide a reason to overwrite the snapshot.',
      'confirm_replace_required',
    );
  if (existing?.revealedToCustomer && !input.reason?.trim())
    throw badRequest('Enter a reason for replacing issued credentials.', { field: 'reason' });

  const snap = {
    wireSetId: null as string | null,
    name: 'Order-specific wire details',
    beneficiary,
    bankName,
    accountNumber,
    routingNumber,
    swiftBic,
    bankAddress: input.bankAddress?.trim() || null,
    instructions: input.instructions?.trim() || null,
    currency: 'USD' as const,
  };

  return ctx.db.tx(() => {
    const hadDeposit = !!ctx.db.get('SELECT 1 FROM deposit_instructions WHERE order_id = ?', [o.id]);
    upsertWireSnapshot(ctx, o.id, snap, actor, true);
    recordAssignment(ctx, o.id, 'wire', existing ? 'replaced' : 'assigned', actor, existing, snap, input.reason?.trim() || null);
    if (!hadDeposit) {
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newId('dep'), o.id, 'crm', `crm_wire_custom_${o.id.replace(/^ord_/, '')}`, 'wire-credentials', o.reference, ctx.clock.now()],
      );
      if (o.status === 'created') applyOrderEvent(ctx, o.id, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, SYSTEM);
    }
    audit(ctx, actor, {
      action: existing ? 'order.wire_credentials_replaced' : 'order.wire_credentials_assigned',
      targetType: 'order',
      targetId: o.id,
      reason: input.reason?.trim() || null,
      data: { custom: true, name: snap.name },
    });
    if (!existing || !revealed) {
      const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
      notify(ctx, {
        userId: o.user_id,
        to: email,
        template: 'buy_wire_instructions',
        orderId: o.id,
        vars: { reference: o.reference, cash: formatUsd(BigInt(o.gross_cents)), deadline: new Date(o.deposit_deadline).toISOString() },
      });
    }
    return getOrderRow(ctx, o.id);
  });
}

/** Staff: assign or replace a CRM deposit wallet on a sell order. */
export function assignWalletCredentials(
  ctx: AppContext,
  actor: Actor,
  orderId: string,
  walletId: string,
  opts: { confirmReplace?: boolean; reason?: string | null } = {},
): OrderRow {
  const o = getOrderRow(ctx, orderId);
  if (o.direction !== 'sell') throw conflict('Only sell orders receive crypto deposit wallets.', 'invalid_transition');
  const wallet = getWallet(ctx, walletId);
  if (wallet.status !== 'active' || !wallet.asset || !wallet.network)
    throw conflict('Select an active wallet with asset and network.', 'invalid_status');
  if (wallet.asset !== o.asset || wallet.network !== o.network)
    throw conflict(`Wallet must be ${o.asset} on ${o.network}.`, 'asset_mismatch');

  const existing = orderWalletSnapshot(ctx, orderId);
  const hasDeposit = !!ctx.db.get('SELECT 1 FROM deposit_instructions WHERE order_id = ?', [o.id]);
  const revealed = !!(existing?.revealedToCustomer || hasDeposit);

  if (revealed && !opts.confirmReplace)
    throw conflict(
      'The customer already has a deposit address. Confirm replacement and provide a reason to overwrite the snapshot.',
      'confirm_replace_required',
    );
  if (revealed && !opts.reason?.trim()) throw badRequest('Enter a reason for replacing the deposit address.', { field: 'reason' });

  const snap = walletRowToSnapshot(wallet);
  return ctx.db.tx(() => {
    if (!hasDeposit) {
      upsertWalletSnapshot(ctx, o.id, snap, actor, true);
      recordAssignment(ctx, o.id, 'wallet', 'assigned', actor, null, snap, null);
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newId('dep'),
          o.id,
          'crm',
          `crm_wal_${wallet.id.replace(/^wal_/, '')}`,
          snap.address,
          snap.destinationTag ?? null,
          ctx.clock.now(),
        ],
      );
      audit(ctx, actor, {
        action: 'order.wallet_assigned',
        targetType: 'order',
        targetId: o.id,
        data: { walletId: wallet.id, address: snap.address },
      });
      if (o.status === 'created') {
        applyOrderEvent(ctx, o.id, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, SYSTEM);
        const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
        notify(ctx, {
          userId: o.user_id,
          to: email,
          template: 'order_created',
          vars: {
            reference: o.reference,
            amount: formatAssetPlain(BigInt(o.amount_atomic), o.asset),
            network: networkLabel(o.asset, o.network),
            deadline: new Date(o.deposit_deadline).toISOString(),
          },
        });
      }
      return getOrderRow(ctx, o.id);
    }

    upsertWalletSnapshot(ctx, o.id, snap, actor, true);
    ctx.db.run('UPDATE deposit_instructions SET address = ?, provider = ?, provider_ref = ? WHERE order_id = ?', [
      snap.address,
      'crm',
      `crm_wal_${wallet.id.replace(/^wal_/, '')}`,
      o.id,
    ]);
    recordAssignment(ctx, o.id, 'wallet', 'replaced', actor, existing, snap, opts.reason?.trim() || null);
    audit(ctx, actor, {
      action: 'order.wallet_replaced',
      targetType: 'order',
      targetId: o.id,
      reason: opts.reason?.trim() || null,
      data: { walletId, address: snap.address, previousAddress: existing?.address ?? null },
    });
    insertEvent(ctx, o.id, {
      type: 'DEPOSIT_ADDRESS_REPLACED',
      from: o.status,
      to: o.status,
      actor,
      visibility: 'customer',
      detail: 'The deposit address for this order was updated. Use only the address shown on the order page.',
      data: { address: snap.address, previousAddress: existing?.address ?? null, reason: opts.reason?.trim() || null },
    });
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
    notify(ctx, {
      userId: o.user_id,
      to: email,
      template: 'deposit_address_updated',
      orderId: o.id,
      vars: {
        reference: o.reference,
        network: networkLabel(o.asset, o.network),
        amount: formatAssetPlain(BigInt(o.amount_atomic), o.asset),
      },
    });
    return getOrderRow(ctx, o.id);
  });
}

/* ---------- Customer actions ---------- */

export function customerOrder(ctx: AppContext, userId: string, id: string): OrderRow {
  const o = ctx.db.get<OrderRow>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, userId]);
  if (!o) throw notFound('Order not found.');
  return o;
}

export function cancelOrder(ctx: AppContext, actor: Actor, userId: string, id: string): OrderRow {
  const o = customerOrder(ctx, userId, id);
  return applyOrderEvent(ctx, o.id, { type: 'CUSTOMER_CANCELLED' }, actor);
}

/**
 * The customer submits the transaction hash for review. Recorded only: it never
 * moves the order, and nothing claims the transfer was verified. Submitting
 * the same hash again is a no-op, so a retried request is safe.
 */
export function reportSent(ctx: AppContext, actor: Actor, userId: string, id: string, txHash: string | null): OrderRow {
  const o = customerOrder(ctx, userId, id);
  if (o.direction === 'buy' && o.payout_method !== 'wire')
    throw conflict('Cash orders have no transaction hash to submit.', 'invalid_transition');
  if (o.customer_reported_sent_at) return o;
  if (o.direction === 'buy') {
    // Wire: the customer's own reference is optional and only format-checked; it never confirms a payment.
    const ref = txHash?.trim() ?? '';
    const refError = validateWireReference(ref);
    if (refError) throw badRequest(refError, { field: 'txHash' });
    return applyOrderEvent(ctx, o.id, { type: 'CUSTOMER_REPORTED_SENT', txHash: ref || null }, actor);
  }
  // The hash is required so the team can look the transfer up; only its format is checked here.
  const hash = txHash?.trim() ?? '';
  const error = validateTxHash(hash, o.network);
  if (error) throw badRequest(error, { field: 'txHash' });
  return applyOrderEvent(ctx, o.id, { type: 'CUSTOMER_REPORTED_SENT', txHash: hash }, actor);
}

/* ---------- Background: expiry ---------- */

export function expireOverdueOrders(ctx: AppContext): number {
  const due = ctx.db.all<{ id: string }>("SELECT id FROM orders WHERE status = 'awaiting_deposit' AND deposit_deadline <= ?", [
    ctx.clock.now(),
  ]);
  let n = 0;
  for (const { id } of due) {
    try {
      applyOrderEvent(
        ctx,
        id,
        { type: 'DEPOSIT_WINDOW_EXPIRED' },
        { type: 'system', id: null, role: null, ip: null },
        { expectedStatus: 'awaiting_deposit' },
      );
      n++;
    } catch (e) {
      ctx.log.warn('expiry skipped', { orderId: id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return n;
}

/* ---------- Provider-driven progress (called from webhook processing) ---------- */

export function afterDepositConfirmed(ctx: AppContext, orderId: string) {
  const o = getOrderRow(ctx, orderId);
  // A held order waits here; releasing the hold runs this step (see releaseHold).
  if (o.status !== 'deposit_confirmed' || o.on_hold === 1) return o;
  const manual =
    BigInt(o.gross_cents) >= ctx.config.manualReviewThresholdCents && ctx.config.manualReviewThresholdCents > 0n
      ? `Amount at or above the manual review threshold (${formatUsd(ctx.config.manualReviewThresholdCents, { whole: true })}).`
      : null;
  const next = postDepositEvent(machineState(o), { manualReviewRequired: manual });
  const updated = applyOrderEvent(ctx, orderId, next, { type: 'system', id: null, role: null, ip: null });
  if (next.type === 'REVIEW_REQUIRED') openReview(ctx, orderId, next.reason, null);
  const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [o.user_id])!.email;
  notify(ctx, {
    userId: o.user_id,
    to: email,
    template: o.direction === 'buy' ? (o.payout_method === 'wire' ? 'buy_wire_verified' : 'buy_cash_verified') : 'deposit_confirmed',
    vars: { reference: o.reference },
  });
  return updated;
}

export function openReview(ctx: AppContext, orderId: string, reason: string, openedBy: string | null) {
  const existing = ctx.db.get("SELECT 1 FROM compliance_reviews WHERE order_id = ? AND status IN ('open','info_requested')", [orderId]);
  if (existing) return;
  ctx.db.run('INSERT INTO compliance_reviews (id, order_id, status, reason, opened_by, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    newId('rev'),
    orderId,
    'open',
    reason,
    openedBy,
    ctx.clock.now(),
  ]);
}

/* ---------- Views ---------- */

export function orderEvents(ctx: AppContext, orderId: string, includeInternal: boolean) {
  return ctx.db
    .all<OrderEventRow>(
      `SELECT * FROM order_events WHERE order_id = ? ${includeInternal ? '' : "AND visibility = 'customer'"} ORDER BY seq`,
      [orderId],
    )
    .map((e) => ({
      seq: e.seq,
      type: e.type,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      actorType: e.actor_type,
      ...(includeInternal ? { actorId: e.actor_id, data: JSON.parse(e.data) as Record<string, unknown>, visibility: e.visibility } : {}),
      detail: e.detail,
      createdAt: e.created_at,
    }));
}

export function orderView(ctx: AppContext, o: OrderRow, { internal = false }: { internal?: boolean } = {}) {
  const deposit = ctx.db.get<{ address: string; memo: string | null; provider_ref: string | null; provider: string }>(
    'SELECT address, memo, provider_ref, provider FROM deposit_instructions WHERE order_id = ?',
    [o.id],
  );
  const events = orderEvents(ctx, o.id, internal);
  const buy = o.direction === 'buy';
  const payIn = buyPayIn(o.direction, o.payout_method);
  // The hash the customer submitted for review (format-checked only; not proof of a deposit).
  const reported = ctx.db.get<{ data: string }>("SELECT data FROM order_events WHERE order_id = ? AND type = 'CUSTOMER_REPORTED_SENT'", [
    o.id,
  ]);
  const customerTxHash = reported ? ((JSON.parse(reported.data) as { txHash?: string | null }).txHash ?? null) : null;
  const wireSnap = payIn === 'wire' ? orderWireSnapshot(ctx, o.id) : null;
  const cardPayInSnap = payIn === 'card' ? orderCardPayInSnapshot(ctx, o.id) : null;
  const walletSnap = !buy ? orderWalletSnapshot(ctx, o.id) : null;
  // CRM-issued addresses are shown even in sandbox; MOCK custody addresses remain sandbox-only.
  const address =
    deposit && !buy && (deposit.provider === 'crm' || ctx.config.mode !== 'sandbox' || isPreviewDepositAddress(deposit.address))
      ? deposit.address
      : null;
  const wireInstructions =
    payIn === 'wire' && o.status !== 'created'
      ? wireSnap
        ? wireLinesFromSnapshot(wireSnap, o.reference)
        : deposit
          ? wireInstructionsPreview(o.reference).filter((l) => !l.placeholder || isPreviewWireValue(l.value))
          : null
      : null;
  const cardPayInInstructions =
    payIn === 'card' && o.status !== 'created' && cardPayInSnap
      ? {
          paymentUrl: cardPayInSnap.payment_url,
          instructions: cardPayInSnap.instructions,
          providerRef: cardPayInSnap.provider_ref,
          assignedAt: cardPayInSnap.assigned_at,
        }
      : null;
  return {
    id: o.id,
    reference: o.reference,
    source: o.source,
    direction: o.direction,
    /** Buy orders: how the dollars are paid (courier_cash, wire, or card). */
    payIn: payIn ?? null,
    status: o.status,
    /** The owner-facing pipeline stage (New, Awaiting Payment, Payment Review, …). */
    stage: orderStage(o.status, o.on_hold === 1),
    onHold: o.on_hold === 1,
    version: o.version,
    asset: o.asset,
    network: o.network,
    networkLabel: networkLabel(o.asset, o.network),
    amountAtomic: o.amount_atomic,
    quote: {
      id: o.quote_id,
      referencePriceMicros: o.reference_price_micros,
      grossCents: String(o.gross_cents),
      spreadBps: o.spread_bps,
      spreadCents: String(o.spread_cents),
      payoutFeeCents: String(o.payout_fee_cents),
      netCents: String(o.net_cents),
      feePending: o.courier_fee_pending === 1,
    },
    courierFee: {
      pending: o.courier_fee_pending === 1,
      acceptedAt: o.courier_fee_accepted_at,
      /** True when the fee is set but the customer has not yet accepted the priced quote. */
      awaitingAcceptance: o.payout_method === 'courier_cash' && o.courier_fee_pending === 0 && o.courier_fee_accepted_at === null,
    },
    payout: (() => {
      const pi = ctx.db.get<{
        completion_kind: 'provider' | 'manual' | null;
        evidence_ref: string | null;
        evidence_note: string | null;
        provider_ref: string | null;
        payout_tx_hash: string | null;
        recorded_by: string | null;
        completed_at: number | null;
      }>(
        `SELECT completion_kind, evidence_ref, evidence_note, provider_ref, payout_tx_hash, recorded_by, completed_at
         FROM payout_instructions WHERE order_id = ? AND status = 'completed' ORDER BY attempt DESC LIMIT 1`,
        [o.id],
      );
      return {
        method: o.payout_method,
        methodName: PAYOUT_METHODS[o.payout_method].name,
        timing: PAYOUT_METHODS[o.payout_method].timingEstimate,
        label: o.payout_label,
        last4: o.payout_last4,
        providerRef: o.payout_provider_ref,
        /** How completion was established. Null until the order is completed. */
        completionKind: pi?.completion_kind ?? null,
        /** Customer-visible reference for a recorded payout; never invents one. */
        evidenceRef: pi?.completion_kind === 'manual' ? pi.evidence_ref : null,
        /** Buy→crypto: actual outgoing TXID when recorded (manual or provider). */
        payoutTxHash: pi?.payout_tx_hash ?? null,
        // The customer sees the delivery details they gave; staff views add role-masked details separately.
        delivery:
          !internal && o.payout_method === 'courier_cash' && o.payout_destination_id ? courierDelivery(ctx, o.payout_destination_id) : null,
        ...(internal
          ? {
              manualEvidenceNote: pi?.completion_kind === 'manual' ? pi.evidence_note : null,
              manualRecordedBy: pi?.completion_kind === 'manual' ? pi.recorded_by : null,
              completedAt: pi?.completed_at ?? null,
            }
          : {}),
      };
    })(),
    /** Wire buys, once issued: bank details from the order's CRM snapshot (immutable). */
    wireInstructions,
    /** True when a wire buy is waiting for staff to assign bank credentials. */
    wireCredentialsPending: payIn === 'wire' && o.status === 'created' && !wireSnap,
    /** Card buys, once issued: external payment URL / instructions (never a fake processor page). */
    cardPayInInstructions,
    /** True when a card buy is waiting for staff to issue a payment link or instructions. */
    cardPayInPending: payIn === 'card' && o.status === 'created' && !cardPayInSnap,
    /** True when a sell has no deposit address yet (no CRM wallet / not assigned). */
    depositCredentialsPending: !buy && o.status === 'created' && !deposit,
    /** Sell: where crypto is returned, once the customer has given it. Null for a buy, whose cash is returned by courier. */
    refundAddress: buy ? null : o.refund_address,
    /** Sell: a refund is pending and waits for the customer's return address. */
    refundAddressNeeded: !buy && o.status === 'refund_pending' && !o.refund_address,
    /** Buy: the wallet that receives the crypto. */
    receiveAddress: buy ? o.refund_address : null,
    documents: orderDocuments(ctx, o.id),
    deposit: (() => {
      const manualConfirm = events.some((e) => e.type === 'MANUAL_DEPOSIT_CONFIRMED');
      const providerConfirm = events.some((e) => e.type === 'DEPOSIT_CONFIRMED');
      return {
        address,
        memo: deposit?.memo ?? null,
        deadline: o.deposit_deadline,
        confirmations: { count: o.confirmations_count, required: o.confirmations_required },
        txHash: o.deposit_tx_hash,
        amountAtomic: o.deposit_amount_atomic,
        exception: o.deposit_exception,
        customerReportedSentAt: o.customer_reported_sent_at,
        customerTxHash,
        /** How deposit finality was established. Null until confirmed. */
        confirmationKind: manualConfirm ? ('manual' as const) : providerConfirm ? ('provider' as const) : null,
      };
    })(),
    refundTxHash: o.refund_tx_hash,
    steps: orderSteps(
      o.status,
      events.map((e) => ({ type: e.type as never, toStatus: e.toStatus, createdAt: e.createdAt, detail: e.detail })),
      {
        count: o.confirmations_count,
        required: o.confirmations_required,
      },
      o.direction,
      payIn,
    ),
    events,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    ...(internal
      ? {
          reviewReason: o.review_reason,
          assignedOperatorId: o.assigned_operator_id,
          depositProviderRef: deposit?.provider_ref ?? null,
          operationCredentials: {
            wire: wireSnap,
            wallet: walletSnap,
            assignmentHistory: ctx.db
              .all<{
                id: number;
                kind: string;
                action: string;
                actor_id: string | null;
                reason: string | null;
                created_at: number;
              }>('SELECT id, kind, action, actor_id, reason, created_at FROM credential_assignment_events WHERE order_id = ? ORDER BY id', [
                o.id,
              ])
              .map((e) => ({
                id: e.id,
                kind: e.kind,
                action: e.action,
                actorId: e.actor_id,
                reason: e.reason,
                createdAt: e.created_at,
              })),
          },
        }
      : {}),
  };
}

export function orderDocuments(ctx: AppContext, orderId: string) {
  return ctx.db
    .all<{
      id: string;
      kind: string;
      file_name: string;
      content_type: string;
      size_bytes: number;
      sha256: string;
      stored: number;
      created_at: number;
    }>(
      'SELECT id, kind, file_name, content_type, size_bytes, sha256, stored, created_at FROM order_documents WHERE order_id = ? ORDER BY created_at',
      [orderId],
    )
    .map((d) => ({
      id: d.id,
      kind: d.kind as 'id_document' | 'payment_receipt' | 'admin_attachment' | 'refund_attachment',
      fileName: d.file_name,
      contentType: d.content_type,
      sizeBytes: d.size_bytes,
      sha256: d.sha256,
      stored: d.stored === 1,
      createdAt: d.created_at,
    }));
}

export function listCustomerOrders(ctx: AppContext, userId: string, page: number, pageSize: number) {
  const total = ctx.db.get<{ n: number }>('SELECT count(*) AS n FROM orders WHERE user_id = ?', [userId])!.n;
  const rows = ctx.db.all<OrderRow>('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [
    userId,
    pageSize,
    (page - 1) * pageSize,
  ]);
  return {
    total,
    page,
    pageSize,
    items: rows.map((o) => ({
      id: o.id,
      reference: o.reference,
      source: o.source,
      direction: o.direction,
      status: o.status,
      stage: orderStage(o.status, o.on_hold === 1),
      asset: o.asset,
      network: o.network,
      amountAtomic: o.amount_atomic,
      netCents: String(o.net_cents),
      grossCents: String(o.gross_cents),
      payoutMethod: o.payout_method,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    })),
  };
}
