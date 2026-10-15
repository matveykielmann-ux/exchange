import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Checkbox } from '@/components/Checkbox';
import { ErrorSummary, Field } from '@/components/Field';
import { errorMessage } from '@/lib/errors';
import { Notice } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { US_STATE_NAMES, US_STATES } from '@/domain/usStates';
import { countryOptions, RESTRICTED_TERRITORIES } from '@/domain/residence';
import { validateEmail, validatePassword, validateRequired } from '@/domain/validation';
import { ApiError } from '@/services/http';
import { isStaff } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { getLang, t } from '@/i18n';

function useReturnTo(fallback = '/account'): string {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // Only allow same-site relative paths (no protocol-relative, backslash or
  // control characters), so a crafted state can't redirect off-site.
  // eslint-disable-next-line no-control-regex
  return from && /^\/(?![/\\])[^\\\u0000-\u001f]*$/.test(from) ? from : fallback;
}

function InternalAccountsNotice() {
  const config = useConfig();
  if (config.mode !== 'sandbox') return null;
  return (
    <Notice tone="warn" title={t('Internal testing accounts')}>
      <p>{t("Accounts on this instance are for internal testing only and never move real funds. Don't reuse a real password.")}</p>
    </Notice>
  );
}

function CodeInput({
  value,
  onChange,
  fieldProps,
}: {
  value: string;
  onChange(v: string): void;
  fieldProps: { id: string; 'aria-invalid': true | undefined; 'aria-describedby': string | undefined };
}) {
  return (
    <InputOTP
      {...fieldProps}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="one-time-code"
      value={value}
      onChange={onChange}
      autoFocus
      containerClassName="otp"
    >
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} className="otp__slot" aria-invalid={fieldProps['aria-invalid']} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/**
 * Customer sign-in, and the staff entrance (`staff`): the master account and
 * team sign in at /admin/login, which the server refuses for customer
 * accounts. Staff accounts are never created by public sign-up.
 */
export function SignInPage({ staff = false }: { staff?: boolean }) {
  useDocumentTitle(staff ? 'Staff sign-in' : 'Sign in');
  const { auth } = useServices();
  const navigate = useNavigate();
  const returnTo = useReturnTo('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (role: Parameters<typeof isStaff>[0]) =>
    navigate(staff ? (returnTo.startsWith('/admin') ? returnTo : '/admin') : returnTo || (isStaff(role) ? '/admin' : '/account'), {
      replace: true,
    });

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
      const r = await auth.signIn({ email, password, ...(staff ? { staffOnly: true } : {}) });
      setPassword('');
      if (r.mfaRequired) setChallenge(r.challengeId);
      else done(r.user);
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
      done(await auth.verifyMfa({ challengeId: challenge, code }));
    } catch (err) {
      setServerError(errorMessage(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth">
      <div className="auth__panel stack stack--lg">
        <div className="stack">
          <h1 className="display-l">{challenge ? t('Two-step sign-in') : staff ? t('Master account') : t('Sign in')}</h1>
          <p className="muted">
            {challenge
              ? t('Enter the 6-digit code from your authenticator app.')
              : staff
                ? t('Sign-in for the owner and staff of CryptoBit Exchange. Customer accounts cannot sign in here.')
                : returnTo.startsWith('/exchange')
                  ? t('Sign in or create an account to exchange. Your amount and choices are kept.')
                  : t('Welcome back.')}
          </p>
        </div>
        <InternalAccountsNotice />
        {!challenge ? (
          <form className="stack" onSubmit={submitCredentials} noValidate>
            <ErrorSummary errors={errors} />
            <Field label={t('Email')} id="signin-email" error={errors['signin-email']}>
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
            <Field label={t('Password')} id="signin-password" error={errors['signin-password']}>
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
              {busy ? t('Checking…') : t('Sign in')}
            </button>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {staff ? (
                <Link className="small" to="/signin">
                  {t('Customer sign-in')}
                </Link>
              ) : (
                <p className="small">
                  {t('New here?')}{' '}
                  <Link to="/signup" state={{ from: returnTo || undefined }}>
                    {t('Create an account')}
                  </Link>
                </p>
              )}
              <Link className="small" to="/reset-password">
                {t('Forgot your password?')}
              </Link>
            </div>
          </form>
        ) : (
          <form className="stack" onSubmit={submitCode} noValidate>
            <Field
              label={t('Verification code')}
              id="signin-code"
              error={errors['signin-code']}
              hint={t('The code changes every 30 seconds.')}
            >
              {(p) => <CodeInput value={code} onChange={setCode} fieldProps={p} />}
            </Field>
            {serverError ? <Notice tone="danger" title={serverError} role="alert" /> : null}
            <button className="btn btn--lg btn--block" type="submit" disabled={busy}>
              {busy ? t('Verifying…') : t('Verify and sign in')}
            </button>
            <button
              type="button"
              className="link-button small"
              onClick={() => {
                setChallenge(null);
                setCode('');
              }}
            >
              {t('Use a different account')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function SignUpPage() {
  useDocumentTitle('Create account');
  const { auth, config } = useServices();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const signupDocs = config.legal.filter((d) => d.acceptance === 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [notRestricted, setNotRestricted] = useState(false);
  const [agree, setAgree] = useState(false);
  const countries = useMemo(() => countryOptions(getLang()), []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const n = validateRequired(name, 'your full legal name');
    const em = validateEmail(email);
    const pw = validatePassword(password);
    if (n) next['signup-name'] = n;
    if (em) next['signup-email'] = em;
    if (pw) next['signup-password'] = pw;
    if (!country) next['signup-country'] = 'Choose the country where you live.';
    else if (country === 'US' && !state) next['signup-state'] = 'Choose the state where you live.';
    if (!notRestricted) next['signup-territory'] = 'Confirm that you do not live in one of the listed territories.';
    if (!agree) next['signup-agree'] = 'Accept the terms to create an account.';
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await auth.signUp({
        email,
        password,
        fullName: name,
        countryOfResidence: country,
        stateOfResidence: country === 'US' ? state : null,
        notInRestrictedTerritory: notRestricted,
        accepted: signupDocs.map((d) => ({ slug: d.slug, version: d.version })),
      });
      setPassword('');
      navigate(returnTo, { replace: true });
    } catch (err) {
      const field = err instanceof ApiError ? err.field : undefined;
      const map: Record<string, string> = {
        email: 'signup-email',
        password: 'signup-password',
        fullName: 'signup-name',
        countryOfResidence: 'signup-country',
        stateOfResidence: 'signup-state',
        notInRestrictedTerritory: 'signup-territory',
      };
      if (field && map[field]) setErrors({ [map[field]]: errorMessage(err) });
      else setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth">
      <div className="auth__panel stack stack--lg">
        <div className="stack">
          <h1 className="display-l">{t('Create an account')}</h1>
          <p className="muted">{t("You'll need one to place an order. We'll verify your identity before your first payout.")}</p>
        </div>
        <InternalAccountsNotice />
        <form className="stack" onSubmit={submit} noValidate>
          <ErrorSummary errors={errors} />
          <Field
            label={t('Full legal name')}
            id="signup-name"
            error={errors['signup-name']}
            hint={t('As it appears on your government ID.')}
          >
            {(p) => (
              <input className="input" {...p} autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            )}
          </Field>
          <Field label={t('Email')} id="signup-email" error={errors['signup-email']}>
            {(p) => (
              <input className="input" {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label={t('Country of residence')} id="signup-country" error={errors['signup-country']}>
            {(p) => (
              <select className="select" {...p} autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">{t('Choose a country')}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {country === 'US' ? (
            <Field label={t('State of residence')} id="signup-state" error={errors['signup-state']}>
              {(p) => (
                <select className="select" {...p} autoComplete="address-level1" value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="">{t('Choose a state')}</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {US_STATE_NAMES[s]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}
          <Field
            label={t('Password')}
            id="signup-password"
            error={errors['signup-password']}
            hint={t('At least 12 characters. A passphrase works well.')}
          >
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
          <Checkbox id="signup-territory" checked={notRestricted} onChange={setNotRestricted} error={errors['signup-territory']}>
            {t('I am not a citizen or resident of, and do not live in, any territory listed in clause 8.5 of the')}{' '}
            <Link to="/legal/terms#clause-8-5" target="_blank">
              {t('Service Rules')}
            </Link>
            : {RESTRICTED_TERRITORIES.join('; ')}.
          </Checkbox>
          <Checkbox id="signup-agree" checked={agree} onChange={setAgree} error={errors['signup-agree']}>
            {t('I agree to the')}{' '}
            {signupDocs.map((d, i) => (
              <span key={d.slug}>
                {i > 0 ? (i === signupDocs.length - 1 ? ' and ' : ', ') : null}
                <Link to={`/legal/${d.slug}`} target="_blank">
                  {d.title}
                </Link>
              </span>
            ))}
            {t(', including receiving documents electronically.')}
          </Checkbox>
          <p className="small muted">
            {t('Under the')}{' '}
            <Link to="/legal/terms" target="_blank">
              {t('Service Rules')}
            </Link>
            {t(', using the Service confirms your agreement with them. You also accept them with each Exchange Request.')}
          </p>
          {serverError ? <Notice tone="danger" title={serverError} role="alert" /> : null}
          <button className="btn btn--lg btn--block" type="submit" disabled={busy}>
            {busy ? t('Creating…') : t('Create account')}
          </button>
          <p className="small">
            {t('Already have one?')}{' '}
            <Link to="/signin" state={{ from: returnTo }}>
              {t('Sign in')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export function ResetRequestPage() {
  useDocumentTitle('Reset password');
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ sandboxResetUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      setSent(await auth.requestPasswordReset(email));
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  const sandboxPath = sent?.sandboxResetUrl ? new URL(sent.sandboxResetUrl).pathname + new URL(sent.sandboxResetUrl).search : null;
  return (
    <div className="container auth">
      <div className="auth__panel stack stack--lg">
        <div className="stack">
          <h1 className="display-l">{t('Reset your password')}</h1>
          <p className="muted">{t("We'll email a link that works once, for 30 minutes.")}</p>
        </div>
        {sent ? (
          <div className="stack">
            <Notice tone="info" title={t('Check your email')} role="status">
              <p>
                {t('If an account exists for')} {email}
                {t(', a reset link is on its way. It can take a few minutes to arrive.')}
              </p>
            </Notice>
            {sandboxPath ? (
              <Notice tone="warn" title={t('Email is not sent on this instance')}>
                <p>
                  {t('Use this reset link instead of waiting for email.')} <Link to={sandboxPath}>{t('Open the reset link')}</Link>
                </p>
              </Notice>
            ) : null}
            <Link to="/signin">{t('Back to sign in')}</Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            <Field label={t('Email')} id="reset-email" error={error}>
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
            <button className="btn btn--lg btn--block" type="submit" disabled={busy}>
              {busy ? t('Sending…') : t('Send reset link')}
            </button>
            <Link className="small" to="/signin">
              {t('Back to sign in')}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResetConfirmPage() {
  useDocumentTitle('Choose a new password');
  const { auth } = useServices();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const pw = validatePassword(password);
    if (pw) next['reset-password'] = pw;
    if (confirm !== password) next['reset-confirm'] = 'The passwords don’t match.';
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await auth.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth">
      <div className="auth__panel stack stack--lg">
        <h1 className="display-l">{t('Choose a new password')}</h1>
        {!token ? (
          <Notice tone="danger" title={t('This link is incomplete')}>
            <p>
              {t('Open the link from your email again, or')} <Link to="/reset-password">{t('request a new one')}</Link>.
            </p>
          </Notice>
        ) : done ? (
          <div className="stack">
            <Notice tone="info" title={t('Password changed')} role="status">
              <p>{t('Every session on your account was signed out. Sign in with your new password.')}</p>
            </Notice>
            <Link className="btn btn--lg" to="/signin">
              {t('Sign in')}
            </Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            <ErrorSummary errors={errors} />
            <Field label={t('New password')} id="reset-password" error={errors['reset-password']} hint={t('At least 12 characters.')}>
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
            <Field label={t('Confirm new password')} id="reset-confirm" error={errors['reset-confirm']}>
              {(p) => (
                <input
                  className="input"
                  {...p}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              )}
            </Field>
            {serverError ? (
              <Notice tone="danger" title={serverError} role="alert">
                <p>
                  {t('Links expire after 30 minutes and work once.')} <Link to="/reset-password">{t('Request a new link')}</Link>.
                </p>
              </Notice>
            ) : null}
            <button className="btn btn--lg btn--block" type="submit" disabled={busy}>
              {busy ? t('Saving…') : t('Save new password')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
