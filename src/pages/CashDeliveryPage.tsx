import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '@/components/Field';
import { Notice, PageHeader, StatusBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { FEATURE_FLAGS } from '@/config/runtime';
import { useServices } from '@/state/services';
import type { CourierAvailability } from '@/services/types';

const REQUIREMENTS = [
  ['Licensing', 'Confirm that money transmitter licensing in each state covers in-person cash disbursement.'],
  [
    'Cash reporting',
    'Currency Transaction Reports for cash over $10,000 per person per business day, aggregation across visits, structuring detection, and any geographic targeting orders.',
  ],
  ['Identity at handoff', 'Re-verify the recipient in person against the verified account holder, with an audit trail.'],
  ['Carrier and insurance', 'A licensed, bonded armored or courier partner with all-risk coverage that meets state requirements.'],
  ['Safety', 'Protocols for robbery and coercion risk, including duress signals, public handoff points and amount caps.'],
  ['Local legal review', 'County and city rules, plus counsel sign-off for every service area before launch.'],
];

export function CashDeliveryPage() {
  useDocumentTitle('Cash delivery');
  const { courier } = useServices();
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CourierAvailability | null>(null);

  async function check(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setError('Enter a 5-digit ZIP code.');
      return;
    }
    setError(null);
    setResult(await courier.checkAvailability(zip));
  }

  return (
    <>
      <PageHeader
        eyebrow="Cash delivery"
        title="Cash by courier is not offered."
        lead="This module is built but switched off. It stays off until every requirement below is verified."
      >
        <div className="row">
          <StatusBadge tone="neutral">{FEATURE_FLAGS.courierCashDelivery ? 'Enabled' : 'Disabled'}</StatusBadge>
        </div>
      </PageHeader>
      <section className="section">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">Before it can be enabled</p>
            <h2 className="display-m">Requirements</h2>
            <p>
              Cash delivery carries the highest anti-money-laundering and physical-safety risk of any payout method. See{' '}
              <Link to="/legal#licensing">licensing status</Link>.
            </p>
          </div>
          <dl className="dl">
            {REQUIREMENTS.map(([k, v]) => (
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
            <p className="eyebrow">Availability</p>
            <h2 className="display-m">Check an area</h2>
            <p>The checker is wired to the courier interface, which returns "not available" everywhere.</p>
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
                  <Notice tone="neutral" title={`Not available in ${zip}`}>
                    <p>{result.reason}</p>
                  </Notice>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
