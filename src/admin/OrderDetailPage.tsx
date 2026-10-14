import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EventLog, StatusRail } from '@/components/TransactionProgress';
import { MockBadge, Notice, StatusBadge } from '@/components/ui';
import { formatUsd } from '@/domain/money';
import { ORDER_STAGE_LABEL, orderStatusLabel, orderTone } from '@/domain/order';
import { StageTrack } from '@/components/StageTrack';
import { notificationText } from '@/i18n/notifications';
import { errorMessage } from '@/lib/errors';
import { destinationLabel, formatAsset, formatDateTime, formatPriceMicros } from '@/lib/format';
import { COURIER_WINDOW_LABELS } from '@/domain/courier';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { ActionAvailability, AdminOrderDetail, OrderActionKey } from '@/services/adminTypes';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError, ReasonForm } from './shared';
import { shortId, useLoad } from './lib';
import { t } from '@/i18n';

const DANGER: ReadonlySet<OrderActionKey> = new Set(['reject', 'refund', 'hold']);

function ActionPanel({ detail, onDone }: { detail: AdminOrderDetail; onDone(): void }) {
  const { admin } = useServices();
  const me = useUser();
  const [open, setOpen] = useState<OrderActionKey | null>(null);
  const [staff, setStaff] = useState<{ id: string; email: string }[] | null>(null);
  const [assignee, setAssignee] = useState(detail.order.assignedOperatorId ?? '');
  const [err, setErr] = useState<string | null>(null);
  const id = detail.order.id;

  const act = async (action: OrderActionKey, body: Record<string, unknown>) => {
    await admin.act(id, action, body);
    setOpen(null);
    onDone();
  };

  const visible = detail.actions.filter((a) => a.action !== 'note');
  return (
    <section className="panel" aria-labelledby="actions-title">
      <div className="panel__head">
        <h2 id="actions-title">{t('Actions')}</h2>
      </div>
      <div className="panel__body stack">
        <p className="small muted">
          {t(
            'Every action is checked again on the server, needs a reason where it changes the order, and is written to the audit log. A payout is complete only when the payout provider reports it.',
          )}
        </p>
        <ul className="action-list">
          {visible.map((a: ActionAvailability) => (
            <li key={a.action}>
              <button
                type="button"
                className={`btn ${DANGER.has(a.action) ? 'btn--danger' : a.action === 'assign' ? 'btn--secondary' : ''} btn--block`}
                disabled={!!a.unavailable}
                aria-expanded={open === a.action}
                aria-describedby={a.unavailable ? `why-${a.action}` : undefined}
                onClick={() => {
                  setErr(null);
                  setOpen(open === a.action ? null : a.action);
                  if (a.action === 'assign' && !staff)
                    admin
                      .staff()
                      .then(setStaff)
                      .catch((e: unknown) => setErr(errorMessage(e)));
                }}
              >
                {t(a.label)}
              </button>
              {a.unavailable ? (
                <p className="small muted" id={`why-${a.action}`}>
                  {t(a.unavailable)}
                </p>
              ) : null}
              {open === a.action && !a.unavailable ? (
                a.action === 'assign' ? (
                  <form
                    className="stack reason-form"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      act('assign', { operatorId: assignee || null }).catch((x: unknown) => setErr(errorMessage(x)));
                    }}
                  >
                    <label className="field__label" htmlFor="assignee">
                      {t('Assign to')}
                    </label>
                    <select id="assignee" className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                      <option value="">{t('Unassigned')}</option>
                      {me ? (
                        <option value={me.id}>
                          {t('Me (')}
                          {me.email})
                        </option>
                      ) : null}
                      {(staff ?? [])
                        .filter((s) => s.id !== me?.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.email}
                          </option>
                        ))}
                    </select>
                    <div className="row">
                      <button type="submit" className="btn">
                        {t('Save')}
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => setOpen(null)}>
                        {t('Cancel')}
                      </button>
                    </div>
                  </form>
                ) : a.action === 'message' ? (
                  <ReasonForm
                    id="message-customer"
                    label={t('Message to the customer (sent to their support messages, with a notification)')}
                    submitLabel={t('Send message')}
                    minLength={2}
                    maxLength={4000}
                    onSubmit={(message) => act('message', { message })}
                    onCancel={() => setOpen(null)}
                  />
                ) : a.action === 'request_info' ? (
                  <ReasonForm
                    id="request-info"
                    label={t('Question for the customer (sent to their support messages)')}
                    submitLabel={t('Send request')}
                    minLength={10}
                    maxLength={2000}
                    onSubmit={(message) => act('request_info', { message })}
                    onCancel={() => setOpen(null)}
                  />
                ) : (
                  <ReasonForm
                    id={`reason-${a.action}`}
                    submitLabel={t(a.label)}
                    danger={DANGER.has(a.action)}
                    onSubmit={(reason) => act(a.action, { reason })}
                    onCancel={() => setOpen(null)}
                  />
                )
              ) : null}
            </li>
          ))}
        </ul>
        {err ? <Notice tone="danger" title={err} role="alert" /> : null}
      </div>
    </section>
  );
}

function NotesPanel({ detail, onDone }: { detail: AdminOrderDetail; onDone(): void }) {
  const { admin } = useServices();
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel" aria-labelledby="notes-title">
      <div className="panel__head">
        <h2 id="notes-title">{t('Internal notes')}</h2>
        <span className="small muted">{t('Staff only')}</span>
      </div>
      <div className="panel__body stack">
        {detail.notes.length ? (
          <ul className="note-list">
            {detail.notes.map((n) => (
              <li key={n.id}>
                <p className="note-list__meta small muted">
                  {n.author.email} · {formatDateTime(n.createdAt)}
                </p>
                <p className="note-list__body">{n.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t('No notes yet.')}</p>
        )}
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setBusy(true);
            setErr(null);
            try {
              await admin.act(detail.order.id, 'note', { body: body.trim() });
              setBody('');
              onDone();
            } catch (x) {
              setErr(errorMessage(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="visually-hidden" htmlFor="note-body">
            {t('New note')}
          </label>
          <textarea
            id="note-body"
            className="textarea"
            rows={3}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('Add a note for the team')}
          />
          {err ? (
            <p className="field__error" role="alert">
              {err}
            </p>
          ) : null}
          <div>
            <button type="submit" className="btn btn--secondary" disabled={busy || !body.trim()}>
              {t('Add note')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function SandboxLab({ detail, onDone }: { detail: AdminOrderDetail; onDone(): void }) {
  const { admin } = useServices();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
  const s = detail.order.status;
  const id = detail.order.id;
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = (await fn()) as { outcome?: unknown };
      setMsg({ tone: 'info', text: `${label}: ${JSON.stringify(r.outcome ?? 'ok')}` });
      onDone();
    } catch (e) {
      setMsg({ tone: 'danger', text: `${label}: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };
  const buttons: { label: string; show: boolean; fn: () => Promise<unknown> }[] = [
    { label: 'Deposit exact amount', show: s === 'awaiting_deposit', fn: () => admin.sandbox.deposit(id, 'exact') },
    { label: 'Deposit short amount', show: s === 'awaiting_deposit', fn: () => admin.sandbox.deposit(id, 'short') },
    {
      label: 'Deposit after window',
      show: ['awaiting_deposit', 'expired', 'cancelled'].includes(s),
      fn: () => admin.sandbox.deposit(id, 'late'),
    },
    { label: 'Expire deposit window now', show: s === 'awaiting_deposit', fn: () => admin.sandbox.expire(id) },
    {
      label: 'Add one confirmation',
      show: s === 'deposit_observed' || s === 'confirming',
      fn: () => admin.sandbox.confirmations(id, false),
    },
    {
      label: 'Reach final confirmations',
      show: s === 'deposit_observed' || s === 'confirming',
      fn: () => admin.sandbox.confirmations(id, true),
    },
    { label: 'Provider: payout processing', show: s === 'payout_submitted', fn: () => admin.sandbox.payout(id, 'processing') },
    {
      label: 'Provider: payout completed',
      show: s === 'payout_submitted' || s === 'payout_processing',
      fn: () => admin.sandbox.payout(id, 'completed'),
    },
    {
      label: 'Provider: payout failed',
      show: s === 'payout_submitted' || s === 'payout_processing',
      fn: () => admin.sandbox.payout(id, 'failed', 'Sandbox: account closed (R02).'),
    },
    { label: 'Provider: refund completed', show: s === 'refund_pending', fn: () => admin.sandbox.refundComplete(id) },
    { label: 'Replay last webhook (duplicate)', show: true, fn: () => admin.sandbox.replay(id) },
  ];
  return (
    <section className="mock-controls" aria-labelledby="lab-title">
      <h2 id="lab-title">
        <MockBadge label={t('Sandbox lab')} force /> {t('Simulate provider events')}
      </h2>
      <p className="small muted">
        {t(
          'Each button makes the sandbox provider send a signed webhook. The server verifies it, de-duplicates it and applies it through the order state machine, exactly like a real callback.',
        )}
      </p>
      <div className="row">
        {buttons
          .filter((b) => b.show)
          .map((b) => (
            <button key={t(b.label)} type="button" className="btn btn--secondary" disabled={busy} onClick={() => run(b.label, b.fn)}>
              {t(b.label)}
            </button>
          ))}
      </div>
      {msg ? (
        <p className={`small ${msg.tone === 'danger' ? 'field__error' : 'muted'} mono`} role="status">
          {t(msg.text)}
        </p>
      ) : null}
    </section>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { admin } = useServices();
  const { data, error, reload } = useLoad(() => admin.order(id), [id]);
  useDocumentTitle(data ? `Order ${data.order.reference}` : 'Order');
  useLiveEvents((e) => {
    if (e.type === 'order.updated' && (e.data.orderId === id || e.data.orderId === data?.order.id)) reload();
  });

  if (!data)
    return (
      <div className="stack">
        <p className="small">
          <Link to="/admin/orders">{t('← Orders')}</Link>
        </p>
        <LoadError error={error} />
        {!error ? <p className="muted">{t('Loading…')}</p> : null}
      </div>
    );

  const o = data.order;
  const c = data.customer;
  return (
    <div className="stack stack--lg">
      <p className="small">
        <Link to="/admin/orders">{t('← Orders')}</Link>
      </p>
      <AdminHead
        title={
          <>
            <span className="mono">{o.reference}</span>{' '}
            <span className={`badge ${o.onHold ? 'badge--warn' : 'badge--info'}`}>{t(ORDER_STAGE_LABEL[o.stage])}</span>{' '}
            <StatusBadge tone={orderTone(o.status)}>{t(orderStatusLabel(o.status, o.direction))}</StatusBadge>{' '}
            <span className="badge badge--neutral">{o.direction === 'buy' ? t('Buy · cash → crypto') : t('Sell · crypto → USD')}</span>
          </>
        }
        lead={t('Created {0} · updated {1} · version {2}', [formatDateTime(o.createdAt), formatDateTime(o.updatedAt), o.version])}
      >
        {o.source === 'sandbox' ? <MockBadge label={t('Sandbox order')} force /> : null}
      </AdminHead>

      <StageTrack stage={o.stage} label={t('Pipeline stage')} />

      {o.onHold ? (
        <Notice tone="warn" title={t('On hold')}>
          <p>{t('Nothing moves this order toward a payout until the hold is released. Provider reports are still recorded.')}</p>
        </Notice>
      ) : null}

      {o.reviewReason ? (
        <Notice tone="warn" title={t('Review reason')}>
          <p>{o.reviewReason}</p>
        </Notice>
      ) : null}

      <div className="admin-detail">
        <div className="stack stack--lg">
          <section className="panel" aria-labelledby="summary-title">
            <div className="panel__head">
              <h2 id="summary-title">{t('Order')}</h2>
            </div>
            <div className="panel__body">
              <dl className="dl dl--cols">
                <div>
                  <dt>{o.direction === 'buy' ? t('Buying') : t('Selling')}</dt>
                  <dd className="tabular">
                    {formatAsset(o.amountAtomic, o.asset)} {t('on')} {o.networkLabel}
                  </dd>
                </div>
                <div>
                  <dt>{t('Reference price')}</dt>
                  <dd className="tabular">{formatPriceMicros(o.quote.referencePriceMicros, o.asset)}</dd>
                </div>
                <div>
                  <dt>{o.direction === 'buy' ? t('Cash to collect') : t('Gross')}</dt>
                  <dd className="tabular">{formatUsd(o.quote.grossCents)}</dd>
                </div>
                <div>
                  <dt>{t('Spread')}</dt>
                  <dd className="tabular">
                    {formatUsd(o.quote.spreadCents)} ({o.quote.spreadBps} {t('bps)')}
                  </dd>
                </div>
                <div>
                  <dt>{o.direction === 'buy' ? t('Courier fee') : t('Payout fee')}</dt>
                  <dd className="tabular">{formatUsd(o.quote.payoutFeeCents)}</dd>
                </div>
                <div>
                  <dt>{o.direction === 'buy' ? t('Converted to crypto') : t('Net payout')}</dt>
                  <dd className="tabular">
                    <strong>{formatUsd(o.quote.netCents)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>{o.direction === 'buy' ? t('Crypto to') : t('Payout to')}</dt>
                  <dd className={o.direction === 'buy' ? 'mono small' : undefined}>
                    {o.direction === 'buy'
                      ? o.receiveAddress
                      : `${o.payout.methodName} · ${destinationLabel(o.payout.label, o.payout.last4)}`}
                  </dd>
                </div>
                {data.courierDelivery ? (
                  <div>
                    <dt>{o.direction === 'buy' ? t('Courier collection') : t('Courier delivery')}</dt>
                    <dd>
                      {o.direction === 'buy' ? t('Collect only from') : t('Hand only to')} {data.courierDelivery.recipient}{' '}
                      {t('after a photo ID check')}
                      <br />
                      <span className="small">
                        {data.courierDelivery.line1}
                        {data.courierDelivery.line2 ? `, ${data.courierDelivery.line2}` : ''}, {data.courierDelivery.city},{' '}
                        {data.courierDelivery.state} {data.courierDelivery.zip}
                      </span>
                      <br />
                      <span className="small muted">
                        {t(COURIER_WINDOW_LABELS[data.courierDelivery.window])}
                        {data.courierDelivery.preferredDate ? t(' · preferred {0}', [data.courierDelivery.preferredDate]) : ''}{' '}
                        {t('· phone')} <span className="tabular">{data.courierDelivery.phone}</span>
                      </span>
                      {data.courierDelivery.instructions ? (
                        <>
                          <br />
                          <span className="small muted">
                            {t('Instructions:')} {data.courierDelivery.instructions}
                          </span>
                        </>
                      ) : null}
                      {data.courierDelivery.masked ? (
                        <>
                          <br />
                          <span className="small muted">{t('Street address and phone are masked for your role.')}</span>
                        </>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t('Quote snapshot')}</dt>
                  <dd className="mono small">{o.quote.id}</dd>
                </div>
                <div>
                  <dt>{t('Deposit address')}</dt>
                  <dd className="mono small">{o.deposit.address ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('Deadline')}</dt>
                  <dd className="tabular">{formatDateTime(o.deposit.deadline)}</dd>
                </div>
                <div>
                  <dt>{t('Confirmations')}</dt>
                  <dd className="tabular">
                    {o.deposit.confirmations.count} {t('of')} {o.deposit.confirmations.required}
                  </dd>
                </div>
                <div>
                  <dt>{t('Deposit tx')}</dt>
                  <dd className="mono small">{o.deposit.txHash ?? '—'}</dd>
                </div>
                {o.deposit.amountAtomic !== null ? (
                  <div>
                    <dt>{o.direction === 'buy' ? t('Cash counted') : t('Amount received')}</dt>
                    <dd className="tabular">
                      {o.direction === 'buy' ? formatUsd(o.deposit.amountAtomic) : formatAsset(o.deposit.amountAtomic, o.asset)}
                    </dd>
                  </div>
                ) : null}
                {o.deposit.exception ? (
                  <div>
                    <dt>{t('Deposit exception')}</dt>
                    <dd>{o.deposit.exception.replace('_', ' ')}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{o.direction === 'buy' ? t('ID uploaded') : t('Customer tx hash')}</dt>
                  <dd>
                    {o.direction === 'buy' ? (
                      o.documents.length ? (
                        <ul className="doc-list small">
                          {o.documents.map((d) => (
                            <li key={d.id}>
                              <span>
                                {d.fileName} · {d.contentType} · {Math.max(1, Math.round(d.sizeBytes / 1024))} {t('KB ·')}{' '}
                                {formatDateTime(d.createdAt)}
                                <span className="mono muted" style={{ display: 'block' }}>
                                  {t('sha256')} {d.sha256.slice(0, 16)}… {d.stored ? '' : t('(sandbox: file checked and discarded)')}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )
                    ) : o.deposit.customerReportedSentAt ? (
                      <>
                        <span className="mono small" style={{ overflowWrap: 'anywhere' }}>
                          {o.deposit.customerTxHash ?? t('no hash')}
                        </span>
                        <br />
                        <span className="small muted">
                          {t('Submitted')} {formatDateTime(o.deposit.customerReportedSentAt)}
                          {t('; format checked only, not proof of deposit')}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {o.direction === 'buy' ? null : (
                  <div>
                    <dt>{t('Refund address')}</dt>
                    <dd className="mono small">{o.refundAddress}</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          <section className="panel" aria-labelledby="progress-title">
            <div className="panel__head">
              <h2 id="progress-title">{t('Timeline')}</h2>
              <span className="small muted">{t('From stored events')}</span>
            </div>
            <div className="panel__body admin-timeline">
              <StatusRail steps={o.steps} />
              <EventLog log={o.events} />
            </div>
          </section>

          {data.deposits.length || data.payouts.length || data.refund ? (
            <section className="panel" aria-labelledby="money-title">
              <div className="panel__head">
                <h2 id="money-title">{t('Deposits, payouts and refunds')}</h2>
              </div>
              <div className="panel__body stack">
                {data.deposits.length ? (
                  <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Deposit observations')}>
                    <table className="data-table admin-table">
                      <caption>{t('Deposit observations (from the deposit monitor)')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('Observed')}</th>
                          <th scope="col">{t('Tx hash')}</th>
                          <th scope="col" className="num">
                            {t('Confirmations')}
                          </th>
                          <th scope="col">{t('Provider event')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.deposits.map((d) => (
                          <tr key={d.eventId}>
                            <td className="tabular small">{formatDateTime(d.observedAt)}</td>
                            <td className="mono small">{shortId(d.txHash)}</td>
                            <td className="num">{d.confirmations}</td>
                            <td className="mono small">
                              {d.provider} · {shortId(d.eventId)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {data.payouts.length ? (
                  <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Payout instructions')}>
                    <table className="data-table admin-table">
                      <caption>{t('Payout instructions')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">{t('Status')}</th>
                          <th scope="col" className="num">
                            {t('Amount')}
                          </th>
                          <th scope="col">{t('Provider ref.')}</th>
                          <th scope="col">{t('Authorization')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payouts.map((p) => (
                          <tr key={p.id}>
                            <td>{p.attempt}</td>
                            <td>
                              {p.status}
                              {p.failureReason ? <span className="small muted block">{p.failureReason}</span> : null}
                            </td>
                            <td className="num">{formatUsd(BigInt(p.amountCents))}</td>
                            <td className="mono small">{p.providerRef ?? '—'}</td>
                            <td className="small">{p.authorizationReason ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {data.refund ? (
                  <dl className="dl">
                    <div>
                      <dt>{t('Refund')}</dt>
                      <dd>
                        {data.refund.status} · {data.refund.reason}
                        {data.refund.txHash ? <span className="mono small block">{data.refund.txHash}</span> : null}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </section>
          ) : null}

          {data.reviews.length ? (
            <section className="panel" aria-labelledby="reviews-title">
              <div className="panel__head">
                <h2 id="reviews-title">{t('Compliance reviews')}</h2>
              </div>
              <div className="panel__body">
                <ul className="note-list">
                  {data.reviews.map((r) => (
                    <li key={r.id}>
                      <p className="note-list__meta small muted">
                        {r.status} {t('· opened')} {formatDateTime(r.createdAt)}
                        {r.decidedAt ? t(' · decided {0}', [formatDateTime(r.decidedAt)]) : ''}
                      </p>
                      <p className="note-list__body">{r.reason}</p>
                      {r.decisionReason ? (
                        <p className="small">
                          {t('Decision:')} {r.decisionReason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <section className="panel" aria-labelledby="ntf-title">
            <div className="panel__head">
              <h2 id="ntf-title">{t('Customer notifications')}</h2>
              {o.source === 'sandbox' ? <MockBadge label={t('Sandbox: not emailed')} force /> : null}
            </div>
            <div className="panel__body">
              {data.notifications.length ? (
                <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Customer notifications')}>
                  <table className="data-table admin-table">
                    <thead>
                      <tr>
                        <th scope="col">{t('When')}</th>
                        <th scope="col">{t('Notice')}</th>
                        <th scope="col">{t('Delivery')}</th>
                        <th scope="col">{t('Read')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.notifications.map((n) => (
                        <tr key={n.id}>
                          <td className="tabular small">{formatDateTime(n.createdAt)}</td>
                          <td className="small">{notificationText(n).subject}</td>
                          <td className="small">{n.status.replace(/_/g, ' ')}</td>
                          <td className="tabular small">{n.readAt ? formatDateTime(n.readAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted">{t('No notices sent for this order yet.')}</p>
              )}
            </div>
          </section>

          <section className="panel" aria-labelledby="audit-title">
            <div className="panel__head">
              <h2 id="audit-title">{t('Audit trail')}</h2>
              <Link className="small" to={`/admin/audit?targetType=order&targetId=${o.id}`}>
                {t('Open in audit log')}
              </Link>
            </div>
            <div className="panel__body">
              <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Audit entries')}>
                <table className="data-table admin-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('When')}</th>
                      <th scope="col">{t('Actor')}</th>
                      <th scope="col">{t('Action')}</th>
                      <th scope="col">{t('Reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((a) => (
                      <tr key={a.id}>
                        <td className="tabular small">{formatDateTime(a.at)}</td>
                        <td className="small">
                          {a.actor.type}
                          {a.actor.role ? ` (${a.actor.role})` : ''}
                        </td>
                        <td className="mono small">{a.action}</td>
                        <td className="small">{a.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <div className="stack stack--lg">
          <section className="panel" aria-labelledby="customer-title">
            <div className="panel__head">
              <h2 id="customer-title">{t('Customer')}</h2>
            </div>
            <div className="panel__body">
              <dl className="dl">
                <div>
                  <dt>{t('Name')}</dt>
                  <dd>{c.name || '—'}</dd>
                </div>
                <div>
                  <dt>{t('Email')}</dt>
                  <dd>{c.email}</dd>
                </div>
                <div>
                  <dt>{t('Phone')}</dt>
                  <dd>{c.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('State')}</dt>
                  <dd>{c.stateOfResidence ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('Verification')}</dt>
                  <dd>
                    {c.kycStatus} ({c.kycLevel})
                  </dd>
                </div>
                <div>
                  <dt>{t('Account')}</dt>
                  <dd>
                    {c.accountStatus} {t('· since')} {formatDateTime(c.memberSince)}
                  </dd>
                </div>
                <div>
                  <dt>{t('Orders')}</dt>
                  <dd>
                    {c.orders.completed} {t('completed of')} {c.orders.total}
                  </dd>
                </div>
              </dl>
              <p className="small muted">{t('Contact details are masked to limit exposure.')}</p>
            </div>
          </section>

          <ActionPanel detail={data} onDone={reload} />
          {data.sandboxControls ? <SandboxLab detail={data} onDone={reload} /> : null}
          <NotesPanel detail={data} onDone={reload} />

          <section className="panel" aria-labelledby="conv-title">
            <div className="panel__head">
              <h2 id="conv-title">{t('Conversations')}</h2>
            </div>
            <div className="panel__body">
              {data.conversations.length ? (
                <ul className="link-list">
                  {data.conversations.map((cv) => (
                    <li key={cv.id}>
                      <Link to={`/admin/inbox/${cv.id}`}>{cv.subject}</Link>
                      <span className="small muted">
                        {' '}
                        · {cv.status} · {formatDateTime(cv.lastMessageAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">{t('No conversations about this order.')}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
