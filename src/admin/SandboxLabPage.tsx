import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MockBadge, Notice } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError } from './shared';
import { useLoad } from './lib';
import { t } from '@/i18n';

const SCENARIOS: [string, string][] = [
  [
    'Happy path',
    'Place an order, then on its admin page: deposit exact amount → reach final confirmations → (authorize payout if above the review threshold) → payout completed.',
  ],
  [
    'Duplicate webhook',
    'On any order with a provider event, “Replay last webhook”. The server acknowledges the duplicate and changes nothing.',
  ],
  ['Short deposit', '“Deposit short amount” puts the order in compliance review with an amount exception; it can only be refunded.'],
  ['Late deposit', 'Let the window expire (or “Expire deposit window now”), then “Deposit after window”.'],
  ['Payout failure', 'After payout is submitted, “Provider: payout failed”; then retry the payout or start a refund.'],
  ['Declined payout', 'A customer whose legal name contains “Decline” gets payouts rejected by the sandbox payout provider.'],
  ['Review and reject', 'Orders above the review threshold, or with a refund address ending in …bEEF, need review; use Reject or Approve.'],
  ['Blocked address', 'A refund address ending in …dEaD fails screening and the order is refused.'],
  ['Identity outcomes', 'Customer names containing “Review”, “Reject” or “Sanctioned” produce those verification results.'],
];

/** Sandbox-only tools: scenario guide and the outbox of notifications that would be emailed. */
export function SandboxLabPage() {
  const config = useConfig();
  const { admin } = useServices();
  const outbox = useLoad(() => admin.sandbox.notifications(), []);
  useLiveEvents((e) => {
    if (e.type === 'notification.created') outbox.reload();
  });
  const [open, setOpen] = useState<string | null>(null);

  if (config.mode !== 'sandbox')
    return (
      <Notice tone="neutral" title={t('Not available')}>
        <p>{t('The sandbox lab exists only in sandbox mode. Its routes are not registered in production.')}</p>
      </Notice>
    );

  return (
    <div className="stack stack--lg">
      <AdminHead
        title={t('Sandbox lab')}
        lead={t('Test-only controls. Every simulated provider event is signed and goes through the same webhook pipeline as a real one.')}
      >
        <MockBadge label={t('Sandbox only')} />
      </AdminHead>
      <section className="panel" aria-labelledby="lab-scenarios">
        <div className="panel__head">
          <h2 id="lab-scenarios">{t('Scenarios')}</h2>
          <Link to="/admin/orders" className="small">
            {t('Open the order queue')}
          </Link>
        </div>
        <div className="panel__body">
          <dl className="dl">
            {SCENARIOS.map(([k, v]) => (
              <div key={k}>
                <dt>{t(k)}</dt>
                <dd>{t(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="small muted">
            {t('The same scenarios run unattended with')} <code>pnpm server:scenarios</code>.
          </p>
        </div>
      </section>
      <section className="panel" aria-labelledby="lab-outbox">
        <div className="panel__head">
          <h2 id="lab-outbox">{t('Notification outbox')}</h2>
          <span className="small muted">{t('Emails are recorded here, never sent, in the sandbox')}</span>
        </div>
        <div className="panel__body">
          <LoadError error={outbox.error} />
          {outbox.data ? (
            outbox.data.length ? (
              <ul className="note-list">
                {outbox.data.map((n) => (
                  <li key={n.id}>
                    <p className="note-list__meta small muted">
                      {formatDateTime(n.createdAt)} {t('· to')} {n.recipient} · {n.template} · {n.status}
                    </p>
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={open === n.id}
                      onClick={() => setOpen(open === n.id ? null : n.id)}
                    >
                      {n.subject}
                    </button>
                    {open === n.id ? <pre className="audit-data">{t(n.body)}</pre> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">{t('Nothing yet.')}</p>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
