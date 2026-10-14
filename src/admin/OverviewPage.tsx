import { Link } from 'react-router-dom';
import { MockBadge, StatusBadge } from '@/components/ui';
import { ORDER_STATUS_LABEL, ORDER_STATUSES, orderTone } from '@/domain/order';
import { formatDateTime } from '@/lib/format';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError, Stat } from './shared';
import { minutes, useLoad } from './lib';

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
      <AdminHead title="Overview" lead={data ? `Counted from the database at ${formatDateTime(data.generatedAt)}.` : undefined}>
        <MockBadge label="Sandbox data" />
      </AdminHead>
      <LoadError error={error} />
      {data ? (
        <>
          <div className="stat-grid">
            <Link to="/admin/orders?review=open" className="stat-link">
              <Stat
                label="Needs review"
                value={data.totals.needsReview}
                tone={data.totals.needsReview ? 'warn' : undefined}
                hint={`Oldest ${minutes(data.processing.oldestOpenReviewMinutes)}`}
              />
            </Link>
            <Link to="/admin/orders?status=ready_for_payout" className="stat-link">
              <Stat label="Awaiting payout" value={data.totals.awaitingPayout} />
            </Link>
            <Link to="/admin/orders?overdue=true" className="stat-link">
              <Stat
                label="Failed, refunding or overdue"
                value={data.totals.failedOrOverdue}
                tone={data.totals.failedOrOverdue ? 'danger' : undefined}
                hint={`${data.byStatus.failed} failed · ${data.byStatus.refund_pending} refunding`}
              />
            </Link>
            <Link to="/admin/orders?status=awaiting_deposit" className="stat-link">
              <Stat label="Awaiting deposit" value={data.totals.awaitingDeposit} />
            </Link>
            <Link to="/admin/orders?status=deposit_observed,confirming" className="stat-link">
              <Stat label="Confirming on-chain" value={data.totals.awaitingConfirmation} />
            </Link>
            <Link to="/admin/inbox?unread=true" className="stat-link">
              <Stat
                label="Unread conversations"
                value={data.totals.unreadConversations}
                hint={`${data.totals.openConversations} open`}
                tone={data.totals.unreadConversations ? 'warn' : undefined}
              />
            </Link>
            <Stat
              label="Completed (30 days)"
              value={data.processing.completedLast30Days}
              tone="success"
              hint={`Median ${minutes(data.processing.medianMinutesToComplete)} to complete`}
            />
            <Stat label="All orders" value={data.totals.total} />
          </div>

          <div className="admin-grid-2">
            <section className="panel" aria-labelledby="by-status">
              <div className="panel__head">
                <h2 id="by-status">Orders by status</h2>
              </div>
              <div className="panel__body">
                <table className="data-table admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Status</th>
                      <th scope="col" className="num">
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORDER_STATUSES.filter((s) => data.byStatus[s] > 0).map((s) => (
                      <tr key={s}>
                        <td>
                          <Link to={`/admin/orders?status=${s}`}>
                            <StatusBadge tone={orderTone(s)}>{ORDER_STATUS_LABEL[s]}</StatusBadge>
                          </Link>
                        </td>
                        <td className="num">{data.byStatus[s]}</td>
                      </tr>
                    ))}
                    {data.totals.total === 0 ? (
                      <tr>
                        <td colSpan={2} className="muted">
                          No orders yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel" aria-labelledby="created-7">
              <div className="panel__head">
                <h2 id="created-7">Orders created, last 7 days</h2>
              </div>
              <div className="panel__body">
                <ol className="bar-chart" aria-label="Orders created per day">
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
        <p className="muted">Loading…</p>
      ) : null}
    </div>
  );
}
