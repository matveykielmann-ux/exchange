import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { MockBadge, StatusBadge } from '@/components/ui';
import { formatUsd } from '@/domain/money';
import { isOrderStatus, ORDER_STATUS_LABEL, ORDER_STATUSES, orderTone, type OrderStatus } from '@/domain/order';
import { PAYOUT_METHODS, PAYOUT_ORDER, type PayoutMethodId } from '@/domain/payout';
import { formatAsset, formatDateTime } from '@/lib/format';
import type { QueueQuery } from '@/services/adminTypes';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError, Pager } from './shared';
import { useLoad } from './lib';

const PRIORITY_TONE = { high: 'danger', medium: 'warn', low: 'neutral' } as const;

const PRESETS: { label: string; params: Record<string, string> }[] = [
  { label: 'All', params: {} },
  { label: 'Needs action', params: { status: 'compliance_review,ready_for_payout,failed,refund_pending', sort: 'priority' } },
  { label: 'Open reviews', params: { review: 'open' } },
  { label: 'Assigned to me', params: { assigned: 'me' } },
  { label: 'Overdue', params: { overdue: 'true' } },
];

function readQuery(p: URLSearchParams): QueueQuery {
  const status = (p.get('status') ?? '').split(',').filter(isOrderStatus);
  const method = p.get('payoutMethod');
  return {
    q: p.get('q') ?? '',
    status,
    payoutMethod: method && Object.hasOwn(PAYOUT_METHODS, method) ? (method as PayoutMethodId) : '',
    review: p.get('review') === 'open' ? 'open' : 'any',
    assigned: p.get('assigned') === 'me' ? 'me' : p.get('assigned') === 'unassigned' ? 'unassigned' : 'any',
    overdue: p.get('overdue') === 'true',
    sort: (['created_at', 'updated_at', 'net_cents', 'priority'] as const).find((s) => s === p.get('sort')) ?? 'created_at',
    dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(p.get('page')) || 1),
    pageSize: 25,
  };
}

/** Order queue with search, filters, sorting and pagination. Filters live in the URL so a view can be shared. */
export function QueuePage() {
  const { admin } = useServices();
  const [params, setParams] = useSearchParams();
  const query = readQuery(params);
  const key = params.toString();
  const { data, error, reload } = useLoad(() => admin.queue(query), [key]);
  useLiveEvents((e) => {
    if (e.type === 'order.updated') reload();
  });
  const [search, setSearch] = useState(query.q ?? '');

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    set({ q: search.trim() || null });
  };

  return (
    <div className="stack stack--lg">
      <AdminHead title="Orders" lead="Search by reference, customer email or name, deposit transaction hash or payout reference.">
        <MockBadge label="Sandbox data" />
      </AdminHead>

      <div className="chip-row" role="group" aria-label="Saved views">
        {PRESETS.map((p) => {
          const keys = [...params.keys()].filter((k) => k !== 'page');
          const active = keys.length === Object.keys(p.params).length && Object.entries(p.params).every(([k, v]) => params.get(k) === v);
          return (
            <button
              key={p.label}
              type="button"
              className="chip"
              aria-pressed={active}
              onClick={() => setParams(new URLSearchParams(p.params))}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <form className="filters" onSubmit={onSearch} role="search">
        <div className="field filters__search">
          <label className="field__label" htmlFor="q">
            Search
          </label>
          <div className="input-with-button">
            <input
              id="q"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ARC-…, email, name, tx hash"
            />
            <button type="submit" className="btn btn--secondary" aria-label="Search">
              <Icon name="search" width={18} height={18} />
            </button>
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-status">
            Status
          </label>
          <select
            id="f-status"
            className="select"
            value={query.status?.length === 1 ? query.status[0] : query.status?.length ? 'multi' : ''}
            onChange={(e) => set({ status: e.target.value || null })}
          >
            <option value="">Any status</option>
            {query.status && query.status.length > 1 ? (
              <option value="multi" disabled>
                {query.status.map((s) => ORDER_STATUS_LABEL[s]).join(', ')}
              </option>
            ) : null}
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-method">
            Payout
          </label>
          <select
            id="f-method"
            className="select"
            value={query.payoutMethod}
            onChange={(e) => set({ payoutMethod: e.target.value || null })}
          >
            <option value="">Any method</option>
            {PAYOUT_ORDER.map((m) => (
              <option key={m} value={m}>
                {PAYOUT_METHODS[m].name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-assigned">
            Assigned
          </label>
          <select
            id="f-assigned"
            className="select"
            value={query.assigned}
            onChange={(e) => set({ assigned: e.target.value === 'any' ? null : e.target.value })}
          >
            <option value="any">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-sort">
            Sort
          </label>
          <select
            id="f-sort"
            className="select"
            value={`${query.sort}:${query.dir}`}
            onChange={(e) => {
              const [sort, dir] = e.target.value.split(':');
              set({ sort: sort ?? null, dir: dir ?? null });
            }}
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="updated_at:desc">Recently updated</option>
            <option value="priority:desc">Priority</option>
            <option value="net_cents:desc">Largest payout</option>
            <option value="net_cents:asc">Smallest payout</option>
          </select>
        </div>
        <label className="check filters__check" htmlFor="f-overdue">
          <input
            id="f-overdue"
            type="checkbox"
            checked={!!query.overdue}
            onChange={(e) => set({ overdue: e.target.checked ? 'true' : null })}
          />
          <span>Overdue only</span>
        </label>
        <label className="check filters__check" htmlFor="f-review">
          <input
            id="f-review"
            type="checkbox"
            checked={query.review === 'open'}
            onChange={(e) => set({ review: e.target.checked ? 'open' : null })}
          />
          <span>Open review</span>
        </label>
      </form>

      <LoadError error={error} />
      {data ? (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Orders">
            <table className="data-table admin-table">
              <caption className="visually-hidden">Orders</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Status</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Customer</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col" className="num">
                    Payout
                  </th>
                  <th scope="col">Assigned</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <th scope="row">
                      <Link to={`/admin/orders/${o.id}`} className="mono">
                        {o.reference}
                      </Link>
                      {o.source === 'sandbox' ? <MockBadge label="SBX" force /> : null}
                    </th>
                    <td>
                      <StatusBadge tone={orderTone(o.status)}>{ORDER_STATUS_LABEL[o.status as OrderStatus]}</StatusBadge>
                      {o.depositException ? (
                        <span className="small muted block">Exception: {o.depositException.replace('_', ' ')}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge badge--${PRIORITY_TONE[o.priority]}`}>{o.priority}</span>
                    </td>
                    <td>
                      {o.customer.name || '—'}
                      <span className="small muted block">{o.customer.email}</span>
                    </td>
                    <td className="num">{formatAsset(o.amountAtomic, o.asset)}</td>
                    <td className="num">
                      {formatUsd(o.netCents)}
                      <span className="small muted block">{PAYOUT_METHODS[o.payoutMethod].name}</span>
                    </td>
                    <td className="small">{o.assignedTo ? (o.assignedTo.email ?? 'Staff') : <span className="muted">Unassigned</span>}</td>
                    <td className="small tabular">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      No orders match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />
        </>
      ) : !error ? (
        <p className="muted">Loading…</p>
      ) : null}
    </div>
  );
}
