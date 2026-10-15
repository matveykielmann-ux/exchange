import { useState } from 'react';
import { Notice } from '@/components/ui';
import { formatUsd } from '@/domain/money';
import { formatDateTime } from '@/lib/format';
import type { ProviderState } from '@/services/types';
import { useServices } from '@/state/services';
import { AdminHead, LoadError, Pager } from './shared';
import { shortId, useLoad } from './lib';
import { t } from '@/i18n';

const STATE: Record<ProviderState, { label: string; tone: string }> = {
  sandbox: { label: 'Sandbox', tone: 'mock' },
  configured: { label: 'Configured', tone: 'success' },
  not_configured: { label: 'Not configured', tone: 'warn' },
  disabled_by_policy: { label: 'Disabled by policy', tone: 'neutral' },
};

/** Health of the running system: mode, providers, database, audit chain and the webhook log. */
export function SystemPage() {
  const { admin } = useServices();
  const sys = useLoad(() => admin.system(), []);
  const [page, setPage] = useState(1);
  const hooks = useLoad(() => admin.webhooks(page), [page]);
  const s = sys.data;

  return (
    <div className="stack stack--lg">
      <AdminHead title={t('System')} lead={t('Read-only. Configuration changes are made on the server and need a restart.')} />
      <LoadError error={sys.error} />
      {s ? (
        <>
          {s.warnings.length ? (
            <Notice tone="warn" title={t('Configuration warnings')}>
              <ul>
                {s.warnings.map((w) => (
                  <li key={w}>{t(w)}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <div className="admin-grid-2">
            <section className="panel" aria-labelledby="sys-mode">
              <div className="panel__head">
                <h2 id="sys-mode">{t('Runtime')}</h2>
              </div>
              <div className="panel__body">
                <dl className="dl">
                  <div>
                    <dt>{t('Mode')}</dt>
                    <dd>
                      {s.mode === 'sandbox'
                        ? t('Internal testing (isolated database; staff tooling only)')
                        : t('Production')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Real money')}</dt>
                    <dd>
                      {s.realMoneyEnabled
                        ? t('Allowed when providers are configured')
                        : t('Disabled by policy until providers and compliance gates are ready')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Courier cash delivery')}</dt>
                    <dd>{s.featureFlags.courierCashDelivery ? t('Enabled') : t('Disabled')}</dd>
                  </div>
                  <div>
                    <dt>{t('Staff two-step sign-in')}</dt>
                    <dd>{s.requireStaffMfa ? t('Required') : t('Optional')}</dd>
                  </div>
                  <div>
                    <dt>{t('Manual review above')}</dt>
                    <dd className="tabular">{formatUsd(BigInt(s.manualReviewThresholdCents))}</dd>
                  </div>
                  <div>
                    <dt>{t('Live connections')}</dt>
                    <dd className="tabular">{s.liveConnections}</dd>
                  </div>
                  <div>
                    <dt>{t('Database migrations')}</dt>
                    <dd>
                      {s.database.applied} {t('applied')}
                      {s.database.pending.length ? t(', pending: {0}', [s.database.pending.join(', ')]) : t(', none pending')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Audit chain')}</dt>
                    <dd>
                      {s.auditChain.ok ? (
                        <span className="badge badge--success">
                          {t('Intact ·')} {s.auditChain.count} {t('entries')}
                        </span>
                      ) : (
                        <span className="badge badge--danger">
                          {t('Broken at entry')} {s.auditChain.brokenAtId}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Notifications')}</dt>
                    <dd>{s.notifications.length ? s.notifications.map((n) => `${n.n} ${n.status}`).join(' · ') : t('None')}</dd>
                  </div>
                </dl>
              </div>
            </section>
            <section className="panel" aria-labelledby="sys-providers">
              <div className="panel__head">
                <h2 id="sys-providers">{t('Providers')}</h2>
              </div>
              <div className="panel__body">
                <table className="data-table admin-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('Provider')}</th>
                      <th scope="col">{t('State')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.providers.map((p) => (
                      <tr key={p.key}>
                        <th scope="row">
                          {t(p.label)}
                          {p.detail ? <span className="small muted block">{t(p.detail)}</span> : null}
                        </th>
                        <td>
                          <span className={`badge badge--${STATE[p.state].tone}`}>{t(STATE[p.state].label)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : !sys.error ? (
        <p className="muted">{t('Loading…')}</p>
      ) : null}

      <section className="panel" aria-labelledby="sys-hooks">
        <div className="panel__head">
          <h2 id="sys-hooks">{t('Provider webhooks')}</h2>
          <span className="small muted">{t('Signed, de-duplicated by provider and event id')}</span>
        </div>
        <div className="panel__body stack">
          <LoadError error={hooks.error} />
          {hooks.data ? (
            <>
              <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Webhook log')}>
                <table className="data-table admin-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('Received')}</th>
                      <th scope="col">{t('Provider')}</th>
                      <th scope="col">{t('Type')}</th>
                      <th scope="col">{t('Event id')}</th>
                      <th scope="col">{t('Result')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hooks.data.items.map((w) => (
                      <tr key={w.id}>
                        <td className="tabular small">{formatDateTime(w.receivedAt)}</td>
                        <td className="small">{w.provider}</td>
                        <td className="mono small">{w.type}</td>
                        <td className="mono small">{shortId(w.eventId)}</td>
                        <td className="small">
                          <span
                            className={`badge badge--${w.status === 'processed' ? 'success' : w.status === 'failed' ? 'danger' : 'neutral'}`}
                          >
                            {t(w.status)}
                          </span>
                          {w.error ? <span className="small muted block">{w.error}</span> : null}
                        </td>
                      </tr>
                    ))}
                    {hooks.data.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          {t('No webhooks received yet.')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <Pager page={hooks.data.page} pageSize={hooks.data.pageSize} total={hooks.data.total} onPage={setPage} />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
