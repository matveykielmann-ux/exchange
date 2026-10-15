import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Countdown } from '@/components/Countdown';
import { Icon } from '@/components/Icon';
import { SupportContact, TelegramLink } from '@/components/SupportContact';
import { AcceptedBanner } from '@/components/AcceptedBanner';
import { StageTrack } from '@/components/StageTrack';
import { EventLog, StatusRail } from '@/components/TransactionProgress';
import { LiveIndicator } from '@/components/chat/Chat';
import { MockBadge, Notice, StatusBadge } from '@/components/ui';
import { ASSETS, NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { exchangeRateMicros, valueAtRateCents } from '@/domain/quote';
import { feeLineLabel } from '@/domain/payout';
import {
  canRaise,
  DEPOSIT_EXCEPTION_LABEL,
  isPreviewDepositAddress,
  orderStatusLabel,
  orderTone,
  TERMINAL_ORDER_STATUSES,
} from '@/domain/order';
import { validateRefundAddress, validateTxHash } from '@/domain/validation';
import { validateWireReference } from '@/domain/wire';
import { ApiError } from '@/services/http';
import { errorMessage } from '@/lib/errors';
import { courierAddress, describeDestination, destinationLabel, formatAsset, formatDateTime, formatPriceMicros } from '@/lib/format';
import { gsap, REDUCED_OK, useGSAP } from '@/lib/motion';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useExpired } from '@/lib/useExpired';
import type { OrderView } from '@/services/types';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { useLiveEvents, useLiveState } from '@/state/useLive';
import { readBase64 } from '@/lib/files';
import { t } from '@/i18n';

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
      <span aria-live="polite">{copied ? t('Copied') : label}</span>
    </button>
  );
}

/**
 * The sandbox autopilot moves an order on by itself once the customer has done
 * their part: a submitted tx hash (sell), an uploaded ID (cash buy) or a wire
 * marked as sent (wire buy). Each step is a signed sandbox webhook through the
 * normal pipeline. A wire order's placeholder instructions are issued by it too.
 */
function autopilotEngaged(order: OrderView, stepMs: number) {
  if (order.source !== 'sandbox' || stepMs <= 0) return false;
  if (order.payIn === 'wire') return order.status === 'created' || order.deposit.customerReportedSentAt !== null;
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
  const wire = order.payIn === 'wire';
  if (autopilotEngaged(order, config.sandboxAutopilotStepMs)) {
    if (!moving && order.status !== 'created') return null;
    return (
      <p className="small muted autopilot-note" role="status">
        <MockBadge label={t('Sandbox autopilot')} force /> {t('The sandbox')}{' '}
        {wire ? t('bank desk') : buy ? t('courier and cash desk') : t('deposit monitor')} {t('moves this order one step about every')}{' '}
        {Math.round(config.sandboxAutopilotStepMs / 1000)}{' '}
        {t('seconds using signed test events. Nothing real is collected, sent or broadcast.')}
      </p>
    );
  }
  if (!awaiting && !confirming) return null;
  return (
    <section className="mock-controls" aria-labelledby="mock-controls-title">
      <h2 id="mock-controls-title">
        <MockBadge label={t('Sandbox controls')} force />{' '}
        {wire ? t('Simulate the bank') : buy ? t('Simulate the courier') : t('Simulate the blockchain')}
      </h2>
      <p className="small muted">
        {t('These buttons send a signed test event from the sandbox')}{' '}
        {wire ? t('bank provider') : buy ? t('cash provider') : t('deposit monitor')}
        {t('. The server checks the signature and moves the order through the same rules a real')}{' '}
        {wire ? t('wire') : buy ? t('cash collection') : t('deposit')} {t('would. They don’t exist outside the sandbox.')}
      </p>
      <div className="row">
        {awaiting ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => sandbox.deposit(order.id, 'exact'))}>
              {wire ? t('The exact wire arrives') : buy ? t('Courier collects the exact cash') : t('Deposit the exact amount')}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => run(() => sandbox.deposit(order.id, 'short'))}
            >
              {wire ? t('The wire is short') : buy ? t('Cash is short') : t('Deposit too little')}
            </button>
          </>
        ) : null}
        {confirming ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => sandbox.confirmations(order.id, true))}>
              {wire ? t('Match the wire') : buy ? t('Finish the cash count') : t('Reach final confirmations')}
            </button>
            {!buy ? (
              <button
                type="button"
                className="btn btn--secondary"
                disabled={busy}
                onClick={() => run(() => sandbox.confirmations(order.id, false))}
              >
                {t('Add one confirmation')}
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
      <Notice tone="neutral" title={t('Transaction hash submitted for review')}>
        {order.deposit.customerTxHash ? (
          <p className="mono small" style={{ overflowWrap: 'anywhere' }}>
            {order.deposit.customerTxHash}
          </p>
        ) : null}
        <p>
          {t('Received at')} {formatDateTime(order.deposit.customerReportedSentAt)}
          {t(
            '. A hash helps our team find your transfer, but it does not confirm a deposit: the order moves on only when deposit monitoring reports the transaction on the',
          )}{' '}
          {NETWORKS[order.network].name} {t('network.')}
        </p>
        <p>
          {t('If more proof is needed, support will contact you in your')} <Link to="/support">{t('support messages')}</Link>
          {t(', or you can reach us on')} <TelegramLink />.
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
      <h3 className="title">{t('Sent it? Submit the transaction hash')}</h3>
      <div className="field" data-invalid={error ? 'true' : undefined}>
        <label className="field__label" htmlFor="tx-hash">
          {t('Transaction hash (TXID)')}
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
          {t('Copy it from your wallet’s transaction details. We check its format only; it doesn’t confirm the deposit.')}
        </p>
      </div>
      <div>
        <button type="submit" className="btn btn--secondary" disabled={busy}>
          {busy ? t('Submitting…') : t('Submit for review')}
        </button>
      </div>
    </form>
  );
}

/**
 * Wire buys: the instructions (demo placeholders for every bank field) and the
 * "I've sent the wire" step with an optional reference from the customer's bank.
 */
function WireInstructions({ order, busy, run }: { order: OrderView; busy: boolean; run: Run }) {
  const { orders } = useServices();
  const [ref, setRef] = useState('');
  const [touched, setTouched] = useState(false);
  const lines = order.wireInstructions ?? [];
  const sent = order.deposit.customerReportedSentAt;
  const error = touched ? validateWireReference(ref) : null;
  return (
    <section className="stack" aria-labelledby="wire-title">
      <h2 id="wire-title" className="flow__step-title">
        {t('Wire')} {formatUsd(order.quote.grossCents)}
      </h2>
      <div className="deposit-box">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{t('Wire instructions')}</strong>
          <Countdown to={order.deposit.deadline} prefix={t('Window closes in')} ended={t('Window closed')} />
        </div>
        <dl className="dl">
          <div>
            <dt>{t('Amount')}</dt>
            <dd className="tabular">{formatUsd(order.quote.grossCents)}</dd>
          </div>
          {lines.map((l) => (
            <div key={l.label}>
              <dt>{t(l.label)}</dt>
              <dd className="mono" style={{ overflowWrap: 'anywhere' }}>
                {l.value} {l.placeholder ? <MockBadge label={t('Placeholder')} force /> : <CopyButton value={l.value} label={t('Copy')} />}
              </dd>
            </div>
          ))}
        </dl>
        <p className="small">
          <strong>{t('Demo instructions. Do not send a wire.')}</strong>{' '}
          {t(
            'The exchange is simulated: no bank account exists for these placeholders, and real bank details are issued only after launch.',
          )}
        </p>
      </div>
      <Notice tone="warn" title={t('Use only the instructions on this page')}>
        <p>
          {t(
            'Send the wire from a US bank account in your own name and quote the order number as the reference. Nobody from this service will send you bank details by email, chat or phone. If anything seems wrong, stop and contact support.',
          )}
        </p>
      </Notice>
      {sent ? (
        <Notice tone="neutral" title={t('You marked the wire as sent')}>
          <p>
            {t('Received at')} {formatDateTime(sent)}
            {order.deposit.customerTxHash ? t(' · your reference {0}', [order.deposit.customerTxHash]) : ''}.{' '}
            {t('This does not confirm a payment: the order moves on only when the bank reports the wire.')}
          </p>
        </Notice>
      ) : canRaise(order.status, 'CUSTOMER_REPORTED_SENT', 'customer') ? (
        <form
          className="stack tx-hash-form"
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setTouched(true);
            if (validateWireReference(ref)) {
              document.getElementById('wire-ref')?.focus();
              return;
            }
            run(() => orders.reportSent(order.id, ref.trim() || null));
          }}
        >
          <h3 className="title">{t('Sent the wire? Let us know')}</h3>
          <div className="field" data-invalid={error ? 'true' : undefined}>
            <label className="field__label" htmlFor="wire-ref">
              {t('Your bank’s reference (optional)')}
            </label>
            <input
              id="wire-ref"
              className="input mono"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              onBlur={() => ref && setTouched(true)}
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'wire-ref-error wire-ref-hint' : 'wire-ref-hint'}
            />
            {error ? (
              <p className="field__error" id="wire-ref-error">
                <Icon name="alert" /> {t(error)}
              </p>
            ) : null}
            <p className="field__hint" id="wire-ref-hint">
              {t('For example the Fed or confirmation number your bank shows. It helps us find the wire; it doesn’t confirm it.')}
            </p>
          </div>
          <div>
            <button type="submit" className="btn btn--secondary" disabled={busy}>
              {busy ? t('Submitting…') : t('I’ve sent the wire')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

/** Asked for only when a refund is pending and no refund address was given. The address can be saved once. */
function RefundAddressForm({ order, busy, run }: { order: OrderView; busy: boolean; run: Run }) {
  const { orders } = useServices();
  const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false);
  if (!order.refundAddressNeeded) return null;
  const error = touched ? validateRefundAddress(address, order.network) : null;
  return (
    <section className="panel" aria-labelledby="refund-address-title">
      <div className="panel__head">
        <h2 id="refund-address-title">{t('Where should we return your deposit?')}</h2>
      </div>
      <form
        className="panel__body stack"
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setTouched(true);
          if (validateRefundAddress(address, order.network)) {
            document.getElementById('refund-address')?.focus();
            return;
          }
          run(() => orders.setRefundAddress(order.id, address));
        }}
      >
        <p>
          {t('This order can’t be completed, so your {0} will be returned. Enter an address on {1} that you control.', [
            order.asset,
            networkLabel(order.asset, order.network),
          ])}
        </p>
        <div className="field" data-invalid={error ? 'true' : undefined}>
          <label className="field__label" htmlFor="refund-address">
            {t('Refund address ({0})', [NETWORKS[order.network].name])}
          </label>
          <input
            id="refund-address"
            className="input mono"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            onBlur={() => address && setTouched(true)}
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'refund-address-error refund-address-hint' : 'refund-address-hint'}
            placeholder={NETWORKS[order.network].addressExample}
          />
          {error ? (
            <p className="field__error" id="refund-address-error">
              <Icon name="alert" /> {error}
            </p>
          ) : null}
          <p className="field__hint" id="refund-address-hint">
            {t('We check the address before sending the refund. Once saved, it can’t be changed.')}
          </p>
        </div>
        <div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? t('Saving…') : t('Save refund address')}
          </button>
        </div>
      </form>
    </section>
  );
}

const ID_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ID_MAX_BYTES = 4 * 1024 * 1024;

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
    if (!file) return setError(t('Choose a photo or scan of your ID.'));
    if (!ID_TYPES.includes(file.type)) return setError(t('Upload a JPEG, PNG or PDF file.'));
    if (file.size > ID_MAX_BYTES) return setError(t('The file is larger than 4 MB. Use a smaller photo or scan.'));
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
        <h3 id="id-title">{t('Photo ID for the courier')}</h3>
        {sandbox ? <MockBadge label={t('Demo upload')} force /> : null}
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
                    {d.contentType.replace(/^.*\//, '').toUpperCase()} · {Math.max(1, Math.round(d.sizeBytes / 1024))} {t('KB · received')}{' '}
                    {formatDateTime(d.createdAt)}
                    {d.stored ? '' : t(' · checked and discarded (sandbox: the file is not kept)')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">
            {t('Upload the photo ID you will show the courier. The courier collects cash only from the verified account holder.')}
            {sandbox ? t(' Sandbox: use a test image, not a real document. The file is checked and then discarded.') : ''}
          </p>
        )}
        {open && order.documents.length < 3 ? (
          <form className="stack" onSubmit={submit} noValidate>
            <div className="field" data-invalid={error ? 'true' : undefined}>
              <label className="field__label" htmlFor="id-file">
                {order.documents.length ? t('Add another file') : t('ID document (JPEG, PNG or PDF, up to 4 MB)')}
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
                {busy ? t('Uploading…') : t('Upload ID')}
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
  const wire = order.payIn === 'wire';
  const sandbox = order.source === 'sandbox';
  const demo = sandbox ? t(' (sandbox simulation)') : '';
  const help = (
    <p className="small">
      {t('Questions? Reach support on')} <TelegramLink /> {t('or in your')} <Link to="/support">{t('support messages')}</Link>.
    </p>
  );
  switch (order.status) {
    case 'created':
      return (
        <Notice
          tone="info"
          title={wire ? t('Preparing your wire instructions') : buy ? t('Arranging the courier') : t('Preparing your deposit address')}
          role="status"
        >
          <p>{t('This usually takes a moment. The page updates by itself.')}</p>
        </Notice>
      );
    case 'deposit_observed':
    case 'confirming':
      return (
        <Notice
          tone="info"
          title={wire ? t('Wire received{0}', [demo]) : buy ? t('Cash collected{0}', [demo]) : t('Deposit seen{0}', [demo])}
          role="status"
        >
          <p>
            {wire
              ? t('The bank reported a wire for this order. It is now matched and checked before any crypto is sent.')
              : buy
                ? t('The courier reported collecting the cash. It is now counted and checked before any crypto is sent.')
                : t('Deposit monitoring reported a transfer for this order. It becomes final after {0} network confirmations.', [
                    order.deposit.confirmations.required,
                  ])}
          </p>
        </Notice>
      );
    case 'deposit_confirmed':
      return (
        <Notice
          tone="info"
          title={wire ? t('Wire verified{0}', [demo]) : buy ? t('Cash verified{0}', [demo]) : t('Deposit final{0}', [demo])}
          role="status"
        >
          <p>{t('Automatic checks are running. This page updates by itself.')}</p>
        </Notice>
      );
    case 'compliance_review':
      return (
        <Notice tone="warn" title={t('Held for review')}>
          <p>
            {t('A member of our team is checking this order before')} {buy ? t('the crypto is sent') : 'payout'}.
            {order.deposit.exception ? t(' Reason: {0}', [t(DEPOSIT_EXCEPTION_LABEL[order.deposit.exception])]) : ''}{' '}
            {t('If more proof is needed, support will contact you in your')} <Link to="/support">{t('support messages')}</Link>
            {t(', or you can reach us on')} <TelegramLink />.
          </p>
        </Notice>
      );
    case 'ready_for_payout':
      return (
        <Notice tone="info" title={buy ? t('Approved: waiting for the transfer to be authorized') : t('Approved for payout')} role="status">
          <p>
            {wire
              ? t('The wire is verified and checks are complete. A member of our team authorizes each crypto transfer before it is sent.')
              : buy
                ? t('The cash is verified and checks are complete. A member of our team authorizes each crypto transfer before it is sent.')
                : t(
                    'Your deposit is final and checks are complete. A member of our team authorizes each payout before it goes to the payout provider.',
                  )}
          </p>
          {help}
        </Notice>
      );
    case 'payout_submitted':
    case 'payout_processing':
      return (
        <Notice tone="info" title={buy ? t('Crypto transfer in progress{0}', [demo]) : t('Payout in progress{0}', [demo])} role="status">
          <p>
            {buy
              ? t(
                  'The transfer of {0} was handed to the custody provider. This page shows it as completed only when the provider reports it.',
                  [formatAsset(order.amountAtomic, order.asset)],
                )
              : t(
                  'The payout instruction was accepted by the payout provider. This page shows it as completed only when the provider reports it.',
                )}
            {sandbox ? t(' In the sandbox nothing is broadcast or paid.') : ''}
          </p>
          {help}
        </Notice>
      );
    case 'failed':
      return (
        <Notice tone="danger" title={buy ? t('The crypto transfer didn’t go through') : t('The payout didn’t go through')}>
          <p>
            {t('Our team has been alerted and will retry or contact you. If the exchange cannot be completed, clause 4.2 of the')}{' '}
            <Link to="/legal/terms#clause-4-2">{t('Service Rules')}</Link> {t('governs the return of funds.')}
          </p>
          {help}
        </Notice>
      );
    case 'refund_pending':
      return (
        <Notice
          tone="warn"
          title={
            wire
              ? t('Wire return in progress')
              : buy
                ? t('Cash return in progress')
                : order.refundAddressNeeded
                  ? t('Refund address needed')
                  : t('Refund in progress')
          }
        >
          <p>
            {wire
              ? t('The wire will be returned to the bank account it came from. ')
              : buy
                ? t('The courier will return your cash to you after an ID check. ')
                : order.refundAddressNeeded
                  ? t('We need a refund address to return your {0}: enter it below. ', [order.asset])
                  : t('We are returning your {0} on-chain to the refund address you gave. ', [order.asset])}
            {t('Return fees and timeframes are set by Section 9 of the Service Rules; see the')}{' '}
            <Link to="/legal/refunds">{t('refund policy')}</Link>.
          </p>
          {help}
        </Notice>
      );
    case 'refunded':
      return (
        <Notice tone="neutral" title={t('Refunded')}>
          <p>
            {wire
              ? t('The bank reported your wire as returned to the sending account.')
              : buy
                ? t('The provider reported your cash as returned.')
                : t('Your {0} was returned to your refund address.', [order.asset])}
          </p>
        </Notice>
      );
    case 'expired':
      return (
        <Notice
          tone="neutral"
          title={wire ? t('The wire window closed') : buy ? t('The collection window closed') : t('The deposit window closed')}
        >
          {wire ? (
            <p>
              {t('No wire was received in time, so this order expired. If you already sent a wire,')}{' '}
              <Link to="/support">{t('contact support')}</Link>
              {t(': it is returned under Section 9 of the Service Rules.')}
            </p>
          ) : buy ? (
            <p>
              {t('The cash wasn’t collected in time, so this order expired. Nothing was taken. Start a new exchange or')}{' '}
              <Link to="/support">{t('contact support')}</Link>.
            </p>
          ) : (
            <p>
              {t('No deposit was seen in time, so this order expired. If you sent funds after the window closed,')}{' '}
              <Link to="/support">{t('contact support')}</Link>
              {t('. Under clause 4.14 of the')} <Link to="/legal/terms#clause-4-14">{t('Service Rules')}</Link>
              {t(
                ', such funds are transferred back with the related commission fees deducted, and if you ask to proceed with the exchange instead, the rate and terms may be changed.',
              )}
            </p>
          )}
          {help}
        </Notice>
      );
    case 'rejected':
      return (
        <Notice tone="neutral" title={t('We couldn’t accept this order')}>
          <p>
            {t('If you already sent funds, their return is handled under Sections 8 and 9 of the')}{' '}
            <Link to="/legal/refunds">{t('Service Rules')}</Link>.
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
  const wire = order.payIn === 'wire';
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
              {buy ? t('Exchange completed') : t('Payout completed')}
            </h2>
            <p className="row" style={{ gap: 8 }}>
              <StatusBadge tone="success">{sandbox ? t('Completed (demo)') : t('Completed')}</StatusBadge>
              <span className="small muted">
                {t('Order')} <span className="mono">{order.reference}</span>
              </span>
            </p>
          </div>
        </div>
        <dl className="dl">
          <div>
            <dt>{wire ? t('Paid by wire') : buy ? t('Cash paid') : t('You sent')}</dt>
            <dd className="tabular">{buy ? formatUsd(order.quote.grossCents) : formatAsset(order.amountAtomic, order.asset)}</dd>
          </div>
          <div>
            <dt>{buy ? t('Crypto received') : t('You received')}</dt>
            <dd className="tabular">
              <strong>{buy ? formatAsset(order.amountAtomic, order.asset) : formatUsd(order.quote.netCents)}</strong>
            </dd>
          </div>
          <div>
            <dt>{buy ? t('Sent to') : t('Paid to')}</dt>
            <dd className={buy ? 'mono' : undefined}>
              {buy ? order.receiveAddress : destinationLabel(order.payout.label, order.payout.last4)}
            </dd>
          </div>
          {order.payout.providerRef ? (
            <div>
              <dt>{t('Provider reference')}</dt>
              <dd className="mono">{order.payout.providerRef}</dd>
            </div>
          ) : null}
        </dl>
        {sandbox ? (
          <p className="small">
            <MockBadge force /> {t('This is a sandbox demo. The amounts are simulated and nothing was')}{' '}
            {wire ? t('wired, sent or broadcast') : buy ? t('collected, sent or broadcast') : t('received or paid out')}.
          </p>
        ) : (
          <p className="small">
            {buy
              ? t('The custody provider reported the transfer as completed. Your wallet may take time to show it.')
              : t('The payout provider reported the payout as completed. {0}', [
                  order.payout.method === 'courier_cash' ? '' : t('Your bank may take time to show it.'),
                ])}
          </p>
        )}
        <div className="stack" style={{ gap: 8 }}>
          <h3 className="title">{t('Next steps')}</h3>
          <ul className="small next-steps">
            <li>
              {t('Keep the order number')} {order.reference} {t('for your records; the receipt is on this page.')}
            </li>
            <li>
              {t('Something doesn’t match? Contact support with the order number on')} <TelegramLink /> {t('or in your')}{' '}
              <Link to="/support/new">{t('support messages')}</Link>.
            </li>
          </ul>
          <div className="row">
            <Link className="btn" to={wire ? '/exchange?direction=buy&pay=wire' : buy ? '/exchange?direction=buy' : '/exchange'}>
              {t('Start another exchange')}
            </Link>
            <Link className="btn btn--secondary" to="/orders">
              {t('View all orders')}
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
  const wire = order.payIn === 'wire';
  return (
    <dl className="dl">
      <div>
        <dt>{wire ? t('You pay by wire') : buy ? t('You pay in cash') : t('You send')}</dt>
        <dd className="tabular">{buy ? formatUsd(order.quote.grossCents) : formatAsset(order.amountAtomic, order.asset)}</dd>
      </div>
      <div>
        <dt>{t('Exchange rate')}</dt>
        <dd className="tabular">
          {formatPriceMicros(
            exchangeRateMicros({
              asset: order.asset,
              amountAtomic: order.amountAtomic,
              // A buy's rate is the cash after the courier fee per unit received; a sell's is the value after the spread.
              grossCents: buy ? order.quote.grossCents - order.quote.payoutFeeCents : order.quote.grossCents,
              spreadCents: buy ? 0n : order.quote.spreadCents,
            }),
            order.asset,
          )}{' '}
          {t('per')} {ASSETS[order.asset].code}
        </dd>
      </div>
      {!buy ? (
        <div>
          <dt>{t('Value at this rate')}</dt>
          <dd className="tabular">{formatUsd(valueAtRateCents(order.quote))}</dd>
        </div>
      ) : null}
      <div>
        <dt>{t(buy && !wire ? 'Courier fee' : feeLineLabel(order.payout.method))}</dt>
        <dd className="tabular">−{formatUsd(order.quote.payoutFeeCents)}</dd>
      </div>
      <div>
        <dt>{t('You receive')}</dt>
        <dd className="tabular">
          <strong>{buy ? formatAsset(order.amountAtomic, order.asset) : formatUsd(order.quote.netCents)}</strong>
        </dd>
      </div>
      {buy ? (
        <div>
          <dt>{t('Crypto sent to')}</dt>
          <dd className="mono">
            {order.receiveAddress}
            <br />
            <span className="small muted">{networkLabel(order.asset, order.network)}</span>
          </dd>
        </div>
      ) : (
        <div>
          <dt>{t('Payout')}</dt>
          <dd>
            {t(order.payout.methodName)}
            <br />
            <span className="small muted">
              {destinationLabel(order.payout.label, order.payout.last4)} · {t(order.payout.timing)}
            </span>
          </dd>
        </div>
      )}
      {!buy ? (
        <div>
          <dt>{t('Confirmations')}</dt>
          <dd className="tabular">
            {order.deposit.confirmations.count} {t('of')} {order.deposit.confirmations.required}
          </dd>
        </div>
      ) : null}
      {order.payout.delivery ? (
        <div>
          <dt>{buy ? t('Cash collection') : t('Delivery')}</dt>
          <dd>
            {order.payout.delivery.recipient}
            {t(', ID check at the door')}
            <br />
            <span className="small muted">
              {buy && order.payout.delivery
                ? courierAddress(order.payout.delivery)
                : describeDestination({ kind: 'courier', last4: '', courier: order.payout.delivery })}
              {order.payout.delivery.preferredDate ? t(' · preferred {0}', [order.payout.delivery.preferredDate]) : ''}
            </span>
          </dd>
        </div>
      ) : null}
      {!buy && order.deposit.txHash ? (
        <div>
          <dt>{t('Deposit tx')}</dt>
          <dd className="mono">{order.deposit.txHash}</dd>
        </div>
      ) : null}
      {order.deposit.amountAtomic !== null && order.deposit.amountAtomic !== (buy ? order.quote.grossCents : order.amountAtomic) ? (
        <div>
          <dt>{wire ? t('Wire received') : buy ? t('Cash counted') : t('Amount received')}</dt>
          <dd className="tabular">{buy ? formatUsd(order.deposit.amountAtomic) : formatAsset(order.deposit.amountAtomic, order.asset)}</dd>
        </div>
      ) : null}
      {order.payout.providerRef ? (
        <div>
          <dt>{buy ? t('Transfer ref.') : t('Payout ref.')}</dt>
          <dd className="mono">{order.payout.providerRef}</dd>
        </div>
      ) : null}
      {!buy && order.refundAddress ? (
        <div>
          <dt>{t('Refund to')}</dt>
          <dd className="mono">{order.refundAddress}</dd>
        </div>
      ) : null}
      {wire && order.deposit.customerTxHash ? (
        <div>
          <dt>{t('Your wire ref.')}</dt>
          <dd className="mono">{order.deposit.customerTxHash}</dd>
        </div>
      ) : null}
      {order.refundTxHash ? (
        <div>
          <dt>{buy ? t('Return ref.') : t('Refund tx')}</dt>
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
          <Notice tone="danger" title={t('This order could not be loaded.')} role="alert">
            <p>{error}</p>
            <div>
              <button type="button" className="btn btn--secondary" onClick={load}>
                <Icon name="refresh" width={16} height={16} /> {t('Try again')}
              </button>
            </div>
          </Notice>
        ) : (
          <div className="stack" aria-busy="true">
            <p className="muted" role="status">
              {t('Loading your order…')}
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
        <h1 className="display-l">{t('Order not found')}</h1>
        <p>{t('It may belong to a different account, or the link is wrong.')}</p>
        <p>
          <Link to="/orders">{t('Back to orders')}</Link>
        </p>
      </div>
    );

  const buy = order.direction === 'buy';
  const wire = order.payIn === 'wire';
  const network = NETWORKS[order.network];
  const address = order.deposit.address;
  // In the sandbox the address must be an obvious placeholder; anything else is withheld.
  const showAddress = !!address && (config.mode !== 'sandbox' || isPreviewDepositAddress(address));
  const sandboxOrder = order.source === 'sandbox';
  const label = t(orderStatusLabel(order.status, order.direction, order.payIn ?? undefined));
  const steps = !buy && order.payout.method === 'courier_cash' ? order.steps.map(courierStep) : order.steps;

  return (
    <div className="container flow">
      <div className="flow__head">
        <p className="eyebrow">
          <Link to="/orders">{t('Orders')}</Link> <span aria-hidden="true">/</span> <span className="mono">{order.reference}</span>
        </p>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="display-l">{label}</h1>
            <p className="muted">
              {wire
                ? t('Buying {0} for {1} by bank wire', [formatAsset(order.amountAtomic, order.asset), formatUsd(order.quote.grossCents)])
                : buy
                  ? t('Buying {0} for {1} in cash', [formatAsset(order.amountAtomic, order.asset), formatUsd(order.quote.grossCents)])
                  : t('Selling {0} for {1}', [formatAsset(order.amountAtomic, order.asset), formatUsd(order.quote.netCents)])}{' '}
              {t('· created')} {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="row">
            <StatusBadge tone={orderTone(order.status)}>{label}</StatusBadge>
            {sandboxOrder ? <MockBadge label={t('Sandbox order')} force /> : null}
            <LiveIndicator state={live} />
          </div>
        </div>
        <StageTrack stage={order.stage} />
        {order.onHold ? (
          <Notice tone="warn" title={t('Your order is on hold')}>
            <p>{t('Our team is checking it. Nothing moves until the hold is released; we will message you if we need anything.')}</p>
          </Notice>
        ) : null}
      </div>

      {/* Shown after creation until the final screen takes over. */}
      {justCreated && order.status !== 'completed' ? (
        <div className="stack" style={{ marginBottom: 24 }}>
          <AcceptedBanner reference={order.reference} detailsId="order-details" />
          {order.status === 'awaiting_deposit' || (wire && order.status === 'created') ? (
            <Notice tone="info" title={t('Order {0} placed', [order.reference])}>
              <p>
                {wire
                  ? t('Your rate is held for a wire of exactly the amount shown that arrives in the window.')
                  : buy
                    ? t('Your rate is held for the cash amount shown. The courier will call to confirm the collection time.')
                    : t('Your rate is held for a deposit of exactly the quoted amount that arrives in the window below.')}
                {sandboxOrder
                  ? wire
                    ? t(' This is a sandbox order: the wire instructions are placeholders. Do not send a wire.')
                    : buy
                      ? t(' This is a sandbox order: no courier will come and no crypto will be sent.')
                      : t(' This is a sandbox order: the deposit address is a placeholder. Do not send funds to it.')
                  : ''}
              </p>
            </Notice>
          ) : null}
        </div>
      ) : null}

      <div className="flow__grid" id="order-details">
        <div className="flow__main">
          {order.status === 'completed' ? <SuccessPanel order={order} animate={sawIncomplete} /> : null}

          {order.status === 'awaiting_deposit' && !buy ? (
            <section className="stack" aria-labelledby="deposit-title">
              <h2 id="deposit-title" className="flow__step-title">
                {t('Send')} {formatAsset(order.amountAtomic, order.asset)}
              </h2>
              <div className="deposit-box">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>
                    {t('Network:')} {networkLabel(order.asset, order.network)}
                  </strong>
                  <Countdown to={order.deposit.deadline} prefix={t('Window closes in')} ended={t('Window closed')} />
                </div>
                {showAddress ? (
                  <div className="deposit-box__address">
                    <code>{address}</code>
                    <CopyButton value={address} label={t('Copy')} />
                  </div>
                ) : (
                  <Notice tone="danger" title={t('Deposit address withheld')} role="alert">
                    <p>{t('No usable deposit address is available for this order. Do not send funds. Contact support.')}</p>
                  </Notice>
                )}
                {order.deposit.memo ? (
                  <p className="small">
                    {t('Memo / tag:')} <code>{order.deposit.memo}</code>
                  </p>
                ) : null}
                {sandboxOrder ? (
                  <p className="small">
                    <strong>{t('Sandbox placeholder. Do not send funds.')}</strong> {t('It is deliberately invalid on every network.')}
                  </p>
                ) : null}
              </div>
              <Notice tone="warn" title={t('Only send {0} on {1}', [order.asset, network.name])}>
                <p>
                  {t(
                    'Sending a different asset, or using a different network, may result in permanent loss. Send exactly the amount shown; a different amount is held for review.',
                  )}
                </p>
              </Notice>
              <TxHashForm order={order} busy={busy} run={run} />
            </section>
          ) : null}

          {wire && order.wireInstructions && order.status === 'awaiting_deposit' ? (
            <WireInstructions order={order} busy={busy} run={run} />
          ) : null}

          {order.status === 'awaiting_deposit' && buy && !wire ? (
            <section className="stack" aria-labelledby="collect-title">
              <h2 id="collect-title" className="flow__step-title">
                {t('Have')} {formatUsd(order.quote.grossCents)} {t('in cash ready')}
              </h2>
              <div className="deposit-box">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{t('Courier collection')}</strong>
                  <Countdown to={order.deposit.deadline} prefix={t('Collection window closes in')} ended={t('Window closed')} />
                </div>
                <ol className="small next-steps">
                  <li>{t('Upload the photo ID you will show the courier (below).')}</li>
                  <li>
                    {t('The courier calls to confirm the time, checks your ID and collects exactly')} {formatUsd(order.quote.grossCents)}.
                  </li>
                  <li>
                    {t('The cash is counted and verified, then')} {formatAsset(order.amountAtomic, order.asset)} {t('is sent to your')}{' '}
                    {networkLabel(order.asset, order.network)} {t('wallet.')}
                  </li>
                </ol>
                {sandboxOrder ? (
                  <p className="small">
                    <strong>{t('Sandbox order.')}</strong> {t('No courier will come. Don’t hand cash to anyone for this order.')}
                  </p>
                ) : null}
              </div>
              <Notice tone="warn" title={t('Hand cash only to the courier at your saved address')}>
                <p>
                  {t(
                    'Nobody from this service will ask you to pay elsewhere, send crypto, or hand cash to someone without an ID check. If anything seems wrong, stop and contact support.',
                  )}
                </p>
              </Notice>
            </section>
          ) : null}

          {buy && !wire ? <IdUpload order={order} onChange={load} /> : null}

          <StatusNotice order={order} />
          <RefundAddressForm order={order} busy={busy} run={run} />

          <section className="panel" aria-labelledby="progress-title">
            <div className="panel__head">
              <h2 id="progress-title">{t('Progress')}</h2>
              <span className="small muted">
                {t('Updated')} {formatDateTime(order.updatedAt)}
              </span>
            </div>
            <div className="panel__body">
              <StatusRail steps={steps} />
            </div>
          </section>

          {error ? (
            <Notice tone="danger" title={error} role="alert">
              <div>
                <button type="button" className="btn btn--secondary btn--sm" onClick={load}>
                  <Icon name="refresh" width={16} height={16} /> {t('Refresh the order')}
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
                      wire
                        ? t('Cancel this order? Only if you have not sent the wire.')
                        : buy
                          ? 'Cancel this order? Only before the courier collects the cash.'
                          : 'Cancel this order? Only do this if you have not sent any funds.',
                    )
                  )
                    run(() => services.orders.cancel(order.id));
                }}
              >
                {t('Cancel this order')}
              </button>
              <p className="small muted" style={{ marginTop: 8 }}>
                {wire ? (
                  <>
                    {t('Only before you send the wire. Already sent it? Contact support: returns are handled under Section 9 of the')}{' '}
                    <Link to="/legal/refunds">{t('Service Rules')}</Link>.
                  </>
                ) : buy ? (
                  <>
                    {t(
                      'Only before the courier collects the cash. After that, contact support: returns are handled under Section 9 of the',
                    )}{' '}
                    <Link to="/legal/refunds">{t('Service Rules')}</Link>.
                  </>
                ) : (
                  <>
                    {t(
                      'Only before you send funds. Already sent them? You can still ask support to cancel before the exchange is completed (clause 4.11 of the',
                    )}{' '}
                    <Link to="/legal/refunds#after-you-send">{t('Service Rules')}</Link>
                    {t('); return costs under clause 9.2 apply.')}
                  </>
                )}
              </p>
            </div>
          ) : null}

          <section aria-labelledby="log-title" className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 id="log-title" className="title">
                {t('Activity')}
              </h2>
              {sandboxOrder ? <MockBadge label={t('Sandbox events')} force /> : null}
            </div>
            <EventLog log={order.events} />
          </section>

          <SupportContact title={t('Questions about this order?')} orderReference={order.reference}>
            {t('Mention order')} <span className="mono">{order.reference}</span> {t('so we can find it quickly.')}
          </SupportContact>
        </div>

        <aside className="flow__aside flow__aside--after" aria-label={t('Receipt')}>
          <div className="panel">
            <div className="panel__head">
              <h2 className="title">{t('Receipt')}</h2>
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
