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

export function TimerBar({ from, to }: { from: number; to: number }) {
  const remaining = to - useNow(1000);
  return (
    <div className="timer-bar timer-bar--flush" data-urgent={remaining < 15_000 || undefined} aria-hidden="true">
      <span style={{ transform: `scaleX(${Math.max(0, remaining / (to - from))})` }} />
    </div>
  );
}
