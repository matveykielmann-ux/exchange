import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AmountField, AssetNetworkFields, QuoteIssues } from '@/components/ExchangeInputs';
import { HoldButton } from '@/components/HoldButton';
import { QuoteSkeleton } from '@/components/QuoteSkeleton';
import { RateRing } from '@/components/RateRing';
import { Icon } from '@/components/Icon';
import { QuoteBreakdown } from '@/components/QuoteBreakdown';
import { Notice } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { ASSETS, networkLabel, parseAssetAmount } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { describeFee, feeLabel, PAYOUT_METHODS, payoutOptions } from '@/domain/payout';
import { amountIssues } from '@/domain/quote';
import { AddBankForm } from '@/components/AddBankForm';
import { AddCourierForm } from '@/components/AddCourierForm';
import { errorMessage, isNotConfigured } from '@/lib/errors';
import { describeDestination, destinationLabel, formatAsset } from '@/lib/format';
import { useUser } from '@/state/auth';
import { useDraft, type ExchangeDraft } from '@/state/draft';
import { useServices } from '@/state/services';
import { quoteData, useQuote, type QuoteState } from '@/state/useQuote';
import { useDestinations } from '@/state/useDestinations';
import { Checkbox } from '@/components/Checkbox';
import { KycNotice } from '@/components/KycNotice';
import { SupportContact } from '@/components/SupportContact';
import { BuyFlow } from './BuyFlow';
import { Countdown } from '@/components/Countdown';
import { useExpired } from '@/lib/useExpired';
import { clientId } from '@/services/http';
import type { QuoteData } from '@/services/types';
import { useConfig } from '@/state/config';
import { t } from '@/i18n';

const STEPS = ['Amount', 'Payout', 'Details', 'Review'] as const;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label={t('Exchange progress')}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'current' : 'upcoming';
        return (
          <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="stepper__label">
              <span className="stepper__num" aria-hidden="true">
                {state === 'done' ? <Icon name="check" /> : n}
              </span>
              <span className="stepper__text">{t(label)}</span>
              {state === 'done' ? <span className="visually-hidden">{t('(completed)')}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Step 1 ---------------- */
function AmountStep({ state, onNext }: { state: QuoteState; onNext: () => void }) {
  const { draft, update, setAsset } = useDraft();
  const [touched, setTouched] = useState(false);
  const data = quoteData(state);
  const issues = data ? amountIssues(data.issues) : [];
  const ready = state.status === 'ready' && issues.length === 0;

  return (
    <form
      className="flow__main"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (ready) onNext();
      }}
      noValidate
    >
      <h2 className="flow__step-title">{t('What are you selling?')}</h2>
      <AssetNetworkFields
        idPrefix="ex"
        asset={draft.asset}
        network={draft.network}
        onAsset={setAsset}
        onNetwork={(network) => update({ network })}
      />
      <AmountField
        id="ex-amount"
        asset={draft.asset}
        value={draft.amount}
        onChange={(amount) => update({ amount })}
        touched={touched || draft.amount !== ''}
        onBlur={() => setTouched(true)}
      />
      {ASSETS[draft.asset].networks.length > 1 ? (
        <Notice tone="warn" title={t('Send only on {0}', [networkLabel(draft.asset, draft.network)])}>
          <p>
            {draft.asset} {t('sent on any other network may be lost. Check the network your wallet or exchange uses before you continue.')}
          </p>
        </Notice>
      ) : null}
      <div aria-live="polite">{data ? <QuoteIssues issues={issues} asset={draft.asset} /> : null}</div>
      <div className="flow__actions">
        <span />
        <button className="btn btn--lg" type="submit" disabled={!ready}>
          {t('Continue to payout')} <Icon name="arrowRight" width={18} height={18} />
        </button>
      </div>
    </form>
  );
}

/* ---------------- Step 2 ---------------- */
function PayoutStep({ grossCents, onBack, onNext }: { grossCents: bigint | null; onBack: () => void; onNext: () => void }) {
  const { draft, update } = useDraft();
  const options = payoutOptions(grossCents);
  const selectedOk = options.some((o) => o.method.id === draft.payoutMethod && o.eligibility.eligible);

  return (
    <form
      className="flow__main"
      onSubmit={(e) => {
        e.preventDefault();
        if (selectedOk) onNext();
      }}
    >
      <fieldset className="option-list">
        <legend>
          <h2 className="flow__step-title">{t('How do you want to receive dollars?')}</h2>
        </legend>
        {options.map(({ method: m, eligibility, feeCents }) => {
          const disabled = !eligibility.eligible;
          const inputId = `payout-${m.id}`;
          return (
            <label key={m.id} className="option" htmlFor={inputId} data-disabled={disabled || undefined}>
              <input
                id={inputId}
                type="radio"
                name="payout"
                value={m.id}
                checked={draft.payoutMethod === m.id}
                disabled={disabled}
                aria-describedby={`${inputId}-desc`}
                onChange={() => update({ payoutMethod: m.id, destinationId: null })}
              />
              <span>
                <span className="option__title">{t(m.name)}</span>
                <span className="option__meta" id={`${inputId}-desc`} style={{ display: 'block' }}>
                  {eligibility.eligible ? `${t(m.timingEstimate)}. ${t(m.summary)}` : t(eligibility.reason)}
                </span>
              </span>
              <span className="option__aside">
                {disabled ? (
                  <span className="badge badge--neutral">{m.availability.available ? t('Not eligible') : t('Not offered')}</span>
                ) : (
                  <>
                    <strong>{feeLabel(feeCents)}</strong>
                    {m.fee.kind === 'percent' ? t(describeFee(m.fee, m.feeStatus)) : null}
                  </>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="small muted">
        {t('Timing is estimated from when your deposit is final and any review is complete. It is not guaranteed. For')}{' '}
        <Link to="/cash-delivery">{t('cash by courier')}</Link> {t('you give a delivery address in the next step.')}
      </p>
      <div className="flow__actions">
        <button type="button" className="btn btn--secondary btn--lg" onClick={onBack}>
          <Icon name="arrowLeft" width={18} height={18} /> {t('Back')}
        </button>
        <button className="btn btn--lg" type="submit" disabled={!selectedOk}>
          {t('Continue to details')} <Icon name="arrowRight" width={18} height={18} />
        </button>
      </div>
    </form>
  );
}

/* ---------------- Step 3 ---------------- */
function DetailsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { draft, update } = useDraft();
  const user = useUser();
  const { account } = useServices();
  const { list: destinations, reload: load } = useDestinations();
  const [cardError, setCardError] = useState<{ message: string; notConfigured: boolean } | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const method = PAYOUT_METHODS[draft.payoutMethod];

  if (!user) {
    return (
      <div className="flow__main">
        <h2 className="flow__step-title">{t('Sign in to continue')}</h2>
        <p>{t('You need an account to save a payout destination and confirm an exchange. Your amount and choices are kept.')}</p>
        <div className="row">
          <Link className="btn btn--lg" to="/signin" state={{ from: '/exchange' }}>
            {t('Sign in')}
          </Link>
          <Link className="btn btn--lg btn--secondary" to="/signup" state={{ from: '/exchange' }}>
            {t('Create an account')}
          </Link>
        </div>
        <div className="flow__actions">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onBack}>
            <Icon name="arrowLeft" width={18} height={18} /> {t('Back')}
          </button>
        </div>
      </div>
    );
  }

  const usable = destinations?.filter((d) => d.methods.includes(draft.payoutMethod)) ?? [];
  const destinationError =
    touched && !usable.some((d) => d.id === draft.destinationId)
      ? draft.payoutMethod === 'courier_cash'
        ? 'Save or choose a delivery address.'
        : 'Choose where to send your dollars.'
      : null;
  const valid = usable.some((d) => d.id === draft.destinationId);

  return (
    <form
      className="flow__main"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (valid) onNext();
        else document.getElementById(destinationError || !draft.destinationId ? 'dest-0' : 'refund-address')?.focus();
      }}
    >
      <h2 className="flow__step-title">
        {draft.payoutMethod === 'courier_cash' ? t('Where should the courier bring it?') : t('Where should we send it?')}
      </h2>

      <fieldset className="option-list">
        <legend className="field__label">
          {draft.payoutMethod === 'courier_cash' ? t('Delivery address') : `${t(method.name)} destination`}
        </legend>
        {destinations === null ? (
          <p className="muted">{t('Loading saved destinations…')}</p>
        ) : usable.length === 0 ? (
          <p className="muted">
            {draft.payoutMethod === 'courier_cash'
              ? t('No saved delivery addresses yet. Add one below.')
              : t('No saved destinations can receive {0} payouts yet.', [t(method.name)])}
          </p>
        ) : (
          usable.map((d, i) => (
            <label className="option" key={d.id} htmlFor={`dest-${i}`}>
              <input
                id={`dest-${i}`}
                type="radio"
                name="destination"
                checked={draft.destinationId === d.id}
                onChange={() => update({ destinationId: d.id })}
              />
              <span>
                <span className="option__title">{d.label}</span>
                <span className="option__meta tabular" style={{ display: 'block' }}>
                  {describeDestination(d)}
                </span>
              </span>
            </label>
          ))
        )}
        {destinationError ? (
          <p className="field__error">
            <Icon name="alert" /> {destinationError}
          </p>
        ) : null}
      </fieldset>

      {draft.payoutMethod === 'instant_debit' ? (
        usable.length === 0 ? (
          <div className="stack">
            <Notice tone="neutral" title={t('Cards are added through our card provider')}>
              <p>
                {t(
                  'Card numbers are entered only in the card provider’s secure form, never on this site. The security code (CVV) is never stored.',
                )}
              </p>
            </Notice>
            {cardError ? <Notice tone={cardError.notConfigured ? 'warn' : 'danger'} title={cardError.message} role="alert" /> : null}
            <div>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={addingCard}
                onClick={async () => {
                  setAddingCard(true);
                  setCardError(null);
                  try {
                    const d = await account.addCard('Debit card');
                    update({ destinationId: d.id });
                    load();
                  } catch (e) {
                    setCardError(
                      isNotConfigured(e)
                        ? { message: t('Card payouts are not available yet: the card provider is not connected.'), notConfigured: true }
                        : { message: errorMessage(e), notConfigured: false },
                    );
                  } finally {
                    setAddingCard(false);
                  }
                }}
              >
                {addingCard ? t('Adding…') : t('Add a debit card')}
              </button>
            </div>
          </div>
        ) : null
      ) : draft.payoutMethod === 'courier_cash' ? (
        adding || (destinations !== null && usable.length === 0) ? (
          <AddCourierForm
            onAdded={(d) => {
              setAdding(false);
              update({ destinationId: d.id });
              load();
            }}
            onCancel={usable.length ? () => setAdding(false) : undefined}
          />
        ) : (
          <div>
            <button type="button" className="btn btn--secondary" onClick={() => setAdding(true)}>
              {t('Add a delivery address')}
            </button>
          </div>
        )
      ) : adding ? (
        <AddBankForm
          onAdded={(d) => {
            setAdding(false);
            update({ destinationId: d.id });
            load();
          }}
        />
      ) : (
        <div>
          <button type="button" className="btn btn--secondary" onClick={() => setAdding(true)}>
            {t('Add a bank account')}
          </button>
        </div>
      )}

      <div className="flow__actions">
        <button type="button" className="btn btn--secondary btn--lg" onClick={onBack}>
          <Icon name="arrowLeft" width={18} height={18} /> {t('Back')}
        </button>
        <button className="btn btn--lg" type="submit">
          {t('Review quote')} <Icon name="arrowRight" width={18} height={18} />
        </button>
      </div>
    </form>
  );
}

/* ---------------- Step 4 ---------------- */

/**
 * Firm quote for the review step: issued and stored by the server, usable
 * once, until it expires. A new one is fetched on demand after expiry.
 */
function useFirmQuote(draft: ExchangeDraft) {
  const { quotes } = useServices();
  const [nonce, setNonce] = useState(0);
  const [stored, setStored] = useState<{ key: string; data: QuoteData | null; error: string | null } | null>(null);
  const parsed = parseAssetAmount(draft.amount, draft.asset);
  const amountAtomic = parsed.ok ? parsed.value : null;
  const key = `${draft.asset}|${draft.network}|${amountAtomic}|${draft.payoutMethod}|${nonce}`;
  useEffect(() => {
    if (amountAtomic === null) return;
    let cancelled = false;
    quotes
      .firm({ asset: draft.asset, network: draft.network, amountAtomic, payoutMethod: draft.payoutMethod })
      .then((data) => !cancelled && setStored({ key, data, error: null }))
      .catch((e: unknown) => !cancelled && setStored({ key, data: null, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [quotes, key, amountAtomic, draft.asset, draft.network, draft.payoutMethod]);
  const current = stored?.key === key ? stored : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: !current,
    refresh: useCallback(() => setNonce((n) => n + 1), []),
  };
}

function ReviewStep({ onBack, draft }: { onBack: () => void; draft: ExchangeDraft }) {
  const services = useServices();
  const config = useConfig();
  const user = useUser();
  const navigate = useNavigate();
  const { reset } = useDraft();
  const firm = useFirmQuote(draft);
  const locked = firm.data;
  const expired = useExpired(locked?.quote.expiresAt ?? null);
  const destination = useDestinations().list?.find((d) => d.id === draft.destinationId) ?? null;
  const orderDocs = config.legal.filter((d) => d.acceptance === 'order');
  const [ackNetwork, setAckNetwork] = useState(false);
  const [ackDocs, setAckDocs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One idempotency key per firm quote: a retried confirm can't create a second order.
  const keyRef = useRef<{ quoteId: string; key: string } | null>(null);

  if (!user) return null;
  const kyc = user.verification.status;
  const verified = kyc === 'verified';
  const canConfirm =
    !!locked &&
    !expired &&
    !firm.loading &&
    locked.issues.length === 0 &&
    verified &&
    ackNetwork &&
    ackDocs &&
    !!destination &&
    !submitting;

  async function confirm() {
    if (!locked || !destination) return;
    if (keyRef.current?.quoteId !== locked.quote.id) keyRef.current = { quoteId: locked.quote.id, key: clientId('order') };
    setSubmitting(true);
    setError(null);
    try {
      const order = await services.orders.create(
        {
          quoteId: locked.quote.id,
          destinationId: destination.id,
          accepted: orderDocs.map((d) => ({ slug: d.slug, version: d.version })),
        },
        keyRef.current.key,
      );
      reset();
      navigate(`/orders/${order.id}`, { state: { justCreated: true } });
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="flow__grid">
      <div className="flow__main">
        <h2 className="flow__step-title">{t('Review and confirm')}</h2>

        <KycNotice />

        <section className="panel" aria-labelledby="locked-title">
          <div className="panel__head">
            <h3 id="locked-title">{t('Your quote')}</h3>
            {locked && !expired ? (
              <span className="small rate-hold">
                <RateRing from={locked.quote.createdAt} to={locked.quote.expiresAt} />
                <span>
                  {t('Rate held ·')} <Countdown to={locked.quote.expiresAt} prefix={t('Expires in')} ended={t('Expired')} />
                </span>
              </span>
            ) : null}
          </div>
          <div className="panel__body stack">
            {locked ? (
              <>
                <QuoteBreakdown quote={locked.quote} loading={firm.loading} />
                <QuoteIssues issues={locked.issues} asset={locked.quote.asset} />
              </>
            ) : firm.error ? (
              <Notice tone="warn" title={t('We couldn’t lock a quote')} role="alert">
                <p>{firm.error}</p>
                <div>
                  <button type="button" className="btn btn--secondary" onClick={firm.refresh}>
                    <Icon name="refresh" width={16} height={16} /> {t('Try again')}
                  </button>
                </div>
              </Notice>
            ) : (
              <QuoteSkeleton rows={5} />
            )}
            <div aria-live="assertive">
              {expired ? (
                <Notice tone="warn" title={t('This quote has expired')}>
                  <p>{t('Prices move. Get a new quote to continue. Nothing has been submitted.')}</p>
                  <div>
                    <button type="button" className="btn btn--secondary" onClick={firm.refresh}>
                      <Icon name="refresh" width={16} height={16} /> {t('Get a new quote')}
                    </button>
                  </div>
                </Notice>
              ) : null}
            </div>
          </div>
        </section>

        <p className="small muted">
          {t(
            'The exchange rate, fee, minimum, quote validity and deposit window shown here are the conditions of this exchange. Under clause 4.24 of the',
          )}{' '}
          <Link to="/legal/terms#clause-4-24">{t('Service Rules')}</Link>
          {t(
            ', continuing with this Exchange Request signifies your agreement with them. Submitting it is acceptance of the public offer (Section 3).',
          )}
        </p>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="visually-hidden">{t('Acknowledgements')}</legend>
          <Checkbox id="ack-network" checked={ackNetwork} onChange={setAckNetwork}>
            {t('I will send exactly')} {locked ? formatAsset(locked.quote.amountAtomic, locked.quote.asset) : draft.asset} {t('on')}{' '}
            <strong>{networkLabel(draft.asset, draft.network)}</strong>
            {t(
              ', from a wallet I control, within the deposit window. Blockchain transactions can’t be reversed, and nobody from this service will ever ask me to send crypto on their behalf.',
            )}
          </Checkbox>
          <Checkbox id="ack-docs" checked={ackDocs} onChange={setAckDocs}>
            {t('I have read and accept the')}{' '}
            {orderDocs.map((d, i) => (
              <span key={d.slug}>
                {i > 0 ? (i === orderDocs.length - 1 ? ' and ' : ', ') : null}
                <Link to={`/legal/${d.slug}`} target="_blank">
                  {d.title}
                </Link>
              </span>
            ))}{' '}
            {t('for this order.')}
          </Checkbox>
        </fieldset>

        {error ? <Notice tone="danger" title={error} role="alert" /> : null}

        <div className="flow__actions">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onBack}>
            <Icon name="arrowLeft" width={18} height={18} /> {t('Back')}
          </button>
          <HoldButton disabled={!canConfirm} onConfirm={confirm}>
            {submitting ? t('Confirming…') : t('Confirm exchange')}
          </HoldButton>
        </div>
        {!canConfirm && locked && !expired ? (
          <p className="small muted" style={{ textAlign: 'right' }}>
            {!verified ? t('Verify your identity, then ') : ''}
            {!ackNetwork || !ackDocs ? t('tick both boxes to confirm.') : ''}
          </p>
        ) : null}
      </div>
      <aside className="flow__aside flow__aside--after" aria-label={t('Exchange details')}>
        <div className="panel">
          <div className="panel__head">
            <h3 className="title">{t('Exchange details')}</h3>
          </div>
          <div className="panel__body">
            <dl className="dl">
              <div>
                <dt>{t('Payout to')}</dt>
                <dd>{destination ? destinationLabel(destination.label, destination.last4) : '—'}</dd>
              </div>
              <div>
                <dt>{t('Payout method')}</dt>
                <dd>
                  {t(PAYOUT_METHODS[draft.payoutMethod].name)}
                  <span className="small muted" style={{ display: 'block' }}>
                    {t(PAYOUT_METHODS[draft.payoutMethod].timingEstimate)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{t('Deposit window')}</dt>
                <dd>
                  {config.policy.depositWindowMs / 60000} {t('minutes after you confirm')}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <SupportContact />
      </aside>
    </div>
  );
}

/* ---------------- Page ---------------- */

/** Sell (crypto → USD) or buy (cash → crypto). The choice lives in the URL so a refresh or a shared link keeps it. */
function DirectionSwitch({ value, onChange }: { value: 'sell' | 'buy'; onChange: (v: 'sell' | 'buy') => void }) {
  return (
    <div className="segmented direction-switch" role="group" aria-label={t('Exchange direction')}>
      <button type="button" aria-pressed={value === 'sell'} onClick={() => onChange('sell')}>
        {t('Sell crypto for USD')}
      </button>
      <button type="button" aria-pressed={value === 'buy'} onClick={() => onChange('buy')}>
        {t('Buy crypto with cash')}
      </button>
    </div>
  );
}

export function ExchangePage() {
  const [params, setParams] = useSearchParams();
  const direction = params.get('direction') === 'buy' ? 'buy' : 'sell';
  useDocumentTitle(direction === 'buy' ? 'Buy crypto with cash' : 'Sell crypto');
  const header = (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">{direction === 'buy' ? t('Buy crypto with US dollar cash') : t('Sell crypto for USD')}</p>
        <h1 className="display-l">{t('Exchange')}</h1>
      </div>
      <DirectionSwitch value={direction} onChange={(d) => setParams(d === 'buy' ? { direction: 'buy' } : {}, { replace: true })} />
    </div>
  );
  return (
    <div className="container flow" key={direction}>
      {direction === 'buy' ? <BuyFlow header={header} /> : <SellFlow header={header} />}
    </div>
  );
}

function SellFlow({ header }: { header: ReactNode }) {
  const { draft, update } = useDraft();
  const user = useUser();
  const parsed = parseAssetAmount(draft.amount, draft.asset);
  const amountOk = parsed.ok && parsed.value > 0n;
  // Upper bound on the step from what is known without a quote; step 4 fetches its own locked quote.
  const reachable = !amountOk ? 1 : !user ? 3 : 4;
  const { state } = useQuote(draft, { enabled: Math.min(draft.step, reachable) < 4 });
  const data = quoteData(state);
  const blocking = data ? amountIssues(data.issues) : [];
  const headingRef = useRef<HTMLDivElement>(null);

  // Never allow a step whose prerequisites aren't met (e.g. after a refresh).
  const maxStep = blocking.length ? 1 : reachable;
  const step = Math.min(draft.step, maxStep) as ExchangeDraft['step'];

  const go = (s: ExchangeDraft['step']) => {
    update({ step: s });
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      const h = headingRef.current?.querySelector<HTMLElement>('h2');
      h?.setAttribute('tabindex', '-1');
      h?.focus();
    });
  };

  return (
    <>
      <div className="flow__head">
        {header}
        <Stepper current={step} />
      </div>
      {step === 4 ? (
        <div ref={headingRef} className="flow__step" key="step-4">
          <ReviewStep onBack={() => go(3)} draft={draft} />
        </div>
      ) : (
        <div className="flow__grid">
          <div ref={headingRef} className="flow__step" key={`step-${step}`}>
            {step === 1 && <AmountStep state={state} onNext={() => go(2)} />}
            {step === 2 && <PayoutStep grossCents={data?.quote.grossCents ?? null} onBack={() => go(1)} onNext={() => go(3)} />}
            {step === 3 && <DetailsStep onBack={() => go(2)} onNext={() => go(4)} />}
          </div>
          <aside className="flow__aside" aria-label={t('Quote summary')}>
            {data ? (
              <div className="summary-bar" aria-hidden="true">
                <span className="small">{t('You receive (indicative)')}</span>
                <strong>{formatUsd(data.quote.netCents < 0n ? 0n : data.quote.netCents)}</strong>
              </div>
            ) : null}
            <div className="panel flow__aside--hide-mobile">
              <div className="panel__head">
                <h2 className="title">{t('Indicative quote')}</h2>
              </div>
              <div className="panel__body">
                {data ? (
                  <QuoteBreakdown quote={data.quote} loading={state.status === 'loading'} />
                ) : state.status === 'loading' ? (
                  <QuoteSkeleton rows={5} />
                ) : (
                  <p className="muted small">{t('Enter an amount to see the breakdown.')}</p>
                )}
                <p className="quote-meta">
                  <span>{t('Final quote is locked on the review step.')}</span>
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
      {step < 4 ? (
        <div className="flow__support">
          <SupportContact />
        </div>
      ) : null}
    </>
  );
}
