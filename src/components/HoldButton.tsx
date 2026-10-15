import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { gsap } from '@/lib/motion';
import { t } from '@/i18n';

const HOLD_SECONDS = 1;

/**
 * Hold-to-confirm for irreversible actions: pointer users press and hold for a
 * second (a fill shows progress; releasing early cancels). Keyboard and
 * assistive-tech activation (Enter, Space, a click with no pointer) confirms at
 * once, so nobody is locked out.
 */
export function HoldButton({
  onConfirm,
  disabled,
  children,
  hint = 'Press and hold for one second, or press Enter.',
}: {
  onConfirm: () => void;
  disabled?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  const fill = useRef<HTMLSpanElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);

  useEffect(() => () => void tween.current?.kill(), []);

  const start = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || e.button !== 0 || !fill.current) return;
      tween.current?.kill();
      tween.current = gsap.to(fill.current, {
        scaleX: 1,
        duration: HOLD_SECONDS,
        ease: 'none',
        onComplete: () => {
          tween.current = null;
          onConfirm();
        },
      });
    },
    [disabled, onConfirm],
  );

  const cancel = useCallback(() => {
    if (!tween.current) return;
    tween.current.kill();
    tween.current = null;
    if (fill.current) gsap.to(fill.current, { scaleX: 0, duration: 0.2, ease: 'power2.out' });
  }, []);

  return (
    <div className="hold">
      <button
        type="button"
        className="btn btn--lg hold__button"
        disabled={disabled}
        aria-describedby="hold-hint"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          // detail 0 = activated without a pointer (keyboard, screen reader).
          if (e.detail === 0 && !disabled) onConfirm();
        }}
      >
        <span ref={fill} className="hold__fill" aria-hidden="true" />
        <span className="hold__label">{children}</span>
      </button>
      <p className="small muted hold__hint" id="hold-hint">
        {t(hint)}
      </p>
    </div>
  );
}
