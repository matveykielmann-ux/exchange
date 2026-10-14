import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t, tNode } from '@/i18n';
import { Icon } from './Icon';

export interface FieldRenderProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

/**
 * Accessible field wrapper: visible label, hint and error are wired to the
 * control through aria-describedby; the control is marked aria-invalid.
 */
export function Field({
  label,
  hint,
  error,
  className,
  id: idProp,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  id?: string;
  children: (props: FieldRenderProps) => ReactNode;
}) {
  const auto = useId();
  const id = idProp ?? `f${auto.replace(/:/g, '')}`;
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="field__label" htmlFor={id}>
        {tNode(label)}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p className="field__error" id={errorId!}>
          <Icon name="alert" />
          <span>{t(error)}</span>
        </p>
      ) : null}
      {hint ? (
        <p className="field__hint" id={hintId!}>
          {tNode(hint)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Lists a form's errors as links to their fields and takes focus whenever a new
 * set of errors arrives (i.e. after a failed submit).
 */
export function ErrorSummary({ errors, title = 'Fix the following to continue' }: { errors: Record<string, string>; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (Object.keys(errors).length) ref.current?.focus();
  }, [errors]);
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2>{t(title)}</h2>
      <ul>
        {entries.map(([fieldId, message]) => (
          <li key={fieldId}>
            <a href={`#${fieldId}`}>{t(message)}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
