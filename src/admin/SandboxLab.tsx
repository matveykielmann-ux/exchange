import { useState } from 'react';
import { MockBadge } from '@/components/ui';
import { t } from '@/i18n';
import { errorMessage } from '@/lib/errors';
import type { AdminOrderDetail } from '@/services/adminTypes';
import { useServices } from '@/state/services';

/** Sandbox only: buttons that make the simulated providers send signed webhooks for this order. */
export function SandboxLab({ detail, onDone }: { detail: AdminOrderDetail; onDone(): void }) {
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
