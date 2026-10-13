import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AssetMark, MockBadge, Notice, PageHeader, StatusBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatUsd } from '@/domain/money';
import { ORDER_STATUS_LABEL, orderTone } from '@/domain/order';
import { errorMessage } from '@/lib/errors';
import { formatAsset, formatDateTime } from '@/lib/format';
import type { OrderSummary, Page } from '@/services/types';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';

/** Order history for the signed-in customer, newest first, from the server. */
export function OrdersPage() {
  useDocumentTitle('Orders');
  const { orders } = useServices();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState<Page<OrderSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    orders
      .list(page)
      .then((p) => {
        setData(p);
        setError(null);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [orders, page]);
  useEffect(load, [load]);
  useLiveEvents((e) => {
    if (e.type === 'order.updated') load();
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageHeader eyebrow="Account" title="Orders" lead="Every exchange on your account, newest first.">
        <div className="row">
          <MockBadge label="Sandbox orders" />
        </div>
      </PageHeader>
      <div className="container section--tight">
        {error ? (
          <Notice tone="danger" title="Orders could not be loaded." role="alert">
            {error}
          </Notice>
        ) : null}
        {data === null ? (
          error ? null : (
            <p className="muted">Loading…</p>
          )
        ) : data.items.length === 0 ? (
          <div className="stack" style={{ maxWidth: 520 }}>
            <h2 className="title">No orders yet</h2>
            <p>When you confirm an exchange, it appears here with its status and receipt.</p>
            <div>
              <Link className="btn" to="/exchange">
                Start an exchange
              </Link>
            </div>
          </div>
        ) : (
          <div className="stack">
            <ul className="tx-list">
              {data.items.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`}>
                    <AssetMark code={o.asset} />
                    <span className="stack" style={{ gap: 4 }}>
                      <span className="tx-list__title">
                        Sell {formatAsset(o.amountAtomic, o.asset)} <span className="muted small mono">{o.reference}</span>
                      </span>
                      <span className="row small muted" style={{ gap: 8 }}>
                        <StatusBadge tone={orderTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</StatusBadge>
                        <span>{formatDateTime(o.createdAt)}</span>
                      </span>
                    </span>
                    <span className="tx-list__amount">{formatUsd(o.netCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {pages > 1 ? (
              <nav className="pager" aria-label="Pages">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={page <= 1}
                  onClick={() => setParams({ page: String(page - 1) })}
                >
                  Previous
                </button>
                <span className="small muted">
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={page >= pages}
                  onClick={() => setParams({ page: String(page + 1) })}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
