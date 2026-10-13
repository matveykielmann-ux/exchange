import { useRef } from 'react';
import { Icon } from '@/components/Icon';
import type { OrderStep, OrderStepState as StepState } from '@/domain/order';
import type { OrderEventView } from '@/services/types';
import { formatDateTime } from '@/lib/format';
import { gsap, REDUCED_OK, useGSAP } from '@/lib/motion';

const STATE_TEXT: Record<StepState, string> = { done: 'Completed', current: 'In progress', upcoming: 'Not started', failed: 'Stopped' };

/**
 * Status rail: when a step changes state, its connector draws down and its dot
 * settles in (~0.4s). The first render is static, and nothing moves under
 * reduced motion. State is always carried by text, not only by color or motion.
 */
export function StatusRail({ steps }: { steps: OrderStep[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const prev = useRef<Map<string, StepState> | null>(null);
  const signature = steps.map((s) => `${s.key}:${s.state}`).join('|');

  useGSAP(
    () => {
      const before = prev.current;
      prev.current = new Map(steps.map((s) => [s.key, s.state]));
      if (!before) return;
      const changed = steps.filter((s) => before.get(s.key) !== s.state).map((s) => s.key);
      if (changed.length === 0) return;
      const mm = gsap.matchMedia();
      mm.add(REDUCED_OK, () => {
        for (const key of changed) {
          const li = ref.current?.querySelector(`[data-key="${key}"]`);
          if (!li) continue;
          const rail = li.querySelector('.timeline__rail');
          if (rail) gsap.from(rail, { scaleY: 0, duration: 0.4, ease: 'power2.out' });
          gsap.from(li.querySelector('.timeline__dot'), { scale: 0.6, duration: 0.35, ease: 'back.out(2)' });
        }
      });
    },
    { dependencies: [signature], scope: ref },
  );

  return (
    <ol className="timeline" ref={ref}>
      {steps.map((s) => (
        <li key={s.key} data-key={s.key} data-state={s.state}>
          <span className="timeline__rail" aria-hidden="true" />
          <span className="timeline__dot" aria-hidden="true">
            {s.state === 'done' ? (
              <Icon name="check" />
            ) : s.state === 'failed' ? (
              <Icon name="x" />
            ) : s.state === 'current' ? (
              <Icon name="clock" />
            ) : null}
          </span>
          <div>
            <p className="timeline__label">{s.label}</p>
            <p className="timeline__state">{STATE_TEXT[s.state]}</p>
          </div>
          {s.at ? (
            <time className="timeline__detail" dateTime={new Date(s.at).toISOString()}>
              {formatDateTime(s.at)}
            </time>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * Event log in a terminal style, newest first. A new entry types itself in
 * (a left-to-right reveal, ~0.5s); the text is in the DOM from the start, so
 * screen readers and copy/paste never see a partial line.
 */
export function EventLog({ log }: { log: OrderEventView[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const prevCount = useRef<number | null>(null);
  const entries = [...log].reverse();

  useGSAP(
    () => {
      const before = prevCount.current;
      prevCount.current = log.length;
      if (before === null || log.length <= before) return;
      const fresh = [...(ref.current?.querySelectorAll('.event-log__text') ?? [])].slice(0, log.length - before);
      const mm = gsap.matchMedia();
      mm.add(REDUCED_OK, () => {
        gsap.fromTo(
          fresh,
          { clipPath: 'inset(0 100% 0 0)' },
          { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'steps(24)', clearProps: 'clipPath' },
        );
      });
    },
    { dependencies: [log.length], scope: ref },
  );

  return (
    <ol className="event-log" ref={ref}>
      {entries.map((l) => (
        <li key={l.seq}>
          <time className="event-log__time" dateTime={new Date(l.createdAt).toISOString()}>
            {formatDateTime(l.createdAt)}
          </time>
          <span className="event-log__text">{l.detail}</span>
        </li>
      ))}
    </ol>
  );
}
