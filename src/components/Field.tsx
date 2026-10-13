import { useId, type ReactNode } from 'react';
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
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p className="field__error" id={errorId!}>
          <Icon name="alert" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p className="field__hint" id={hintId!}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorSummary({
  errors,
  title = 'Fix the following to continue',
}: {
  errors: Array<{ fieldId: string; message: string }>;
  title?: string;
}) {
  if (!errors.length) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} id="error-summary">
      <h2>{title}</h2>
      <ul>
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a href={`#${e.fieldId}`}>{e.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
