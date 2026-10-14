/**
 * Buy flow (cash → crypto): the customer states the US dollars they will hand
 * to a courier, where the courier should collect them, and the wallet that
 * receives the crypto. The server prices it, stores a firm quote and creates
 * the order; the crypto is sent only after the cash is counted and verified.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { MockBadge, Notice } from '@/components/ui';
import { defaultNetwork, isAssetCode, isSupportedPair, NETWORKS, networkLabel, type AssetCode, type NetworkId } from '@/domain/assets';
import { CASH_COLLECTION_WINDOW_MS } from '@/domain/courier';
import { formatUsd, parseDecimal } from '@/domain/money';
import { PAYOUT_METHODS } from '@/domain/payout';
import { PRICING_POLICY, type QuoteIssue } from '@/domain/quote';
import { validateCashAmount, validateReceiveAddress } from '@/domain/validation';
import { errorMessage } from '@/lib/errors';
import { describeDestination, formatAsset } from '@/lib/format';
import { useExpired } from '@/lib/useExpired';
import { clientId } from '@/services/http';
import type { QuoteData } from '@/services/types';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useDestinations } from '@/state/useDestinations';
import { useServices } from '@/state/services';
import { KycNotice } from '@/components/KycNotice';

export interface BuyDraft {
  asset: AssetCode;
  network: NetworkId;
  /** US dollars as typed, e.g. "1,500". */
  cash: string;
  destinationId: string | null;
  receiveAddress: string;
  step: 1 | 2 | 3;
}

const KEY = 'cryptobit.v1.buyDraft';
const INITIAL: BuyDraft = { asset: 'USDT', network: 'tron', cash: '1000', destinationId: null, receiveAddress: '', step: 1 };

/** Session storage is user-editable: every field is validated before it is trusted. */
function loadDraft(): BuyDraft {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return INITIAL;
    const d = { ...INITIAL, ...(JSON.parse(raw) as Record<string, unknown>) } as BuyDraft;
    const ok =
      isAssetCode(d.asset) &&
      isSupportedPair(d.asset, d.network) &&
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
const collectionAddress = (d: Parameters<typeof describeDestination>[0]) => describeDestination(d).replace(/^Cash to /, '');

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
  const key = cents === null || !enabled ? null : `${draft.asset}|${draft.network}|${cents}|${firm}|${nonce}`;
  useEffect(() => {
    if (key === null || cents === null) return;
    let cancelled = false;
    const input = { direction: 'buy' as const, asset: draft.asset, network: draft.network, cashCents: cents };
    (firm ? quotes.firm(input) : quotes.indicative(input))
      .then((data) => !cancelled && setStored({ key, data, error: null }))
      .catch((e: unknown) => !cancelled && setStored({ key, data: null, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [quotes, key, cents, firm, draft.asset, draft.network]);
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

function BuyIssues({ issues }: { issues: QuoteIssue[] }) {
  if (!issues.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {issues.map((issue) => {
        switch (issue.code) {
          case 'below_minimum':
            return <Notice key={issue.code} tone="warn" title={`Minimum is ${formatUsd(issue.minimumCents)}`} />;
          case 'payout_ineligible':
            return (
              <Notice key={issue.code} tone="warn" title="Cash collection isn’t available for this amount">
                <p>{issue.reason}.</p>
              </Notice>
            );
          case 'non_positive_payout':
            return <Notice key={issue.code} tone="warn" title="Fees would exceed this amount. Enter a larger amount." />;
          case 'unsupported_network':
            return <Notice key={issue.code} tone="danger" title="That network isn't supported for this asset." />;
          case 'zero_amount':
            return null;
        }
      })}
    </div>
  );
}

const STEPS = ['Amount', 'Collection & wallet', 'Review'] as const;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="Exchange progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'current' : 'upcoming';
        return (
          <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="stepper__label">
              <span className="stepper__num" aria-hidden="true">
                {state === 'done' ? <Icon name="check" /> : n}
              </span>
              <span className="stepper__text">{label}</span>
              {state === 'done' ? <span className="visually-hidden">(completed)</span> : null}
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
  const issues = quote.data?.issues.filter((i) => i.code !== 'zero_amount') ?? [];
  const ready = !validateCashAmount(draft.cash) && !!quote.data && !quote.loading && issues.length === 0;
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
      <h2 className="flow__step-title">What do you want to buy?</h2>
      <AssetNetworkFields
        idPrefix="buy"
        asset={draft.asset}
        network={draft.network}
        onAsset={(asset) =>
          update({ asset, network: isSupportedPair(asset, draft.network) ? draft.network : defaultNetwork(asset), receiveAddress: '' })
        }
        onNetwork={(network) => update({ network, receiveAddress: '' })}
      />
      <Field
        label="Cash you pay (USD)"
        id="buy-cash"
        error={fieldError}
        hint={`Paid in person to the courier. Minimum ${formatUsd(PRICING_POLICY.minimumCents, { whole: true })}; cash collection has its own minimum.`}
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
          <Notice tone="warn" title="We couldn’t price this right now" role="alert">
            <p>{quote.error}</p>
            <div>
              <button type="button" className="btn btn--secondary" onClick={quote.refresh}>
                <Icon name="refresh" width={16} height={16} /> Try again
              </button>
            </div>
          </Notice>
        ) : (
          <BuyIssues issues={issues} />
        )}
      </div>
      <div className="flow__actions">
        <span />
        <button className="btn btn--lg" type="submit" disabled={!ready}>
          Continue <Icon name="arrowRight" width={18} height={18} />
        </button>
      </div>
    </form>
  );
}

/* ---------------- Step 2 ---------------- */
function DetailsStep({ draft, update, onBack, onNext }: DraftProps & { onBack: () => void; onNext: () => void }) {
  const user = useUser();
  const { list: destinations, reload } = useDestinations();
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);

  if (!user) {
    return (
      <div className="flow__main">
        <h2 className="flow__step-title">Sign in to continue</h2>
        <p>You need an account to arrange a cash collection and confirm an exchange. Your amount and choices are kept.</p>
        <div className="row">
          <Link className="btn btn--lg" to="/signin" state={{ from: '/exchange?direction=buy' }}>
            Sign in
          </Link>
          <Link className="btn btn--lg btn--secondary" to="/signup" state={{ from: '/exchange?direction=buy' }}>
            Create an account
          </Link>
        </div>
        <div className="flow__actions">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onBack}>
            <Icon name="arrowLeft" width={18} height={18} /> Back
          </button>
        </div>
      </div>
    );
  }

  const usable = destinations?.filter((d) => d.kind === 'courier') ?? [];
  const addressError = touched || draft.receiveAddress ? validateReceiveAddress(draft.receiveAddress, draft.network) : null;
  const destinationOk = usable.some((d) => d.id === draft.destinationId);
  const destinationError = touched && !destinationOk ? 'Save or choose a collection address.' : null;
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
      <h2 className="flow__step-title">Where should the courier collect the cash?</h2>
      <fieldset className="option-list">
        <legend className="field__label">Collection address</legend>
        {destinations === null ? (
          <p className="muted">Loading saved addresses…</p>
        ) : usable.length === 0 ? (
          <p className="muted">No saved addresses yet. Add one below.</p>
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
              <span className="option__aside">
                <MockBadge />
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
            Add a collection address
          </button>
        </div>
      )}
      <p className="small muted">The courier collects the cash only from you, the verified account holder, after checking your photo ID.</p>

      <Field
        label={`Your ${networkLabel(draft.asset, draft.network)} wallet address`}
        id="receive-address"
        error={addressError}
        hint={`We send the ${draft.asset} here once the cash is counted and verified. Use a wallet you control on ${NETWORKS[draft.network].name}; transfers can’t be reversed.`}
      >
        {(p) => (
          <input
            className="input mono"
            {...p}
            value={draft.receiveAddress}
            onChange={(e) => update({ receiveAddress: e.target.value.trim() })}
            onBlur={() => setTouched(true)}
            placeholder={NETWORKS[draft.network].addressExample}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>

      <div className="flow__actions">
        <button type="button" className="btn btn--secondary btn--lg" onClick={onBack}>
          <Icon name="arrowLeft" width={18} height={18} /> Back
        </button>
        <button className="btn btn--lg" type="submit">
          Review quote <Icon name="arrowRight" width={18} height={18} />
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
  const verified = user.verification.status === 'verified';
  const canConfirm =
    !!locked && !expired && !firm.loading && locked.issues.length === 0 && verified && ackCash && ackDocs && !!destination && !submitting;

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
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="flow__step-title">Review and confirm</h2>
          <MockBadge label="Sandbox quote" />
        </div>
        <KycNotice />
        <section className="panel" aria-labelledby="buy-locked-title">
          <div className="panel__head">
            <h3 id="buy-locked-title">Your quote</h3>
            {locked && !expired ? (
              <span className="small rate-hold">
                <RateRing from={locked.quote.createdAt} to={locked.quote.expiresAt} />
                <span>
                  Rate held · <Countdown to={locked.quote.expiresAt} prefix="Expires in" ended="Expired" />
                </span>
              </span>
            ) : null}
          </div>
          <div className="panel__body stack">
            {locked ? (
              <>
                <BuyQuoteBreakdown quote={locked.quote} loading={firm.loading} />
                <BuyIssues issues={locked.issues} />
              </>
            ) : firm.error ? (
              <Notice tone="warn" title="We couldn’t lock a quote" role="alert">
                <p>{firm.error}</p>
                <div>
                  <button type="button" className="btn btn--secondary" onClick={firm.refresh}>
                    <Icon name="refresh" width={16} height={16} /> Try again
                  </button>
                </div>
              </Notice>
            ) : (
              <QuoteSkeleton rows={5} />
            )}
            <div aria-live="assertive">
              {expired ? (
                <Notice tone="warn" title="This quote has expired">
                  <p>Prices move. Get a new quote to continue. Nothing has been submitted.</p>
                  <div>
                    <button type="button" className="btn btn--secondary" onClick={firm.refresh}>
                      <Icon name="refresh" width={16} height={16} /> Get a new quote
                    </button>
                  </div>
                </Notice>
              ) : null}
            </div>
          </div>
        </section>

        <p className="small muted">
          The exchange rate, courier fee, minimum, quote validity and collection window shown here are the conditions of this exchange.
          Under clause 4.24 of the <Link to="/legal/terms#clause-4-24">Service Rules</Link>, continuing with this Exchange Request signifies
          your agreement with them. Submitting it is acceptance of the public offer (Section 3).
        </p>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="visually-hidden">Acknowledgements</legend>
          <Checkbox id="ack-cash" checked={ackCash} onChange={setAckCash}>
            I will hand exactly {locked ? formatUsd(locked.quote.grossCents) : 'the quoted amount'} in US dollar cash to the courier in
            person, after the courier checks my photo ID. The {draft.asset} goes only to the{' '}
            <strong>{networkLabel(draft.asset, draft.network)}</strong> wallet address I gave, which I control. Blockchain transfers can’t
            be reversed.
          </Checkbox>
          <Checkbox id="ack-buy-docs" checked={ackDocs} onChange={setAckDocs}>
            I have read and accept the{' '}
            {orderDocs.map((d, i) => (
              <span key={d.slug}>
                {i > 0 ? (i === orderDocs.length - 1 ? ' and ' : ', ') : null}
                <Link to={`/legal/${d.slug}`} target="_blank">
                  {d.title}
                </Link>
              </span>
            ))}{' '}
            for this order.
          </Checkbox>
        </fieldset>

        {error ? <Notice tone="danger" title={error} role="alert" /> : null}

        <div className="flow__actions">
          <button type="button" className="btn btn--secondary btn--lg" onClick={onBack}>
            <Icon name="arrowLeft" width={18} height={18} /> Back
          </button>
          <HoldButton disabled={!canConfirm} onConfirm={confirm}>
            {submitting ? 'Confirming…' : 'Confirm exchange'}
          </HoldButton>
        </div>
        {!canConfirm && locked && !expired ? (
          <p className="small muted" style={{ textAlign: 'right' }}>
            {!verified ? 'Verify your identity, then ' : ''}
            {!ackCash || !ackDocs ? 'tick both boxes to confirm.' : ''}
          </p>
        ) : null}
      </div>
      <aside className="flow__aside flow__aside--after" aria-label="Exchange details">
        <div className="panel">
          <div className="panel__head">
            <h3 className="title">Exchange details</h3>
          </div>
          <div className="panel__body">
            <dl className="dl">
              <div>
                <dt>Cash collected at</dt>
                <dd>{destination ? collectionAddress(destination) : '—'}</dd>
              </div>
              <div>
                <dt>Crypto sent to</dt>
                <dd className="mono">{draft.receiveAddress}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{networkLabel(draft.asset, draft.network)}</dd>
              </div>
              <div>
                <dt>Collection window</dt>
                <dd>Within {CASH_COLLECTION_WINDOW_MS / 3_600_000} hours after you confirm (estimated)</dd>
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
  const user = useUser();
  const cents = cashCents(draft.cash);
  const reachable = cents === null ? 1 : !user ? 2 : 3;
  const quote = useBuyQuote(draft, { firm: false, enabled: Math.min(draft.step, reachable) < 3 });
  const blocking = quote.data?.issues.filter((i) => i.code !== 'zero_amount') ?? [];
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
        <Stepper current={step} />
      </div>
      {!courier.availability.available ? (
        <Notice tone="warn" title="Buying with cash isn’t available right now">
          <p>Cash collection by courier is switched off. You can still sell crypto for USD.</p>
        </Notice>
      ) : step === 3 ? (
        <div ref={headingRef} className="flow__step" key="step-3">
          <ReviewStep draft={draft} onBack={() => go(2)} onDone={reset} />
        </div>
      ) : (
        <div className="flow__grid">
          <div ref={headingRef} className="flow__step" key={`step-${step}`}>
            {step === 1 && <AmountStep draft={draft} update={update} quote={quote} onNext={() => go(2)} />}
            {step === 2 && <DetailsStep draft={draft} update={update} onBack={() => go(1)} onNext={() => go(3)} />}
          </div>
          <aside className="flow__aside" aria-label="Quote summary">
            {quote.data ? (
              <div className="summary-bar" aria-hidden="true">
                <span className="small">You receive (indicative)</span>
                <strong>{formatAsset(quote.data.quote.amountAtomic, quote.data.quote.asset)}</strong>
              </div>
            ) : null}
            <div className="panel flow__aside--hide-mobile">
              <div className="panel__head">
                <h2 className="title">Indicative quote</h2>
                <MockBadge label="Sandbox pricing" />
              </div>
              <div className="panel__body">
                {quote.data ? (
                  <BuyQuoteBreakdown quote={quote.data.quote} loading={quote.loading} />
                ) : quote.loading ? (
                  <QuoteSkeleton rows={5} />
                ) : (
                  <p className="muted small">Enter an amount to see the breakdown.</p>
                )}
                <p className="quote-meta">
                  <span>Final quote is locked on the review step.</span>
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
