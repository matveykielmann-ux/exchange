import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '@/components/Field';
import { RulesQuote } from '@/components/LegalMarkdown';
import { MockBadge, Notice, PageHeader, StatusBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { FEATURE_FLAGS } from '@/config/runtime';
import { errorMessage } from '@/lib/errors';
import { useServices } from '@/state/services';

const STEPS = [
  ['Sign in and verify', 'Cash delivery needs an account with verified identity. The courier hands the cash only to the account holder.'],
  [
    'Choose cash by courier',
    'Enter the amount, pick "Cash by courier" and add a US delivery address, a phone number and a preferred window.',
  ],
  ['Send your crypto', 'Send the exact amount to the deposit address on your order. We wait for the network confirmations.'],
  [
    'Courier delivery',
    'After your deposit is final and any review is complete, the courier calls to confirm the time and brings the cash.',
  ],
  ['ID check at the door', 'Show a government-issued photo ID that matches your verified account. The cash is not left with anyone else.'],
  [
    'Photograph and count',
    'Before counting, photograph the cash as delivered, indoors, then send the photos and your count within 24 hours, as clause 4.10 of the Service Rules requires.',
  ],
] as const;

export function CashDeliveryPage() {
  useDocumentTitle('Cash delivery');
  const { cash } = useServices();
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof cash.availability>> | null>(null);

  async function check(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setError('Enter a 5-digit ZIP code.');
      return;
    }
    setError(null);
    try {
      setResult(await cash.availability(zip));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cash delivery"
        title="Cash by courier, to your door."
        lead="Sell crypto and receive US dollars in cash, handed to you at your address after an ID check."
      >
        <div className="row">
          <StatusBadge tone={FEATURE_FLAGS.courierCashDelivery ? 'info' : 'neutral'}>
            {FEATURE_FLAGS.courierCashDelivery ? 'Available in served areas' : 'Switched off'}
          </StatusBadge>
          {FEATURE_FLAGS.courierCashDelivery ? (
            <Link className="btn" to="/exchange">
              Start an exchange
            </Link>
          ) : null}
        </div>
      </PageHeader>
      <section className="section">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display-m">From deposit to handoff</h2>
            <p>
              The flat delivery fee and the minimum are shown in your quote before you confirm. Delivery times are estimates. See the{' '}
              <Link to="/legal/cash-delivery">cash delivery terms</Link>.
            </p>
          </div>
          <dl className="dl">
            {STEPS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="section">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">Service Rules</p>
            <h2 className="display-m">When you receive the cash</h2>
            <p>
              These safety rules apply to every cash handoff. They are quoted from the <Link to="/legal/terms">Service Rules</Link>.
            </p>
          </div>
          <RulesQuote refs={['4.10', '4.23']} />
        </div>
      </section>
      <section className="section">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">Availability</p>
            <h2 className="display-m">Check an area</h2>
            <p>Enter the ZIP code of the delivery address to see whether the courier serves it.</p>
          </div>
          <form className="panel" onSubmit={check} noValidate>
            <div className="panel__body stack">
              <Field label="ZIP code" id="zip" error={error}>
                {(p) => (
                  <input
                    className="input tabular"
                    {...p}
                    inputMode="numeric"
                    maxLength={5}
                    autoComplete="postal-code"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                  />
                )}
              </Field>
              <div>
                <button className="btn btn--secondary" type="submit">
                  Check availability
                </button>
              </div>
              <div aria-live="polite">
                {result ? (
                  result.available ? (
                    <Notice tone="info" title={`Cash delivery is available in ${result.zip}`}>
                      <p>
                        {result.reason} <Link to="/exchange">Start an exchange</Link>.
                      </p>
                      <MockBadge />
                    </Notice>
                  ) : (
                    <Notice tone="neutral" title={`Not available in ${result.zip}`}>
                      <p>{result.reason}</p>
                    </Notice>
                  )
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
