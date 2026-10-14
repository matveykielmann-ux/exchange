import { ASSETS, type AssetCode } from '@/domain/assets';
import { formatUnits, MICROS_PER_CENT, type AtomicAmount, type Micros } from '@/domain/money';
import type { Destination } from '@/services/types';
import { COURIER_WINDOW_LABELS } from '@/domain/courier';

export function formatAsset(atomic: AtomicAmount, asset: AssetCode, { withCode = true } = {}): string {
  const a = ASSETS[asset];
  const body = formatUnits(atomic, a.decimals, { maxFraction: a.displayDecimals, minFraction: a.class === 'stable' ? 2 : 0 });
  return withCode ? `${body} ${asset}` : body;
}

export function describeDestination(d: Pick<Destination, 'kind' | 'last4' | 'courier'>): string {
  if (d.kind === 'courier') {
    const c = d.courier;
    if (!c) return 'Cash by courier';
    const street = c.line2 ? `${c.line1}, ${c.line2}` : c.line1;
    return `Cash to ${street}, ${c.city}, ${c.state} ${c.zip} · ${COURIER_WINDOW_LABELS[c.window]}`;
  }
  return `${d.kind === 'bank' ? 'Bank account' : 'Debit card'} ending ${d.last4}`;
}

/** "Checking ending 6789", or just the label for destinations without a number (courier addresses). */
export const destinationLabel = (label: string, last4: string) => (last4 ? `${label} ending ${last4}` : label);

/** USD micros per unit → "$68,420.15"; stablecoins get four decimals so a de-peg is visible. */
export function formatPriceMicros(micros: Micros, asset: AssetCode): string {
  if (ASSETS[asset].class === 'stable') return '$' + formatUnits(micros, 6, { minFraction: 4, maxFraction: 4 });
  return '$' + formatUnits(micros / MICROS_PER_CENT, 2, { minFraction: 2, maxFraction: 2 });
}

const dateTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

export const formatDateTime = (ms: number) => dateTime.format(ms);
export const formatTime = (ms: number) => time.format(ms);

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  // Long windows (a courier collection) read as hours and minutes, not thousands of minutes.
  if (total >= 3600) return `${Math.floor(total / 3600)} h ${Math.floor((total % 3600) / 60)} min`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
