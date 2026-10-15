import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/ui';
import { ORDER_STATUS_LABEL, ORDER_STATUSES, orderTone } from '@/domain/order';
import { formatDateTime } from '@/lib/format';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError, Stat } from './shared';
import { minutes, useLoad } from './lib';
import { t } from '@/i18n';

/** Operations overview: every figure is counted by the server from stored orders and conversations. */
export function OverviewPage() {
  const { admin } = useServices();
  const { data, error, reload } = useLoad(() => admin.overview(), []);
  useLiveEvents((e) => {
    if (e.type === 'order.updated' || e.type === 'conversation.updated') reload();
  });

  const peak = data ? Math.max(1, ...data.createdLast7Days.map((d) => d.n)) : 1;
  return (
    <div className="stack stack--lg">
      <AdminHead title={t('Overview')} lead={data ? t('Counted from the database at {0}.', [formatDateTime(data.generatedAt)]) : undefined} />
      <LoadError error={error} />
      {data ? (
        <>
          <div className="stat-grid">
            <Link to="/admin/orders?review=open" className="stat-link">
              <Stat
                label={t('Needs review')}
                value={data.totals.needsReview}
                tone={data.totals.needsReview ? 'warn' : undefined}
                hint={t('Oldest {0}', [minutes(data.processing.oldestOpenReviewMinutes)])}
              />
            </Link>
            <Link to="/admin/orders?status=ready_for_payout" className="stat-link">
              <Stat label={t('Awaiting payout')} value={data.totals.awaitingPayout} />
            </Link>
            <Link to="/admin/orders?overdue=true" className="stat-link">
              <Stat
                label={t('Failed, refunding or overdue')}
                value={data.totals.failedOrOverdue}
                tone={data.totals.failedOrOverdue ? 'danger' : undefined}
                hint={t('{0} failed · {1} refunding', [data.byStatus.failed, data.byStatus.refund_pending])}
              />
            </Link>
            <Link to="/admin/orders?status=awaiting_deposit" className="stat-link">
              <Stat label={t('Awaiting deposit')} value={data.totals.awaitingDeposit} />
            </Link>
            <Link to="/admin/orders?status=deposit_observed,confirming" className="stat-link">
              <Stat label={t('Confirming on-chain')} value={data.totals.awaitingConfirmation} />
            </Link>
            <Link to="/admin/inbox?unread=true" className="stat-link">
              <Stat
                label={t('Unread conversations')}
                value={data.totals.unreadConversations}
                hint={t('{0} open', [data.totals.openConversations])}
                tone={data.totals.unreadConversations ? 'warn' : undefined}
              />
            </Link>
            <Stat
              label={t('Completed (30 days)')}
              value={data.processing.completedLast30Days}
              tone="success"
              hint={t('Median {0} to complete', [minutes(data.processing.medianMinutesToComplete)])}
            />
            <Stat label={t('All orders')} value={data.totals.total} />
          </div>

          <div className="admin-grid-2">
            <section className="panel" aria-labelledby="by-status">
              <div className="panel__head">
                <h2 id="by-status">{t('Orders by status')}</h2>
              </div>
              <div className="panel__body">
                <table className="data-table admin-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('Status')}</th>
                      <th scope="col" className="num">
                        {t('Orders')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORDER_STATUSES.filter((s) => data.byStatus[s] > 0).map((s) => (
                      <tr key={s}>
                        <td>
                          <Link to={`/admin/orders?status=${s}`}>
                            <StatusBadge tone={orderTone(s)}>{t(ORDER_STATUS_LABEL[s])}</StatusBadge>
                          </Link>
                        </td>
                        <td className="num">{data.byStatus[s]}</td>
                      </tr>
                    ))}
                    {data.totals.total === 0 ? (
                      <tr>
                        <td colSpan={2} className="muted">
                          {t('No orders yet.')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel" aria-labelledby="created-7">
              <div className="panel__head">
                <h2 id="created-7">{t('Orders created, last 7 days')}</h2>
              </div>
              <div className="panel__body">
                <ol className="bar-chart" aria-label={t('Orders created per day')}>
                  {data.createdLast7Days.map((d) => (
                    <li key={d.day}>
                      <span className="bar-chart__bar" style={{ height: `${(d.n / peak) * 100}%` }} aria-hidden="true" />
                      <span className="bar-chart__value">{d.n}</span>
                      <span className="bar-chart__label">{d.day.slice(5)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        </>
      ) : !error ? (
        <p className="muted">{t('Loading…')}</p>
      ) : null}
    </div>
  );
}
