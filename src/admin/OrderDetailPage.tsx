import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EventLog, StatusRail } from '@/components/TransactionProgress';
import { MockBadge, Notice, StatusBadge } from '@/components/ui';
import { formatUsd } from '@/domain/money';
import { ORDER_STATUS_LABEL, orderTone } from '@/domain/order';
import { errorMessage } from '@/lib/errors';
import { formatAsset, formatDateTime, formatPriceMicros } from '@/lib/format';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { ActionAvailability, AdminOrderDetail, OrderActionKey } from '@/services/adminTypes';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError, ReasonForm } from './shared';
import { shortId, useLoad } from './lib';

const DANGER: ReadonlySet<OrderActionKey> = new Set(['reject', 'refund']);

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
        <h2 id="actions-title">Actions</h2>
      </div>
      <div className="panel__body stack">
        <p className="small muted">
          Every action is checked again on the server, needs a reason where it changes the order, and is written to the audit log. A payout
          is complete only when the payout provider reports it.
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
                {a.label}
              </button>
              {a.unavailable ? (
                <p className="small muted" id={`why-${a.action}`}>
                  {a.unavailable}
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
                      Assign to
                    </label>
                    <select id="assignee" className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                      <option value="">Unassigned</option>
                      {me ? <option value={me.id}>Me ({me.email})</option> : null}
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
                        Save
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => setOpen(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : a.action === 'request_info' ? (
                  <ReasonForm
                    id="request-info"
                    label="Question for the customer (sent to their support messages)"
                    submitLabel="Send request"
                    minLength={10}
                    maxLength={2000}
                    onSubmit={(message) => act('request_info', { message })}
                    onCancel={() => setOpen(null)}
                  />
                ) : (
                  <ReasonForm
                    id={`reason-${a.action}`}
                    submitLabel={a.label}
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
        <h2 id="notes-title">Internal notes</h2>
        <span className="small muted">Staff only</span>
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
          <p className="small muted">No notes yet.</p>
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
            New note
          </label>
          <textarea
            id="note-body"
            className="textarea"
            rows={3}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note for the team"
          />
          {err ? (
            <p className="field__error" role="alert">
              {err}
            </p>
          ) : null}
          <div>
            <button type="submit" className="btn btn--secondary" disabled={busy || !body.trim()}>
              Add note
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
        <MockBadge label="Sandbox lab" force /> Simulate provider events
      </h2>
      <p className="small muted">
        Each button makes the sandbox provider send a signed webhook. The server verifies it, de-duplicates it and applies it through the
        order state machine, exactly like a real callback.
      </p>
      <div className="row">
        {buttons
          .filter((b) => b.show)
          .map((b) => (
            <button key={b.label} type="button" className="btn btn--secondary" disabled={busy} onClick={() => run(b.label, b.fn)}>
              {b.label}
            </button>
          ))}
      </div>
      {msg ? (
        <p className={`small ${msg.tone === 'danger' ? 'field__error' : 'muted'} mono`} role="status">
          {msg.text}
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
          <Link to="/admin/orders">← Orders</Link>
        </p>
        <LoadError error={error} />
        {!error ? <p className="muted">Loading…</p> : null}
      </div>
    );

  const o = data.order;
  const c = data.customer;
  return (
    <div className="stack stack--lg">
      <p className="small">
        <Link to="/admin/orders">← Orders</Link>
      </p>
      <AdminHead
        title={
          <>
            <span className="mono">{o.reference}</span> <StatusBadge tone={orderTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</StatusBadge>
          </>
        }
        lead={`Created ${formatDateTime(o.createdAt)} · updated ${formatDateTime(o.updatedAt)} · version ${o.version}`}
      >
        {o.source === 'sandbox' ? <MockBadge label="Sandbox order" force /> : null}
      </AdminHead>

      {o.reviewReason ? (
        <Notice tone="warn" title="Review reason">
          <p>{o.reviewReason}</p>
        </Notice>
      ) : null}

      <div className="admin-detail">
        <div className="stack stack--lg">
          <section className="panel" aria-labelledby="summary-title">
            <div className="panel__head">
              <h2 id="summary-title">Order</h2>
            </div>
            <div className="panel__body">
              <dl className="dl dl--cols">
                <div>
                  <dt>Selling</dt>
                  <dd className="tabular">
                    {formatAsset(o.amountAtomic, o.asset)} on {o.networkLabel}
                  </dd>
                </div>
                <div>
                  <dt>Reference price</dt>
                  <dd className="tabular">{formatPriceMicros(o.quote.referencePriceMicros, o.asset)}</dd>
                </div>
                <div>
                  <dt>Gross</dt>
                  <dd className="tabular">{formatUsd(o.quote.grossCents)}</dd>
                </div>
                <div>
                  <dt>Spread</dt>
                  <dd className="tabular">
                    {formatUsd(o.quote.spreadCents)} ({o.quote.spreadBps} bps)
                  </dd>
                </div>
                <div>
                  <dt>Payout fee</dt>
                  <dd className="tabular">{formatUsd(o.quote.payoutFeeCents)}</dd>
                </div>
                <div>
                  <dt>Net payout</dt>
                  <dd className="tabular">
                    <strong>{formatUsd(o.quote.netCents)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Payout to</dt>
                  <dd>
                    {o.payout.methodName} · {o.payout.label} ending {o.payout.last4}
                  </dd>
                </div>
                <div>
                  <dt>Quote snapshot</dt>
                  <dd className="mono small">{o.quote.id}</dd>
                </div>
                <div>
                  <dt>Deposit address</dt>
                  <dd className="mono small">{o.deposit.address ?? '—'}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd className="tabular">{formatDateTime(o.deposit.deadline)}</dd>
                </div>
                <div>
                  <dt>Confirmations</dt>
                  <dd className="tabular">
                    {o.deposit.confirmations.count} of {o.deposit.confirmations.required}
                  </dd>
                </div>
                <div>
                  <dt>Deposit tx</dt>
                  <dd className="mono small">{o.deposit.txHash ?? '—'}</dd>
                </div>
                {o.deposit.amountAtomic !== null ? (
                  <div>
                    <dt>Amount received</dt>
                    <dd className="tabular">{formatAsset(o.deposit.amountAtomic, o.asset)}</dd>
                  </div>
                ) : null}
                {o.deposit.exception ? (
                  <div>
                    <dt>Deposit exception</dt>
                    <dd>{o.deposit.exception.replace('_', ' ')}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Customer said sent</dt>
                  <dd>
                    {o.deposit.customerReportedSentAt ? `${formatDateTime(o.deposit.customerReportedSentAt)} (not proof of deposit)` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Refund address</dt>
                  <dd className="mono small">{o.refundAddress}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="panel" aria-labelledby="progress-title">
            <div className="panel__head">
              <h2 id="progress-title">Timeline</h2>
              <span className="small muted">From stored events</span>
            </div>
            <div className="panel__body admin-timeline">
              <StatusRail steps={o.steps} />
              <EventLog log={o.events} />
            </div>
          </section>

          {data.deposits.length || data.payouts.length || data.refund ? (
            <section className="panel" aria-labelledby="money-title">
              <div className="panel__head">
                <h2 id="money-title">Deposits, payouts and refunds</h2>
              </div>
              <div className="panel__body stack">
                {data.deposits.length ? (
                  <div className="table-wrap" tabIndex={0} role="region" aria-label="Deposit observations">
                    <table className="data-table admin-table">
                      <caption>Deposit observations (from the deposit monitor)</caption>
                      <thead>
                        <tr>
                          <th scope="col">Observed</th>
                          <th scope="col">Tx hash</th>
                          <th scope="col" className="num">
                            Confirmations
                          </th>
                          <th scope="col">Provider event</th>
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
                  <div className="table-wrap" tabIndex={0} role="region" aria-label="Payout instructions">
                    <table className="data-table admin-table">
                      <caption>Payout instructions</caption>
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Status</th>
                          <th scope="col" className="num">
                            Amount
                          </th>
                          <th scope="col">Provider ref.</th>
                          <th scope="col">Authorization</th>
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
                      <dt>Refund</dt>
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
                <h2 id="reviews-title">Compliance reviews</h2>
              </div>
              <div className="panel__body">
                <ul className="note-list">
                  {data.reviews.map((r) => (
                    <li key={r.id}>
                      <p className="note-list__meta small muted">
                        {r.status} · opened {formatDateTime(r.createdAt)}
                        {r.decidedAt ? ` · decided ${formatDateTime(r.decidedAt)}` : ''}
                      </p>
                      <p className="note-list__body">{r.reason}</p>
                      {r.decisionReason ? <p className="small">Decision: {r.decisionReason}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <section className="panel" aria-labelledby="audit-title">
            <div className="panel__head">
              <h2 id="audit-title">Audit trail</h2>
              <Link className="small" to={`/admin/audit?targetType=order&targetId=${o.id}`}>
                Open in audit log
              </Link>
            </div>
            <div className="panel__body">
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Audit entries">
                <table className="data-table admin-table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Action</th>
                      <th scope="col">Reason</th>
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
              <h2 id="customer-title">Customer</h2>
            </div>
            <div className="panel__body">
              <dl className="dl">
                <div>
                  <dt>Name</dt>
                  <dd>{c.name || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{c.email}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{c.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt>State</dt>
                  <dd>{c.stateOfResidence ?? '—'}</dd>
                </div>
                <div>
                  <dt>Verification</dt>
                  <dd>
                    {c.kycStatus} ({c.kycLevel})
                  </dd>
                </div>
                <div>
                  <dt>Account</dt>
                  <dd>
                    {c.accountStatus} · since {formatDateTime(c.memberSince)}
                  </dd>
                </div>
                <div>
                  <dt>Orders</dt>
                  <dd>
                    {c.orders.completed} completed of {c.orders.total}
                  </dd>
                </div>
              </dl>
              <p className="small muted">Contact details are masked to limit exposure.</p>
            </div>
          </section>

          <ActionPanel detail={data} onDone={reload} />
          {data.sandboxControls ? <SandboxLab detail={data} onDone={reload} /> : null}
          <NotesPanel detail={data} onDone={reload} />

          <section className="panel" aria-labelledby="conv-title">
            <div className="panel__head">
              <h2 id="conv-title">Conversations</h2>
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
                <p className="small muted">No conversations about this order.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
