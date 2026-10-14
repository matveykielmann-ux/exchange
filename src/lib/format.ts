import { ASSETS, type AssetCode } from '@/domain/assets';
import { formatUnits, MICROS_PER_CENT, type AtomicAmount, type Micros } from '@/domain/money';
import type { Destination } from '@/services/types';
import { COURIER_WINDOW_LABELS } from '@/domain/courier';
import { getLang, t } from '@/i18n';

export function formatAsset(atomic: AtomicAmount, asset: AssetCode, { withCode = true } = {}): string {
  const a = ASSETS[asset];
  const body = formatUnits(atomic, a.decimals, { maxFraction: a.displayDecimals, minFraction: a.class === 'stable' ? 2 : 0 });
  return withCode ? `${body} ${asset}` : body;
}

/** A courier address with its delivery window: "1 Main St, Albany, NY 12207 · Weekday mornings". */
export function courierAddress(c: NonNullable<Destination['courier']>): string {
  const street = c.line2 ? `${c.line1}, ${c.line2}` : c.line1;
  return `${street}, ${c.city}, ${c.state} ${c.zip} · ${t(COURIER_WINDOW_LABELS[c.window])}`;
}

export function describeDestination(d: Pick<Destination, 'kind' | 'last4' | 'courier'>): string {
  if (d.kind === 'courier') return d.courier ? t('Cash to {0}', [courierAddress(d.courier)]) : t('Cash by courier');
  return t(d.kind === 'bank' ? 'Bank account ending {0}' : 'Debit card ending {0}', [d.last4]);
}

/** "Checking ending 6789", or just the label for destinations without a number (courier addresses). */
export const destinationLabel = (label: string, last4: string) => (last4 ? t('{0} ending {1}', [label, last4]) : label);

/** USD micros per unit → "$68,420.15"; stablecoins get four decimals so a de-peg is visible. */
export function formatPriceMicros(micros: Micros, asset: AssetCode): string {
  if (ASSETS[asset].class === 'stable') return '$' + formatUnits(micros, 6, { minFraction: 4, maxFraction: 4 });
  return '$' + formatUnits(micros / MICROS_PER_CENT, 2, { minFraction: 2, maxFraction: 2 });
}

// Dates follow the interface language; amounts keep the US format ($1,234.56) in both languages.
const formatters = {
  en: {
    dateTime: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
  },
  ru: {
    dateTime: new Intl.DateTimeFormat('ru-RU', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    time: new Intl.DateTimeFormat('ru-RU', { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
  },
};

export const formatDateTime = (ms: number) => formatters[getLang()].dateTime.format(ms);
export const formatTime = (ms: number) => formatters[getLang()].time.format(ms);

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  // Long windows (a courier collection) read as hours and minutes, not thousands of minutes.
  if (total >= 3600) return t('{0} h {1} min', [Math.floor(total / 3600), Math.floor((total % 3600) / 60)]);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
