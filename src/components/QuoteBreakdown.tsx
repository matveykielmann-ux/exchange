import { NETWORKS, networkLabel } from '@/domain/assets';
import { formatBps, formatUsd } from '@/domain/money';
import { PAYOUT_METHODS, describeFee } from '@/domain/payout';
import type { Quote } from '@/domain/quote';
import { formatAsset, formatPriceMicros } from '@/lib/format';
import { InfoHint } from './InfoHint';

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
            <span className="quote-lines__term">
              Reference price
              <InfoHint label="reference price">
                A simulated mid-market price for {quote.asset}, generated for this preview. Your payout is calculated from it, then the
                spread and payout fee below are taken off.
              </InfoHint>
            </span>
            <small>Mock mid-market, per {quote.asset}</small>
          </dt>
          <dd className={sk}>{formatPriceMicros(quote.referencePriceMicros, quote.asset)}</dd>
        </div>
        <div>
          <dt>Value at reference price</dt>
          <dd className={sk}>{formatUsd(quote.grossCents)}</dd>
        </div>
        <div className="is-deduction">
          <dt>
            <span className="quote-lines__term">
              Exchange spread
              <InfoHint label="the exchange spread">
                The difference between the reference price and the rate you get, shown as a dollar amount so you can see exactly what it
                costs. There is no separate trading fee.
              </InfoHint>
            </span>
            <small>{formatBps(quote.spreadBps)} of value</small>
          </dt>
          <dd className={sk}>{formatUsd(-quote.spreadCents)}</dd>
        </div>
        <div className="is-deduction">
          <dt>
            <span className="quote-lines__term">
              Payout fee
              <InfoHint label="the payout fee">
                {method.name}: {describeFee(method.fee)}. {method.timingEstimate}.
              </InfoHint>
            </span>
            <small>{method.name}</small>
          </dt>
          <dd className={sk}>{formatUsd(-quote.payoutFeeCents)}</dd>
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
