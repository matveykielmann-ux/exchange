import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icon } from '@/components/Icon';
import { COURIER_WINDOW_LABELS } from '@/domain/courier';
import { formatUsd } from '@/domain/money';
import { ORDER_STAGE_LABEL, orderStatusLabel, orderTone } from '@/domain/order';
import { exchangeRateMicros } from '@/domain/quote';
import { t } from '@/i18n';
import { notificationText } from '@/i18n/notifications';
import { errorMessage } from '@/lib/errors';
import { destinationLabel, formatAsset, formatDateTime, formatPriceMicros } from '@/lib/format';
import type { AdminOrderDetail } from '@/services/adminTypes';
import { ApiError } from '@/services/http';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { shortId, useLoad } from './lib';
import {
  ACTION_EXPLAIN,
  ACTION_LABEL,
  actionPlan,
  exchangeSides,
  DEFAULT_REASON,
  NOTIFY_STATUS,
  notifyTemplates,
  REJECT_REASONS,
  SUCCESS,
  type CardAction,
} from './orderActions';
import { TxHashLink } from '@/components/TxHashLink';
import { LoadError } from './shared';

type Result = { tone: 'success' | 'danger'; text: string } | null;

/**
 * The order card: everything an operator needs to decide and act on one
 * order. Used as the side panel of the order queue and as the full order page.
 */
export function OrderCard({ id, headingLevel = 1 }: { id: string; headingLevel?: 1 | 2 }) {
  const { admin } = useServices();
  const { data, error, reload } = useLoad(() => admin.order(id), [id]);
  const [result, setResult] = useState<Result>(null);
  useLiveEvents((e) => {
    if (e.type === 'order.updated' && (e.data.orderId === id || e.data.orderId === data?.order.id)) reload();
  });
  if (!data)
    return (
      <div className="stack">
        <LoadError error={error} />
        {!error ? <p className="muted">{t('Loading…')}</p> : null}
      </div>
    );
  const o = data.order;
  const H = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <article className="order-card stack" aria-labelledby="order-card-title">
      <header className="order-card__head">
        <div>
          <H id="order-card-title" className="order-card__ref mono">
            {o.reference}
          </H>
          <p className="small muted">
            {t('Created {0}', [formatDateTime(o.createdAt)])} ·{' '}
            {o.direction === 'buy' ? (o.payIn === 'wire' ? t('Buy · wire → crypto') : t('Buy · cash → crypto')) : t('Sell · crypto → USD')}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`badge ${o.onHold ? 'badge--warn' : 'badge--info'}`}>{t(ORDER_STAGE_LABEL[o.stage])}</span>
        </div>
      </header>

      {result ? (
        <p className={`order-card__result order-card__result--${result.tone}`} role={result.tone === 'danger' ? 'alert' : 'status'}>
          <Icon name={result.tone === 'success' ? 'check' : 'alert'} width={16} height={16} /> {result.text}
        </p>
      ) : null}

      <MainBlock detail={data} onResult={setResult} reload={reload} />
      <CredentialsBlock detail={data} onResult={setResult} reload={reload} />
      <ClientBlock detail={data} />
      <HistoryBlock detail={data} />
      <MoreDetails detail={data} reload={reload} />
    </article>
  );
}

/* ---------- Operation credentials (wire / deposit wallet) ---------- */

function CredentialsBlock({ detail, onResult, reload }: { detail: AdminOrderDetail; onResult(r: Result): void; reload(): void }) {
  const { admin } = useServices();
  const o = detail.order;
  const wire = o.payIn === 'wire';
  const sell = o.direction === 'sell';
  const snap = o.operationCredentials;
  const [wireSets, setWireSets] = useState<{ id: string; name: string }[]>([]);
  const [wallets, setWallets] = useState<{ id: string; name: string; address: string; isDefault: boolean }[]>([]);
  const [selected, setSelected] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (wire) {
          const items = await admin.credentials.listWire();
          if (!cancelled) setWireSets(items.filter((i) => i.status === 'active').map((i) => ({ id: i.id, name: i.name })));
        } else if (sell) {
          const items = await admin.credentials.walletsForPair(o.asset, o.network);
          if (!cancelled)
            setWallets(items.map((i) => ({ id: i.id, name: i.name, address: i.address, isDefault: i.isDefault })));
        }
      } catch {
        /* list errors surface on assign */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, wire, sell, o.asset, o.network]);

  if (!wire && !sell) return null;

  const revealed = wire ? !!snap?.wire?.revealedToCustomer : !!snap?.wallet?.revealedToCustomer || !!o.deposit.address;

  const assign = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (wire) {
        await admin.credentials.assignWire(o.id, selected, { confirmReplace: revealed ? confirmReplace : undefined, reason: revealed ? reason : undefined });
      } else {
        await admin.credentials.assignWallet(o.id, selected, {
          confirmReplace: revealed ? confirmReplace : undefined,
          reason: revealed ? reason : undefined,
        });
      }
      onResult({ tone: 'success', text: t('Credentials saved on this order.') });
      setConfirmReplace(false);
      setReason('');
      reload();
    } catch (e) {
      onResult({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="order-block" aria-labelledby="block-credentials">
      <h3 id="block-credentials" className="order-block__title">
        {t('Operation credentials')}
      </h3>
      {wire ? (
        snap?.wire ? (
          <dl className="dl dl--compact">
            <Row term={t('Set')}>{snap.wire.name}</Row>
            <Row term={t('Beneficiary')}>{snap.wire.beneficiary}</Row>
            <Row term={t('Bank')}>{snap.wire.bankName}</Row>
            {snap.wire.accountNumber ? (
              <Row term={t('Account')}>
                <span className="mono small">{snap.wire.accountNumber}</span>
              </Row>
            ) : null}
            {snap.wire.routingNumber ? (
              <Row term={t('Routing')}>
                <span className="mono small">{snap.wire.routingNumber}</span>
              </Row>
            ) : null}
            {snap.wire.swiftBic ? (
              <Row term="SWIFT">
                <span className="mono small">{snap.wire.swiftBic}</span>
              </Row>
            ) : null}
          </dl>
        ) : (
          <p className="small muted">{t('No bank credentials on this order yet. Assign a set below to issue instructions.')}</p>
        )
      ) : snap?.wallet || o.deposit.address ? (
        <dl className="dl dl--compact">
          {snap?.wallet ? <Row term={t('Wallet')}>{snap.wallet.name}</Row> : null}
          <Row term={t('Deposit address')}>
            <span className="mono small break">{snap?.wallet?.address ?? o.deposit.address}</span>
          </Row>
          <Row term={t('Network')}>
            {o.asset} · {o.networkLabel}
          </Row>
        </dl>
      ) : (
        <p className="small muted">{t('No deposit wallet on this order. Assign an active wallet for {0} on {1}.', [o.asset, o.networkLabel])}</p>
      )}

      <div className="stack" style={{ gap: 8, marginTop: 12 }}>
        <label className="field">
          <span className="field__label">{wire ? t('Bank credential set') : t('Deposit wallet')}</span>
          <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">{t('— select —')}</option>
            {wire
              ? wireSets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))
              : wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.isDefault ? ` (${t('default')})` : ''} — {w.address.slice(0, 10)}…
                  </option>
                ))}
          </select>
        </label>
        {revealed ? (
          <>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
              <span className="small">{t('I confirm replacing credentials the customer may already have')}</span>
            </label>
            <label className="field">
              <span className="field__label">{t('Reason for replacement')}</span>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </>
        ) : null}
        <button type="button" className="btn btn--secondary" disabled={!selected || busy || (revealed && (!confirmReplace || reason.trim().length < 4))} onClick={() => void assign()}>
          {busy ? t('Saving…') : revealed ? t('Replace credentials') : t('Assign credentials')}
        </button>
      </div>
      {snap?.assignmentHistory?.length ? (
        <details className="small" style={{ marginTop: 12 }}>
          <summary>{t('Assignment history')}</summary>
          <ul className="stack" style={{ gap: 4, marginTop: 8 }}>
            {snap.assignmentHistory.map((h) => (
              <li key={h.id}>
                {formatDateTime(h.createdAt)} · {h.kind} · {h.action}
                {h.reason ? ` — ${h.reason}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/* ---------- Block A: the essentials and the next action ---------- */

function MainBlock({ detail, onResult, reload }: { detail: AdminOrderDetail; onResult(r: Result): void; reload(): void }) {
  const o = detail.order;
  const sides = exchangeSides(o);
  const rate = exchangeRateMicros({
    asset: o.asset,
    amountAtomic: o.amountAtomic,
    grossCents: o.direction === 'buy' ? o.quote.grossCents - o.quote.payoutFeeCents : o.quote.grossCents,
    spreadCents: o.direction === 'buy' ? 0n : o.quote.spreadCents,
  });
  return (
    <section className="order-block" aria-labelledby="block-main">
      <h3 id="block-main" className="order-block__title">
        {t('Essentials')}
      </h3>
      <div className="order-status-line">
        <StatusBadge tone={orderTone(o.status)}>{t(orderStatusLabel(o.status, o.direction, o.payIn ?? undefined))}</StatusBadge>
        {o.onHold ? <span className="badge badge--warn">{t('On hold')}</span> : null}
        <span className="small muted">{t('Updated {0}', [formatDateTime(o.updatedAt)])}</span>
      </div>
      <div className="exchange-sides">
        <div>
          <p className="exchange-sides__label">{t('Customer sends')}</p>
          <p className="exchange-sides__value tabular">{sides.sends}</p>
          <p className="small muted">{sides.sendsNote}</p>
        </div>
        <span className="exchange-sides__arrow" aria-hidden="true">
          →
        </span>
        <div>
          <p className="exchange-sides__label">{t('Customer receives')}</p>
          <p className="exchange-sides__value tabular">{sides.receives}</p>
          <p className="small muted">{sides.receivesNote}</p>
        </div>
      </div>
      <dl className="dl dl--compact">
        <div>
          <dt>{t('Exchange rate')}</dt>
          <dd className="tabular">
            {formatPriceMicros(rate, o.asset)} {t('per')} {o.asset}
          </dd>
        </div>
        <div>
          <dt>{t('Fees')}</dt>
          <dd className="tabular">
            {o.courierFee?.pending || o.quote.feePending
              ? t('Courier fee: calculated individually (not set yet)')
              : t('spread {0} · {1} {2}', [
                  formatUsd(o.quote.spreadCents),
                  o.direction === 'buy' ? (o.payIn === 'wire' ? t('wire') : t('courier')) : t('payout'),
                  formatUsd(o.quote.payoutFeeCents),
                ])}
          </dd>
        </div>
      </dl>
      {o.courierFee?.awaitingAcceptance ? (
        <p className="notice notice--info small">{t('Waiting for the customer to accept the courier fee.')}</p>
      ) : null}
      {o.reviewReason ? (
        <p className="small order-card__flag">
          <Icon name="alert" width={14} height={14} /> {t('Review reason')}: {t(o.reviewReason)}
        </p>
      ) : null}
      <ActionBar detail={detail} onResult={onResult} reload={reload} />
    </section>
  );
}

function ActionBar({ detail, onResult, reload }: { detail: AdminOrderDetail; onResult(r: Result): void; reload(): void }) {
  const o = detail.order;
  const plan = actionPlan(
    {
      ...o,
      payoutMethod: o.payout.method,
      courierFeePending: o.courierFee?.pending,
    },
    detail.actions,
  );
  const [open, setOpen] = useState<CardAction | null>(null);
  const [menu, setMenu] = useState(false);
  const why = (a: CardAction) => detail.actions.find((x) => x.action === a)?.unavailable;
  const danger = (a: CardAction) => a === 'reject' || a === 'refund';
  return (
    <div className="action-bar">
      {plan.primary ? (
        <button type="button" className={`btn ${danger(plan.primary) ? 'btn--danger' : ''}`} onClick={() => setOpen(plan.primary)}>
          {t(ACTION_LABEL[plan.primary])}
        </button>
      ) : plan.waitingFor ? (
        <p className="action-bar__waiting small">
          <Icon name="clock" width={16} height={16} /> {t(plan.waitingFor)}
        </p>
      ) : null}
      {plan.secondary ? (
        <button
          type="button"
          className={`btn ${danger(plan.secondary) ? 'btn--danger' : 'btn--secondary'}`}
          onClick={() => setOpen(plan.secondary)}
        >
          {t(ACTION_LABEL[plan.secondary])}
        </button>
      ) : null}
      {plan.more.length ? (
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <button type="button" className="btn btn--ghost" aria-label={t('More actions')}>
              {t('More')} <Icon name="chevronDown" width={16} height={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="action-menu">
            <ul role="menu" aria-label={t('More actions')}>
              {plan.more.map((a) => (
                <li key={a} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={danger(a) ? 'is-danger' : undefined}
                    onClick={() => {
                      setMenu(false);
                      setOpen(a);
                    }}
                  >
                    {t(ACTION_LABEL[a])}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
      {open ? (
        <ActionDialog
          action={open}
          detail={detail}
          unavailable={open === 'notify' ? why('message') : why(open)}
          onClose={() => setOpen(null)}
          onDone={(r) => {
            setOpen(null);
            onResult(r);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------- Action dialogs ---------- */

function ActionDialog({
  action,
  detail,
  unavailable,
  onClose,
  onDone,
}: {
  action: CardAction;
  detail: AdminOrderDetail;
  unavailable: string | null | undefined;
  onClose(): void;
  onDone(r: Result): void;
}) {
  const { admin } = useServices();
  const me = useUser();
  const o = detail.order;
  const templates = notifyTemplates(o.status, o.onHold);
  const fill = (body: string) => t(body, { ref: o.reference });
  const [text, setText] = useState(
    action === 'notify' ? fill(templates[0]!.body) : action === 'request_info' || action === 'note' ? '' : t(DEFAULT_REASON[action] ?? ''),
  );
  const [evidenceRef, setEvidenceRef] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [courierFeeUsd, setCourierFeeUsd] = useState('');
  const [template, setTemplate] = useState(templates[0]!.id);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]!);
  const [assignee, setAssignee] = useState(detail.order.assignedOperatorId ?? '');
  const [staff, setStaff] = useState<{ id: string; email: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (action !== 'assign') return;
    admin
      .staff()
      .then(setStaff)
      .catch((e: unknown) => setErr(errorMessage(e)));
  }, [action, admin]);

  const minLength = action === 'request_info' ? 10 : action === 'notify' || action === 'note' ? 2 : 4;
  const reasonText = action === 'reject' ? (rejectReason === 'Other' ? text : [t(rejectReason), text].filter(Boolean).join('. ')) : text;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (action !== 'assign' && reasonText.trim().length < minLength) {
      setErr(t('Write at least {0} characters.', [minLength]));
      return;
    }
    if (action === 'record_manual_payout' && evidenceRef.trim().length < 4) {
      setErr(t('Provide an evidence reference (at least 4 characters).'));
      return;
    }
    let feeCents: number | undefined;
    if (action === 'set_courier_fee') {
      const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(courierFeeUsd.trim());
      if (!m) {
        setErr(t('Enter the courier fee in US dollars, for example 45 or 45.00.'));
        return;
      }
      feeCents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
    }
    setBusy(true);
    setErr(null);
    const expectedStatus = o.status;
    try {
      if (action === 'notify') await admin.act(o.id, 'message', { message: text.trim(), expectedStatus });
      else if (action === 'request_info') await admin.act(o.id, 'request_info', { message: text.trim(), expectedStatus });
      else if (action === 'note') await admin.act(o.id, 'note', { body: text.trim() });
      else if (action === 'assign') await admin.act(o.id, 'assign', { operatorId: assignee || null });
      else if (action === 'record_manual_payout')
        await admin.act(o.id, action, {
          reason: reasonText.trim(),
          evidenceRef: evidenceRef.trim(),
          evidenceNote: evidenceNote.trim() || undefined,
          expectedStatus,
        });
      else if (action === 'set_courier_fee')
        await admin.act(o.id, action, { feeCents, reason: reasonText.trim() || t('Courier fee quoted for this order.'), expectedStatus });
      else await admin.act(o.id, action, { reason: reasonText.trim(), expectedStatus });
      onDone({ tone: 'success', text: t(SUCCESS[action] ?? 'Done.') });
    } catch (x) {
      if (x instanceof ApiError && x.code === 'stale_status') onDone({ tone: 'danger', text: errorMessage(x) });
      else setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  }

  const label = t(ACTION_LABEL[action]);
  return (
    <ConfirmDialog
      open
      onOpenChange={(v) => (v ? undefined : onClose())}
      busy={busy}
      title={`${label} · ${o.reference}`}
      description={ACTION_EXPLAIN[action] ? t(ACTION_EXPLAIN[action]!) : undefined}
    >
      {unavailable ? (
        <p className="notice notice--warn small">{t(unavailable)}</p>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {action === 'notify' ? (
            <>
              <div className="field">
                <label className="field__label" htmlFor="notify-template">
                  {t('Template')}
                </label>
                <select
                  id="notify-template"
                  className="select"
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value);
                    setText(fill(templates.find((x) => x.id === e.target.value)?.body ?? ''));
                  }}
                >
                  {templates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {t(x.label)}
                    </option>
                  ))}
                </select>
              </div>
              <TextField id="notify-text" label={t('Message the customer will receive')} value={text} onChange={setText} rows={4} />
              <p className="small muted">
                {t(
                  'It appears in the customer’s support messages for this order, with an account notification.',
                )}
              </p>
            </>
          ) : action === 'request_info' ? (
            <TextField
              id="info-text"
              label={t('Question for the customer (sent to their support messages)')}
              value={text}
              onChange={setText}
              rows={4}
            />
          ) : action === 'reject' ? (
            <>
              <div className="field">
                <label className="field__label" htmlFor="reject-reason">
                  {t('Reason')}
                </label>
                <select id="reject-reason" className="select" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                  {REJECT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(r)}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                id="reject-text"
                label={rejectReason === 'Other' ? t('Reason (recorded in the audit log)') : t('Comment (optional)')}
                value={text}
                onChange={setText}
                rows={2}
              />
            </>
          ) : action === 'assign' ? (
            <div className="field">
              <label className="field__label" htmlFor="assignee">
                {t('Assign to')}
              </label>
              <select id="assignee" className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">{t('Unassigned')}</option>
                {me ? <option value={me.id}>{t('Me ({0})', [me.email])}</option> : null}
                {(staff ?? [])
                  .filter((s) => s.id !== me?.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.email}
                    </option>
                  ))}
              </select>
            </div>
          ) : action === 'note' ? (
            <TextField
              id="note-text"
              label={t('Note for the team (never shown to the customer)')}
              value={text}
              onChange={setText}
              rows={3}
            />
          ) : action === 'set_courier_fee' ? (
            <>
              <p className="notice notice--info small">
                {t(
                  'Courier delivery cost depends on the order. Enter the fee for this order only. The customer must accept the recalculated quote before the exchange continues.',
                )}
              </p>
              <div className="field">
                <label className="field__label" htmlFor="courier-fee-usd">
                  {t('Courier fee (USD)')}
                </label>
                <input
                  id="courier-fee-usd"
                  className="input"
                  inputMode="decimal"
                  value={courierFeeUsd}
                  onChange={(e) => setCourierFeeUsd(e.target.value)}
                  placeholder="45.00"
                  required
                />
              </div>
              <TextField id="courier-fee-reason" label={t('Reason (recorded in the audit log)')} value={text} onChange={setText} rows={2} />
            </>
          ) : action === 'record_manual_payout' ? (
            <>
              <p className="notice notice--warn small">
                {t(
                  'This marks the payout as completed with an operator-recorded confirmation. It is not a provider-verified completion. Use only when you have reliable evidence.',
                )}
              </p>
              <TextField id="manual-reason" label={t('Reason (recorded in the audit log)')} value={text} onChange={setText} rows={2} />
              <div className="field">
                <label className="field__label" htmlFor="evidence-ref">
                  {t('Evidence reference')}
                </label>
                <input
                  id="evidence-ref"
                  className="input"
                  value={evidenceRef}
                  onChange={(e) => setEvidenceRef(e.target.value)}
                  placeholder={t('Bank ref, receipt id, or desk log id')}
                  required
                  minLength={4}
                  maxLength={200}
                />
              </div>
              <TextField
                id="evidence-note"
                label={t('Evidence notes (internal, optional)')}
                value={evidenceNote}
                onChange={setEvidenceNote}
                rows={2}
              />
            </>
          ) : (
            <TextField id="reason-text" label={t('Reason (recorded in the audit log)')} value={text} onChange={setText} rows={2} />
          )}
          {err ? (
            <p className="field__error" role="alert">
              <Icon name="alert" /> <span>{err}</span>
            </p>
          ) : null}
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              {t('Cancel')}
            </button>
            <button type="submit" className={`btn ${action === 'reject' || action === 'refund' ? 'btn--danger' : ''}`} disabled={busy}>
              {busy ? t('Saving…') : action === 'notify' ? t('Send message') : label}
            </button>
          </div>
        </form>
      )}
    </ConfirmDialog>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  rows,
}: {
  id: string;
  label: string;
  value: string;
  onChange(v: string): void;
  rows: number;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="textarea" rows={rows} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------- Block B: customer and operation ---------- */

function ClientBlock({ detail }: { detail: AdminOrderDetail }) {
  const o = detail.order;
  const c = detail.customer;
  const d = detail.courierDelivery;
  const buy = o.direction === 'buy';
  return (
    <section className="order-block" aria-labelledby="block-client">
      <h3 id="block-client" className="order-block__title">
        {t('Customer and operation')}
      </h3>
      <div className="order-block__cols">
        <dl className="dl dl--compact">
          <Row term={t('Customer')}>
            {c.name || '—'}
            <span className="small muted block">{c.email}</span>
          </Row>
          <Row term={t('Phone')}>{c.phone ?? '—'}</Row>
          <Row term={t('Verification')}>
            {t(c.kycStatus.replace('_', ' '))} · {t('{0} of {1} orders completed', [c.orders.completed, c.orders.total])}
          </Row>
          {o.assignedOperatorId ? <Row term={t('Assigned to')}>{shortId(o.assignedOperatorId)}</Row> : null}
        </dl>
        <dl className="dl dl--compact">
          <Row term={buy ? t('Crypto sent to') : t('Payout to')}>
            {buy ? (
              <span className="mono small break">{o.receiveAddress}</span>
            ) : (
              <>
                {t(o.payout.methodName)}
                <span className="small muted block">{destinationLabel(o.payout.label, o.payout.last4)}</span>
              </>
            )}
          </Row>
          {d ? (
            <Row term={buy ? t('Courier collection') : t('Courier delivery')}>
              {d.recipient} · <span className="tabular">{d.phone}</span>
              <span className="small muted block">
                {d.line1}
                {d.line2 ? `, ${d.line2}` : ''}, {d.city}, {d.state} {d.zip} · {t(COURIER_WINDOW_LABELS[d.window])}
              </span>
              {d.masked ? <span className="small muted block">{t('Street address and phone are masked for your role.')}</span> : null}
            </Row>
          ) : null}
          {!buy ? (
            <Row term={t('Deposit address')}>
              <span className="mono small break">{o.deposit.address ?? '—'}</span>
            </Row>
          ) : null}
          <Row term={buy ? t('Cash counted') : t('Deposit')}>
            {o.deposit.amountAtomic !== null ? (
              <>
                {buy ? formatUsd(o.deposit.amountAtomic) : formatAsset(o.deposit.amountAtomic, o.asset)}
                {!buy ? (
                  <span className="small muted block">
                    {t('{0} of {1} confirmations', [o.deposit.confirmations.count, o.deposit.confirmations.required])}
                    {o.deposit.txHash ? (
                      <span className="block">
                        <TxHashLink txHash={o.deposit.txHash} network={o.network} className="mono small" />
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="muted">{t('Not received yet')}</span>
            )}
            {o.deposit.exception ? <span className="badge badge--warn">{t(o.deposit.exception.replace('_', ' '))}</span> : null}
          </Row>
          {!buy && o.deposit.customerTxHash ? (
            <Row term={t('Customer tx hash')}>
              <TxHashLink txHash={o.deposit.customerTxHash} network={o.network} className="mono small" />
              <span className="small muted block">{t('Format checked only, not proof of deposit')}</span>
            </Row>
          ) : null}
          {buy ? (
            <Row term={t('ID uploaded')}>
              {o.documents.length
                ? o.documents.map((doc) => (
                    <span key={doc.id} className="small block">
                      {doc.fileName} · {formatDateTime(doc.createdAt)}
                    </span>
                  ))
                : '—'}
            </Row>
          ) : (
            <Row term={t('Refund address')}>
              {o.refundAddress ? (
                <span className="mono small break">{o.refundAddress}</span>
              ) : (
                <span className="small muted">{t('Not given yet. Asked for only if a refund is needed.')}</span>
              )}
            </Row>
          )}
        </dl>
      </div>
    </section>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ---------- Block C: history ---------- */

type HistoryItem = { at: number; kind: 'event' | 'notice' | 'note' | 'problem'; text: string; meta?: string };

function HistoryBlock({ detail }: { detail: AdminOrderDetail }) {
  const o = detail.order;
  const items: HistoryItem[] = [];
  for (const e of o.events) {
    if (e.type === 'CONFIRMATIONS_UPDATED') continue;
    const reason = (e.data as { reason?: string } | undefined)?.reason;
    const who =
      e.actorType === 'operator'
        ? t('Staff')
        : e.actorType === 'provider'
          ? t('Provider')
          : e.actorType === 'customer'
            ? t('Customer')
            : t('System (automatic)');
    const problem = e.toStatus === 'failed' || e.type === 'PAYOUT_FAILED' || e.type === 'DEPOSIT_INSTRUCTIONS_FAILED';
    items.push({
      at: e.createdAt,
      kind: problem ? 'problem' : 'event',
      text: t(e.detail),
      meta: [
        who,
        e.toStatus !== e.fromStatus && e.fromStatus ? t(orderStatusLabel(e.toStatus, o.direction, o.payIn ?? undefined)) : null,
        reason,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  for (const n of detail.notifications) {
    items.push({
      at: n.createdAt,
      kind: n.status === 'failed' ? 'problem' : 'notice',
      text: `${t('Notification')}: ${notificationText(n).subject}`,
      meta: t(NOTIFY_STATUS[n.status] ?? n.status) + (n.readAt ? ` · ${t('read')}` : ''),
    });
  }
  for (const n of detail.notes)
    items.push({ at: n.createdAt, kind: 'note', text: n.body, meta: `${t('Internal note')} · ${n.author.email}` });
  items.sort((a, b) => b.at - a.at);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <section className="order-block" aria-labelledby="block-history">
      <h3 id="block-history" className="order-block__title">
        {t('History')}
      </h3>
      <ol className="history">
        {shown.map((h, i) => (
          <li key={`${h.at}-${i}`} className={`history__item history__item--${h.kind}`}>
            <span className="history__time tabular small">{formatDateTime(h.at)}</span>
            <span className="history__text">
              {h.text}
              {h.meta ? <span className="small muted block">{h.meta}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {items.length > shown.length ? (
        <button type="button" className="link-button small" onClick={() => setAll(true)}>
          {t('Show all {0} entries', [items.length])}
        </button>
      ) : null}
    </section>
  );
}

/* ---------- Details on demand ---------- */

function MoreDetails({ detail }: { detail: AdminOrderDetail; reload(): void }) {
  const o = detail.order;
  return (
    <details className="order-more">
      <summary>{t('More details: payments, reviews, conversations, audit')}</summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <dl className="dl dl--compact">
          <Row term={t('Quote snapshot')}>
            <span className="mono small">{o.quote.id}</span>
          </Row>
          <Row term={t('Deadline')}>{formatDateTime(o.deposit.deadline)}</Row>
          {detail.payouts.map((p) => (
            <Row key={p.id} term={t('Payout attempt {0}', [p.attempt])}>
              {p.status} · {formatUsd(BigInt(p.amountCents))}
              <span className="small muted block">
                {p.providerRef ?? '—'}
                {p.failureReason ? ` · ${p.failureReason}` : ''}
                {p.authorizationReason ? ` · ${p.authorizationReason}` : ''}
              </span>
            </Row>
          ))}
          {detail.refund ? (
            <Row term={t('Refund')}>
              {detail.refund.status} · {detail.refund.reason}
              {detail.refund.txHash ? (
                <TxHashLink txHash={detail.refund.txHash} network={o.network} className="mono small" />
              ) : null}
            </Row>
          ) : null}
          {detail.reviews.map((r) => (
            <Row key={r.id} term={t('Compliance review')}>
              {r.status} · {r.reason}
              {r.decisionReason ? <span className="small muted block">{r.decisionReason}</span> : null}
            </Row>
          ))}
          <Row term={t('Conversations')}>
            {detail.conversations.length
              ? detail.conversations.map((cv) => (
                  <Link key={cv.id} className="block small" to={`/admin/inbox/${cv.id}`}>
                    {cv.subject} · {cv.status}
                  </Link>
                ))
              : t('No conversations about this order.')}
          </Row>
        </dl>
        <p className="small">
          <Link to={`/admin/audit?targetType=order&targetId=${o.id}`}>{t('Open in audit log')}</Link>
        </p>
      </div>
    </details>
  );
}
