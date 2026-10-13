import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { QuoteBreakdown } from '@/components/QuoteBreakdown';
import { EventLog, StatusRail } from '@/components/TransactionProgress';
import { MockBadge, Notice, StatusBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { PAYOUT_METHODS } from '@/domain/payout';
import { Countdown } from '@/components/Countdown';
import { useExpired } from '@/lib/useExpired';
import {
  allowedEvents,
  canApply,
  isPreviewDepositAddress,
  STATUS_LABEL,
  statusTone,
  TERMINAL_STATUSES,
  timelineFor,
  type Transaction,
  type TransactionEvent,
} from '@/domain/transaction';
import { errorMessage } from '@/lib/errors';
import { formatAsset, formatDateTime } from '@/lib/format';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import type { TransactionSimulator } from '@/services/types';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} width={16} height={16} />
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

function MockControls({
  tx,
  simulator,
  onEvent,
  busy,
}: {
  tx: Transaction;
  simulator: TransactionSimulator;
  onEvent: (e: TransactionEvent) => void;
  busy: boolean;
}) {
  const next = simulator.nextEvent(tx);
  const allowed = allowedEvents(tx.status);
  const alternates: Array<{ label: string; event: TransactionEvent }> = [];
  if (allowed.includes('WINDOW_EXPIRED')) alternates.push({ label: 'Simulate deposit window expiring', event: { type: 'WINDOW_EXPIRED' } });
  if (allowed.includes('REVIEW_REQUIRED'))
    alternates.push({ label: 'Simulate a compliance hold', event: { type: 'REVIEW_REQUIRED', reason: 'Simulated manual review.' } });
  if (allowed.includes('REVIEW_REJECTED'))
    alternates.push({ label: 'Simulate review not cleared', event: { type: 'REVIEW_REJECTED', reason: 'Simulated outcome.' } });
  if (allowed.includes('PAYOUT_FAILED'))
    alternates.push({
      label: 'Simulate payout returned by bank',
      event: { type: 'PAYOUT_FAILED', reason: 'Simulated return: account closed.' },
    });

  if (TERMINAL_STATUSES.has(tx.status)) return null;
  return (
    <section className="mock-controls" aria-labelledby="mock-controls-title">
      <h2 id="mock-controls-title">
        <MockBadge label="Mock controls" /> Simulate what happens next
      </h2>
      <p className="small muted">
        These buttons stand in for blockchain monitoring and payout-provider events. They exist only in the preview.
      </p>
      <div className="row">
        {next ? (
          <button type="button" className="btn" disabled={busy} onClick={() => onEvent(next)}>
            Advance: {next.type === 'CONFIRMATION' ? 'add confirmations' : next.type.toLowerCase().replace(/_/g, ' ')}
          </button>
        ) : null}
        {alternates.map((a) => (
          <button key={a.label} type="button" className="btn btn--secondary" disabled={busy} onClick={() => onEvent(a.event)}>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function TransactionPage() {
  const { id = '' } = useParams();
  const user = useUser();
  const services = useServices();
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;
  const [tx, setTx] = useState<Transaction | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(tx ? `Exchange ${tx.id}` : 'Exchange');

  const load = useCallback(() => {
    if (!user) return;
    services.transactions.get(id, user.email).then(setTx);
  }, [services, id, user]);
  useEffect(load, [load]);
  // When the deposit window closes, re-read: the service expires the transaction.
  const windowClosed = useExpired(tx?.status === 'awaiting_deposit' ? tx.depositDeadline : null);
  useEffect(() => {
    if (windowClosed) load();
  }, [windowClosed, load]);

  if (tx === undefined)
    return (
      <div className="container flow">
        <p className="muted">Loading…</p>
      </div>
    );
  if (tx === null || !user)
    return (
      <div className="container flow stack">
        <h1 className="display-l">Exchange not found</h1>
        <p>It may belong to a different account, or the link is wrong.</p>
        <p>
          <Link to="/transactions">Back to activity</Link>
        </p>
      </div>
    );

  const tone = statusTone(tx.status);
  const network = NETWORKS[tx.quote.network];
  const steps = timelineFor(tx);

  async function dispatch(event: TransactionEvent) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      setTx(await services.transactions.dispatch(tx!.id, user.email, event));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container flow">
      <div className="flow__head">
        <p className="eyebrow">
          <Link to="/transactions">Activity</Link> <span aria-hidden="true">/</span> <span className="mono">{tx.id}</span>
        </p>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="display-l">{STATUS_LABEL[tx.status]}</h1>
            <p className="muted">
              Selling {formatAsset(tx.quote.amountAtomic, tx.quote.asset)} for {formatUsd(tx.quote.netCents)} · created{' '}
              {formatDateTime(tx.createdAt)}
            </p>
          </div>
          <div className="row">
            <StatusBadge tone={tone}>{STATUS_LABEL[tx.status]}</StatusBadge>
            <MockBadge label="Mock transaction" />
          </div>
        </div>
      </div>

      {justCreated && tx.status === 'awaiting_deposit' ? (
        <div style={{ marginBottom: 24 }}>
          <Notice tone="info" title="Exchange confirmed (simulated)" role="status">
            <p>
              Your rate is held for deposits that arrive in the window below. The deposit address is a placeholder. Do not send funds to it.
            </p>
          </Notice>
        </div>
      ) : null}

      <div className="flow__grid">
        <div className="flow__main">
          {tx.status === 'awaiting_deposit' ? (
            <section className="stack" aria-labelledby="deposit-title">
              <h2 id="deposit-title" className="flow__step-title">
                Send {formatAsset(tx.quote.amountAtomic, tx.quote.asset)}
              </h2>
              <div className="deposit-box">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>Network: {networkLabel(tx.quote.asset, tx.quote.network)}</strong>
                  <Countdown to={tx.depositDeadline} prefix="Window closes in" ended="Window closed" />
                </div>
                {isPreviewDepositAddress(tx.depositAddress) ? (
                  <div className="deposit-box__address">
                    <code>{tx.depositAddress}</code>
                    <CopyButton value={tx.depositAddress} label="Copy" />
                  </div>
                ) : (
                  // Defense in depth: never display something that could be a real address in the preview.
                  <Notice tone="danger" title="Deposit address withheld" role="alert">
                    <p>The stored address is not a preview placeholder, so it is not shown. Do not send funds.</p>
                  </Notice>
                )}
                <p className="small">
                  <strong>Placeholder address. Do not send funds.</strong> It is deliberately invalid on every network. A live service would
                  show a real, single-use address here.
                </p>
              </div>
              <Notice tone="warn" title={`Only send ${tx.quote.asset} on ${network.name}`}>
                <p>
                  Sending a different asset, or using a different network, may result in permanent loss. Send exactly the amount shown; a
                  different amount needs a new quote.
                </p>
              </Notice>
            </section>
          ) : null}

          <section className="panel" aria-labelledby="progress-title">
            <div className="panel__head">
              <h2 id="progress-title">Progress</h2>
              <span className="small muted">Updated {formatDateTime(tx.updatedAt)}</span>
            </div>
            <div className="panel__body">
              <StatusRail steps={steps} />
            </div>
          </section>

          {tx.status === 'compliance_review' ? (
            <Notice tone="warn" title="Held for review">
              <p>Some exchanges need a manual check before payout. A live service would tell you if anything is needed from you.</p>
            </Notice>
          ) : null}
          {tx.status === 'payout_failed' ? (
            <Notice tone="danger" title="Your bank returned the payout">
              <p>Check your payout destination. The payout can be retried once the destination is confirmed.</p>
            </Notice>
          ) : null}

          {error ? <Notice tone="danger" title={error} role="alert" /> : null}
          {services.simulator ? <MockControls tx={tx} simulator={services.simulator} busy={busy} onEvent={dispatch} /> : null}

          {canApply(tx.status, 'CUSTOMER_CANCELLED') ? (
            <div>
              <button type="button" className="btn btn--danger" disabled={busy} onClick={() => dispatch({ type: 'CUSTOMER_CANCELLED' })}>
                Cancel this exchange
              </button>
              <p className="small muted" style={{ marginTop: 8 }}>
                Only before you send funds.
              </p>
            </div>
          ) : null}

          <section aria-labelledby="log-title" className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 id="log-title" className="title">
                Event log
              </h2>
              <MockBadge label="Simulated events" />
            </div>
            <EventLog log={tx.log} />
          </section>
        </div>

        <aside className="flow__aside flow__aside--after" aria-label="Receipt">
          <div className="panel">
            <div className="panel__head">
              <h2 className="title">Receipt</h2>
              <MockBadge />
            </div>
            <div className="panel__body stack">
              <QuoteBreakdown quote={tx.quote} />
              <dl className="dl">
                <div>
                  <dt>Payout</dt>
                  <dd>
                    {PAYOUT_METHODS[tx.destination.method].name}
                    <br />
                    <span className="small muted">
                      {tx.destination.label} ending {tx.destination.last4}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Confirmations</dt>
                  <dd>
                    {tx.confirmations.count} of {tx.confirmations.required}
                  </dd>
                </div>
                {tx.depositTxHash ? (
                  <div>
                    <dt>Deposit tx</dt>
                    <dd className="mono">{tx.depositTxHash}</dd>
                  </div>
                ) : null}
                {tx.payoutReference ? (
                  <div>
                    <dt>Payout ref.</dt>
                    <dd className="mono">{tx.payoutReference}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Refund to</dt>
                  <dd className="mono">{tx.refundAddress}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
