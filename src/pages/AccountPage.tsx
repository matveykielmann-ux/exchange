import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddBankForm } from '@/components/AddBankForm';
import { Icon } from '@/components/Icon';
import { MockBadge, Notice, PageHeader, StatusBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatUsd } from '@/domain/money';
import { PRICING_POLICY } from '@/domain/quote';
import { formatDateTime } from '@/lib/format';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import type { PayoutDestinationRecord, VerificationLevel } from '@/services/types';

const LEVEL: Record<VerificationLevel, { label: string; tone: 'neutral' | 'success' | 'info'; body: string }> = {
  unverified: { label: 'Not verified', tone: 'neutral', body: 'Verify your identity before your first exchange.' },
  verified: {
    label: 'Verified (simulated)',
    tone: 'success',
    body: `You can confirm online exchanges up to ${formatUsd(PRICING_POLICY.retailMaximumCents)} each.`,
  },
  enhanced: {
    label: 'Enhanced (simulated)',
    tone: 'success',
    body: 'Eligible for the large-transaction desk, subject to review of each request.',
  },
};

export function AccountPage() {
  useDocumentTitle('Account');
  const user = useUser();
  const services = useServices();
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState<PayoutDestinationRecord[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<VerificationLevel | null>(null);

  const load = useCallback(() => {
    if (user) services.payouts.listDestinations(user.email).then(setDestinations);
  }, [services, user]);
  useEffect(load, [load]);

  if (!user) return null;
  const level = LEVEL[user.verification];

  async function verify(target: 'verified' | 'enhanced') {
    if (!user) return;
    setBusy(target);
    try {
      await services.kyc.startVerification(user.email, target);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Account" title={user.name} lead={user.email}>
        <div className="row">
          <MockBadge label="Preview account" />
          <span className="small muted">Created {formatDateTime(user.createdAt)}</span>
        </div>
      </PageHeader>
      <div className="container">
        <div className="content-grid account-grid">
          <nav className="account-nav" aria-label="Account sections">
            <a href="#verification">Verification</a>
            <a href="#payout-methods">Payout methods</a>
            <a href="#security">Security</a>
            <Link to="/transactions">Activity</Link>
          </nav>
          <div className="stack stack--lg">
            <section id="verification" className="panel" aria-labelledby="verification-title">
              <div className="panel__head">
                <h2 id="verification-title">Identity verification</h2>
                <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
              </div>
              <div className="panel__body stack">
                <p>{level.body}</p>
                <Notice tone="neutral" title="Simulated in this preview">
                  <p>
                    A live service would use an identity-verification provider to check a government ID, a selfie, and your SSN, and would
                    ask for source-of-funds documents for enhanced verification. Nothing is collected here.
                  </p>
                </Notice>
                <div className="row">
                  {user.verification === 'unverified' ? (
                    <button type="button" className="btn" disabled={busy !== null} onClick={() => verify('verified')}>
                      {busy === 'verified' ? 'Verifying…' : 'Run simulated verification'}
                    </button>
                  ) : null}
                  {user.verification !== 'enhanced' ? (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={busy !== null || user.verification === 'unverified'}
                      onClick={() => verify('enhanced')}
                    >
                      {busy === 'enhanced' ? 'Verifying…' : 'Simulate enhanced verification'}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section id="payout-methods" className="panel" aria-labelledby="payout-title">
              <div className="panel__head">
                <h2 id="payout-title">Payout methods</h2>
              </div>
              <div className="panel__body stack">
                {destinations === null ? (
                  <p className="muted">Loading…</p>
                ) : destinations.length === 0 ? (
                  <p className="muted">No payout methods saved.</p>
                ) : (
                  <ul className="tx-list" style={{ borderTop: 0 }}>
                    {destinations.map((d) => (
                      <li
                        key={d.id}
                        className="row"
                        style={{ justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line)' }}
                      >
                        <span className="row" style={{ gap: 12 }}>
                          <Icon name={d.kind === 'bank' ? 'bank' : 'card'} width={22} height={22} />
                          <span>
                            <span className="tx-list__title">{d.label}</span>
                            <span className="small muted tabular" style={{ display: 'block' }}>
                              {d.kind === 'bank' ? 'Bank account' : 'Debit card'} ending {d.last4}
                            </span>
                          </span>
                          <MockBadge />
                        </span>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={async () => {
                            await services.payouts.removeDestination(user.email, d.id);
                            load();
                          }}
                          aria-label={`Remove ${d.label} ending ${d.last4}`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {adding ? (
                  <AddBankForm
                    onAdded={() => {
                      setAdding(false);
                      load();
                    }}
                  />
                ) : (
                  <div className="row">
                    <button type="button" className="btn btn--secondary" onClick={() => setAdding(true)}>
                      Add a bank account
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={async () => {
                        await services.payouts.addSimulatedCard(user.email);
                        load();
                      }}
                    >
                      Add simulated debit card
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section id="security" className="panel" aria-labelledby="security-title">
              <div className="panel__head">
                <h2 id="security-title">Security</h2>
              </div>
              <div className="panel__body stack">
                <dl className="dl">
                  <div>
                    <dt>Two-step sign-in</dt>
                    <dd>On (simulated authenticator, preview code)</dd>
                  </div>
                  <div>
                    <dt>Session</dt>
                    <dd>Signs out automatically after 12 hours</dd>
                  </div>
                  <div>
                    <dt>Stored payout data</dt>
                    <dd>Last four digits only</dd>
                  </div>
                </dl>
                <div>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => {
                      services.auth.signOut();
                      navigate('/');
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
