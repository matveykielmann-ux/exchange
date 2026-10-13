import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MockBadge, PageHeader, StatusBadge, AssetMark } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatUsd } from '@/domain/money';
import { STATUS_LABEL, statusTone, type Transaction } from '@/domain/transaction';
import { formatAsset, formatDateTime } from '@/lib/format';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';

export function TransactionsPage() {
  useDocumentTitle('Activity');
  const user = useUser();
  const { transactions } = useServices();
  const [list, setList] = useState<Transaction[] | null>(null);

  useEffect(() => {
    if (user) transactions.list(user.email).then(setList);
  }, [transactions, user]);

  return (
    <>
      <PageHeader eyebrow="Account" title="Activity" lead="Every exchange on this demo account, newest first.">
        <div className="row">
          <MockBadge label="Demo data" />
        </div>
      </PageHeader>
      <div className="container section--tight">
        {list === null ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <div className="stack" style={{ maxWidth: 520 }}>
            <h2 className="title">No exchanges yet</h2>
            <p>When you confirm an exchange, it appears here with its status and receipt.</p>
            <div>
              <Link className="btn" to="/exchange">
                Start an exchange
              </Link>
            </div>
          </div>
        ) : (
          <ul className="tx-list">
            {list.map((tx) => (
              <li key={tx.id}>
                <Link to={`/transactions/${tx.id}`}>
                  <AssetMark code={tx.quote.asset} />
                  <span className="stack" style={{ gap: 4 }}>
                    <span className="tx-list__title">Sold {formatAsset(tx.quote.amountAtomic, tx.quote.asset)}</span>
                    <span className="row small muted" style={{ gap: 8 }}>
                      <StatusBadge tone={statusTone(tx.status)}>{STATUS_LABEL[tx.status]}</StatusBadge>
                      <span>{formatDateTime(tx.createdAt)}</span>
                    </span>
                  </span>
                  <span className="tx-list__amount">{formatUsd(tx.quote.netCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
