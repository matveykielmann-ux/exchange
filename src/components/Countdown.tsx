/** Isolated countdown so only the timer re-renders each second, not the page. */
import { formatCountdown } from '@/lib/format';
import { useNow } from '@/lib/useNow';

export function Countdown({ to, prefix, ended }: { to: number; prefix: string; ended: string }) {
  const remaining = to - useNow(1000);
  const text = remaining > 0 ? `${prefix} ${formatCountdown(remaining)}` : ended;
  return (
    <span className="tabular" role="timer" aria-label={text}>
      {text}
    </span>
  );
}
