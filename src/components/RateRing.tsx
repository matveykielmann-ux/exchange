import { useNow } from '@/lib/useNow';

const R = 11;
const C = 2 * Math.PI * R;

/** Ring that empties as the locked rate runs out. Decorative: the countdown text next to it is the accessible value. */
export function RateRing({ from, to }: { from: number; to: number }) {
  const remaining = Math.max(0, to - useNow(1000));
  const left = remaining / (to - from);
  return (
    <svg className="rate-ring" viewBox="0 0 28 28" aria-hidden="true" data-urgent={remaining < 15_000 || undefined}>
      <circle className="rate-ring__track" cx="14" cy="14" r={R} />
      <circle className="rate-ring__left" cx="14" cy="14" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - left)} />
    </svg>
  );
}
