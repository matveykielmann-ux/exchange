import { useState } from 'react';
import { MockBadge } from '@/components/ui';
import { NETWORKS } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { formatDateTime } from '@/lib/format';
import { useServices } from '@/state/services';
import { AdminHead, LoadError, Pager } from './shared';
import { useLoad } from './lib';

const TIMING: Record<string, string> = { this_week: 'This week', this_month: 'This month', exploring: 'Exploring' };

/** Requests from the large-transaction desk form, newest first. */
export function DeskPage() {
  const { admin } = useServices();
  const [page, setPage] = useState(1);
  const { data, error } = useLoad(() => admin.largeDesk(page), [page]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="stack stack--lg">
      <AdminHead
        title="Large-transaction desk"
        lead="Requests for individually priced large orders. Contact details are shown to staff so the desk can reply."
      >
        <MockBadge label="Sandbox data" />
      </AdminHead>
      <LoadError error={error} />
      {data ? (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Desk requests">
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Received</th>
                  <th scope="col">Asset</th>
                  <th scope="col" className="num">
                    Approx. value
                  </th>
                  <th scope="col">Requester</th>
                  <th scope="col">Timing</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      <button
                        type="button"
                        className="link-button mono"
                        aria-expanded={open === r.id}
                        onClick={() => setOpen(open === r.id ? null : r.id)}
                      >
                        {r.reference}
                      </button>
                      {open === r.id && r.notes ? <p className="small desk-notes">{r.notes}</p> : null}
                    </th>
                    <td className="tabular small">{formatDateTime(r.createdAt)}</td>
                    <td className="small">
                      {r.asset} · {NETWORKS[r.network]?.name ?? r.network}
                    </td>
                    <td className="num">{formatUsd(BigInt(r.approximateUsdCents), { whole: true })}</td>
                    <td className="small">
                      {r.fullName} ({r.customerType})<span className="muted block">{r.email}</span>
                      <span className="muted block">{r.phone}</span>
                    </td>
                    <td className="small">{TIMING[r.timing] ?? r.timing}</td>
                    <td>
                      <span className="badge badge--neutral">{r.status}</span>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No requests yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      ) : !error ? (
        <p className="muted">Loading…</p>
      ) : null}
    </div>
  );
}
