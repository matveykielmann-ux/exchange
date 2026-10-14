/**
 * Quotes are computed on the server from the rate provider's price; the
 * client sends only inputs and later the quote id. Firm quotes are stored,
 * expire after PRICING_POLICY.quoteTtlMs, and are single-use.
 */
import { isSupportedPair, type AssetCode, type NetworkId } from '@/domain/assets';
import type { PayoutMethodId } from '@/domain/payout';
import { calculateBuyQuote, calculateQuote, type ExchangeDirection, type Quote, type QuoteIssue } from '@/domain/quote';
import type { AppContext } from '../context';
import { ApiError, badRequest, notConfigured, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { isUsable } from '../providers/registry';
import { ProviderError, ProviderNotConfiguredError, type ReferencePrice } from '../providers/types';

export interface SellQuoteInput {
  direction?: 'sell';
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: bigint;
  payoutMethod: PayoutMethodId;
}
/** Cash → crypto: the customer states the dollars they will hand to the courier. */
export interface BuyQuoteInput {
  direction: 'buy';
  asset: AssetCode;
  network: NetworkId;
  cashCents: bigint;
}
export type QuoteInput = SellQuoteInput | BuyQuoteInput;

function compute(input: QuoteInput, price: ReferencePrice, now: number, id: string) {
  return input.direction === 'buy'
    ? calculateBuyQuote({ ...input, referencePriceMicros: price.priceMicros, now, source: price.source, id })
    : calculateQuote({ ...input, referencePriceMicros: price.priceMicros, now, source: price.source, id });
}

export async function referencePrice(ctx: AppContext, asset: AssetCode): Promise<ReferencePrice> {
  if (!isUsable(ctx.providers.rates.info())) throw notConfigured('Exchange-rate provider');
  try {
    const price = await ctx.providers.rates.getReferencePrice(asset);
    // A stale price must never be quoted.
    if (ctx.clock.now() - price.asOf > 60_000)
      throw new ApiError(503, 'price_stale', 'Pricing is temporarily unavailable. Try again in a moment.');
    return price;
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) throw notConfigured('Exchange-rate provider');
    if (e instanceof ProviderError)
      throw new ApiError(503, 'provider_unavailable', 'Pricing is temporarily unavailable. Try again in a moment.');
    throw e;
  }
}

function checkPair(input: QuoteInput) {
  if (!isSupportedPair(input.asset, input.network)) throw badRequest('That asset is not supported on that network.', { field: 'network' });
}

export interface QuoteView {
  quote: Quote;
  issues: QuoteIssue[];
  price: ReferencePrice;
  firm: boolean;
}

/** Indicative quote for the calculator: computed, not stored, cannot be accepted. */
export async function indicativeQuote(ctx: AppContext, input: QuoteInput): Promise<QuoteView> {
  checkPair(input);
  const price = await referencePrice(ctx, input.asset);
  const { quote, issues } = compute(input, price, ctx.clock.now(), 'indicative');
  return { quote, issues, price, firm: false };
}

/** Firm quote for a signed-in customer: stored with its expiry so it can be accepted once. */
export async function firmQuote(ctx: AppContext, userId: string, input: QuoteInput): Promise<QuoteView> {
  checkPair(input);
  const price = await referencePrice(ctx, input.asset);
  const id = newId('qte');
  const { quote, issues } = compute(input, price, ctx.clock.now(), id);
  ctx.db.run(
    `INSERT INTO quotes (id, user_id, direction, source, asset, network, payout_method, amount_atomic, reference_price_micros, price_as_of, gross_cents,
       spread_bps, spread_cents, payout_fee_cents, net_cents, effective_rate_micros, issues, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      quote.direction ?? 'sell',
      quote.source === 'live' ? 'live' : 'sandbox',
      quote.asset,
      quote.network,
      quote.payoutMethod,
      quote.amountAtomic.toString(),
      quote.referencePriceMicros.toString(),
      price.asOf,
      Number(quote.grossCents),
      quote.spreadBps,
      Number(quote.spreadCents),
      Number(quote.payoutFeeCents),
      Number(quote.netCents),
      quote.effectiveRateMicros.toString(),
      JSON.stringify(issues, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
      quote.createdAt,
      quote.expiresAt,
    ],
  );
  return { quote, issues, price, firm: true };
}

export interface QuoteRow {
  id: string;
  user_id: string | null;
  direction: ExchangeDirection;
  source: 'sandbox' | 'live';
  asset: AssetCode;
  network: NetworkId;
  payout_method: PayoutMethodId;
  amount_atomic: string;
  reference_price_micros: string;
  price_as_of: number;
  gross_cents: number;
  spread_bps: number;
  spread_cents: number;
  payout_fee_cents: number;
  net_cents: number;
  effective_rate_micros: string;
  issues: string;
  created_at: number;
  expires_at: number;
  used_at: number | null;
}

export function quoteFromRow(r: QuoteRow): Quote {
  return {
    id: r.id,
    direction: r.direction,
    source: r.source,
    asset: r.asset,
    network: r.network,
    amountAtomic: BigInt(r.amount_atomic),
    referencePriceMicros: BigInt(r.reference_price_micros),
    grossCents: BigInt(r.gross_cents),
    spreadBps: r.spread_bps,
    spreadCents: BigInt(r.spread_cents),
    payoutMethod: r.payout_method,
    payoutFeeCents: BigInt(r.payout_fee_cents),
    netCents: BigInt(r.net_cents),
    effectiveRateMicros: BigInt(r.effective_rate_micros),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

export function loadQuote(ctx: AppContext, id: string, userId: string): QuoteRow {
  const row = ctx.db.get<QuoteRow>('SELECT * FROM quotes WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) throw notFound('Quote not found. Get a new quote.');
  return row;
}
