import { ASSETS, type AssetCode } from '@/domain/assets';
import { formatUnits } from '@/domain/money';

/** "0.05 BTC" for emails and logs (the browser has its own formatter in src/lib/format.ts). */
export function formatAssetPlain(atomic: bigint, asset: AssetCode): string {
  const a = ASSETS[asset];
  return `${formatUnits(atomic, a.decimals, { maxFraction: a.decimals, minFraction: a.class === 'stable' ? 2 : 0 })} ${asset}`;
}

/** Masks an email for staff views and logs: the first two characters of the local part and the domain. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(3, local.length - 2)))}@${domain}`;
}
