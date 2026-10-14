import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Countdown } from '@/components/Countdown';
import { Icon } from '@/components/Icon';
import { SupportContact, TelegramLink } from '@/components/SupportContact';
import { EventLog, OrderProgressBar, StatusRail } from '@/components/TransactionProgress';
import { LiveIndicator } from '@/components/chat/Chat';
import { MockBadge, Notice, StatusBadge } from '@/components/ui';
import { ASSETS, NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd, formatBps } from '@/domain/money';
import {
  canRaise,
  DEPOSIT_EXCEPTION_LABEL,
  isPreviewDepositAddress,
  orderStatusLabel,
  orderTone,
  TERMINAL_ORDER_STATUSES,
} from '@/domain/order';
import { validateTxHash } from '@/domain/validation';
import { ApiError } from '@/services/http';
import { errorMessage } from '@/lib/errors';
import { describeDestination, destinationLabel, formatAsset, formatDateTime, formatPriceMicros } from '@/lib/format';
import { gsap, REDUCED_OK, useGSAP } from '@/lib/motion';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useExpired } from '@/lib/useExpired';
import type { OrderView } from '@/services/types';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { useLiveEvents, useLiveState } from '@/state/useLive';

type Run = (fn: () => Promise<OrderView>) => void;

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
 * The sandbox autopilot moves an order on by itself once the customer has done
 * their part: a submitted tx hash (sell) or an uploaded ID (buy). Each step is
 * a signed sandbox webhook through the normal pipeline.
 */
function autopilotEngaged(order: OrderView, stepMs: number) {
  if (order.source !== 'sandbox' || stepMs <= 0) return false;
  return order.direction === 'buy' ? order.documents.length > 0 : order.deposit.customerReportedSentAt !== null;
}

/**
 * Sandbox stand-ins for deposit monitoring. Each button asks the server to
 * emit a signed test webhook, which goes through the same verification and
 * state machine as a real provider callback. Payout and refund outcomes are
 * staff-only, in the admin sandbox lab.
 */
function SandboxControls({ order, busy, run }: { order: OrderView; busy: boolean; run: Run }) {
  const { sandbox } = useServices();
  const config = useConfig();
  if (!sandbox) return null;
  const awaiting = order.status === 'awaiting_deposit';
  const confirming = order.status === 'deposit_observed' || order.status === 'confirming';
  const moving = awaiting || confirming || order.status === 'payout_submitted' || order.status === 'payout_processing';
  const buy = order.direction === 'buy';
  if (autopilotEngaged(order, config.sandboxAutopilotStepMs)) {
    if (!moving) return null;
    return (
      <p className="small muted autopilot-note" role="status">
        <MockBadge label="Sandbox autopilot" force /> The sandbox {buy ? 'courier and cash desk' : 'deposit monitor'} moves this order one
        step about every {Math.round(config.sandboxAutopilotStepMs / 1000)} seconds using signed test events. Nothing real is collected,
        sent or broadcast.
      </p>
    );
  }
  if (!awaiting && !confirming) return null;
  return (
    <section className="mock-controls" aria-labelledby="mock-controls-title">
      <h2 id="mock-controls-title">
        <MockBadge label="Sandbox controls" force /> {buy ? 'Simulate the courier' : 'Simulate the blockchain'}
      </h2>
      <p className="small muted">
        These buttons send a signed test event from the sandbox {buy ? 'cash provider' : 'deposit monitor'}. The server checks the signature
        and moves the order through the same rules a real {buy ? 'collection' : 'deposit'} would. They don’t exist outside the sandbox.
      </p>
      <div className="row">
        {awaiting ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => sandbox.deposit(order.id, 'exact'))}>
              {buy ? 'Courier collects the exact cash' : 'Deposit the exact amount'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => run(() => sandbox.deposit(order.id, 'short'))}
            >
              {buy ? 'Cash is short' : 'Deposit too little'}
            </button>
          </>
        ) : null}
        {confirming ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => sandbox.confirmations(order.id, true))}>
              {buy ? 'Finish the cash count' : 'Reach final confirmations'}
            </button>
            {!buy ? (
              <button
                type="button"
                className="btn btn--secondary"
                disabled={busy}
                onClick={() => run(() => sandbox.confirmations(order.id, false))}
              >
                Add one confirmation
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

/** Sell orders: the customer submits the transaction hash of their transfer for the team to review. */
function TxHashForm({ order, busy, run }: { order: OrderView; busy: boolean; run: Run }) {
  const { orders } = useServices();
  const [hash, setHash] = useState('');
  const [touched, setTouched] = useState(false);
  if (order.deposit.customerReportedSentAt)
    return (
      <Notice tone="neutral" title="Transaction hash submitted for review">
        {order.deposit.customerTxHash ? (
          <p className="mono small" style={{ overflowWrap: 'anywhere' }}>
            {order.deposit.customerTxHash}
          </p>
        ) : null}
        <p>
          Received at {formatDateTime(order.deposit.customerReportedSentAt)}. A hash helps our team find your transfer, but it does not
          confirm a deposit: the order moves on only when deposit monitoring reports the transaction on the {NETWORKS[order.network].name}{' '}
          network.
        </p>
        <p>
          If more proof is needed, support will contact you in your <Link to="/support">support messages</Link>, or you can reach us on{' '}
          <TelegramLink />.
        </p>
      </Notice>
    );
  if (!canRaise(order.status, 'CUSTOMER_REPORTED_SENT', 'customer')) return null;
  const error = touched ? validateTxHash(hash, order.network) : null;
  return (
    <form
      className="stack tx-hash-form"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (validateTxHash(hash, order.network)) {
          document.getElementById('tx-hash')?.focus();
          return;
        }
        run(() => orders.reportSent(order.id, hash.trim()));
      }}
    >
      <h3 className="title">Sent it? Submit the transaction hash</h3>
      <div className="field" data-invalid={error ? 'true' : undefined}>
        <label className="field__label" htmlFor="tx-hash">
          Transaction hash (TXID)
        </label>
        <input
          id="tx-hash"
          className="input mono"
          value={hash}
          onChange={(e) => setHash(e.target.value.trim())}
          onBlur={() => hash && setTouched(true)}
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'tx-hash-error tx-hash-hint' : 'tx-hash-hint'}
          placeholder={order.network === 'ethereum' || order.network === 'base' ? '0x…' : undefined}
        />
        {error ? (
          <p className="field__error" id="tx-hash-error">
            <Icon name="alert" /> {error}
          </p>
        ) : null}
        <p className="field__hint" id="tx-hash-hint">
          Copy it from your wallet’s transaction details. We check its format only; it doesn’t confirm the deposit.
        </p>
      </div>
      <div>
        <button type="submit" className="btn btn--secondary" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </form>
  );
}

const ID_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ID_MAX_BYTES = 4 * 1024 * 1024;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(new Error('The file could not be read. Choose it again.'));
    r.readAsDataURL(file);
  });
}

/** Buy orders: the photo ID the courier checks at the handover. A demo upload: the sandbox checks the file and discards it. */
function IdUpload({ order, onChange }: { order: OrderView; onChange: () => void }) {
  const { orders } = useServices();
  const sandbox = useConfig().mode === 'sandbox';
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = order.status === 'created' || order.status === 'awaiting_deposit';
  if (!open && !order.documents.length) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError('Choose a photo or scan of your ID.');
    if (!ID_TYPES.includes(file.type)) return setError('Upload a JPEG, PNG or PDF file.');
    if (file.size > ID_MAX_BYTES) return setError('The file is larger than 4 MB. Use a smaller photo or scan.');
    setBusy(true);
    setError(null);
    try {
      const dataBase64 = await readBase64(file);
      await orders.uploadDocument(order.id, { kind: 'id_document', fileName: file.name, contentType: file.type, dataBase64 });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="id-title">
      <div className="panel__head">
        <h3 id="id-title">Photo ID for the courier</h3>
        {sandbox ? <MockBadge label="Demo upload" force /> : null}
      </div>
      <div className="panel__body stack">
        {order.documents.length ? (
          <ul className="doc-list">
            {order.documents.map((d) => (
              <li key={d.id}>
                <Icon name="check" width={16} height={16} />
                <span>
                  <strong>{d.fileName}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {d.contentType.replace(/^.*\//, '').toUpperCase()} · {Math.max(1, Math.round(d.sizeBytes / 1024))} KB · received{' '}
                    {formatDateTime(d.createdAt)}
                    {d.stored ? '' : ' · checked and discarded (sandbox: the file is not kept)'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">
            Upload the photo ID you will show the courier. The courier collects cash only from the verified account holder.
            {sandbox ? ' Sandbox: use a test image, not a real document. The file is checked and then discarded.' : ''}
          </p>
        )}
        {open && order.documents.length < 3 ? (
          <form className="stack" onSubmit={submit} noValidate>
            <div className="field" data-invalid={error ? 'true' : undefined}>
              <label className="field__label" htmlFor="id-file">
                {order.documents.length ? 'Add another file' : 'ID document (JPEG, PNG or PDF, up to 4 MB)'}
              </label>
              <input
                ref={inputRef}
                id="id-file"
                className="input"
                type="file"
                accept={ID_TYPES.join(',')}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'id-file-error' : undefined}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
              {error ? (
                <p className="field__error" id="id-file-error" role="alert">
                  <Icon name="alert" /> {error}
                </p>
              ) : null}
            </div>
            <div>
              <button type="submit" className="btn btn--secondary" disabled={busy || !file}>
                {busy ? 'Uploading…' : 'Upload ID'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}

/** Explanations for each state, worded for the order's direction. Processing states say what is happening and who acts next. */
function StatusNotice({ order }: { order: OrderView }) {
  const buy = order.direction === 'buy';
  const sandbox = order.source === 'sandbox';
  const demo = sandbox ? ' (sandbox simulation)' : '';
  const help = (
    <p className="small">
      Questions? Reach support on <TelegramLink /> or in your <Link to="/support">support messages</Link>.
    </p>
  );
  switch (order.status) {
    case 'created':
      return (
        <Notice tone="info" title={buy ? 'Arranging the courier' : 'Preparing your deposit address'} role="status">
          <p>This usually takes a moment. The page updates by itself.</p>
        </Notice>
      );
    case 'deposit_observed':
    case 'confirming':
      return (
        <Notice tone="info" title={buy ? `Cash collected${demo}` : `Deposit seen${demo}`} role="status">
          <p>
            {buy
              ? 'The courier reported collecting the cash. It is now counted and checked before any crypto is sent.'
              : `Deposit monitoring reported a transfer for this order. It becomes final after ${order.deposit.confirmations.required} network confirmations.`}
          </p>
        </Notice>
      );
    case 'deposit_confirmed':
      return (
        <Notice tone="info" title={buy ? `Cash verified${demo}` : `Deposit final${demo}`} role="status">
          <p>Automatic checks are running. This page updates by itself.</p>
        </Notice>
      );
    case 'compliance_review':
      return (
        <Notice tone="warn" title="Held for review">
          <p>
            A member of our team is checking this order before {buy ? 'the crypto is sent' : 'payout'}.
            {order.deposit.exception ? ` Reason: ${DEPOSIT_EXCEPTION_LABEL[order.deposit.exception]}` : ''} If more proof is needed, support
            will contact you in your <Link to="/support">support messages</Link>, or you can reach us on <TelegramLink />.
          </p>
        </Notice>
      );
    case 'ready_for_payout':
      return (
        <Notice tone="info" title={buy ? 'Approved: waiting for the transfer to be authorized' : 'Approved for payout'} role="status">
          <p>
            {buy
              ? 'The cash is verified and checks are complete. A member of our team authorizes each crypto transfer before it is sent.'
              : 'Your deposit is final and checks are complete. A member of our team authorizes each payout before it goes to the payout provider.'}
          </p>
          {help}
        </Notice>
      );
    case 'payout_submitted':
    case 'payout_processing':
      return (
        <Notice tone="info" title={buy ? `Crypto transfer in progress${demo}` : `Payout in progress${demo}`} role="status">
          <p>
            {buy
              ? `The transfer of ${formatAsset(order.amountAtomic, order.asset)} was handed to the custody provider. This page shows it as completed only when the provider reports it.`
              : 'The payout instruction was accepted by the payout provider. This page shows it as completed only when the provider reports it.'}
            {sandbox ? ' In the sandbox nothing is broadcast or paid.' : ''}
          </p>
          {help}
        </Notice>
      );
    case 'failed':
      return (
        <Notice tone="danger" title={buy ? 'The crypto transfer didn’t go through' : 'The payout didn’t go through'}>
          <p>
            Our team has been alerted and will retry or contact you. If the exchange cannot be completed, clause 4.2 of the{' '}
            <Link to="/legal/terms#clause-4-2">Service Rules</Link> governs the return of funds.
          </p>
          {help}
        </Notice>
      );
    case 'refund_pending':
      return (
        <Notice tone="warn" title={buy ? 'Cash return in progress' : 'Refund in progress'}>
          <p>
            {buy
              ? 'The courier will return your cash to you after an ID check. '
              : `We are returning your ${order.asset} on-chain to the refund address you gave. `}
            Return fees and timeframes are set by Section 9 of the Service Rules; see the <Link to="/legal/refunds">refund policy</Link>.
          </p>
          {help}
        </Notice>
      );
    case 'refunded':
      return (
        <Notice tone="neutral" title="Refunded">
          <p>{buy ? 'The provider reported your cash as returned.' : `Your ${order.asset} was returned to your refund address.`}</p>
        </Notice>
      );
    case 'expired':
      return (
        <Notice tone="neutral" title={buy ? 'The collection window closed' : 'The deposit window closed'}>
          {buy ? (
            <p>
              The cash wasn’t collected in time, so this order expired. Nothing was taken. Start a new exchange or{' '}
              <Link to="/support">contact support</Link>.
            </p>
          ) : (
            <p>
              No deposit was seen in time, so this order expired. If you sent funds after the window closed,{' '}
              <Link to="/support">contact support</Link>. Under clause 4.14 of the <Link to="/legal/terms#clause-4-14">Service Rules</Link>,
              such funds are transferred back with the related commission fees deducted, and if you ask to proceed with the exchange
              instead, the rate and terms may be changed.
            </p>
          )}
          {help}
        </Notice>
      );
    case 'rejected':
      return (
        <Notice tone="neutral" title="We couldn’t accept this order">
          <p>
            If you already sent funds, their return is handled under Sections 8 and 9 of the <Link to="/legal/refunds">Service Rules</Link>.
          </p>
          {help}
        </Notice>
      );
    default:
      return null;
  }
}

/**
 * Completed order: the final figures and what happens next. The check draws
 * itself once (~0.6s) when the order completes while the page is open; under
 * reduced motion, or on a later visit, it is simply shown.
 */
function SuccessPanel({ order, animate }: { order: OrderView; animate: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const buy = order.direction === 'buy';
  const sandbox = order.source === 'sandbox';
  useGSAP(
    () => {
      if (!animate) return;
      const mm = gsap.matchMedia();
      mm.add(REDUCED_OK, () => {
        gsap.from('.success__mark', { scale: 0.6, opacity: 0, duration: 0.35, ease: 'back.out(2)' });
        gsap.fromTo('.success__check', { strokeDashoffset: 30 }, { strokeDashoffset: 0, duration: 0.45, delay: 0.15, ease: 'power2.out' });
        gsap.from('.success__body > *', { y: 8, opacity: 0, duration: 0.3, stagger: 0.06, delay: 0.2, ease: 'power2.out' });
      });
    },
    { dependencies: [animate], scope: ref },
  );
  return (
    <section className="panel success" ref={ref} aria-labelledby="success-title">
      <div className="panel__body success__body">
        <div className="success__head">
          <svg className="success__mark" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
            <circle cx="24" cy="24" r="22" />
            <path className="success__check" d="M14 25l7 7 13-15" pathLength={30} />
          </svg>
          <div className="stack" style={{ gap: 4 }}>
            <h2 id="success-title" className="flow__step-title">
              {buy ? 'Exchange completed' : 'Payout completed'}
            </h2>
            <p className="row" style={{ gap: 8 }}>
              <StatusBadge tone="success">{sandbox ? 'Completed (demo)' : 'Completed'}</StatusBadge>
              <span className="small muted">
                Order <span className="mono">{order.reference}</span>
              </span>
            </p>
          </div>
        </div>
        <dl className="dl">
          <div>
            <dt>{buy ? 'Cash paid' : 'You sent'}</dt>
            <dd className="tabular">{buy ? formatUsd(order.quote.grossCents) : formatAsset(order.amountAtomic, order.asset)}</dd>
          </div>
          <div>
            <dt>{buy ? 'Crypto received' : 'You received'}</dt>
            <dd className="tabular">
              <strong>{buy ? formatAsset(order.amountAtomic, order.asset) : formatUsd(order.quote.netCents)}</strong>
            </dd>
          </div>
          <div>
            <dt>{buy ? 'Sent to' : 'Paid to'}</dt>
            <dd className={buy ? 'mono' : undefined}>
              {buy ? order.receiveAddress : destinationLabel(order.payout.label, order.payout.last4)}
            </dd>
          </div>
          {order.payout.providerRef ? (
            <div>
              <dt>Provider reference</dt>
              <dd className="mono">{order.payout.providerRef}</dd>
            </div>
          ) : null}
        </dl>
        {sandbox ? (
          <p className="small">
            <MockBadge force /> This is a sandbox demo. The amounts are simulated and nothing was{' '}
            {buy ? 'collected, sent or broadcast' : 'received or paid out'}.
          </p>
        ) : (
          <p className="small">
            {buy
              ? 'The custody provider reported the transfer as completed. Your wallet may take time to show it.'
              : `The payout provider reported the payout as completed. ${order.payout.method === 'courier_cash' ? '' : 'Your bank may take time to show it.'}`}
          </p>
        )}
        <div className="stack" style={{ gap: 8 }}>
          <h3 className="title">Next steps</h3>
          <ul className="small next-steps">
            <li>Keep the order number {order.reference} for your records; the receipt is on this page.</li>
            <li>
              Something doesn’t match? Contact support with the order number on <TelegramLink /> or in your{' '}
              <Link to="/support/new">support messages</Link>.
            </li>
          </ul>
          <div className="row">
            <Link className="btn" to={buy ? '/exchange?direction=buy' : '/exchange'}>
              Start another exchange
            </Link>
            <Link className="btn btn--secondary" to="/orders">
              View all orders
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Courier orders use the same payout states; only the words change. */
const COURIER_STEP_LABELS: Partial<Record<string, string>> = { payout: 'Courier scheduled', completed: 'Cash delivered' };
const courierStep = <T extends { key: string; label: string }>(step: T): T => ({
  ...step,
  label: COURIER_STEP_LABELS[step.key] ?? step.label,
});

function Receipt({ order }: { order: OrderView }) {
  const buy = order.direction === 'buy';
  return (
    <dl className="dl">
      <div>
        <dt>{buy ? 'You pay in cash' : 'You send'}</dt>
        <dd className="tabular">{buy ? formatUsd(order.quote.grossCents) : formatAsset(order.amountAtomic, order.asset)}</dd>
      </div>
      <div>
        <dt>Reference price</dt>
        <dd className="tabular">
          {formatPriceMicros(order.quote.referencePriceMicros, order.asset)} per {ASSETS[order.asset].code}
        </dd>
      </div>
      {!buy ? (
        <div>
          <dt>Value</dt>
          <dd className="tabular">{formatUsd(order.quote.grossCents)}</dd>
        </div>
      ) : null}
      <div>
        <dt>Exchange spread ({formatBps(order.quote.spreadBps)})</dt>
        <dd className="tabular">−{formatUsd(order.quote.spreadCents)}</dd>
      </div>
      <div>
        <dt>{buy ? 'Courier fee' : 'Payout fee'}</dt>
        <dd className="tabular">−{formatUsd(order.quote.payoutFeeCents)}</dd>
      </div>
      {buy ? (
        <div>
          <dt>Converted to {order.asset}</dt>
          <dd className="tabular">{formatUsd(order.quote.netCents)}</dd>
        </div>
      ) : null}
      <div>
        <dt>You receive</dt>
        <dd className="tabular">
          <strong>{buy ? formatAsset(order.amountAtomic, order.asset) : formatUsd(order.quote.netCents)}</strong>
        </dd>
      </div>
      {buy ? (
        <div>
          <dt>Crypto sent to</dt>
          <dd className="mono">
            {order.receiveAddress}
            <br />
            <span className="small muted">{networkLabel(order.asset, order.network)}</span>
          </dd>
        </div>
      ) : (
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
      )}
      {!buy ? (
        <div>
          <dt>Confirmations</dt>
          <dd className="tabular">
            {order.deposit.confirmations.count} of {order.deposit.confirmations.required}
          </dd>
        </div>
      ) : null}
      {order.payout.delivery ? (
        <div>
          <dt>{buy ? 'Cash collection' : 'Delivery'}</dt>
          <dd>
            {order.payout.delivery.recipient}, ID check at the door
            <br />
            <span className="small muted">
              {describeDestination({ kind: 'courier', last4: '', courier: order.payout.delivery }).replace(buy ? /^Cash to / : /^$/, '')}
              {order.payout.delivery.preferredDate ? ` · preferred ${order.payout.delivery.preferredDate}` : ''}
            </span>
          </dd>
        </div>
      ) : null}
      {!buy && order.deposit.txHash ? (
        <div>
          <dt>Deposit tx</dt>
          <dd className="mono">{order.deposit.txHash}</dd>
        </div>
      ) : null}
      {order.deposit.amountAtomic !== null && order.deposit.amountAtomic !== (buy ? order.quote.grossCents : order.amountAtomic) ? (
        <div>
          <dt>{buy ? 'Cash counted' : 'Amount received'}</dt>
          <dd className="tabular">{buy ? formatUsd(order.deposit.amountAtomic) : formatAsset(order.deposit.amountAtomic, order.asset)}</dd>
        </div>
      ) : null}
      {order.payout.providerRef ? (
        <div>
          <dt>{buy ? 'Transfer ref.' : 'Payout ref.'}</dt>
          <dd className="mono">{order.payout.providerRef}</dd>
        </div>
      ) : null}
      {!buy ? (
        <div>
          <dt>Refund to</dt>
          <dd className="mono">{order.refundAddress}</dd>
        </div>
      ) : null}
      {order.refundTxHash ? (
        <div>
          <dt>{buy ? 'Return ref.' : 'Refund tx'}</dt>
          <dd className="mono">{order.refundTxHash}</dd>
        </div>
      ) : null}
    </dl>
  );
}

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
  // The success animation plays only when completion happens while the page is open.
  const [sawIncomplete, setSawIncomplete] = useState(false);
  useDocumentTitle(order ? `Order ${order.reference}` : 'Order');
  if (order && order.status !== 'completed' && !sawIncomplete) setSawIncomplete(true);

  const load = useCallback(() => {
    services.orders
      .get(id)
      .then((o) => {
        setOrder(o);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setOrder(null);
        else setError(errorMessage(e));
      });
  }, [services, id]);
  useEffect(load, [load]);
  useLiveEvents((e) => {
    if (e.type === 'order.updated' && e.data.orderId === id) load();
  });
  // Without the live stream, refresh while the order is still moving: every 10 s, or with the sandbox autopilot every 3 s.
  const fastPoll = !!order && autopilotEngaged(order, config.sandboxAutopilotStepMs);
  useEffect(() => {
    if ((live === 'open' && !fastPoll) || !order || TERMINAL_ORDER_STATUSES.has(order.status)) return;
    const t = window.setInterval(load, fastPoll ? 3000 : 10_000);
    return () => window.clearInterval(t);
  }, [live, order, load, fastPoll]);
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
            <p>{error}</p>
            <div>
              <button type="button" className="btn btn--secondary" onClick={load}>
                <Icon name="refresh" width={16} height={16} /> Try again
              </button>
            </div>
          </Notice>
        ) : (
          <div className="stack" aria-busy="true">
            <p className="muted" role="status">
              Loading your order…
            </p>
            <div className="skeleton" style={{ height: 32, maxWidth: 360 }} />
            <div className="skeleton" style={{ height: 160 }} />
          </div>
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

  const buy = order.direction === 'buy';
  const network = NETWORKS[order.network];
  const address = order.deposit.address;
  // In the sandbox the address must be an obvious placeholder; anything else is withheld.
  const showAddress = !!address && (config.mode !== 'sandbox' || isPreviewDepositAddress(address));
  const sandboxOrder = order.source === 'sandbox';
  const label = orderStatusLabel(order.status, order.direction);
  const steps = !buy && order.payout.method === 'courier_cash' ? order.steps.map(courierStep) : order.steps;

  return (
    <div className="container flow">
      <div className="flow__head">
        <p className="eyebrow">
          <Link to="/orders">Orders</Link> <span aria-hidden="true">/</span> <span className="mono">{order.reference}</span>
        </p>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="display-l">{label}</h1>
            <p className="muted">
              {buy
                ? `Buying ${formatAsset(order.amountAtomic, order.asset)} for ${formatUsd(order.quote.grossCents)} in cash`
                : `Selling ${formatAsset(order.amountAtomic, order.asset)} for ${formatUsd(order.quote.netCents)}`}{' '}
              · created {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="row">
            <StatusBadge tone={orderTone(order.status)}>{label}</StatusBadge>
            {sandboxOrder ? <MockBadge label="Sandbox order" force /> : null}
            <LiveIndicator state={live} />
          </div>
        </div>
        <OrderProgressBar steps={steps} />
      </div>

      {justCreated && order.status === 'awaiting_deposit' ? (
        <div style={{ marginBottom: 24 }}>
          <Notice tone="info" title={`Order ${order.reference} placed`} role="status">
            <p>
              {buy
                ? 'Your rate is held for the cash amount shown. The courier will call to confirm the collection time.'
                : 'Your rate is held for a deposit of exactly the quoted amount that arrives in the window below.'}
              {sandboxOrder
                ? buy
                  ? ' This is a sandbox order: no courier will come and no crypto will be sent.'
                  : ' This is a sandbox order: the deposit address is a placeholder. Do not send funds to it.'
                : ''}
            </p>
          </Notice>
        </div>
      ) : null}

      <div className="flow__grid">
        <div className="flow__main">
          {order.status === 'completed' ? <SuccessPanel order={order} animate={sawIncomplete} /> : null}

          {order.status === 'awaiting_deposit' && !buy ? (
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
              <TxHashForm order={order} busy={busy} run={run} />
            </section>
          ) : null}

          {order.status === 'awaiting_deposit' && buy ? (
            <section className="stack" aria-labelledby="collect-title">
              <h2 id="collect-title" className="flow__step-title">
                Have {formatUsd(order.quote.grossCents)} in cash ready
              </h2>
              <div className="deposit-box">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>Courier collection</strong>
                  <Countdown to={order.deposit.deadline} prefix="Collection window closes in" ended="Window closed" />
                </div>
                <ol className="small next-steps">
                  <li>Upload the photo ID you will show the courier (below).</li>
                  <li>The courier calls to confirm the time, checks your ID and collects exactly {formatUsd(order.quote.grossCents)}.</li>
                  <li>
                    The cash is counted and verified, then {formatAsset(order.amountAtomic, order.asset)} is sent to your{' '}
                    {networkLabel(order.asset, order.network)} wallet.
                  </li>
                </ol>
                {sandboxOrder ? (
                  <p className="small">
                    <strong>Sandbox order.</strong> No courier will come. Don’t hand cash to anyone for this order.
                  </p>
                ) : null}
              </div>
              <Notice tone="warn" title="Hand cash only to the courier at your saved address">
                <p>
                  Nobody from this service will ask you to pay elsewhere, send crypto, or hand cash to someone without an ID check. If
                  anything seems wrong, stop and contact support.
                </p>
              </Notice>
            </section>
          ) : null}

          {buy ? <IdUpload order={order} onChange={load} /> : null}

          <StatusNotice order={order} />

          <section className="panel" aria-labelledby="progress-title">
            <div className="panel__head">
              <h2 id="progress-title">Progress</h2>
              <span className="small muted">Updated {formatDateTime(order.updatedAt)}</span>
            </div>
            <div className="panel__body">
              <StatusRail steps={steps} />
            </div>
          </section>

          {error ? (
            <Notice tone="danger" title={error} role="alert">
              <div>
                <button type="button" className="btn btn--secondary btn--sm" onClick={load}>
                  <Icon name="refresh" width={16} height={16} /> Refresh the order
                </button>
              </div>
            </Notice>
          ) : null}
          <SandboxControls order={order} busy={busy} run={run} />

          {canRaise(order.status, 'CUSTOMER_CANCELLED', 'customer') ? (
            <div>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      buy
                        ? 'Cancel this order? Only before the courier collects the cash.'
                        : 'Cancel this order? Only do this if you have not sent any funds.',
                    )
                  )
                    run(() => services.orders.cancel(order.id));
                }}
              >
                Cancel this order
              </button>
              <p className="small muted" style={{ marginTop: 8 }}>
                {buy ? (
                  <>
                    Only before the courier collects the cash. After that, contact support: returns are handled under Section 9 of the{' '}
                    <Link to="/legal/refunds">Service Rules</Link>.
                  </>
                ) : (
                  <>
                    Only before you send funds. Already sent them? You can still ask support to cancel before the exchange is completed
                    (clause 4.11 of the <Link to="/legal/refunds#after-you-send">Service Rules</Link>); return costs under clause 9.2 apply.
                  </>
                )}
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

          <SupportContact title="Questions about this order?" orderReference={order.reference}>
            Mention order <span className="mono">{order.reference}</span> so we can find it quickly.
          </SupportContact>
        </div>

        <aside className="flow__aside flow__aside--after" aria-label="Receipt">
          <div className="panel">
            <div className="panel__head">
              <h2 className="title">Receipt</h2>
              {sandboxOrder ? <MockBadge force /> : null}
            </div>
            <div className="panel__body stack">
              <Receipt order={order} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
