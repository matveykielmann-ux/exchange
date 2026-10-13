import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Checkbox } from '@/components/Checkbox';
import { ErrorSummary, Field } from '@/components/Field';
import { errorMessage } from '@/lib/errors';
import { Notice } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { validateEmail, validatePassword, validateRequired } from '@/domain/validation';
import { useServices } from '@/state/services';

function useReturnTo(): string {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // Only allow same-site relative paths (no protocol-relative, backslash or
  // control characters), so a crafted state can't redirect off-site.
  // eslint-disable-next-line no-control-regex
  return from && /^\/(?![/\\])[^\\\u0000-\u001f]*$/.test(from) ? from : '/account';
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

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const emailErr = validateEmail(email);
    if (emailErr) next['signin-email'] = emailErr;
    if (!password) next['signin-password'] = 'Enter your password.';
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const { challengeId } = await auth.signIn({ email, password });
      setPassword('');
      setChallenge(challengeId);
    } catch (err) {
      setServerError(errorMessage(err));
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
      setServerError(errorMessage(err));
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
            <ErrorSummary errors={errors} />
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
                <InputOTP
                  {...p}
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={setCode}
                  autoFocus
                  containerClassName="otp"
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="otp__slot" aria-invalid={p['aria-invalid']} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
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
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await auth.signUp({ name, email, password });
      setPassword('');
      navigate(returnTo, { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
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
          <ErrorSummary errors={errors} />
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
          <Checkbox id="signup-agree" checked={agree} onChange={setAgree} error={errors['signup-agree']}>
            I understand this is a preview with simulated data, and I've read the <Link to="/legal#terms">terms</Link> and{' '}
            <Link to="/legal#privacy">privacy notice</Link>.
          </Checkbox>
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
