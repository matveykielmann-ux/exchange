/**
 * Quote calculation. Pure and deterministic: identical inputs always produce
 * identical outputs, so the same function can later run server-side to verify
 * a quote that the client displayed.
 *
 * Reconciliation invariant: grossCents − spreadCents − payoutFeeCents === netCents.
 * Every line is rounded to whole cents BEFORE subtraction, so the displayed
 * rows always add up exactly to the displayed payout.
 */
import { ASSETS, type AssetCode, type NetworkId, isSupportedPair } from './assets';
import { divRoundHalfUp, MICROS_PER_CENT, microsToCentsFloor, pow10, type AtomicAmount, type Cents, type Micros } from './money';
import { PAYOUT_METHODS, payoutEligibility, payoutFeeCents, type PayoutMethodId } from './payout';

/** MOCK pricing policy. Real spreads must come from the pricing/treasury owner. */
export const PRICING_POLICY = {
  minimumCents: 50_00n,
  /** There is no maximum. From this amount the large-transaction desk can price an order individually (optional). */
  largeDeskFromCents: 25_000_00n,
  /** Quote validity on the review step before it must be refreshed. */
  quoteTtlMs: 60_000,
  /** Indicative calculator quotes refresh on this cadence. */
  indicativeRefreshMs: 15_000,
  /** How long the locked rate holds for an incoming deposit after confirmation. */
  depositWindowMs: 30 * 60_000,
  spreadBps: {
    volatile: [
      { upToCents: 10_000_00n, bps: 100 },
      { upToCents: null, bps: 75 },
    ],
    stable: [
      { upToCents: 10_000_00n, bps: 30 },
      { upToCents: null, bps: 20 },
    ],
  },
  /** Indicative only — large-transaction pricing is negotiated per request. */
  largeIndicativeSpreadBps: { volatile: 40, stable: 10 },
} as const;

export interface QuoteRequest {
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  payoutMethod: PayoutMethodId;
  referencePriceMicros: Micros;
  now: number;
  /** Where the reference price came from. Defaults to 'mock' for the browser-only calculator. */
  source?: QuoteSource;
  /** Server-assigned id; generated locally when omitted. */
  id?: string;
}

export type QuoteSource = 'mock' | 'sandbox' | 'live';

export type QuoteIssue =
  | { code: 'unsupported_network' }
  | { code: 'zero_amount' }
  | { code: 'below_minimum'; minimumCents: Cents; minimumAtomic: AtomicAmount }
  | { code: 'payout_ineligible'; reason: string }
  | { code: 'non_positive_payout' };

export interface Quote {
  id: string;
  source: QuoteSource;
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  referencePriceMicros: Micros;
  grossCents: Cents;
  spreadBps: number;
  spreadCents: Cents;
  payoutMethod: PayoutMethodId;
  payoutFeeCents: Cents;
  netCents: Cents;
  /** Net USD micros received per whole unit of the asset. */
  effectiveRateMicros: Micros;
  createdAt: number;
  expiresAt: number;
}

export interface QuoteResult {
  quote: Quote;
  issues: QuoteIssue[];
}

export function spreadBpsFor(asset: AssetCode, grossCents: Cents): number {
  const tiers = PRICING_POLICY.spreadBps[ASSETS[asset].class];
  for (const tier of tiers) {
    if (tier.upToCents === null || grossCents < tier.upToCents) return tier.bps;
  }
  throw new Error('Spread tiers must end with an open-ended tier');
}

export function grossCentsFor(asset: AssetCode, amountAtomic: AtomicAmount, priceMicros: Micros): Cents {
  return microsToCentsFloor((amountAtomic * priceMicros) / pow10(ASSETS[asset].decimals));
}

/** Smallest atomic amount whose gross value reaches `cents` (rounded up). */
export function atomicForCents(asset: AssetCode, cents: Cents, priceMicros: Micros): AtomicAmount {
  if (priceMicros <= 0n) return 0n;
  const numerator = cents * MICROS_PER_CENT * pow10(ASSETS[asset].decimals);
  return (numerator + priceMicros - 1n) / priceMicros;
}

let quoteCounter = 0;
function quoteId(now: number): string {
  quoteCounter = (quoteCounter + 1) % 1_000_000;
  return `q_mock_${now.toString(36)}_${quoteCounter.toString(36)}`;
}

export function calculateQuote(req: QuoteRequest): QuoteResult {
  const issues: QuoteIssue[] = [];
  if (!isSupportedPair(req.asset, req.network)) issues.push({ code: 'unsupported_network' });

  const grossCents = grossCentsFor(req.asset, req.amountAtomic, req.referencePriceMicros);
  const spreadBps = spreadBpsFor(req.asset, grossCents);
  const spreadCents = divRoundHalfUp(grossCents * BigInt(spreadBps), 10_000n);
  const method = PAYOUT_METHODS[req.payoutMethod];
  const feeCents = payoutFeeCents(method, grossCents);
  const netCents = grossCents - spreadCents - feeCents;

  if (req.amountAtomic <= 0n) {
    issues.push({ code: 'zero_amount' });
  } else if (grossCents < PRICING_POLICY.minimumCents) {
    issues.push({
      code: 'below_minimum',
      minimumCents: PRICING_POLICY.minimumCents,
      minimumAtomic: atomicForCents(req.asset, PRICING_POLICY.minimumCents, req.referencePriceMicros),
    });
  } else {
    const eligibility = payoutEligibility(method, grossCents);
    if (!eligibility.eligible) issues.push({ code: 'payout_ineligible', reason: eligibility.reason });
    if (netCents <= 0n) issues.push({ code: 'non_positive_payout' });
  }

  const effectiveRateMicros =
    req.amountAtomic > 0n && netCents > 0n ? (netCents * MICROS_PER_CENT * pow10(ASSETS[req.asset].decimals)) / req.amountAtomic : 0n;

  return {
    quote: {
      id: req.id ?? quoteId(req.now),
      source: req.source ?? 'mock',
      asset: req.asset,
      network: req.network,
      amountAtomic: req.amountAtomic,
      referencePriceMicros: req.referencePriceMicros,
      grossCents,
      spreadBps,
      spreadCents,
      payoutMethod: req.payoutMethod,
      payoutFeeCents: feeCents,
      netCents,
      effectiveRateMicros,
      createdAt: req.now,
      expiresAt: req.now + PRICING_POLICY.quoteTtlMs,
    },
    issues,
  };
}

/** Issues about the amount itself (vs. the chosen payout method), which block step 1 of the flow. */
export function amountIssues(issues: QuoteIssue[]): QuoteIssue[] {
  return issues.filter((i) => i.code !== 'payout_ineligible');
}

/**
 * Server-side quote verification. Nothing the client sends is trusted: the
 * price is looked up independently for the quote's timestamp, the timestamp
 * must be fresh, every derived field is recomputed, and issues come from the
 * recomputation rather than the client.
 */
export function verifyQuote(
  quote: Quote,
  priceAt: (asset: AssetCode, time: number) => Micros,
  now: number,
): QuoteResult | { error: 'expired' | 'tampered' } {
  if (quote.createdAt > now || now - quote.createdAt >= PRICING_POLICY.quoteTtlMs) return { error: 'expired' };
  if (priceAt(quote.asset, quote.createdAt) !== quote.referencePriceMicros) return { error: 'tampered' };
  const { quote: r, issues } = calculateQuote({ ...quote, now: quote.createdAt });
  const same =
    r.source === quote.source &&
    r.grossCents === quote.grossCents &&
    r.spreadCents === quote.spreadCents &&
    r.spreadBps === quote.spreadBps &&
    r.payoutFeeCents === quote.payoutFeeCents &&
    r.netCents === quote.netCents &&
    r.expiresAt === quote.expiresAt;
  return same ? { quote, issues } : { error: 'tampered' };
}

export function isQuoteExpired(quote: Pick<Quote, 'expiresAt'>, now: number): boolean {
  return now >= quote.expiresAt;
}
