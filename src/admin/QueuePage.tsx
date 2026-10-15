import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { formatUsd } from '@/domain/money';
import {
  buyPayIn,
  isOrderStatus,
  ORDER_STAGE_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  orderStatusLabel,
  type OrderStatus,
} from '@/domain/order';
import { PAYOUT_METHODS, PAYOUT_ORDER, type PayoutMethodId } from '@/domain/payout';
import { t } from '@/i18n';
import { formatAsset, formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { Overview, QueueItem, QueueQuery } from '@/services/adminTypes';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { OrderCard } from './OrderCard';
import { queueNextStep } from './orderActions';
import { AdminHead, LoadError, Pager } from './shared';
import { useLoad } from './lib';

/** The five views at the top of the queue. Each is a filter the server applies; the counts come from the same data. */
const VIEWS: { key: string; label: string; params: Record<string, string>; count(o: Overview): number; tone?: 'warn' }[] = [
  { key: 'attention', label: 'Needs action', params: { attention: 'true' }, count: (o) => o.totals.needsAction, tone: 'warn' },
  {
    key: 'payment',
    label: 'Awaiting payment',
    params: { status: 'created,awaiting_deposit' },
    count: (o) => o.byStatus.created + o.byStatus.awaiting_deposit,
  },
  {
    key: 'progress',
    label: 'Orders in progress',
    params: { status: 'deposit_observed,confirming,deposit_confirmed,payout_submitted,payout_processing' },
    count: (o) =>
      o.byStatus.deposit_observed +
      o.byStatus.confirming +
      o.byStatus.deposit_confirmed +
      o.byStatus.payout_submitted +
      o.byStatus.payout_processing,
  },
  { key: 'done', label: 'Completed orders', params: { status: 'completed' }, count: (o) => o.byStatus.completed },
  {
    key: 'rejected',
    label: 'Rejected or cancelled',
    params: { status: 'rejected,cancelled,expired,refund_pending,refunded' },
    count: (o) => o.byStatus.rejected + o.byStatus.cancelled + o.byStatus.expired + o.byStatus.refund_pending + o.byStatus.refunded,
  },
];
const VIEW_KEYS = ['attention', 'status'];

function readQuery(p: URLSearchParams): QueueQuery {
  const status = (p.get('status') ?? '').split(',').filter(isOrderStatus);
  const method = p.get('payoutMethod');
  return {
    q: p.get('q') ?? '',
    status,
    attention: p.get('attention') === 'true',
    payoutMethod: method && Object.hasOwn(PAYOUT_METHODS, method) ? (method as PayoutMethodId) : '',
    review: p.get('review') === 'open' ? 'open' : 'any',
    assigned: p.get('assigned') === 'me' ? 'me' : p.get('assigned') === 'unassigned' ? 'unassigned' : 'any',
    overdue: p.get('overdue') === 'true',
    // Default: orders waiting on a person first, then the rest by latest update.
    sort: (['created_at', 'updated_at', 'net_cents', 'attention'] as const).find((s) => s === p.get('sort')) ?? 'attention',
    dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(p.get('page')) || 1),
    pageSize: 25,
  };
}

/** "2,500.00 USDC" → "$2,492.75": what the customer sends and what they receive. */
function amounts(o: QueueItem) {
  return o.direction === 'buy'
    ? { sends: formatUsd(o.grossCents), receives: formatAsset(o.amountAtomic, o.asset), pair: `USD → ${o.asset}` }
    : { sends: formatAsset(o.amountAtomic, o.asset), receives: formatUsd(o.netCents), pair: `${o.asset} → USD` };
}

/**
 * The CRM home: every order, those waiting on a person first. A row opens the
 * order card in a side panel; filters and the open order live in the URL.
 */
export function QueuePage() {
  useDocumentTitle('Orders');
  const { admin } = useServices();
  const [params, setParams] = useSearchParams();
  const query = readQuery(params);
  const key = [...params.entries()].filter(([k]) => k !== 'open').join('&');
  const { data, error, reload } = useLoad(() => admin.queue(query), [key]);
  const overview = useLoad(() => admin.overview(), []);
  useLiveEvents((e) => {
    if (e.type === 'order.updated') {
      reload();
      overview.reload();
    }
  });
  const [search, setSearch] = useState(query.q ?? '');
  const openId = params.get('open');

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const activeView = VIEWS.find((v) => Object.entries(v.params).every(([k, val]) => params.get(k) === val))?.key ?? null;
  const advancedCount = ['payoutMethod', 'assigned', 'overdue', 'review'].filter((k) => params.get(k)).length;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    set({ q: search.trim() || null });
  };

  return (
    <div className="stack stack--lg">
      <AdminHead title={t('Orders')} lead={t('Orders waiting on you come first. Open an order to see it and act on it.')} />

      <div className="kpi-row" role="group" aria-label={t('Quick filters')}>
        <button
          type="button"
          className="kpi-chip"
          aria-pressed={!activeView && !params.get('status')}
          onClick={() => {
            const next = new URLSearchParams(params);
            VIEW_KEYS.forEach((k) => next.delete(k));
            next.delete('page');
            setParams(next);
          }}
        >
          <span className="kpi-chip__label">{t('All')}</span>
          <span className="kpi-chip__value tabular">{overview.data?.totals.total ?? '—'}</span>
        </button>
        {VIEWS.map((v) => {
          const n = overview.data ? v.count(overview.data) : null;
          return (
            <button
              key={v.key}
              type="button"
              className={`kpi-chip${v.tone && n ? ` kpi-chip--${v.tone}` : ''}`}
              aria-pressed={activeView === v.key}
              onClick={() => {
                const next = new URLSearchParams(params);
                VIEW_KEYS.forEach((k) => next.delete(k));
                next.delete('page');
                for (const [k, val] of Object.entries(v.params)) next.set(k, val);
                setParams(next);
              }}
            >
              <span className="kpi-chip__label">{t(v.label)}</span>
              <span className="kpi-chip__value tabular">{n ?? '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="queue-tools">
        <form className="queue-search" onSubmit={onSearch} role="search">
          <label className="visually-hidden" htmlFor="q">
            {t('Search')}
          </label>
          <div className="input-with-button">
            <input
              id="q"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Order number, customer email or name')}
            />
            <button type="submit" className="btn btn--secondary" aria-label={t('Search')}>
              <Icon name="search" width={18} height={18} />
            </button>
          </div>
        </form>
        <details className="queue-filters" open={advancedCount > 0 || undefined}>
          <summary>
            {t('Filters')}
            {advancedCount ? ` · ${advancedCount}` : ''}
          </summary>
          <div className="filters">
            <div className="field">
              <label className="field__label" htmlFor="f-status">
                {t('Status')}
              </label>
              <select
                id="f-status"
                className="select"
                value={query.status?.length === 1 ? query.status[0] : ''}
                onChange={(e) => set({ status: e.target.value || null, attention: null })}
              >
                <option value="">{t('Any status')}</option>
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
                  set({ sort: sort === 'attention' ? null : (sort ?? null), dir: dir === 'desc' ? null : (dir ?? null) });
                }}
              >
                <option value="attention:desc">{t('Needs action first')}</option>
                <option value="created_at:desc">{t('Newest first')}</option>
                <option value="created_at:asc">{t('Oldest first')}</option>
                <option value="updated_at:desc">{t('Recently updated')}</option>
                <option value="net_cents:desc">{t('Largest payout')}</option>
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
          </div>
        </details>
      </div>

      <LoadError error={error} />
      {data ? (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Orders')}>
            <table className="data-table admin-table queue-table data-table--stack">
              <caption className="visually-hidden">{t('Orders')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('Order')}</th>
                  <th scope="col">{t('Customer')}</th>
                  <th scope="col">{t('Exchange')}</th>
                  <th scope="col" className="num">
                    {t('Amount')}
                  </th>
                  <th scope="col">{t('Status')}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t('Action')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => {
                  const a = amounts(o);
                  const step = queueNextStep(o);
                  return (
                    <tr key={o.id} className={step.urgent ? 'is-urgent' : undefined}>
                      <th scope="row">
                        <button type="button" className="link-button mono" onClick={() => set({ open: o.id })}>
                          {o.reference}
                        </button>
                        <span className="small muted block tabular">{formatDateTime(o.createdAt)}</span>
                      </th>
                      <td data-label={t('Customer')}>
                        {o.customer.name || '—'}
                        <span className="small muted block">{o.customer.email}</span>
                      </td>
                      <td data-label={t('Exchange')}>
                        {a.pair}
                        <span className="small muted block">
                          {o.direction === 'buy'
                            ? o.payoutMethod === 'wire'
                              ? t('Bank wire')
                              : t('Cash by courier')
                            : t(PAYOUT_METHODS[o.payoutMethod].name)}
                        </span>
                      </td>
                      <td data-label={t('Amount')} className="num tabular">
                        {a.sends}
                        <span className="small muted block">→ {a.receives}</span>
                      </td>
                      <td data-label={t('Status')}>
                        <StatusCell
                          status={o.status}
                          onHold={o.onHold}
                          direction={o.direction}
                          wire={buyPayIn(o.direction, o.payoutMethod) === 'wire'}
                          stage={t(ORDER_STAGE_LABEL[o.stage])}
                        />
                      </td>
                      <td className="queue-table__action">
                        <button
                          type="button"
                          className={`btn ${step.urgent ? '' : 'btn--ghost'}`}
                          onClick={() => set({ open: o.id })}
                          aria-label={`${t(step.label)} · ${o.reference}`}
                        >
                          {t(step.label)}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
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

      <Sheet open={!!openId} onOpenChange={(v) => (v ? undefined : set({ open: null }))}>
        <SheetContent side="right" className="order-sheet" aria-describedby={undefined}>
          <SheetTitle className="visually-hidden">{t('Order')}</SheetTitle>
          {openId ? <OrderCard id={openId} headingLevel={2} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusCell({
  status,
  onHold,
  direction,
  wire,
  stage,
}: {
  status: OrderStatus;
  onHold: boolean;
  direction: 'sell' | 'buy';
  wire: boolean;
  stage: string;
}) {
  const tone =
    onHold || status === 'failed'
      ? 'warn'
      : status === 'completed'
        ? 'success'
        : ['rejected', 'cancelled', 'expired', 'refunded'].includes(status)
          ? 'neutral'
          : 'info';
  return (
    <>
      <span className={`badge badge--${tone}`}>{stage}</span>
      <span className="small muted block">{t(orderStatusLabel(status, direction, wire ? 'wire' : undefined))}</span>
    </>
  );
}
