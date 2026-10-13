import { useRef } from 'react';
import { formatUsd } from '@/domain/money';
import { gsap, REDUCED_OK, useGSAP } from '@/lib/motion';

/**
 * A dollar figure whose changed digits roll into place (~0.35s) when the value
 * updates. The final value renders immediately and is what assistive tech reads;
 * only the visual digits move. Nothing moves when reduced motion is requested.
 */
export function RollingAmount({ cents }: { cents: bigint }) {
  const text = formatUsd(cents);
  const [whole = '', frac = ''] = text.split('.');
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<string | null>(null);

  useGSAP(
    () => {
      const before = prev.current;
      prev.current = text;
      if (before === null || before === text) return;
      const changed = [...text].map((ch, i) => (/\d/.test(ch) && before[i] !== ch ? i : -1)).filter((i) => i >= 0);
      const mm = gsap.matchMedia();
      mm.add(REDUCED_OK, () => {
        const els = changed.map((i) => ref.current?.querySelector(`[data-i="${i}"]`)).filter(Boolean);
        gsap.from(els, { yPercent: 100, opacity: 0, duration: 0.35, ease: 'power3.out', stagger: 0.02 });
      });
    },
    { dependencies: [text], scope: ref },
  );

  return (
    <span className="rolling" ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="rolling__digits">
        {[...whole].map((ch, i) => (
          <span key={i} className="rolling__cell">
            <span data-i={i}>{ch}</span>
          </span>
        ))}
        <span className="cents">
          .
          {[...frac].map((ch, j) => {
            const i = whole.length + 1 + j;
            return (
              <span key={i} className="rolling__cell">
                <span data-i={i}>{ch}</span>
              </span>
            );
          })}
        </span>
      </span>
    </span>
  );
}
