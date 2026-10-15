import { useState } from 'react';
import {
  COURIER_MAX_DAYS_AHEAD,
  COURIER_WINDOW_LABELS,
  COURIER_WINDOWS,
  isoDay,
  validateCourierDelivery,
  type CourierDeliveryInput,
  type CourierErrors,
  type CourierWindow,
} from '@/domain/courier';
import { US_STATE_NAMES, US_STATES } from '@/domain/usStates';
import { errorMessage, isNotConfigured } from '@/lib/errors';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import type { Destination } from '@/services/types';
import { ErrorSummary, Field } from './Field';
import { Notice } from './ui';
import { t } from '@/i18n';

const DAY = 86_400_000;

/**
 * Collects the address and contact details for a courier visit: a cash
 * delivery (sell) or a cash collection (buy). The saved destination is the same.
 */
export function AddCourierForm({
  onAdded,
  onCancel,
  purpose = 'delivery',
}: {
  onAdded: (d: Destination) => void;
  onCancel?: () => void;
  purpose?: 'delivery' | 'collection';
}) {
  const word = purpose === 'collection' ? 'collection' : 'delivery';
  const { account } = useServices();
  const user = useUser();
  const sandbox = useConfig().mode === 'sandbox';
  const [input, setInput] = useState<CourierDeliveryInput>(() => ({
    phone: user?.phone ?? '',
    line1: '',
    line2: '',
    city: '',
    state: user?.stateOfResidence ?? '',
    zip: '',
    window: 'any',
    preferredDate: '',
    instructions: '',
  }));
  const [errors, setErrors] = useState<CourierErrors>({});
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; notConfigured: boolean } | null>(null);
  // The browser's date is only a hint for the date picker; the server checks the date again.
  const [now] = useState(() => Date.now());
  const today = isoDay(now);
  const minDate = isoDay(now + DAY);
  const maxDate = isoDay(now + COURIER_MAX_DAYS_AHEAD * DAY);

  const set = <K extends keyof CourierDeliveryInput>(key: K, value: CourierDeliveryInput[K]) => {
    setInput((i) => ({ ...i, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit() {
    const found = validateCourierDelivery(input, today);
    setErrors(found);
    const entries = Object.entries(found).filter(([, m]) => m) as [string, string][];
    setSummary(Object.fromEntries(entries.map(([k, m]) => [`courier-${k}`, m])));
    if (entries.length) return;
    setBusy(true);
    setServerError(null);
    try {
      onAdded(await account.addCourierAddress(input));
    } catch (e) {
      setServerError(
        isNotConfigured(e)
          ? { message: t('Cash delivery is not available yet: no courier carrier is connected.'), notConfigured: true }
          : { message: errorMessage(e), notConfigured: false },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel__body stack">
        {sandbox ? (
          <Notice tone="warn" title={t("Sandbox: don't enter your real address")}>
            <p>
              {t('Any US address works. ZIP codes starting with')} <span className="mono">999</span>{' '}
              {t("are outside the sandbox courier's area.")}
            </p>
          </Notice>
        ) : null}
        <p className="small muted">
          {t('Cash is handed only to')} {user?.fullName ? <strong>{user.fullName}</strong> : t('the account holder')}
          {t(
            ', after a check of a government-issued photo ID that matches your verified account. Details are encrypted when saved and shared only with the courier.',
          )}
        </p>
        <ErrorSummary errors={summary} />
        <div className="form-grid">
          <Field label={t('Street address')} id="courier-line1" error={errors.line1} className="span-2">
            {(p) => (
              <input
                className="input"
                {...p}
                autoComplete="address-line1"
                maxLength={100}
                value={input.line1}
                onChange={(e) => set('line1', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('Apartment, suite or unit')} id="courier-line2" hint={t('Optional')} error={errors.line2} className="span-2">
            {(p) => (
              <input
                className="input"
                {...p}
                autoComplete="address-line2"
                maxLength={60}
                value={input.line2}
                onChange={(e) => set('line2', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('City')} id="courier-city" error={errors.city}>
            {(p) => (
              <input
                className="input"
                {...p}
                autoComplete="address-level2"
                maxLength={40}
                value={input.city}
                onChange={(e) => set('city', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('State')} id="courier-state" error={errors.state}>
            {(p) => (
              <select
                className="select"
                {...p}
                autoComplete="address-level1"
                value={input.state}
                onChange={(e) => set('state', e.target.value)}
              >
                <option value="">{t('Choose a state')}</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {US_STATE_NAMES[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('ZIP code')} id="courier-zip" error={errors.zip}>
            {(p) => (
              <input
                className="input tabular"
                {...p}
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={10}
                value={input.zip}
                onChange={(e) => set('zip', e.target.value.replace(/[^\d-]/g, ''))}
              />
            )}
          </Field>
          <Field label={t('Phone for the courier')} id="courier-phone" error={errors.phone}>
            {(p) => (
              <input
                className="input tabular"
                {...p}
                type="tel"
                autoComplete="tel"
                maxLength={20}
                value={input.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            )}
          </Field>
          <Field label={purpose === 'collection' ? t('Collection window') : t('Delivery window')} id="courier-window" error={errors.window}>
            {(p) => (
              <select className="select" {...p} value={input.window} onChange={(e) => set('window', e.target.value as CourierWindow)}>
                {COURIER_WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    {t(COURIER_WINDOW_LABELS[w])}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label={t('Preferred date')}
            id="courier-preferredDate"
            hint={t('Optional. Leave empty for the first available day.')}
            error={errors.preferredDate}
          >
            {(p) => (
              <input
                className="input tabular"
                {...p}
                type="date"
                min={minDate}
                max={maxDate}
                value={input.preferredDate}
                onChange={(e) => set('preferredDate', e.target.value)}
              />
            )}
          </Field>
          <Field
            label={t('Instructions for the courier')}
            id="courier-instructions"
            hint={t("Optional, e.g. a gate code or where to park. Don't include passwords or account details.")}
            error={errors.instructions}
            className="span-2"
          >
            {(p) => (
              <textarea
                className="textarea"
                {...p}
                rows={3}
                maxLength={200}
                value={input.instructions}
                onChange={(e) => set('instructions', e.target.value)}
              />
            )}
          </Field>
        </div>
        <p className="small muted">
          {t('The date and window are a preference. The courier confirms the')} {word} {t('time with you by phone.')}
        </p>
        {serverError ? <Notice tone={serverError.notConfigured ? 'warn' : 'danger'} title={serverError.message} role="alert" /> : null}
        <div className="row">
          <button type="button" className="btn btn--secondary" onClick={submit} disabled={busy}>
            {busy ? t('Checking the area…') : t('Save {0} address', [word])}
          </button>
          {onCancel ? (
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              {t('Cancel')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
