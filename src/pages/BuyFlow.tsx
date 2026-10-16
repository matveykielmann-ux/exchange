/**
 * Buy flow (cash or wire → crypto): the customer states the US dollars they
 * will pay, how (cash handed to a courier, or a bank wire), where the courier
 * should collect cash, and the wallet that receives the crypto. The server
 * prices it, stores a firm quote and creates the order; the crypto is sent
 * only after the cash is counted or the wire is matched and verified.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AddCourierForm } from '@/components/AddCourierForm';
import { Checkbox } from '@/components/Checkbox';
import { Countdown } from '@/components/Countdown';
import { AssetNetworkFields } from '@/components/ExchangeInputs';
import { Field } from '@/components/Field';
import { HoldButton } from '@/components/HoldButton';
import { Icon } from '@/components/Icon';
import { BuyQuoteBreakdown } from '@/components/QuoteBreakdown';
import { QuoteSkeleton } from '@/components/QuoteSkeleton';
import { RateRing } from '@/components/RateRing';
import { SupportContact } from '@/components/SupportContact';
import { Notice } from '@/components/ui';
import { defaultNetwork, isAssetCode, isSupportedPair, NETWORKS, networkLabel, type AssetCode, type NetworkId } from '@/domain/assets';
import { CASH_COLLECTION_WINDOW_MS } from '@/domain/courier';
import { formatUsd, parseDecimal } from '@/domain/money';
import { describeFee, PAYOUT_METHODS } from '@/domain/payout';
import { amountIssues, buyPayInMethod, isBuyPayIn, PRICING_POLICY, type BuyPayIn, type QuoteIssue } from '@/domain/quote';
import { WIRE_RECEIPT_WINDOW_MS } from '@/domain/wire';
import { validateCashAmount, validateReceiveAddress } from '@/domain/validation';
import { errorMessage } from '@/lib/errors';
import { courierAddress, describeDestination, formatAsset } from '@/lib/format';
import { useExpired } from '@/lib/useExpired';
import { clientId } from '@/services/http';
import type { QuoteData } from '@/services/types';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useDestinations } from '@/state/useDestinations';
import { useServices } from '@/state/services';
import { t } from '@/i18n';

export interface BuyDraft {
  asset: AssetCode;
  network: NetworkId;
  /** How the dollars are paid: cash to a courier, or a bank wire. */
  payIn: BuyPayIn;
  /** US dollars as typed, e.g. "1,500". */
  cash: string;
  destinationId: string | null;
  receiveAddress: string;
  step: 1 | 2 | 3;
}

const KEY = 'cryptobit.v1.buyDraft';
const INITIAL: BuyDraft = {
  asset: 'USDT',
  network: 'tron',
  payIn: 'courier_cash',
  cash: '1000',
  destinationId: null,
  receiveAddress: '',
  step: 1,
};

/** Session storage is user-editable: every field is validated before it is trusted. */
function loadDraft(): BuyDraft {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return INITIAL;
    const d = { ...INITIAL, ...(JSON.parse(raw) as Record<string, unknown>) } as BuyDraft;
    const ok =
      isAssetCode(d.asset) &&
      isSupportedPair(d.asset, d.network) &&
      isBuyPayIn(d.payIn) &&
      typeof d.cash === 'string' &&
      d.cash.length <= 20 &&
      (d.destinationId === null || typeof d.destinationId === 'string') &&
      typeof d.receiveAddress === 'string' &&
      d.receiveAddress.length <= 128 &&
      [1, 2, 3].includes(d.step);
    return ok ? d : INITIAL;
  } catch {
    return INITIAL;
  }
}

function useBuyDraft() {
  const [draft, setDraft] = useState<BuyDraft>(loadDraft);
  const save = useCallback((next: BuyDraft) => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory */
    }
    return next;
  }, []);
  const update = useCallback((patch: Partial<BuyDraft>) => setDraft((d) => save({ ...d, ...patch })), [save]);
  const reset = useCallback(() => setDraft(save(INITIAL)), [save]);
  return { draft, update, reset };
}

/** The courier address without the delivery wording ("Cash to …") that describeDestination uses for payouts. */
const collectionAddress = (d: Parameters<typeof describeDestination>[0]) =>
  d.courier ? courierAddress(d.courier) : describeDestination(d);

function cashCents(cash: string): bigint | null {
  const p = parseDecimal(cash.replace(/,/g, ''), 2);
  return p.ok && p.value > 0n ? p.value : null;
}

/**
 * Buy quote from the server. `firm` stores it (single use, expires); otherwise
 * it is indicative and refreshed on the pricing cadence. A stale response is
 * never shown as current: results are keyed by their inputs.
 */
function useBuyQuote(draft: BuyDraft, { firm, enabled = true }: { firm: boolean; enabled?: boolean }) {
  const { quotes } = useServices();
  const [nonce, setNonce] = useState(0);
  const [stored, setStored] = useState<{ key: string; data: QuoteData | null; error: string | null } | null>(null);
  const cents = cashCents(draft.cash);
  const key = cents === null || !enabled ? null : `${draft.asset}|${draft.network}|${draft.payIn}|${cents}|${firm}|${nonce}`;
  useEffect(() => {
    if (key === null || cents === null) return;
    let cancelled = false;
    const input = { direction: 'buy' as const, asset: draft.asset, network: draft.network, cashCents: cents, payIn: draft.payIn };
    (firm ? quotes.firm(input) : quotes.indicative(input))
      .then((data) => !cancelled && setStored({ key, data, error: null }))
      .catch((e: unknown) => !cancelled && setStored({ key, data: null, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [quotes, key, cents, firm, draft.asset, draft.network, draft.payIn]);
  useEffect(() => {
    if (firm || !enabled) return;
    const t = window.setInterval(() => setNonce((n) => n + 1), PRICING_POLICY.indicativeRefreshMs);
    return () => window.clearInterval(t);
  }, [firm, enabled]);
  const current = stored?.key === key ? stored : null;
  // Between indicative refreshes keep showing the previous figures (greyed).
  const shown = current ?? (!firm && stored?.data ? stored : null);
  return {
    data: key === null ? null : (shown?.data ?? null),
    error: current?.error ?? null,
    loading: key !== null && !current,
    refresh: useCallback(() => setNonce((n) => n + 1), []),
  };
}

function BuyIssues({ issues, payIn = 'courier_cash' }: { issues: QuoteIssue[]; payIn?: BuyPayIn }) {
  if (!issues.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {issues.map((issue) => {
        switch (issue.code) {
          case 'below_minimum':
            return <Notice key={issue.code} tone="warn" title={t('Minimum is {0}', [formatUsd(issue.minimumCents)])} />;
          case 'payout_ineligible':
            return (
              <Notice
                key={issue.code}
                tone="warn"
                title={
                  payIn === 'wire'
                    ? t('Paying by wire isn’t available for this amount')
                    : t('Cash collection isn’t available for this amount')
                }
              >
                <p>{issue.reason}.</p>
              </Notice>
            );
          case 'non_positive_payout':
            return <Notice key={issue.code} tone="warn" title={t('Fees would exceed this amount. Enter a larger amount.')} />;
          case 'unsupported_network':
            return <Notice key={issue.code} tone="danger" title={t("That network isn't supported for this asset.")} />;
          case 'zero_amount':
            return null;
        }
      })}
    </div>
  );
}

const STEPS = ['Amount', 'Collection & wallet', 'Review'] as const;
const REMOTE_PAY_STEPS = ['Amount', 'Wallet', 'Review'] as const;

function Stepper({ current, payIn }: { current: number; payIn: BuyPayIn }) {
  return (
    <ol className="stepper" aria-label={t('Exchange progress')}>
      {(payIn === 'wire' || payIn === 'card' ? REMOTE_PAY_STEPS : STEPS).map((label, i) => {
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

type DraftProps = { draft: BuyDraft; update: (patch: Partial<BuyDraft>) => void };

/* ---------------- Step 1 ---------------- */
function AmountStep({ draft, update, quote, onNext }: DraftProps & { quote: ReturnType<typeof useBuyQuote>; onNext: () => void }) {
  const [touched, setTouched] = useState(false);
  const fieldError = touched || draft.cash !== '' ? validateCashAmount(draft.cash) : null;
  // Courier fee is set later in CRM — it must not block leaving step 1.
  const issues = quote.data ? amountIssues(quote.data.issues).filter((i) => i.code !== 'zero_amount') : [];
  const ready = !validateCashAmount(draft.cash) && !!quote.data && !quote.loading && issues.length === 0;
  const wire = draft.payIn === 'wire';
  const card = draft.payIn === 'card';
  return (
    <form
      className="flow__main"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (ready) onNext();
      }}
    >
      <h2 className="flow__step-title">{t('What do you want to buy?')}</h2>
      <AssetNetworkFields
        idPrefix="buy"
        asset={draft.asset}
        network={draft.network}
        onAsset={(asset) =>
          update({ asset, network: isSupportedPair(asset, draft.network) ? draft.network : defaultNetwork(asset), receiveAddress: '' })
        }
        onNetwork={(network) => update({ network, receiveAddress: '' })}
      />
      <fieldset className="option-list">
        <legend className="field__label">{t('How you pay')}</legend>
        {(['courier_cash', 'wire', 'card'] as const).map((id) => {
          const m = PAYOUT_METHODS[buyPayInMethod(id)];
          const title = id === 'wire' ? t('Bank wire') : id === 'card' ? t('Bank card') : t('Cash by courier');
          const meta =
            id === 'wire'
              ? t('You send a wire from your own US bank account. No wallet or card needed on our side.')
              : id === 'card'
                ? t('You pay on a secure external payment page. We never collect your CVV or full card details for this payment.')
                : t('A courier collects US dollar cash from you after an ID check.');
          return (
            <label className="option" key={id} htmlFor={`pay-${id}`}>
              <input id={`pay-${id}`} type="radio" name="pay-in" checked={draft.payIn === id} onChange={() => update({ payIn: id })} />
              <span>
                <span className="option__title">{title}</span>
                <span className="option__meta" style={{ display: 'block' }}>
                  {meta}
                </span>
              </span>
              <span className="option__aside small" style={{ whiteSpace: 'normal', textAlign: 'right', maxWidth: '16rem' }}>
                {t(describeFee(m.fee, m.feeStatus))}
              </span>
            </label>
          );
        })}
      </fieldset>
      <Field
        label={wire ? t('Dollars you wire (USD)') : card ? t('Dollars you pay by card (USD)') : t('Cash you pay (USD)')}
        id="buy-cash"
        error={fieldError}
        hint={
          wire
            ? t('Sent by bank wire to the instructions on your order page.')
            : card
              ? t('Paid on the external payment page linked from your order after instructions are issued.')
              : t('Calculated individually based on the order parameters')
        }
      >
        {(p) => (
          <div className="amount-input" data-invalid={fieldError ? 'true' : undefined}>
            <input
              {...p}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={draft.cash}
              onChange={(e) => update({ cash: e.target.value.replace(/[^\d.,]/g, '') })}
              onBlur={() => setTouched(true)}
            />
            <span className="amount-input__code" aria-hidden="true">
              USD
            </span>
          </div>
        )}
      </Field>
      <div aria-live="polite">
        {quote.error ? (
          <Notice tone="warn" title={t('We couldn’t price this right now')} role="alert">
            <p>{quote.error}</p>
            <div>
              <button type="button" className="btn btn--secondary" onClick={quote.refresh}>
                <Icon name="refresh" width={16} height={16} /> {t('Try again')}
              </button>
            </div>
          </Notice>
        ) : (
          <BuyIssues issues={issues} payIn={draft.payIn} />
        )}
      </div>
      <div className="flow__actions">
        <span />
        <button className="btn btn--lg" type="submit" disabled={!ready}>
          {t('Continue')} <Icon name="arrowRight" width={18} height={18} />
        </button>
      </div>
    </form>
  );
}

/* ---------------- Step 2 ---------------- */
function SignInStep({ onBack }: { onBack: () => void }) {
  return (
    <div className="flow__main">
      <h2 className="flow__step-title">{t('Sign in to continue')}</h2>
      <p>{t('You need an account to confirm an exchange. Your amount and choices are kept.')}</p>
      <div className="row">
        <Link className="btn btn--lg" to="/signin" state={{ from: '/exchange?direction=buy' }}>
          {t('Sign in')}
        </Link>
        <Link className="btn btn--lg btn--secondary" to="/signup" state={{ from: '/exchange?direction=buy' }}>
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

function ReceiveAddressField({ draft, update, error, onBlur }: DraftProps & { error: string | null; onBlur: () => void }) {
  return (
    <Field
      label={t('Your {0} wallet address', [networkLabel(draft.asset, draft.network)])}
      id="receive-address"
      error={error}
      hint={t(
        draft.payIn === 'wire'
          ? 'We send the {0} here once the wire is matched and verified. Use a wallet you control on {1}; transfers can’t be reversed.'
          : draft.payIn === 'card'
            ? 'We send the {0} here once the card payment is verified. Use a wallet you control on {1}; transfers can’t be reversed.'
            : 'We send the {0} here once the cash is counted and verified. Use a wallet you control on {1}; transfers can’t be reversed.',
        [draft.asset, NETWORKS[draft.network].name],
      )}
    >
      {(p) => (
        <input
          className="input mono"
          {...p}
          value={draft.receiveAddress}
          onChange={(e) => update({ receiveAddress: e.target.value.trim() })}
          onBlur={onBlur}
          placeholder={NETWORKS[draft.network].addressExample}
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </Field>
  );
}

function DetailsStep({ draft, update, onBack, onNext }: DraftProps & { onBack: () => void; onNext: () => void }) {
  const user = useUser();
  const { list: destinations, reload } = useDestinations();
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);

  if (!user) return <SignInStep onBack={onBack} />;

  const usable = destinations?.filter((d) => d.kind === 'courier') ?? [];
  const addressError = touched || draft.receiveAddress ? validateReceiveAddress(draft.receiveAddress, draft.network) : null;
  const destinationOk = usable.some((d) => d.id === draft.destinationId);
  const destinationError = touched && !destinationOk ? t('Save or choose a collection address.') : null;
  const valid = destinationOk && !validateReceiveAddress(draft.receiveAddress, draft.network);

  return (
    <form
      className="flow__main"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (valid) onNext();
        else document.getElementById(!destinationOk ? (usable.length ? 'collect-0' : 'courier-phone') : 'receive-address')?.focus();
      }}
    >
      <h2 className="flow__step-title">{t('Where should the courier collect the cash?')}</h2>
      <fieldset className="option-list">
        <legend className="field__label">{t('Collection address')}</legend>
        {destinations === null ? (
          <p className="muted">{t('Loading saved addresses…')}</p>
        ) : usable.length === 0 ? (
          <p className="muted">{t('No saved addresses yet. Add one below.')}</p>
        ) : (
          usable.map((d, i) => (
            <label className="option" key={d.id} htmlFor={`collect-${i}`}>
              <input
                id={`collect-${i}`}
                type="radio"
                name="collection"
                checked={draft.destinationId === d.id}
                onChange={() => update({ destinationId: d.id })}
              />
              <span>
                <span className="option__title">{d.label}</span>
                <span className="option__meta tabular" style={{ display: 'block' }}>
                  {collectionAddress(d)}
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
      {adding || (destinations !== null && usable.length === 0) ? (
        <AddCourierForm
          purpose="collection"
          onAdded={(d) => {
            setAdding(false);
            update({ destinationId: d.id });
            reload();
          }}
          onCancel={usable.length ? () => setAdding(false) : undefined}
        />
      ) : (
        <div>
          <button type="button" className="btn btn--secondary" onClick={() => setAdding(true)}>
            {t('Add a collection address')}
          </button>
        </div>
      )}
      <p className="small muted">
        {t('The courier collects the cash only from you, the verified account holder, after checking your photo ID.')}
      </p>

      <ReceiveAddressField draft={draft} update={update} error={addressError} onBlur={() => setTouched(true)} />

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

/** Step 2 for a wire: only the receiving wallet. The wire instructions come with the order. */
function WireDetailsStep({ draft, update, onBack, onNext }: DraftProps & { onBack: () => void; onNext: () => void }) {
  const user = useUser();
  const [touched, setTouched] = useState(false);
  if (!user) return <SignInStep onBack={onBack} />;
  const addressError = touched || draft.receiveAddress ? validateReceiveAddress(draft.receiveAddress, draft.network) : null;
  return (
    <form
      className="flow__main"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (!validateReceiveAddress(draft.receiveAddress, draft.network)) onNext();
        else document.getElementById('receive-address')?.focus();
      }}
    >
      <h2 className="flow__step-title">{t('Where should we send the crypto?')}</h2>
      <ReceiveAddressField draft={draft} update={update} error={addressError} onBlur={() => setTouched(true)} />
      <p className="small muted">
        {draft.payIn === 'card'
          ? t(
              'After you confirm, card payment instructions appear on your order page. Pay only through the https link or instructions shown there — never through a page sent by email.',
            )
          : t(
              'After you confirm, the wire instructions appear on your order page. Send the wire from a US bank account in your own name and quote the order number as the reference.',
            )}
      </p>
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

/* ---------------- Step 3 ---------------- */
function ReviewStep({ draft, onBack, onDone }: { draft: BuyDraft; onBack: () => void; onDone: () => void }) {
  const services = useServices();
  const config = useConfig();
  const user = useUser();
  const navigate = useNavigate();
  const firm = useBuyQuote(draft, { firm: true });
  const locked = firm.data;
  const expired = useExpired(locked?.quote.expiresAt ?? null);
  const destination = useDestinations().list?.find((d) => d.id === draft.destinationId) ?? null;
  const orderDocs = config.legal.filter((d) => d.acceptance === 'order');
  const [ackCash, setAckCash] = useState(false);
  const [ackDocs, setAckDocs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One idempotency key per firm quote: a retried confirm can't create a second order.
  const keyRef = useRef<{ quoteId: string; key: string } | null>(null);

  if (!user) return null;
  const wire = draft.payIn === 'wire';
  const card = draft.payIn === 'card';
  const remotePay = wire || card;
  const canConfirm =
    !!locked &&
    !expired &&
    !firm.loading &&
    locked.issues.every((i) => i.code === 'courier_fee_pending') &&
    ackCash &&
    ackDocs &&
    (remotePay || !!destination) &&
    !submitting;

  async function confirm() {
    if (!locked || (!remotePay && !destination)) return;
    if (keyRef.current?.quoteId !== locked.quote.id) keyRef.current = { quoteId: locked.quote.id, key: clientId('order') };
    setSubmitting(true);
    setError(null);
    try {
      const order = await services.orders.create(
        {
          quoteId: locked.quote.id,
          // A wire has no saved destination; the server ignores this field for it.
          destinationId: destination?.id ?? '',
          receiveAddress: draft.receiveAddress,
          accepted: orderDocs.map((d) => ({ slug: d.slug, version: d.version })),
        },
        keyRef.current.key,
      );
      onDone();
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
        <section className="panel" aria-labelledby="buy-locked-title">
          <div className="panel__head">
            <h3 id="buy-locked-title">{t('Your quote')}</h3>
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
                <BuyQuoteBreakdown quote={locked.quote} loading={firm.loading} />
                <BuyIssues issues={locked.issues} payIn={draft.payIn} />
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
          {wire
            ? t(
                'The exchange rate, wire fee, minimum, quote validity and wire window shown here are the conditions of this exchange. Under clause 4.24 of the',
              )
            : card
              ? t(
                  'The exchange rate, card payment fee, minimum, quote validity and payment window shown here are the conditions of this exchange. Under clause 4.24 of the',
                )
              : t(
                  'The exchange rate, courier fee, minimum, quote validity and collection window shown here are the conditions of this exchange. Under clause 4.24 of the',
                )}{' '}
          <Link to="/legal/terms#clause-4-24">{t('Service Rules')}</Link>
          {t(
            ', continuing with this Exchange Request signifies your agreement with them. Submitting it is acceptance of the public offer (Section 3).',
          )}
        </p>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="visually-hidden">{t('Acknowledgements')}</legend>
          <Checkbox id="ack-cash" checked={ackCash} onChange={setAckCash}>
            {wire ? (
              <>
                {t('I will wire exactly')} {locked ? formatUsd(locked.quote.grossCents) : t('the quoted amount')}{' '}
                {t(
                  'from a US bank account in my own name, only to the instructions on my order page, with the order number as the reference. The',
                )}{' '}
                {draft.asset}
              </>
            ) : card ? (
              <>
                {t('I will pay exactly')} {locked ? formatUsd(locked.quote.grossCents) : t('the quoted amount')}{' '}
                {t(
                  'by card only through the payment page or instructions on my order page. The',
                )}{' '}
                {draft.asset}
              </>
            ) : (
              <>
                {t('I will hand exactly')} {locked ? formatUsd(locked.quote.grossCents) : t('the quoted amount')}{' '}
                {t('in US dollar cash to the courier in person, after the courier checks my photo ID. The')} {draft.asset}
              </>
            )}{' '}
            {t('goes only to the')} <strong>{networkLabel(draft.asset, draft.network)}</strong>{' '}
            {t('wallet address I gave, which I control. Blockchain transfers can’t be reversed.')}
          </Checkbox>
          <Checkbox id="ack-buy-docs" checked={ackDocs} onChange={setAckDocs}>
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
        {!canConfirm && locked && !expired && (!ackCash || !ackDocs) ? (
          <p className="small muted" style={{ textAlign: 'right' }}>
            {t('tick both boxes to confirm.')}
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
              {wire ? (
                <div>
                  <dt>{t('You pay by')}</dt>
                  <dd>{t('Bank wire. Instructions appear on your order page after you confirm.')}</dd>
                </div>
              ) : (
                <div>
                  <dt>{t('Cash collected at')}</dt>
                  <dd>{destination ? collectionAddress(destination) : '—'}</dd>
                </div>
              )}
              <div>
                <dt>{t('Crypto sent to')}</dt>
                <dd className="mono">{draft.receiveAddress}</dd>
              </div>
              <div>
                <dt>{t('Network')}</dt>
                <dd>{networkLabel(draft.asset, draft.network)}</dd>
              </div>
              <div>
                <dt>{wire ? t('Wire window') : t('Collection window')}</dt>
                <dd>
                  {t('Within')} {(wire ? WIRE_RECEIPT_WINDOW_MS : CASH_COLLECTION_WINDOW_MS) / 3_600_000}{' '}
                  {t('hours after you confirm (estimated)')}
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

/* ---------------- Flow ---------------- */
export function BuyFlow({ header }: { header: ReactNode }) {
  const { draft, update, reset } = useBuyDraft();
  // A link such as /exchange?direction=buy&pay=wire preselects the payment method.
  const [params] = useSearchParams();
  const payParam = params.get('pay');
  useEffect(() => {
    if (payParam === 'wire' || payParam === 'cash' || payParam === 'card')
      update({ payIn: payParam === 'wire' ? 'wire' : payParam === 'card' ? 'card' : 'courier_cash' });
  }, [payParam, update]);
  const user = useUser();
  const cents = cashCents(draft.cash);
  const reachable = cents === null ? 1 : !user ? 2 : 3;
  const quote = useBuyQuote(draft, { firm: false, enabled: Math.min(draft.step, reachable) < 3 });
  const blocking = quote.data ? amountIssues(quote.data.issues).filter((i) => i.code !== 'zero_amount') : [];
  const maxStep = blocking.length && !quote.loading ? 1 : reachable;
  const step = Math.min(draft.step, maxStep) as BuyDraft['step'];
  const headingRef = useRef<HTMLDivElement>(null);
  const courier = PAYOUT_METHODS.courier_cash;

  const go = (s: BuyDraft['step']) => {
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
        <Stepper current={step} payIn={draft.payIn} />
      </div>
      {draft.payIn === 'courier_cash' && !courier.availability.available ? (
        <Notice tone="warn" title={t('Buying with cash isn’t available right now')}>
          <p>{t('Cash collection by courier is switched off. You can still sell crypto for USD.')}</p>
        </Notice>
      ) : step === 3 ? (
        <div ref={headingRef} className="flow__step" key="step-3">
          <ReviewStep draft={draft} onBack={() => go(2)} onDone={reset} />
        </div>
      ) : (
        <div className="flow__grid">
          <div ref={headingRef} className="flow__step" key={`step-${step}`}>
            {step === 1 && <AmountStep draft={draft} update={update} quote={quote} onNext={() => go(2)} />}
            {step === 2 &&
              (draft.payIn === 'wire' || draft.payIn === 'card' ? (
                <WireDetailsStep draft={draft} update={update} onBack={() => go(1)} onNext={() => go(3)} />
              ) : (
                <DetailsStep draft={draft} update={update} onBack={() => go(1)} onNext={() => go(3)} />
              ))}
          </div>
          <aside className="flow__aside" aria-label={t('Quote summary')}>
            {quote.data ? (
              <div className="summary-bar" aria-hidden="true">
                <span className="small">{t('You receive (indicative)')}</span>
                <strong>{formatAsset(quote.data.quote.amountAtomic, quote.data.quote.asset)}</strong>
              </div>
            ) : null}
            <div className="panel flow__aside--hide-mobile">
              <div className="panel__head">
                <h2 className="title">{t('Indicative quote')}</h2>
              </div>
              <div className="panel__body">
                {quote.data ? (
                  <BuyQuoteBreakdown quote={quote.data.quote} loading={quote.loading} />
                ) : quote.loading ? (
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
      {step < 3 ? (
        <div className="flow__support">
          <SupportContact />
        </div>
      ) : null}
    </>
  );
}
