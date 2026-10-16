import { useState } from 'react';
import { validateCardHolderName, validateCardNumber } from '@/domain/validation';
import { errorMessage } from '@/lib/errors';
import { useServices } from '@/state/services';
import type { Destination } from '@/services/types';
import { Field } from './Field';
import { Notice } from './ui';
import { t } from '@/i18n';

/** Manual card payout destination: PAN + holder name only. Never collects CVV/CVC/PIN. */
export function AddCardForm({ onAdded, onCancel }: { onAdded: (d: Destination) => void; onCancel?: () => void }) {
  const { account: accounts } = useServices();
  const [nickname, setNickname] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const numberError = submitted ? validateCardNumber(cardNumber) : null;
  const holderError = submitted ? validateCardHolderName(holderName) : null;

  async function submit() {
    setSubmitted(true);
    if (validateCardNumber(cardNumber) || validateCardHolderName(holderName)) return;
    setBusy(true);
    setServerError(null);
    try {
      const d = await accounts.addCard({
        label: nickname.trim() || undefined,
        cardNumber,
        holderName: holderName.trim(),
      });
      setCardNumber('');
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
        <p className="small muted">
          {t(
            'Enter the debit card that should receive USD. The number is encrypted at rest. The security code (CVV/CVC) and PIN are never collected.',
          )}
        </p>
        <div className="form-grid">
          <Field label={t('Nickname')} id="card-nickname" hint={t('Optional')} className="span-2">
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
          <Field label={t('Card number')} id="card-number" error={numberError} className="span-2">
            {(p) => (
              <input
                className="input tabular"
                {...p}
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                maxLength={23}
              />
            )}
          </Field>
          <Field label={t('Name on card')} id="card-holder" error={holderError} className="span-2">
            {(p) => (
              <input
                className="input"
                {...p}
                autoComplete="cc-name"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                maxLength={80}
              />
            )}
          </Field>
        </div>
        {serverError ? (
          <Notice tone="danger" title={serverError} role="alert" />
        ) : (
          <Notice tone="neutral" title={t('Manual card payout')}>
            <p>{t('An operator pays this card through an external service after your deposit is verified. Completion is recorded only after the payout is actually sent.')}</p>
          </Notice>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void submit()}>
            {busy ? t('Saving…') : t('Save card')}
          </button>
          {onCancel ? (
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>
              {t('Cancel')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
