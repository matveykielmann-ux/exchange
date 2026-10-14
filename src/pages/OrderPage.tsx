import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Countdown } from '@/components/Countdown';
import { Icon } from '@/components/Icon';
import { EventLog, StatusRail } from '@/components/TransactionProgress';
import { LiveIndicator } from '@/components/chat/Chat';
import { MockBadge, Notice, StatusBadge } from '@/components/ui';
import { ASSETS, NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd, formatBps } from '@/domain/money';
import {
  canRaise,
  DEPOSIT_EXCEPTION_LABEL,
  isPreviewDepositAddress,
  ORDER_STATUS_LABEL,
  orderTone,
  TERMINAL_ORDER_STATUSES,
} from '@/domain/order';
import { ApiError } from '@/services/http';
import { errorMessage } from '@/lib/errors';
import { describeDestination, destinationLabel, formatAsset, formatDateTime, formatPriceMicros } from '@/lib/format';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useExpired } from '@/lib/useExpired';
import type { OrderView } from '@/services/types';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { useLiveEvents, useLiveState } from '@/state/useLive';

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

/**
 * Sandbox stand-ins for blockchain monitoring. Each button asks the server to
 * emit a signed test webhook, which goes through the same verification and
 * state machine as a real provider callback. Payout and refund outcomes are
 * staff-only, in the admin sandbox lab.
 */
function SandboxControls({ order, busy, run }: { order: OrderView; busy: boolean; run(fn: () => Promise<OrderView>): void }) {
  const { sandbox } = useServices();
  if (!sandbox) return null;
  const awaiting = order.status === 'awaiting_deposit';
  const confirming = order.status === 'deposit_observed' || order.status === 'confirming';
  if (!awaiting && !confirming) return null;
  return (
    <section className="mock-controls" aria-labelledby="mock-controls-title">
      <h2 id="mock-controls-title">
        <MockBadge label="Sandbox controls" force /> Simulate the blockchain
      </h2>
      <p className="small muted">
        These buttons send a signed test event from the sandbox deposit monitor. The server checks the signature and moves the order through
        the same rules a real deposit would. They don’t exist outside the sandbox.
      </p>
      <div className="row">
        {awaiting ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => sandbox.deposit(order.id, 'exact'))}>
              Deposit the exact amount
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => run(() => sandbox.deposit(order.id, 'short'))}
            >
              Deposit too little
            </button>
          </>
        ) : null}
        {confirming ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => sandbox.confirmations(order.id, true))}>
              Reach final confirmations
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => run(() => sandbox.confirmations(order.id, false))}
            >
              Add one confirmation
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function ReportSent({ order, busy, run }: { order: OrderView; busy: boolean; run(fn: () => Promise<OrderView>): void }) {
  const { orders } = useServices();
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState('');
  if (order.deposit.customerReportedSentAt)
    return (
      <Notice tone="neutral" title="You told us you sent it">
        <p>
          Noted at {formatDateTime(order.deposit.customerReportedSentAt)}. Your order moves forward only when our deposit monitoring sees
          the transaction on the {NETWORKS[order.network].name} network, which can take a few minutes.
        </p>
      </Notice>
    );
  if (!canRaise(order.status, 'CUSTOMER_REPORTED_SENT', 'customer')) return null;
  return open ? (
    <form
      className="stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        run(() => orders.reportSent(order.id, hash.trim() || null));
      }}
    >
      <div className="field">
        <label className="field__label" htmlFor="tx-hash">
          Transaction hash (optional)
        </label>
        <input
          id="tx-hash"
          className="input mono"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="field__hint">Helps our team find your transfer if it is delayed. It doesn’t confirm the deposit.</p>
      </div>
      <div className="row">
        <button type="submit" className="btn btn--secondary" disabled={busy}>
          Let us know
        </button>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>
          Not yet
        </button>
      </div>
    </form>
  ) : (
    <div>
      <button type="button" className="btn btn--secondary" onClick={() => setOpen(true)}>
        I’ve sent it
      </button>
    </div>
  );
}

function StatusNotice({ order }: { order: OrderView }) {
  switch (order.status) {
    case 'created':
      return (
        <Notice tone="info" title="Preparing your deposit address" role="status">
          <p>This usually takes a moment. The page updates by itself.</p>
        </Notice>
      );
    case 'compliance_review':
      return (
        <Notice tone="warn" title="Held for review">
          <p>
            A member of our team is checking this order before payout.
            {order.deposit.exception ? ` Reason: ${DEPOSIT_EXCEPTION_LABEL[order.deposit.exception]}` : ''} If we need anything from you,
            we’ll ask in your <Link to="/support">support messages</Link>.
          </p>
        </Notice>
      );
    case 'ready_for_payout':
      return (
        <Notice tone="info" title="Approved for payout">
          <p>
            Your deposit is final and checks are complete. A member of our team authorizes each payout before it goes to the payout
            provider.
          </p>
        </Notice>
      );
    case 'failed':
      return (
        <Notice tone="danger" title="The payout didn’t go through">
          <p>
            Our team has been alerted and will retry or contact you. If the exchange cannot be completed, clause 4.2 of the{' '}
            <Link to="/legal/terms#clause-4-2">Service Rules</Link> governs the return of funds.
          </p>
        </Notice>
      );
    case 'refund_pending':
      return (
        <Notice tone="warn" title="Refund in progress">
          <p>
            We are returning your {order.asset} on-chain to the refund address you gave. Return fees and timeframes are set by Section 9 of
            the Service Rules; see the <Link to="/legal/refunds">refund policy</Link>.
          </p>
        </Notice>
      );
    case 'refunded':
      return (
        <Notice tone="neutral" title="Refunded">
          <p>Your {order.asset} was returned to your refund address.</p>
        </Notice>
      );
    case 'expired':
      return (
        <Notice tone="neutral" title="The deposit window closed">
          <p>
            No deposit was seen in time, so this order expired. If you sent funds after the window closed,{' '}
            <Link to="/support">contact support</Link>. Under clause 4.14 of the <Link to="/legal/terms#clause-4-14">Service Rules</Link>,
            such funds are transferred back with the related commission fees deducted, and if you ask to proceed with the exchange instead,
            the rate and terms may be changed.
          </p>
        </Notice>
      );
    case 'rejected':
      return (
        <Notice tone="neutral" title="We couldn’t accept this order">
          <p>
            If you already sent funds, their return is handled under Sections 8 and 9 of the <Link to="/legal/refunds">Service Rules</Link>.{' '}
            <Link to="/support">Contact support</Link> with any questions.
          </p>
        </Notice>
      );
    case 'completed':
      return (
        <Notice tone="info" title="Payout completed" role="status">
          <p>
            The payout provider reported the payout as completed{order.payout.providerRef ? ` (reference ${order.payout.providerRef})` : ''}
            . Your bank may take time to show it.
          </p>
        </Notice>
      );
    default:
      return null;
  }
}

/** Courier orders use the same payout states; only the words change. */
const COURIER_STEP_LABELS: Partial<Record<string, string>> = { payout: 'Courier scheduled', completed: 'Cash delivered' };
const courierStep = <T extends { key: string; label: string }>(step: T): T => ({
  ...step,
  label: COURIER_STEP_LABELS[step.key] ?? step.label,
});

export function OrderPage() {
  const { id = '' } = useParams();
  const services = useServices();
  const config = useConfig();
  const live = useLiveState();
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(order ? `Order ${order.reference}` : 'Order');

  const load = useCallback(() => {
    services.orders
      .get(id)
      .then(setOrder)
      .catch((e: unknown) => {
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setOrder(null);
        else setError(errorMessage(e));
      });
  }, [services, id]);
  useEffect(load, [load]);
  useLiveEvents((e) => {
    if (e.type === 'order.updated' && e.data.orderId === id) load();
  });
  // Without the live stream, refresh every 10 s while the order is still moving.
  useEffect(() => {
    if (live === 'open' || !order || TERMINAL_ORDER_STATUSES.has(order.status)) return;
    const t = window.setInterval(load, 10_000);
    return () => window.clearInterval(t);
  }, [live, order, load]);
  // When the deposit window closes, re-read: the server expires the order.
  const windowClosed = useExpired(order?.status === 'awaiting_deposit' ? order.deposit.deadline + 1500 : null);
  useEffect(() => {
    if (windowClosed) load();
  }, [windowClosed, load]);

  function run(fn: () => Promise<OrderView>) {
    setBusy(true);
    setError(null);
    fn()
      .then(setOrder)
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  }

  if (order === undefined)
    return (
      <div className="container flow">
        {error ? (
          <Notice tone="danger" title="This order could not be loaded." role="alert">
            {error}
          </Notice>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    );
  if (order === null)
    return (
      <div className="container flow stack">
        <h1 className="display-l">Order not found</h1>
        <p>It may belong to a different account, or the link is wrong.</p>
        <p>
          <Link to="/orders">Back to orders</Link>
        </p>
      </div>
    );

  const network = NETWORKS[order.network];
  const address = order.deposit.address;
  // In the sandbox the address must be an obvious placeholder; anything else is withheld.
  const showAddress = !!address && (config.mode !== 'sandbox' || isPreviewDepositAddress(address));
  const sandboxOrder = order.source === 'sandbox';

  return (
    <div className="container flow">
      <div className="flow__head">
        <p className="eyebrow">
          <Link to="/orders">Orders</Link> <span aria-hidden="true">/</span> <span className="mono">{order.reference}</span>
        </p>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="display-l">{ORDER_STATUS_LABEL[order.status]}</h1>
            <p className="muted">
              Selling {formatAsset(order.amountAtomic, order.asset)} for {formatUsd(order.quote.netCents)} · created{' '}
              {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="row">
            <StatusBadge tone={orderTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</StatusBadge>
            {sandboxOrder ? <MockBadge label="Sandbox order" force /> : null}
            <LiveIndicator state={live} />
          </div>
        </div>
      </div>

      {justCreated && order.status === 'awaiting_deposit' ? (
        <div style={{ marginBottom: 24 }}>
          <Notice tone="info" title="Order placed" role="status">
            <p>
              Your rate is held for a deposit of exactly the quoted amount that arrives in the window below.
              {sandboxOrder ? ' This is a sandbox order: the deposit address is a placeholder. Do not send funds to it.' : ''}
            </p>
          </Notice>
        </div>
      ) : null}

      <div className="flow__grid">
        <div className="flow__main">
          {order.status === 'awaiting_deposit' ? (
            <section className="stack" aria-labelledby="deposit-title">
              <h2 id="deposit-title" className="flow__step-title">
                Send {formatAsset(order.amountAtomic, order.asset)}
              </h2>
              <div className="deposit-box">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>Network: {networkLabel(order.asset, order.network)}</strong>
                  <Countdown to={order.deposit.deadline} prefix="Window closes in" ended="Window closed" />
                </div>
                {showAddress ? (
                  <div className="deposit-box__address">
                    <code>{address}</code>
                    <CopyButton value={address} label="Copy" />
                  </div>
                ) : (
                  <Notice tone="danger" title="Deposit address withheld" role="alert">
                    <p>No usable deposit address is available for this order. Do not send funds. Contact support.</p>
                  </Notice>
                )}
                {order.deposit.memo ? (
                  <p className="small">
                    Memo / tag: <code>{order.deposit.memo}</code>
                  </p>
                ) : null}
                {sandboxOrder ? (
                  <p className="small">
                    <strong>Sandbox placeholder. Do not send funds.</strong> It is deliberately invalid on every network.
                  </p>
                ) : null}
              </div>
              <Notice tone="warn" title={`Only send ${order.asset} on ${network.name}`}>
                <p>
                  Sending a different asset, or using a different network, may result in permanent loss. Send exactly the amount shown; a
                  different amount is held for review.
                </p>
              </Notice>
              <ReportSent order={order} busy={busy} run={run} />
            </section>
          ) : null}

          <StatusNotice order={order} />

          <section className="panel" aria-labelledby="progress-title">
            <div className="panel__head">
              <h2 id="progress-title">Progress</h2>
              <span className="small muted">Updated {formatDateTime(order.updatedAt)}</span>
            </div>
            <div className="panel__body">
              <StatusRail steps={order.payout.method === 'courier_cash' ? order.steps.map(courierStep) : order.steps} />
            </div>
          </section>

          {error ? <Notice tone="danger" title={error} role="alert" /> : null}
          <SandboxControls order={order} busy={busy} run={run} />

          {canRaise(order.status, 'CUSTOMER_CANCELLED', 'customer') ? (
            <div>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Cancel this order? Only do this if you have not sent any funds.'))
                    run(() => services.orders.cancel(order.id));
                }}
              >
                Cancel this order
              </button>
              <p className="small muted" style={{ marginTop: 8 }}>
                Only before you send funds. Already sent them? You can still ask support to cancel before the exchange is completed (clause
                4.11 of the <Link to="/legal/refunds#after-you-send">Service Rules</Link>); return costs under clause 9.2 apply.
              </p>
            </div>
          ) : null}

          <section aria-labelledby="log-title" className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 id="log-title" className="title">
                Activity
              </h2>
              {sandboxOrder ? <MockBadge label="Sandbox events" force /> : null}
            </div>
            <EventLog log={order.events} />
          </section>

          <p className="small">
            Questions about this order? <Link to="/support/new">Message support</Link> and choose order {order.reference}.
          </p>
        </div>

        <aside className="flow__aside flow__aside--after" aria-label="Receipt">
          <div className="panel">
            <div className="panel__head">
              <h2 className="title">Receipt</h2>
              {sandboxOrder ? <MockBadge force /> : null}
            </div>
            <div className="panel__body stack">
              <dl className="dl">
                <div>
                  <dt>You send</dt>
                  <dd className="tabular">{formatAsset(order.amountAtomic, order.asset)}</dd>
                </div>
                <div>
                  <dt>Reference price</dt>
                  <dd className="tabular">
                    {formatPriceMicros(order.quote.referencePriceMicros, order.asset)} per {ASSETS[order.asset].code}
                  </dd>
                </div>
                <div>
                  <dt>Value</dt>
                  <dd className="tabular">{formatUsd(order.quote.grossCents)}</dd>
                </div>
                <div>
                  <dt>Exchange spread ({formatBps(order.quote.spreadBps)})</dt>
                  <dd className="tabular">−{formatUsd(order.quote.spreadCents)}</dd>
                </div>
                <div>
                  <dt>Payout fee</dt>
                  <dd className="tabular">−{formatUsd(order.quote.payoutFeeCents)}</dd>
                </div>
                <div>
                  <dt>You receive</dt>
                  <dd className="tabular">
                    <strong>{formatUsd(order.quote.netCents)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Payout</dt>
                  <dd>
                    {order.payout.methodName}
                    <br />
                    <span className="small muted">
                      {destinationLabel(order.payout.label, order.payout.last4)} · {order.payout.timing}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Confirmations</dt>
                  <dd className="tabular">
                    {order.deposit.confirmations.count} of {order.deposit.confirmations.required}
                  </dd>
                </div>
                {order.payout.delivery ? (
                  <div>
                    <dt>Delivery</dt>
                    <dd>
                      {order.payout.delivery.recipient}, ID check at the door
                      <br />
                      <span className="small muted">
                        {describeDestination({ kind: 'courier', last4: '', courier: order.payout.delivery })}
                        {order.payout.delivery.preferredDate ? ` · preferred ${order.payout.delivery.preferredDate}` : ''}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {order.deposit.txHash ? (
                  <div>
                    <dt>Deposit tx</dt>
                    <dd className="mono">{order.deposit.txHash}</dd>
                  </div>
                ) : null}
                {order.deposit.amountAtomic !== null && order.deposit.amountAtomic !== order.amountAtomic ? (
                  <div>
                    <dt>Amount received</dt>
                    <dd className="tabular">{formatAsset(order.deposit.amountAtomic, order.asset)}</dd>
                  </div>
                ) : null}
                {order.payout.providerRef ? (
                  <div>
                    <dt>Payout ref.</dt>
                    <dd className="mono">{order.payout.providerRef}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Refund to</dt>
                  <dd className="mono">{order.refundAddress}</dd>
                </div>
                {order.refundTxHash ? (
                  <div>
                    <dt>Refund tx</dt>
                    <dd className="mono">{order.refundTxHash}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
