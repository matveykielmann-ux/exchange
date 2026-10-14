import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { MockBadge, StatusBadge } from '@/components/ui';
import { formatUsd } from '@/domain/money';
import {
  isOrderStatus,
  ORDER_STAGE_LABEL,
  ORDER_STAGES,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  orderStatusLabel,
  orderTone,
  type OrderStage,
} from '@/domain/order';
import { PAYOUT_METHODS, PAYOUT_ORDER, type PayoutMethodId } from '@/domain/payout';
import { formatAsset, formatDateTime } from '@/lib/format';
import type { QueueQuery } from '@/services/adminTypes';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError, Pager } from './shared';
import { useLoad } from './lib';
import { t } from '@/i18n';

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
  const stage = (p.get('stage') ?? '').split(',').filter((x): x is OrderStage => (ORDER_STAGES as readonly string[]).includes(x));
  const method = p.get('payoutMethod');
  return {
    q: p.get('q') ?? '',
    status,
    stage,
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
      <AdminHead title={t('Orders')} lead={t('Search by reference, customer email or name, deposit transaction hash or payout reference.')}>
        <MockBadge label={t('Sandbox data')} />
      </AdminHead>

      <div className="chip-row" role="group" aria-label={t('Pipeline stage')}>
        <button type="button" className="chip" aria-pressed={!query.stage?.length} onClick={() => set({ stage: null })}>
          {t('All stages')}
        </button>
        {ORDER_STAGES.map((st) => (
          <button
            key={st}
            type="button"
            className="chip"
            aria-pressed={query.stage?.length === 1 && query.stage[0] === st}
            onClick={() => set({ stage: st })}
          >
            {t(ORDER_STAGE_LABEL[st])}
          </button>
        ))}
      </div>

      <div className="chip-row" role="group" aria-label={t('Saved views')}>
        {PRESETS.map((p) => {
          const keys = [...params.keys()].filter((k) => k !== 'page');
          const active = keys.length === Object.keys(p.params).length && Object.entries(p.params).every(([k, v]) => params.get(k) === v);
          return (
            <button
              key={t(p.label)}
              type="button"
              className="chip"
              aria-pressed={active}
              onClick={() => setParams(new URLSearchParams(p.params))}
            >
              {t(p.label)}
            </button>
          );
        })}
      </div>

      <form className="filters" onSubmit={onSearch} role="search">
        <div className="field filters__search">
          <label className="field__label" htmlFor="q">
            {t('Search')}
          </label>
          <div className="input-with-button">
            <input
              id="q"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('CBX-…, email, name, tx hash')}
            />
            <button type="submit" className="btn btn--secondary" aria-label={t('Search')}>
              <Icon name="search" width={18} height={18} />
            </button>
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-status">
            {t('Status')}
          </label>
          <select
            id="f-status"
            className="select"
            value={query.status?.length === 1 ? query.status[0] : query.status?.length ? 'multi' : ''}
            onChange={(e) => set({ status: e.target.value || null })}
          >
            <option value="">{t('Any status')}</option>
            {query.status && query.status.length > 1 ? (
              <option value="multi" disabled>
                {query.status.map((s) => t(ORDER_STATUS_LABEL[s])).join(', ')}
              </option>
            ) : null}
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(ORDER_STATUS_LABEL[s])}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-method">
            {t('Payout')}
          </label>
          <select
            id="f-method"
            className="select"
            value={query.payoutMethod}
            onChange={(e) => set({ payoutMethod: e.target.value || null })}
          >
            <option value="">{t('Any method')}</option>
            {PAYOUT_ORDER.map((m) => (
              <option key={m} value={m}>
                {t(PAYOUT_METHODS[m].name)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-assigned">
            {t('Assigned')}
          </label>
          <select
            id="f-assigned"
            className="select"
            value={query.assigned}
            onChange={(e) => set({ assigned: e.target.value === 'any' ? null : e.target.value })}
          >
            <option value="any">{t('Anyone')}</option>
            <option value="me">{t('Me')}</option>
            <option value="unassigned">{t('Unassigned')}</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-sort">
            {t('Sort')}
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
            <option value="created_at:desc">{t('Newest first')}</option>
            <option value="created_at:asc">{t('Oldest first')}</option>
            <option value="updated_at:desc">{t('Recently updated')}</option>
            <option value="priority:desc">{t('Priority')}</option>
            <option value="net_cents:desc">{t('Largest payout')}</option>
            <option value="net_cents:asc">{t('Smallest payout')}</option>
          </select>
        </div>
        <label className="check filters__check" htmlFor="f-overdue">
          <input
            id="f-overdue"
            type="checkbox"
            checked={!!query.overdue}
            onChange={(e) => set({ overdue: e.target.checked ? 'true' : null })}
          />
          <span>{t('Overdue only')}</span>
        </label>
        <label className="check filters__check" htmlFor="f-review">
          <input
            id="f-review"
            type="checkbox"
            checked={query.review === 'open'}
            onChange={(e) => set({ review: e.target.checked ? 'open' : null })}
          />
          <span>{t('Open review')}</span>
        </label>
      </form>

      <LoadError error={error} />
      {data ? (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Orders')}>
            <table className="data-table admin-table">
              <caption className="visually-hidden">{t('Orders')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('Reference')}</th>
                  <th scope="col">{t('Stage')}</th>
                  <th scope="col">{t('Status')}</th>
                  <th scope="col">{t('Priority')}</th>
                  <th scope="col">{t('Customer')}</th>
                  <th scope="col" className="num">
                    {t('Amount')}
                  </th>
                  <th scope="col" className="num">
                    {t('Payout')}
                  </th>
                  <th scope="col">{t('Assigned')}</th>
                  <th scope="col">{t('Created')}</th>
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
                      <span className={`badge ${o.onHold ? 'badge--warn' : 'badge--info'}`}>{t(ORDER_STAGE_LABEL[o.stage])}</span>
                    </td>
                    <td>
                      <StatusBadge tone={orderTone(o.status)}>{t(orderStatusLabel(o.status, o.direction))}</StatusBadge>
                      {o.direction === 'buy' ? <span className="small muted block">{t('Buy · cash collection')}</span> : null}
                      {o.depositException ? (
                        <span className="small muted block">
                          {t('Exception:')} {o.depositException.replace('_', ' ')}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge badge--${PRIORITY_TONE[o.priority]}`}>{t(o.priority)}</span>
                    </td>
                    <td>
                      {o.customer.name || '—'}
                      <span className="small muted block">{o.customer.email}</span>
                    </td>
                    <td className="num">{formatAsset(o.amountAtomic, o.asset)}</td>
                    <td className="num">
                      {formatUsd(o.netCents)}
                      <span className="small muted block">
                        {o.direction === 'buy' ? t('Crypto transfer') : t(PAYOUT_METHODS[o.payoutMethod].name)}
                      </span>
                    </td>
                    <td className="small">
                      {o.assignedTo ? (o.assignedTo.email ?? t('Staff')) : <span className="muted">{t('Unassigned')}</span>}
                    </td>
                    <td className="small tabular">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="muted">
                      {t('No orders match these filters.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />
        </>
      ) : !error ? (
        <p className="muted">{t('Loading…')}</p>
      ) : null}
    </div>
  );
}
