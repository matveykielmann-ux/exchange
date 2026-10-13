/**
 * Live indicative quote for the current inputs. Refreshes on the pricing
 * cadence and whenever inputs change. Loading/idle are derived from whether
 * the stored result matches the current request key, so stale responses can
 * never be shown as current and no state is set synchronously in effects.
 */
import { useEffect, useState } from 'react';
import { parseAssetAmount, type AssetCode, type NetworkId } from '@/domain/assets';
import type { PayoutMethodId } from '@/domain/payout';
import { PRICING_POLICY, type QuoteResult } from '@/domain/quote';
import type { ReferencePrice } from '@/services/types';
import { useServices } from './services';

type QuoteData = QuoteResult & { price: ReferencePrice };

export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading'; previous: QuoteData | null }
  | { status: 'ready'; data: QuoteData }
  | { status: 'error'; message: string };

type Stored = { key: string; data: QuoteData | null; error: string | null };

export function useQuote(
  input: { asset: AssetCode; network: NetworkId; amount: string; payoutMethod: PayoutMethodId },
  { live = true } = {},
) {
  const { quotes } = useServices();
  const [stored, setStored] = useState<Stored | null>(null);
  const [nonce, setNonce] = useState(0);
  const { asset, network, amount, payoutMethod } = input;

  const parsed = parseAssetAmount(amount, asset);
  const amountAtomic = parsed.ok && parsed.value > 0n ? parsed.value : null;
  const key = amountAtomic === null ? null : `${asset}|${network}|${amountAtomic}|${payoutMethod}|${nonce}`;

  useEffect(() => {
    if (key === null || amountAtomic === null) return;
    let cancelled = false;
    quotes
      .getQuote({ asset, network, amountAtomic, payoutMethod })
      .then((data) => {
        if (!cancelled) setStored({ key, data, error: null });
      })
      .catch(() => {
        if (!cancelled) setStored({ key, data: null, error: 'Pricing is unavailable right now. Try again in a moment.' });
      });
    return () => {
      cancelled = true;
    };
  }, [quotes, key, asset, network, amountAtomic, payoutMethod]);

  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNonce((n) => n + 1), PRICING_POLICY.indicativeRefreshMs);
    return () => window.clearInterval(t);
  }, [live]);

  let state: QuoteState;
  if (key === null) state = { status: 'idle' };
  else if (stored?.key === key) state = stored.error ? { status: 'error', message: stored.error } : { status: 'ready', data: stored.data! };
  else state = { status: 'loading', previous: stored?.data ?? null };

  return { state, refresh: () => setNonce((n) => n + 1) };
}

export function quoteData(state: QuoteState): QuoteData | null {
  if (state.status === 'ready') return state.data;
  if (state.status === 'loading') return state.previous;
  return null;
}
