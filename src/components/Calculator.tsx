import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { describeFee, PAYOUT_METHODS, PAYOUT_ORDER, type PayoutMethodId } from '@/domain/payout';
import { PRICING_POLICY } from '@/domain/quote';
import { formatTime } from '@/lib/format';
import { useDraft } from '@/state/draft';
import { quoteData, useQuote } from '@/state/useQuote';
import { ChoiceSelect } from './ChoiceSelect';
import { QuoteSkeleton } from './QuoteSkeleton';
import { AmountField, AssetNetworkFields, QuoteIssues } from './ExchangeInputs';
import { Field } from './Field';
import { Icon } from './Icon';
import { QuoteBreakdown } from './QuoteBreakdown';
import { Notice } from './ui';
import { t } from '@/i18n';

/** Homepage calculator. Writes straight into the exchange draft so "Continue" resumes at step 2. */
export function Calculator() {
  const { draft, update, setAsset } = useDraft();
  const navigate = useNavigate();
  const [touched, setTouched] = useState(false);
  const { state } = useQuote(draft);
  const data = quoteData(state);
  const canContinue = state.status === 'ready' && state.data.issues.length === 0;

  return (
    <section className="panel panel--raised calculator" aria-labelledby="calc-title">
      <div className="panel__head">
        <h2 id="calc-title">{t('Sell crypto for USD')}</h2>
      </div>
      <div className="panel__body stack">
        <AssetNetworkFields
          idPrefix="calc"
          asset={draft.asset}
          network={draft.network}
          onAsset={setAsset}
          onNetwork={(network) => update({ network })}
        />
        <AmountField
          id="calc-amount"
          asset={draft.asset}
          value={draft.amount}
          onChange={(amount) => update({ amount })}
          touched={touched || draft.amount !== ''}
          onBlur={() => setTouched(true)}
        />
        <Field
          label={t('Receive by')}
          id="calc-payout"
          hint={`${t(PAYOUT_METHODS[draft.payoutMethod].timingEstimate)}. ${t(describeFee(PAYOUT_METHODS[draft.payoutMethod].fee))}.`}
        >
          {(p) => (
            <ChoiceSelect
              field={p}
              value={draft.payoutMethod}
              onChange={(payoutMethod: PayoutMethodId) => update({ payoutMethod })}
              choices={PAYOUT_ORDER.map((id) => {
                const m = PAYOUT_METHODS[id];
                return {
                  value: id,
                  label: m.availability.available ? t(m.name) : t('{0} — not offered', [t(m.name)]),
                  detail: m.availability.available ? t(m.timingEstimate) : t(m.availability.reason),
                  disabled: !m.availability.available,
                };
              })}
            />
          )}
        </Field>

        <div aria-live="polite" aria-atomic="false">
          {state.status === 'error' ? <Notice tone="danger" title={state.message} /> : null}
          {data ? (
            <div className="stack">
              <QuoteBreakdown quote={data.quote} loading={state.status === 'loading'} compact />
              <QuoteIssues issues={data.issues} asset={draft.asset} />
            </div>
          ) : state.status === 'idle' ? (
            <p className="small muted">{t('Enter an amount to see a full breakdown.')}</p>
          ) : state.status === 'loading' ? (
            <QuoteSkeleton rows={3} />
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn--lg btn--block"
          disabled={!canContinue}
          onClick={() => {
            update({ step: 2 });
            navigate('/exchange');
          }}
        >
          {t('Continue')} <Icon name="arrowRight" width={18} height={18} />
        </button>
        <p className="quote-meta" style={{ marginTop: 0 }}>
          <span>{t('Indicative. Refreshes every {0}s.', [PRICING_POLICY.indicativeRefreshMs / 1000])}</span>
          {data ? (
            <span className="tabular">
              {t('Price as of')} {formatTime(data.price.asOf)}
            </span>
          ) : null}
        </p>
      </div>
    </section>
  );
}
