import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ErrorSummary, Field } from '@/components/Field';
import { Notice } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { validateEmail, validatePassword, validateRequired } from '@/domain/validation';
import { useServices } from '@/state/services';

function useReturnTo(): string {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // Only allow same-site relative paths, so a crafted state can't redirect off-site.
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/account';
}

function PreviewAuthNotice() {
  return (
    <Notice tone="warn" title="Preview accounts are simulated">
      <p>
        Accounts exist only in this browser. Passwords are checked for length and then discarded, never stored. Don't reuse a real password.
      </p>
    </Notice>
  );
}

export function SignInPage() {
  useDocumentTitle('Sign in');
  const { auth } = useServices();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const emailErr = validateEmail(email);
    if (emailErr) next['signin-email'] = emailErr;
    if (!password) next['signin-password'] = 'Enter your password.';
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => summaryRef.current?.querySelector<HTMLElement>('#error-summary')?.focus());
      return;
    }
    setBusy(true);
    try {
      const { challengeId } = await auth.signIn({ email, password });
      setPassword('');
      setChallenge(challengeId);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    if (!/^\d{6}$/.test(code)) {
      setErrors({ 'signin-code': 'Enter the 6-digit code.' });
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      await auth.verifyMfa({ challengeId: challenge, code });
      navigate(returnTo, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth">
      <div className="auth__panel stack stack--lg">
        <div className="stack">
          <h1 className="display-l">{challenge ? 'Check your code' : 'Sign in'}</h1>
          <p className="muted">{challenge ? 'Enter the 6-digit code from your authenticator app.' : 'Welcome back.'}</p>
        </div>
        <PreviewAuthNotice />
        {!challenge ? (
          <form className="stack" onSubmit={submitCredentials} noValidate>
            <div ref={summaryRef}>
              <ErrorSummary errors={Object.entries(errors).map(([fieldId, message]) => ({ fieldId, message }))} />
            </div>
            <Field label="Email" id="signin-email" error={errors['signin-email']}>
              {(p) => (
                <input
                  className="input"
                  {...p}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Field label="Password" id="signin-password" error={errors['signin-password']}>
              {(p) => (
                <input
                  className="input"
                  {...p}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            {serverError ? <Notice tone="danger" title={serverError} role="alert" /> : null}
            <button className="btn btn--lg btn--block" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <p className="small">
              New here?{' '}
              <Link to="/signup" state={{ from: returnTo }}>
                Create a preview account
              </Link>
            </p>
          </form>
        ) : (
          <form className="stack" onSubmit={submitCode} noValidate>
            <Field label="Verification code" id="signin-code" error={errors['signin-code']} hint="Preview code: 000000">
              {(p) => (
                <input
                  className="input tabular"
                  {...p}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              )}
            </Field>
            {serverError ? <Notice tone="danger" title={serverError} role="alert" /> : null}
            <button className="btn btn--lg btn--block" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify and sign in'}
            </button>
            <button
              type="button"
              className="link-button small"
              onClick={() => {
                setChallenge(null);
                setCode('');
              }}
            >
              Use a different account
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function SignUpPage() {
  useDocumentTitle('Create account');
  const { auth } = useServices();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const n = validateRequired(name, 'your full name');
    const em = validateEmail(email);
    const pw = validatePassword(password);
    if (n) next['signup-name'] = n;
    if (em) next['signup-email'] = em;
    if (pw) next['signup-password'] = pw;
    if (!agree) next['signup-agree'] = 'Confirm you understand this is a preview.';
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => summaryRef.current?.querySelector<HTMLElement>('#error-summary')?.focus());
      return;
    }
    setBusy(true);
    try {
      await auth.signUp({ name, email, password });
      setPassword('');
      navigate(returnTo, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth">
      <div className="auth__panel stack stack--lg">
        <div className="stack">
          <h1 className="display-l">Create an account</h1>
          <p className="muted">You'll need one to confirm an exchange.</p>
        </div>
        <PreviewAuthNotice />
        <form className="stack" onSubmit={submit} noValidate>
          <div ref={summaryRef}>
            <ErrorSummary errors={Object.entries(errors).map(([fieldId, message]) => ({ fieldId, message }))} />
          </div>
          <Field label="Full legal name" id="signup-name" error={errors['signup-name']}>
            {(p) => <input className="input" {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Email" id="signup-email" error={errors['signup-email']}>
            {(p) => (
              <input className="input" {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="Password" id="signup-password" error={errors['signup-password']} hint="At least 12 characters.">
            {(p) => (
              <input
                className="input"
                {...p}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <div className="field">
            <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }} htmlFor="signup-agree">
              <input
                id="signup-agree"
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                aria-invalid={errors['signup-agree'] ? true : undefined}
                aria-describedby={errors['signup-agree'] ? 'signup-agree-error' : undefined}
                style={{ width: 20, height: 20, marginTop: 2, flex: 'none', accentColor: 'var(--emerald-700)' }}
              />
              <span>
                I understand this is a preview with simulated data, and I've read the <Link to="/legal#terms">terms</Link> and{' '}
                <Link to="/legal#privacy">privacy notice</Link>.
              </span>
            </label>
            {errors['signup-agree'] ? (
              <p className="field__error" id="signup-agree-error">
                {errors['signup-agree']}
              </p>
            ) : null}
          </div>
          {serverError ? <Notice tone="danger" title={serverError} role="alert" /> : null}
          <button className="btn btn--lg btn--block" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="small">
            Already have one?{' '}
            <Link to="/signin" state={{ from: returnTo }}>
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
