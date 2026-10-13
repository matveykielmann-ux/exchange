import { NETWORKS, networkLabel } from '@/domain/assets';
import { formatBps, formatUsd } from '@/domain/money';
import { PAYOUT_METHODS } from '@/domain/payout';
import type { Quote } from '@/domain/quote';
import { formatAsset, formatPriceMicros } from '@/lib/format';

function SplitDollars({ cents }: { cents: bigint }) {
  const text = formatUsd(cents);
  const [whole, frac] = text.split('.');
  return (
    <>
      {whole}
      <span className="cents">.{frac}</span>
    </>
  );
}

/**
 * The quote anatomy. Rows reconcile exactly: gross − spread − fee = net.
 * `loading` greys the figures while a refresh is in flight.
 */
export function QuoteBreakdown({ quote, loading = false, compact = false }: { quote: Quote; loading?: boolean; compact?: boolean }) {
  const method = PAYOUT_METHODS[quote.payoutMethod];
  const sk = loading ? ' skeleton' : '';
  return (
    <div aria-busy={loading || undefined}>
      <dl className="quote-lines">
        {!compact && (
          <div>
            <dt>You send</dt>
            <dd className={sk}>
              {formatAsset(quote.amountAtomic, quote.asset)}
              <br />
              <span className="small muted">on {networkLabel(quote.asset, quote.network)}</span>
            </dd>
          </div>
        )}
        <div>
          <dt>
            Reference price
            <small>Mock mid-market, per {quote.asset}</small>
          </dt>
          <dd className={sk}>
            {formatPriceMicros(quote.referencePriceMicros, { precise: quote.asset === 'USDT' || quote.asset === 'USDC' })}
          </dd>
        </div>
        <div>
          <dt>Value at reference price</dt>
          <dd className={sk}>{formatUsd(quote.grossCents)}</dd>
        </div>
        <div className="is-deduction">
          <dt>
            Exchange spread
            <small>{formatBps(quote.spreadBps)} of value</small>
          </dt>
          <dd className={sk}>{formatUsd(-quote.spreadCents)}</dd>
        </div>
        <div className="is-deduction">
          <dt>
            Payout fee
            <small>{method.name}</small>
          </dt>
          <dd className={sk}>{quote.payoutFeeCents === 0n ? '$0.00' : formatUsd(-quote.payoutFeeCents)}</dd>
        </div>
      </dl>
      <div className="quote-total">
        <span className="quote-total__label">You receive</span>
        <span className={`quote-total__value${sk}`} aria-live="off">
          <SplitDollars cents={quote.netCents} />
        </span>
      </div>
      {!compact && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Your wallet charges its own {NETWORKS[quote.network].name} network fee to send. It is not included above.
        </p>
      )}
    </div>
  );
}
