import { COURIER_WINDOW_LABELS } from '@/domain/courier';
import { ID_DOCUMENT_LABEL, KYC_FILE_LABEL } from '@/domain/identity';
import { ORDER_STAGE_LABEL, ORDER_STATUS_LABEL, ORDER_STATUSES, orderStatusLabel } from '@/domain/order';
import { PAYOUT_METHODS, describeFee } from '@/domain/payout';
import {
  ACTION_EXPLAIN,
  ACTION_LABEL,
  DEFAULT_REASON,
  NOTIFY_STATUS,
  notifyTemplates,
  queueNextStep,
  REJECT_REASONS,
  SUCCESS,
  WAITING,
} from '@/admin/orderActions';
import { getLang, lookupRu, setLang, t } from './index';

/** The app's source files (tests and this folder excluded), read as text at build time. */
const SOURCES = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.*', '!../test/**', '!./**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Every literal passed to t() / tNode() in the app. */
function literalKeys(): string[] {
  const keys = new Set<string>();
  const re = /\bt(?:Node)?\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  for (const src of Object.values(SOURCES)) {
    for (const m of src.matchAll(re)) keys.add(m[2]!.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n'));
  }
  return [...keys];
}

describe('Russian dictionary', () => {
  afterEach(() => setLang('en'));

  it('translates every string the interface passes to t()', () => {
    const keys = literalKeys();
    expect(keys.length).toBeGreaterThan(900);
    const missing = keys.filter((k) => lookupRu(k) === undefined);
    expect(missing).toEqual([]);
  });

  it('translates the labels that come from the domain', () => {
    const labels = [
      ...Object.values(ORDER_STATUS_LABEL),
      ...ORDER_STATUSES.map((s) => orderStatusLabel(s, 'buy')),
      ...ORDER_STATUSES.map((s) => orderStatusLabel(s, 'buy', 'wire')),
      ...Object.values(ORDER_STAGE_LABEL),
      ...Object.values(COURIER_WINDOW_LABELS),
      ...Object.values(ID_DOCUMENT_LABEL),
      ...Object.values(KYC_FILE_LABEL),
      ...Object.values(PAYOUT_METHODS).flatMap((m) => [m.name, m.summary, m.timingEstimate]),
      describeFee({ kind: 'none' }),
      // CRM labels and texts kept in tables
      ...Object.values(ACTION_LABEL),
      ...Object.values(ACTION_EXPLAIN),
      ...Object.values(DEFAULT_REASON),
      ...Object.values(SUCCESS),
      ...Object.values(WAITING),
      ...Object.values(NOTIFY_STATUS),
      ...REJECT_REASONS,
      ...ORDER_STATUSES.flatMap((s) => [true, false].flatMap((h) => notifyTemplates(s, h).flatMap((x) => [x.label, x.body]))).filter(
        Boolean,
      ),
      ...ORDER_STATUSES.flatMap((s) => [
        queueNextStep({ status: s, onHold: false }).label,
        queueNextStep({ status: s, onHold: true }).label,
      ]),
    ];
    expect(labels.filter((k) => lookupRu(k) === undefined)).toEqual([]);
  });

  it('switches language, fills values and falls back to English', () => {
    expect(getLang()).toBe('en');
    expect(t('Order {0} placed', ['CBX-1'])).toBe('Order CBX-1 placed');
    setLang('ru');
    expect(t('Order {0} placed', ['CBX-1'])).toBe('Заявка CBX-1 оформлена');
    expect(t('Request accepted')).toBe('Заявка принята');
    expect(t('3 of 6 network confirmations.')).toBe('3 из 6 подтверждений сети.');
    expect(t('Enter your email.')).toBe('Введите email.');
    expect(t('A string nobody translated')).toBe('A string nobody translated');
    expect(document.documentElement.lang).toBe('ru');
  });
});
