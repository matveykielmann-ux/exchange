import { useState, type FormEvent, type ReactNode } from 'react';
import { Notice } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { ApiError } from '@/services/http';

export function LoadError({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof ApiError && error.code === 'mfa_required')
    return (
      <Notice tone="warn" title="Two-step sign-in required" role="alert">
        <p>Staff tools need a verified authenticator code. Turn on two-step sign-in in your account, then sign in again.</p>
      </Notice>
    );
  if (error instanceof ApiError && error.status === 403)
    return (
      <Notice tone="neutral" title="Not available for your role" role="alert">
        <p>{error.message}</p>
      </Notice>
    );
  return (
    <Notice tone="danger" title="This could not be loaded" role="alert">
      <p>{errorMessage(error)}</p>
    </Notice>
  );
}

export function AdminHead({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="admin-head">
      <div>
        <h1 className="admin-title">{title}</h1>
        {lead ? <p className="muted small">{lead}</p> : null}
      </div>
      {children ? <div className="admin-head__actions">{children}</div> : null}
    </header>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage(p: number): void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="btn btn--secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="small muted tabular">
        Page {page} of {pages} · {total} total
      </span>
      <button type="button" className="btn btn--secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

/**
 * A recorded reason for a manual action. Every manual step on an order,
 * account or role carries one; it is stored in the audit log with the action.
 */
export function ReasonForm({
  id,
  label = 'Reason (recorded in the audit log)',
  submitLabel,
  danger = false,
  minLength = 4,
  maxLength = 500,
  onSubmit,
  onCancel,
  children,
}: {
  id: string;
  label?: string;
  submitLabel: string;
  danger?: boolean;
  minLength?: number;
  maxLength?: number;
  onSubmit(reason: string): Promise<void>;
  onCancel(): void;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < minLength) {
      setError(`Write at least ${minLength} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="reason-form stack" onSubmit={submit} noValidate>
      {children}
      <div className="field">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <textarea
          id={id}
          className="textarea"
          rows={3}
          maxLength={maxLength}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={error ? true : undefined}
          autoFocus
        />
      </div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className={`btn ${danger ? 'btn--danger' : ''}`} disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'warn' | 'danger' | 'success';
}) {
  return (
    <div className={`kpi ${tone ? `kpi--${tone}` : ''}`}>
      <p className="kpi__label">{label}</p>
      <p className="kpi__value">{value}</p>
      {hint ? <p className="kpi__hint">{hint}</p> : null}
    </div>
  );
}
