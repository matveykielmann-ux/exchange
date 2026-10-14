import { NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { PAYOUT_METHODS, describeFee } from '@/domain/payout';
import { exchangeRateMicros, valueAtRateCents, type Quote } from '@/domain/quote';
import { formatAsset, formatPriceMicros } from '@/lib/format';
import { InfoHint } from './InfoHint';
import { RollingAmount } from './RollingAmount';
import { t } from '@/i18n';

/**
 * The quote anatomy. Rows reconcile exactly: value at the customer's rate − fee = net.
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
            <dt>{t('You send')}</dt>
            <dd className={sk}>
              {formatAsset(quote.amountAtomic, quote.asset)}
              <br />
              <span className="small muted">
                {t('on')} {networkLabel(quote.asset, quote.network)}
              </span>
            </dd>
          </div>
        )}
        <div>
          <dt>
            <span className="quote-lines__term">
              {t('Exchange rate')}
              <InfoHint label={t('the exchange rate')}>
                {t('The rate you get for')} {quote.asset}{' '}
                {t('on this quote. Our commission is already included in it; the payout fee below is the only other deduction.')}
              </InfoHint>
            </span>
            <small>
              {t('Per')} {quote.asset}
            </small>
          </dt>
          <dd className={sk}>{formatPriceMicros(exchangeRateMicros(quote), quote.asset)}</dd>
        </div>
        <div>
          <dt>{t('Value at this rate')}</dt>
          <dd className={sk}>{formatUsd(valueAtRateCents(quote))}</dd>
        </div>
        <div className="is-deduction">
          <dt>
            <span className="quote-lines__term">
              {t('Payout fee')}
              <InfoHint label={t('the payout fee')}>
                {t(method.name)}: {t(describeFee(method.fee))}. {t(method.timingEstimate)}.
              </InfoHint>
            </span>
            <small>{t(method.name)}</small>
          </dt>
          <dd className={sk}>{formatUsd(-quote.payoutFeeCents)}</dd>
        </div>
      </dl>
      <div className="quote-total">
        <span className="quote-total__label">{t('You receive')}</span>
        <span className={`quote-total__value${sk}`} aria-live="off">
          <RollingAmount cents={quote.netCents} />
        </span>
      </div>
      {!compact && (
        <p className="small muted" style={{ marginTop: 12 }}>
          {t('Your wallet charges its own')} {NETWORKS[quote.network].name} {t('network fee to send. It is not included above.')}
        </p>
      )}
    </div>
  );
}

/**
 * Buy quote (cash → crypto): cash paid − courier fee, converted at the
 * customer's rate (commission included) into the crypto they receive.
 */
export function BuyQuoteBreakdown({ quote, loading = false }: { quote: Quote; loading?: boolean }) {
  const method = PAYOUT_METHODS[quote.payoutMethod];
  const sk = loading ? ' skeleton' : '';
  return (
    <div aria-busy={loading || undefined}>
      <dl className="quote-lines">
        <div>
          <dt>
            {t('You pay in cash')}
            <small>{t('Handed to the courier after an ID check')}</small>
          </dt>
          <dd className={sk}>{formatUsd(quote.grossCents)}</dd>
        </div>
        <div className="is-deduction">
          <dt>
            <span className="quote-lines__term">
              {t('Courier fee')}
              <InfoHint label={t('the courier fee')}>
                {t(method.name)}: {t(describeFee(method.fee))}.
              </InfoHint>
            </span>
            <small>{t('Cash collection')}</small>
          </dt>
          <dd className={sk}>{formatUsd(-quote.payoutFeeCents)}</dd>
        </div>
        <div>
          <dt>
            {t('Exchange rate')}
            <small>
              {t('Per')} {quote.asset}
              {t(', commission included')}
            </small>
          </dt>
          <dd className={sk}>{formatPriceMicros(buyRateMicros(quote), quote.asset)}</dd>
        </div>
      </dl>
      <div className="quote-total">
        <span className="quote-total__label">{t('You receive')}</span>
        <span className={`quote-total__value tabular${sk}`}>{formatAsset(quote.amountAtomic, quote.asset)}</span>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        {t('Sent on')} {networkLabel(quote.asset, quote.network)}{' '}
        {t('to the wallet address you give, after the cash is counted and verified.')}
      </p>
    </div>
  );
}

/** Buy: dollars paid after the courier fee, per whole unit of crypto received (commission included). */
function buyRateMicros(quote: Quote) {
  return exchangeRateMicros({ ...quote, grossCents: quote.grossCents - quote.payoutFeeCents, spreadCents: 0n });
}
