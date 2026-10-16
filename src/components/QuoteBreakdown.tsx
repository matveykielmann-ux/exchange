import { NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { PAYOUT_METHODS, describeFee, exchangeFeeBps, feeLineLabel, feeScheduleFor, wireFeeParts } from '@/domain/payout';
import { buyReceiveAmountAtomic, exchangeRateMicros, valueAtRateCents, type Quote } from '@/domain/quote';
import { formatAsset, formatPriceMicros } from '@/lib/format';
import { InfoHint } from './InfoHint';
import { RollingAmount } from './RollingAmount';
import { t } from '@/i18n';

/**
 * The quote anatomy. Rows reconcile exactly: value at the market rate − fee = net (there is no spread).
 * `loading` greys the figures while a refresh is in flight.
 * When the courier fee is pending, fee and net show as individually calculated — never a fabricated amount.
 */
export function QuoteBreakdown({ quote, loading = false, compact = false }: { quote: Quote; loading?: boolean; compact?: boolean }) {
  const direction = quote.direction === 'buy' ? 'buy' : 'sell';
  const method = PAYOUT_METHODS[quote.payoutMethod];
  const schedule = feeScheduleFor(quote.payoutMethod, direction);
  const sk = loading ? ' skeleton' : '';
  const feePending = !!quote.feePending;
  const wire = quote.payoutMethod === 'wire';
  const wireParts = wire ? wireFeeParts(quote.grossCents, direction) : null;
  const exchangePct = `${exchangeFeeBps(direction) / 100}%`;
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
                {t('The market rate for')} {quote.asset}{' '}
                {t('at the moment of this quote. There is no spread: the fee below is the only deduction.')}
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
        {wireParts ? (
          <>
            <div className="is-deduction">
              <dt>
                <span className="quote-lines__term">
                  {t('Bank processing fee')}
                  <InfoHint label={t('the bank processing fee')}>
                    {t(
                      'Estimated bank wire fee charged by the bank (typically $30). CryptoBit Exchange does not keep this amount as its commission.',
                    )}
                  </InfoHint>
                </span>
              </dt>
              <dd className={sk}>{formatUsd(-wireParts.bankFeeCents)}</dd>
            </div>
            <div className="is-deduction">
              <dt>
                <span className="quote-lines__term">
                  {t('Exchange fee')}
                  <InfoHint label={t('the exchange fee')}>
                    {t('{0} CryptoBit exchange fee on the wire direction.', [exchangePct])}
                  </InfoHint>
                </span>
              </dt>
              <dd className={sk}>{formatUsd(-wireParts.exchangeFeeCents)}</dd>
            </div>
          </>
        ) : (
          <div className="is-deduction">
            <dt>
              <span className="quote-lines__term">
                {t(feeLineLabel(quote.payoutMethod))}
                <InfoHint label={t('the fee')}>
                  {t(method.name)}: {t(describeFee(schedule, method.feeStatus))}. {t(method.timingEstimate)}.
                </InfoHint>
              </span>
              <small>{t(method.name)}</small>
            </dt>
            <dd className={sk}>
              {feePending
                ? t('Calculated individually based on the order parameters')
                : formatUsd(-quote.payoutFeeCents)}
            </dd>
          </div>
        )}
      </dl>
      <div className="quote-total">
        <span className="quote-total__label">{t('You receive')}</span>
        <span className={`quote-total__value${sk}`} aria-live="off">
          {feePending ? t('After courier fee') : <RollingAmount cents={quote.netCents} />}
        </span>
      </div>
      {feePending ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          {t('Courier delivery cost depends on the order and is confirmed before you accept the final quote.')}
        </p>
      ) : null}
      {!compact && (
        <p className="small muted" style={{ marginTop: 12 }}>
          {t('Your wallet charges its own')} {NETWORKS[quote.network].name} {t('network fee to send. It is not included above.')}
        </p>
      )}
    </div>
  );
}

/**
 * Buy quote (USD → crypto): cash/wire paid − fees, converted at the
 * market rate (no spread) into the crypto they receive.
 */
export function BuyQuoteBreakdown({ quote, loading = false }: { quote: Quote; loading?: boolean }) {
  const method = PAYOUT_METHODS[quote.payoutMethod];
  const schedule = feeScheduleFor(quote.payoutMethod, 'buy');
  const sk = loading ? ' skeleton' : '';
  const feePending = !!quote.feePending;
  const wire = quote.payoutMethod === 'wire';
  const card = quote.payoutMethod === 'instant_debit';
  const wireParts = wire ? wireFeeParts(quote.grossCents, 'buy') : null;
  const payLabel = wire ? t('You send by bank wire') : card ? t('You pay by card') : t('You pay in cash');
  const payHint = wire
    ? t('To the bank details shown on your order')
    : card
      ? t('On the secure payment page or instructions shown on your order')
      : t('Handed to the courier after an ID check');
  return (
    <div aria-busy={loading || undefined}>
      <dl className="quote-lines">
        <div>
          <dt>
            {payLabel}
            <small>{payHint}</small>
          </dt>
          <dd className={sk}>{formatUsd(quote.grossCents)}</dd>
        </div>
        {wireParts ? (
          <>
            <div className="is-deduction">
              <dt>{t('Bank processing fee')}</dt>
              <dd className={sk}>{formatUsd(-wireParts.bankFeeCents)}</dd>
            </div>
            <div className="is-deduction">
              <dt>{t('Exchange fee')}</dt>
              <dd className={sk}>{formatUsd(-wireParts.exchangeFeeCents)}</dd>
            </div>
          </>
        ) : (
          <div className="is-deduction">
            <dt>
              <span className="quote-lines__term">
                {t(feeLineLabel(quote.payoutMethod))}
                <InfoHint label={t('the fee')}>
                  {t(method.name)}: {t(describeFee(schedule, method.feeStatus))}.
                </InfoHint>
              </span>
              <small>{card ? t('Card payment') : t('Cash collection')}</small>
            </dt>
            <dd className={sk}>
              {feePending
                ? t('Calculated individually based on the order parameters')
                : formatUsd(-quote.payoutFeeCents)}
            </dd>
          </div>
        )}
        <div>
          <dt>
            {t('Exchange rate')}
            <small>
              {t('Per')} {quote.asset}
              {t(', market rate')}
            </small>
          </dt>
          <dd className={sk}>{formatPriceMicros(buyRateMicros(quote), quote.asset)}</dd>
        </div>
      </dl>
      <div className="quote-total">
        <span className="quote-total__label">{t('You receive')}</span>
        <span className={`quote-total__value tabular${sk}`}>
          {formatAsset(buyReceiveAmountAtomic(quote), quote.asset)}
          {feePending ? <span className="small muted"> {t('(before courier fee)')}</span> : null}
        </span>
      </div>
      {feePending ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          {t('Courier collection cost depends on the order and is confirmed before you accept the final quote.')}
        </p>
      ) : (
        <p className="small muted" style={{ marginTop: 12 }}>
          {wire
            ? t('Sent on') +
              ' ' +
              networkLabel(quote.asset, quote.network) +
              ' ' +
              t('to the wallet address you give, after the wire is matched and verified.')
            : t('Sent on') +
              ' ' +
              networkLabel(quote.asset, quote.network) +
              ' ' +
              t('to the wallet address you give, after the cash is counted and verified.')}
        </p>
      )}
    </div>
  );
}

/** Buy: dollars paid after fees, per whole unit of crypto received. */
function buyRateMicros(quote: Quote) {
  const amountAtomic = buyReceiveAmountAtomic(quote);
  const grossCents = quote.feePending ? quote.grossCents : quote.grossCents - quote.payoutFeeCents;
  const fromAmount = exchangeRateMicros({ ...quote, amountAtomic, grossCents, spreadCents: 0n });
  return fromAmount > 0n ? fromAmount : quote.referencePriceMicros;
}
