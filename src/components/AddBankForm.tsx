import { useState } from 'react';
import { validateAccountNumber, validateRoutingNumber } from '@/domain/validation';
import { errorMessage } from '@/lib/errors';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import type { Destination } from '@/services/types';
import { Field } from './Field';
import { Notice } from './ui';

export function AddBankForm({ onAdded }: { onAdded: (d: Destination) => void }) {
  const { account: accounts } = useServices();
  const sandbox = useConfig().mode === 'sandbox';
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [nickname, setNickname] = useState('');
  const [routing, setRouting] = useState('');
  const [account, setAccount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const routingError = submitted ? validateRoutingNumber(routing) : null;
  const accountError = submitted ? validateAccountNumber(account) : null;

  async function submit() {
    setSubmitted(true);
    if (validateRoutingNumber(routing) || validateAccountNumber(account)) return;
    setBusy(true);
    setServerError(null);
    try {
      const d = await accounts.addBankAccount({ label: nickname.trim(), routingNumber: routing, accountNumber: account, accountType });
      // Drop full numbers from component state immediately.
      setRouting('');
      setAccount('');
      onAdded(d);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel__body stack">
        {sandbox ? (
          <Notice tone="warn" title="Sandbox: don't enter real bank details">
            <p>
              Use a test routing number such as <span className="mono">011000015</span> and any account number of 4 to 17 digits.
            </p>
          </Notice>
        ) : null}
        <p className="small muted">
          The account must be a US checking or savings account in your name. Numbers are encrypted when saved and shown back only as the
          last four digits.
        </p>
        <div className="form-grid">
          <Field label="Nickname" id="bank-nickname" hint="Optional, e.g. Checking" className="span-2">
            {(p) => (
              <input
                className="input"
                {...p}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={40}
                autoComplete="off"
              />
            )}
          </Field>
          <Field label="Account type" id="bank-type" className="span-2">
            {(p) => (
              <select
                className="select"
                {...p}
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'checking' | 'savings')}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            )}
          </Field>
          <Field label="Routing number" id="bank-routing" error={routingError}>
            {(p) => (
              <input
                className="input tabular"
                {...p}
                inputMode="numeric"
                autoComplete="off"
                maxLength={9}
                value={routing}
                onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
          <Field label="Account number" id="bank-account" error={accountError}>
            {(p) => (
              <input
                className="input tabular"
                {...p}
                inputMode="numeric"
                autoComplete="off"
                maxLength={17}
                value={account}
                onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
        </div>
        {serverError ? <Notice tone="danger" title={serverError} role="alert" /> : null}
        <div>
          <button type="button" className="btn btn--secondary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save bank account'}
          </button>
        </div>
      </div>
    </div>
  );
}
