import { ASSETS, type AssetCode } from '@/domain/assets';
import { formatUnits, MICROS_PER_CENT, type AtomicAmount, type Micros } from '@/domain/money';

export function formatAsset(atomic: AtomicAmount, asset: AssetCode, { withCode = true } = {}): string {
  const a = ASSETS[asset];
  const body = formatUnits(atomic, a.decimals, { maxFraction: a.displayDecimals, minFraction: a.class === 'stable' ? 2 : 0 });
  return withCode ? `${body} ${asset}` : body;
}

/** USD micros → "$68,420.15" (truncated to cents; sub-cent shown for stablecoins). */
export function formatPriceMicros(micros: Micros, { precise = false } = {}): string {
  if (precise) return '$' + formatUnits(micros, 6, { minFraction: 4, maxFraction: 4 });
  return '$' + formatUnits(micros / MICROS_PER_CENT, 2, { minFraction: 2, maxFraction: 2 });
}

const dateTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

export const formatDateTime = (ms: number) => dateTime.format(ms);
export const formatTime = (ms: number) => time.format(ms);

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
