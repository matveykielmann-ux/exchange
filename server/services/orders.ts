/**
 * Exchange orders. All status changes go through `applyOrderEvent`, which
 * runs the domain state machine and persists the new status, the event and
 * an audit record in one transaction, with optimistic concurrency on the
 * order's version. Nothing else updates orders.status.
 */
import { isValidAddress, NETWORKS, networkLabel, type AssetCode, type NetworkId } from '@/domain/assets';
import { CASH_COLLECTION_WINDOW_MS } from '@/domain/courier';
import { isPreviewWireValue, validateWireReference, WIRE_RECEIPT_WINDOW_MS, wireInstructionsPreview } from '@/domain/wire';
import { formatUsd } from '@/domain/money';
import { PAYOUT_METHODS, payoutEligibility, type PayoutMethodId } from '@/domain/payout';
import { isQuoteExpired, PRICING_POLICY, type ExchangeDirection, type Quote } from '@/domain/quote';
import { canConfirmExchange } from '@/domain/identity';
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
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, notConfigured, notFound } from '../http/errors';
import { newId, randomId } from '../lib/clock';
import { isUsable } from '../providers/registry';
import { ProviderError, ProviderNotConfiguredError, type PayoutProvider, type WebhookSource } from '../providers/types';
import { audit } from './audit';
import { courierDelivery, getProfile, payoutDetails, type DestinationRow } from './customers';
import { notify } from './notifications';
import { loadQuote, quoteFromRow } from './quotes';
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
  'MANUAL_PAYOUT_RECORDED',
  'PAYOUT_COMPLETED',
  'CUSTOMER_CANCELLED',
  'PAYOUT_SUBMITTED',
  'PAYOUT_COMPLETED',
  'PAYOUT_FAILED',
  'REFUND_INITIATED',
  'REFUND_COMPLETED',
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
      status: orderStatusLabel(o.status, o.direction, buyPayIn(o.direction, o.payout_method)),
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

function payoutProviderFor(ctx: AppContext, method: PayoutMethodId): PayoutProvider {
  if (method === 'instant_debit') return ctx.providers.cardPayout;
  if (method === 'ach' || method === 'wire') return ctx.providers.bankPayout;
  return ctx.providers.cash;
}

export async function screenAddress(ctx: AppContext, network: NetworkId, address: string) {
  try {
    return await ctx.providers.screening.screenAddress(network, address);
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) throw notConfigured('Sanctions screening');
    throw new ApiError(503, 'provider_unavailable', 'Screening is temporarily unavailable. Try again shortly.');
  }
}

// Orders created before the rebrand keep their ARC- references.
const newReference = () => `CBX-${randomId(8)}`;

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

  // Readiness: refuse up front rather than take a deposit we cannot pay out.
  if (!isUsable(ctx.providers.custody.info())) throw notConfigured('Deposit address provider');
  const payoutProvider = payoutProviderFor(ctx, quote.payoutMethod);
  if (!isUsable(payoutProvider.info())) throw notConfigured(`${PAYOUT_METHODS[quote.payoutMethod].name} payout provider`);
  if (!isUsable(ctx.providers.screening.info())) throw notConfigured('Sanctions screening');

  if (quoteRow.used_at) throw conflict('This quote has already been used. Get a new quote.', 'quote_used');
  if (isQuoteExpired(quote, now)) throw new ApiError(409, 'quote_expired', 'This quote has expired. Get a new quote to continue.');
  const issues = JSON.parse(quoteRow.issues) as unknown[];
  if (issues.length) throw new ApiError(422, 'quote_issues', 'This quote cannot be accepted. Change the amount or payout method.');
  const eligibility = payoutEligibility(PAYOUT_METHODS[quote.payoutMethod], quote.grossCents);
  if (!eligibility.eligible) throw new ApiError(422, 'method_unavailable', eligibility.reason);

  const profile = getProfile(ctx, userId);
  if (!canConfirmExchange(profile.kyc_status === 'verified' ? 'verified' : 'unverified'))
    throw new ApiError(403, 'kyc_required', 'Verify your identity before confirming an exchange.');

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
  const reference = newReference();
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
         confirmations_required, review_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  // Deposit instructions come from the custody provider. Sandbox addresses are invalid on every chain.
  try {
    const instr = await ctx.providers.custody.createDepositInstructions({
      orderId: id,
      asset: quote.asset,
      network: quote.network,
      amountAtomic: quote.amountAtomic,
      idempotencyKey: `deposit:${id}`,
    });
    if (ctx.config.mode === 'sandbox' && !isPreviewDepositAddress(instr.address))
      throw new Error('Sandbox custody returned an address that could be valid on a real chain.');
    ctx.db.tx(() => {
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newId('dep'),
          id,
          ctx.config.mode === 'sandbox' ? 'sandbox' : 'custody',
          instr.providerRef,
          instr.address,
          instr.memo,
          ctx.clock.now(),
        ],
      );
      applyOrderEvent(ctx, id, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, { type: 'system', id: null, role: null, ip: null });
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
    ctx.log.error('deposit instructions failed', { orderId: id, error: e instanceof Error ? e.message : String(e) });
    applyOrderEvent(
      ctx,
      id,
      { type: 'DEPOSIT_INSTRUCTIONS_FAILED', reason: e instanceof ProviderError ? e.message : 'Provider error' },
      { type: 'system', id: null, role: null, ip: null },
    );
    throw new ApiError(
      503,
      'provider_unavailable',
      'We could not issue deposit instructions. Nothing was sent; get a new quote and try again.',
    );
  }
  return getOrderRow(ctx, id);
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
  if (wire) {
    if (!isUsable(ctx.providers.bankPayout.info())) throw notConfigured('Bank wire provider');
  } else if (!isUsable(ctx.providers.cash.info())) throw notConfigured('Cash collection provider');
  if (!isUsable(ctx.providers.custody.info())) throw notConfigured('Crypto custody provider');
  if (!isUsable(ctx.providers.screening.info())) throw notConfigured('Sanctions screening');

  if (usedAt) throw conflict('This quote has already been used. Get a new quote.', 'quote_used');
  if (isQuoteExpired(quote, now)) throw new ApiError(409, 'quote_expired', 'This quote has expired. Get a new quote to continue.');
  if ((JSON.parse(issuesJson) as unknown[]).length)
    throw new ApiError(422, 'quote_issues', 'This quote cannot be accepted. Change the amount.');
  const eligibility = payoutEligibility(PAYOUT_METHODS[wire ? 'wire' : 'courier_cash'], quote.grossCents);
  if (!eligibility.eligible) throw new ApiError(422, 'method_unavailable', eligibility.reason);

  const profile = getProfile(ctx, userId);
  if (!canConfirmExchange(profile.kyc_status === 'verified' ? 'verified' : 'unverified'))
    throw new ApiError(403, 'kyc_required', 'Verify your identity before confirming an exchange.');

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

  // A wire needs no saved destination: the customer sends it from their own bank.
  const dest = wire
    ? null
    : ctx.db.get<DestinationRow>(
        "SELECT * FROM payout_destinations WHERE id = ? AND user_id = ? AND status = 'active' AND kind = 'courier'",
        [input.destinationId, userId],
      );
  if (!wire && !dest) throw badRequest('Choose the address where the courier collects the cash.', { field: 'destinationId' });

  const docs = requireAcceptance(input.accepted, 'order');

  const screening = await screenAddress(ctx, quote.network, receiveAddress);
  if (screening.result === 'blocked') {
    audit(ctx, actor, { action: 'order.blocked_by_screening', targetType: 'quote', targetId: quote.id, data: { network: quote.network } });
    throw new ApiError(422, 'screening_blocked', 'We can’t process this exchange. Contact support if you think this is a mistake.');
  }

  const id = newId('ord');
  const reference = newReference();
  const deadline = now + (wire ? WIRE_RECEIPT_WINDOW_MS : CASH_COLLECTION_WINDOW_MS);
  ctx.db.tx(() => {
    const { changes } = ctx.db.run('UPDATE quotes SET used_at = ? WHERE id = ? AND used_at IS NULL', [now, quote.id]);
    if (changes !== 1) throw conflict('This quote has already been used. Get a new quote.', 'quote_used');
    ctx.db.run(
      `INSERT INTO orders (id, reference, user_id, quote_id, status, source, direction, asset, network, amount_atomic, reference_price_micros, gross_cents,
         spread_bps, spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address,
         deposit_deadline, confirmations_required, review_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'created', ?, 'buy', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
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
        wire ? 'wire' : 'courier_cash',
        dest?.id ?? null,
        dest?.label ?? 'Bank wire',
        dest?.last4 ?? '',
        receiveAddress,
        deadline,
        screening.result === 'review' ? `Receiving address screening: ${screening.note}` : null,
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
      data: { quoteId: quote.id, direction: 'buy', payIn: wire ? 'wire' : 'courier_cash' },
    });
    recordAcceptances(ctx, userId, docs, 'order', { ip: actor.ip, orderId: id });
    audit(ctx, actor, {
      action: 'order.created',
      targetType: 'order',
      targetId: id,
      data: {
        quoteId: quote.id,
        direction: 'buy',
        payIn: wire ? 'wire' : 'courier_cash',
        grossCents: quote.grossCents,
        amountAtomic: quote.amountAtomic,
      },
    });
  });

  // A wire order waits for its instructions to be issued (in the CRM, or by the sandbox autopilot): see issueWireInstructions.
  if (wire || !dest) return getOrderRow(ctx, id);

  try {
    const destination = payoutDetails(ctx, dest.id);
    if (destination.kind !== 'courier') throw new Error('Collection address is not a courier address.');
    const { providerRef } = await ctx.providers.cash.scheduleCollection({
      orderId: id,
      amountCents: quote.grossCents,
      destination,
      idempotencyKey: `collection:${id}`,
    });
    ctx.db.tx(() => {
      // No crypto deposit address exists for a buy; the row records the courier collection.
      ctx.db.run(
        'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newId('dep'), id, 'cash', providerRef, 'courier-collection', null, ctx.clock.now()],
      );
      applyOrderEvent(ctx, id, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, { type: 'system', id: null, role: null, ip: null });
      const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
      notify(ctx, {
        userId,
        to: email,
        template: 'buy_order_created',
        vars: { reference, cash: formatUsd(quote.grossCents), deadline: new Date(deadline).toISOString() },
      });
    });
  } catch (e) {
    ctx.log.error('cash collection request failed', { orderId: id, error: e instanceof Error ? e.message : String(e) });
    applyOrderEvent(
      ctx,
      id,
      { type: 'DEPOSIT_INSTRUCTIONS_FAILED', reason: e instanceof ProviderError ? e.message : 'Provider error' },
      { type: 'system', id: null, role: null, ip: null },
    );
    if (e instanceof ProviderError && !e.retryable) throw new ApiError(422, 'collection_unavailable', e.message);
    throw new ApiError(503, 'provider_unavailable', 'We could not arrange cash collection. Get a new quote and try again.');
  }
  return getOrderRow(ctx, id);
}

/**
 * Wire buys: records that the wire instructions were issued and moves the
 * order to "awaiting wire". Demo only: in the sandbox the instructions are
 * placeholders (domain/wire.ts) and nothing a customer could pay into is
 * stored. Outside the sandbox there is no contracted bank, so this refuses.
 * The operator's action is audited; the transition itself is a system event.
 */
export function issueWireInstructions(ctx: AppContext, actor: Actor, orderId: string): OrderRow {
  if (ctx.config.mode !== 'sandbox') throw notConfigured('Bank wire provider');
  const o = getOrderRow(ctx, orderId);
  if (o.direction !== 'buy' || o.payout_method !== 'wire') throw conflict('Only wire orders have wire instructions.', 'invalid_transition');
  if (o.status !== 'created') throw conflict(`Wire instructions were already issued (the order is ${o.status}).`, 'invalid_transition');
  const placeholder = 'DEMO-WIRE-INSTRUCTIONS-NOT-ISSUED';
  return ctx.db.tx(() => {
    ctx.db.run(
      'INSERT INTO deposit_instructions (id, order_id, provider, provider_ref, address, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newId('dep'), o.id, 'sandbox', `sbx_wire_${o.id.replace(/^ord_/, '')}`, placeholder, o.reference, ctx.clock.now()],
    );
    audit(ctx, actor, { action: 'order.wire_instructions_issued', targetType: 'order', targetId: o.id, data: { demo: true } });
    const updated = applyOrderEvent(ctx, o.id, { type: 'DEPOSIT_INSTRUCTIONS_ISSUED' }, { type: 'system', id: null, role: null, ip: null });
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
  const deposit = ctx.db.get<{ address: string; memo: string | null; provider_ref: string | null }>(
    'SELECT address, memo, provider_ref FROM deposit_instructions WHERE order_id = ?',
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
  // In sandbox mode the UI must never show an address that could be valid on a real chain. A buy has no deposit address.
  const address = deposit && !buy && (ctx.config.mode !== 'sandbox' || isPreviewDepositAddress(deposit.address)) ? deposit.address : null;
  return {
    id: o.id,
    reference: o.reference,
    source: o.source,
    direction: o.direction,
    /** Buy orders: how the dollars are paid (courier_cash or wire). */
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
    },
    payout: (() => {
      const pi = ctx.db.get<{
        completion_kind: 'provider' | 'manual' | null;
        evidence_ref: string | null;
        evidence_note: string | null;
        provider_ref: string | null;
        recorded_by: string | null;
        completed_at: number | null;
      }>(
        `SELECT completion_kind, evidence_ref, evidence_note, provider_ref, recorded_by, completed_at
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
    /**
     * Wire buys, once instructions are issued: what the customer sends and where. In this demo every bank field is a
     * placeholder (never a real account or routing number); anything else is withheld.
     */
    wireInstructions:
      payIn === 'wire' && deposit && o.status !== 'created'
        ? wireInstructionsPreview(o.reference).filter((l) => !l.placeholder || isPreviewWireValue(l.value))
        : null,
    /** Sell: where crypto is returned, once the customer has given it. Null for a buy, whose cash is returned by courier. */
    refundAddress: buy ? null : o.refund_address,
    /** Sell: a refund is pending and waits for the customer's return address. */
    refundAddressNeeded: !buy && o.status === 'refund_pending' && !o.refund_address,
    /** Buy: the wallet that receives the crypto. */
    receiveAddress: buy ? o.refund_address : null,
    documents: orderDocuments(ctx, o.id),
    deposit: {
      address,
      memo: deposit?.memo ?? null,
      deadline: o.deposit_deadline,
      confirmations: { count: o.confirmations_count, required: o.confirmations_required },
      txHash: o.deposit_tx_hash,
      amountAtomic: o.deposit_amount_atomic,
      exception: o.deposit_exception,
      customerReportedSentAt: o.customer_reported_sent_at,
      customerTxHash,
    },
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
      ? { reviewReason: o.review_reason, assignedOperatorId: o.assigned_operator_id, depositProviderRef: deposit?.provider_ref ?? null }
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
      kind: d.kind as 'id_document',
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
