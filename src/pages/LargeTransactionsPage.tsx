import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorSummary, Field } from '@/components/Field';
import { MockBadge, Notice, PageHeader } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { ASSET_ORDER, ASSETS, defaultNetwork, networkLabel, type AssetCode, type NetworkId } from '@/domain/assets';
import { formatBps, formatUsd, parseDecimal } from '@/domain/money';
import { PRICING_POLICY } from '@/domain/quote';
import { validateEmail, validateRequired, validateUsdAmount } from '@/domain/validation';
import { errorMessage } from '@/lib/errors';
import { useServices } from '@/state/services';
import type { LargeTransactionRequest } from '@/services/types';

const MIN_DOLLARS = Number(PRICING_POLICY.retailMaximumCents / 100n);

export function LargeTransactionsPage() {
  useDocumentTitle('Large transactions');
  const { largeDesk } = useServices();
  const [asset, setAsset] = useState<AssetCode>('BTC');
  const [network, setNetwork] = useState<NetworkId>('bitcoin');
  const [amount, setAmount] = useState('');
  const [customerType, setCustomerType] = useState<LargeTransactionRequest['customerType']>('individual');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [timing, setTiming] = useState<LargeTransactionRequest['timing']>('this_month');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const checks: Array<[string, string | null]> = [
      ['lt-amount', validateUsdAmount(amount, { minDollars: MIN_DOLLARS })],
      ['lt-name', validateRequired(fullName, customerType === 'business' ? 'the contact name' : 'your full name')],
      ['lt-email', validateEmail(email)],
      ['lt-phone', /^[\d\s()+-]{10,}$/.test(phone.trim()) ? null : 'Enter a US phone number, including area code.'],
    ];
    for (const [id, err] of checks) if (err) next[id] = err;
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => summaryRef.current?.querySelector<HTMLElement>('#error-summary')?.focus());
      return;
    }
    const parsed = parseDecimal(amount, 2);
    if (!parsed.ok) return;
    setBusy(true);
    try {
      const res = await largeDesk.submit({
        asset,
        network,
        approximateUsdCents: parsed.value,
        customerType,
        fullName,
        email,
        phone,
        timing,
        notes,
      });
      setReference(res.reference);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Large transactions"
        title={<>A desk for {formatUsd(PRICING_POLICY.retailMaximumCents).replace('.00', '')} and up.</>}
        lead="Large sales are priced and reviewed one by one. You work with a desk, not a checkout, and receive dollars by wire."
      />

      <section className="section">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display-m">What to expect</h2>
            <p>No turnaround time is promised in this preview. A live desk would publish its hours and response targets.</p>
          </div>
          <ol className="steps-row" style={{ gridTemplateColumns: '1fr' }}>
            <li>
              <span className="steps-row__num">01</span>
              <h3>Request a quote</h3>
              <p>Tell us the asset, network and approximate size. No funds move at this stage.</p>
            </li>
            <li>
              <span className="steps-row__num">02</span>
              <h3>Enhanced verification</h3>
              <p>
                Identity verification for you, or for the business and its beneficial owners, plus source-of-funds documentation. Each
                request is reviewed individually and may be declined.
              </p>
            </li>
            <li>
              <span className="steps-row__num">03</span>
              <h3>Wallet check and pricing</h3>
              <p>We confirm the sending wallet, often with a small test deposit, then agree a price for a defined window.</p>
            </li>
            <li>
              <span className="steps-row__num">04</span>
              <h3>Settle by wire</h3>
              <p>Once the deposit is final and checks are complete, dollars are sent by domestic wire to an account in your name.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2 className="display-m">Indicative spreads</h2>
            <p>Every desk price is quoted per request. These starting points are illustrative only.</p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <caption>
                Indicative only, not an offer. <MockBadge label="Mock policy" />
              </caption>
              <thead>
                <tr>
                  <th scope="col">Asset type</th>
                  <th scope="col" className="num">
                    Online, under $10k
                  </th>
                  <th scope="col" className="num">
                    Desk, indicative
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">BTC, ETH</th>
                  <td className="num">{formatBps(PRICING_POLICY.spreadBps.volatile[0].bps)}</td>
                  <td className="num">from {formatBps(PRICING_POLICY.largeIndicativeSpreadBps.volatile)}</td>
                </tr>
                <tr>
                  <th scope="row">USDT, USDC</th>
                  <td className="num">{formatBps(PRICING_POLICY.spreadBps.stable[0].bps)}</td>
                  <td className="num">from {formatBps(PRICING_POLICY.largeIndicativeSpreadBps.stable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="request-title">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">Request</p>
            <h2 id="request-title" className="display-m">
              Request a desk quote
            </h2>
            <p>
              Below {formatUsd(PRICING_POLICY.retailMaximumCents)}? Use the <Link to="/exchange">online exchange</Link>.
            </p>
          </div>
          {reference ? (
            <div className="panel">
              <div className="panel__body stack" role="status">
                <h3 style={{ fontSize: 'var(--fs-title)' }}>Request recorded</h3>
                <p>
                  Reference <span className="mono">{reference}</span>
                </p>
                <Notice tone="warn" title="Nobody will contact you">
                  <p>This is a preview. The request was saved in this browser only. There is no desk staff behind this form yet.</p>
                </Notice>
                <div>
                  <button type="button" className="btn btn--secondary" onClick={() => setReference(null)}>
                    Submit another request
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form className="panel" onSubmit={submit} noValidate>
              <div className="panel__body stack">
                <div ref={summaryRef}>
                  <ErrorSummary errors={Object.entries(errors).map(([fieldId, message]) => ({ fieldId, message }))} />
                </div>
                <div className="form-grid">
                  <Field label="Asset" id="lt-asset">
                    {(p) => (
                      <select
                        className="select"
                        {...p}
                        value={asset}
                        onChange={(e) => {
                          const a = e.target.value as AssetCode;
                          setAsset(a);
                          setNetwork(defaultNetwork(a));
                        }}
                      >
                        {ASSET_ORDER.map((c) => (
                          <option key={c} value={c}>
                            {c} · {ASSETS[c].name}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Network" id="lt-network">
                    {(p) => (
                      <select className="select" {...p} value={network} onChange={(e) => setNetwork(e.target.value as NetworkId)}>
                        {ASSETS[asset].networks.map((n) => (
                          <option key={n.network} value={n.network}>
                            {networkLabel(asset, n.network)}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field
                    label="Approximate amount (USD)"
                    id="lt-amount"
                    error={errors['lt-amount']}
                    hint={`${formatUsd(PRICING_POLICY.retailMaximumCents)} or more`}
                    className="span-2"
                  >
                    {(p) => (
                      <input
                        className="input tabular"
                        {...p}
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                        placeholder="75,000"
                      />
                    )}
                  </Field>
                  <fieldset className="option-list span-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <legend className="field__label">Selling as</legend>
                    {(['individual', 'business'] as const).map((t) => (
                      <label key={t} className="option" htmlFor={`lt-type-${t}`} style={{ gridTemplateColumns: '22px 1fr' }}>
                        <input
                          id={`lt-type-${t}`}
                          type="radio"
                          name="lt-type"
                          checked={customerType === t}
                          onChange={() => setCustomerType(t)}
                        />
                        <span className="option__title">{t === 'individual' ? 'An individual' : 'A business'}</span>
                      </label>
                    ))}
                  </fieldset>
                  <Field label={customerType === 'business' ? 'Contact name' : 'Full legal name'} id="lt-name" error={errors['lt-name']}>
                    {(p) => (
                      <input className="input" {...p} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    )}
                  </Field>
                  <Field label="Email" id="lt-email" error={errors['lt-email']}>
                    {(p) => (
                      <input
                        className="input"
                        {...p}
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Phone" id="lt-phone" error={errors['lt-phone']}>
                    {(p) => (
                      <input
                        className="input"
                        {...p}
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Timing" id="lt-timing">
                    {(p) => (
                      <select
                        className="select"
                        {...p}
                        value={timing}
                        onChange={(e) => setTiming(e.target.value as LargeTransactionRequest['timing'])}
                      >
                        <option value="this_week">This week</option>
                        <option value="this_month">This month</option>
                        <option value="exploring">Just exploring</option>
                      </select>
                    )}
                  </Field>
                  <Field
                    label="Anything else"
                    id="lt-notes"
                    hint="Optional. Don't include account numbers, keys or seed phrases."
                    className="span-2"
                  >
                    {(p) => (
                      <textarea className="textarea" {...p} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
                    )}
                  </Field>
                </div>
                {serverError ? <Notice tone="danger" title={serverError} role="alert" /> : null}
                <button className="btn btn--lg" type="submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Request a quote'}
                </button>
                <p className="small muted">Preview: the request is stored in this browser only and is not sent to anyone.</p>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
