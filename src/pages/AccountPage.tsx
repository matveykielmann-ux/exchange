import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddBankForm } from '@/components/AddBankForm';
import { AddCardForm } from '@/components/AddCardForm';
import { AddCourierForm } from '@/components/AddCourierForm';
import { FEATURE_FLAGS } from '@/config/runtime';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { NotificationItem } from '@/components/NotificationItem';
import { Notice, PageHeader, StatusBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { US_STATE_NAMES, US_STATES, type UsStateCode } from '@/domain/usStates';
import { countryName, countryOptions } from '@/domain/residence';
import { validatePassword } from '@/domain/validation';
import { errorMessage } from '@/lib/errors';
import { describeDestination, destinationLabel, formatDateTime } from '@/lib/format';
import type { Acceptance, KycStatus, SessionInfo, User } from '@/services/types';
import { useDestinations } from '@/state/useDestinations';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import { useNotifications } from '@/state/useNotifications';
import { getLang, t } from '@/i18n';

const KYC: Record<KycStatus, { label: string; tone: 'neutral' | 'success' | 'info' | 'warn' | 'danger'; body: string }> = {
  unverified: {
    label: 'Not verified',
    tone: 'neutral',
    body: 'Verify your identity before your first exchange: upload a photo ID, a selfie and a proof of address. You only need to do this once.',
  },
  pending: {
    label: 'In review',
    tone: 'info',
    body: 'Our team is reviewing your documents. We will notify you when the review is finished.',
  },
  verified: { label: 'Verified', tone: 'success', body: 'You can place online exchanges.' },
  needs_info: {
    label: 'More information needed',
    tone: 'warn',
    body: 'Our team needs more information to finish verifying you. Open your documents to see the reviewer’s note.',
  },
  rejected: {
    label: 'Not approved',
    tone: 'danger',
    body: 'We could not verify your identity, so exchanges are not available on this account.',
  },
};

function Section({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="panel" aria-labelledby={`${id}-title`}>
      <div className="panel__head">
        <h2 id={`${id}-title`}>{title}</h2>
        {aside}
      </div>
      <div className="panel__body stack">{children}</div>
    </section>
  );
}

function ProfileSection({ user }: { user: User }) {
  const { account } = useServices();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [country, setCountry] = useState(user.countryOfResidence ?? (user.stateOfResidence ? 'US' : ''));
  const [state, setState] = useState(user.stateOfResidence ?? '');
  const countries = useMemo(() => countryOptions(getLang()), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = user.verification.status === 'verified' || user.verification.status === 'pending';

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await account.updateProfile({
        ...(locked ? {} : { fullName: name.trim() }),
        phone: phone.trim() || null,
        countryOfResidence: country || null,
        stateOfResidence: country === 'US' ? state || null : null,
      });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section id="profile" title={t('Profile')}>
      {editing ? (
        <form className="stack" onSubmit={save} noValidate>
          <div className="form-grid">
            <Field
              label={t('Full legal name')}
              id="pf-name"
              hint={locked ? t('Contact support to change a verified name.') : undefined}
              className="span-2"
            >
              {(p) => (
                <input className="input" {...p} value={name} readOnly={locked} onChange={(e) => setName(e.target.value)} maxLength={120} />
              )}
            </Field>
            <Field label={t('Phone (optional)')} id="pf-phone">
              {(p) => (
                <input className="input" {...p} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              )}
            </Field>
            <Field label={t('Country of residence')} id="pf-country">
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
              <Field label={t('State of residence')} id="pf-state">
                {(p) => (
                  <select className="select" {...p} value={state} onChange={(e) => setState(e.target.value)}>
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
          </div>
          {error ? <Notice tone="danger" title={error} role="alert" /> : null}
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? t('Saving…') : t('Save')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              {t('Cancel')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="dl">
            <div>
              <dt>{t('Name')}</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>{t('Email')}</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>{t('Phone')}</dt>
              <dd>{user.phone ?? t('Not added')}</dd>
            </div>
            <div>
              <dt>{t('Country')}</dt>
              <dd>{user.countryOfResidence ? countryName(user.countryOfResidence, getLang()) : t('Not added')}</dd>
            </div>
            {user.stateOfResidence ? (
              <div>
                <dt>{t('State')}</dt>
                <dd>{US_STATE_NAMES[user.stateOfResidence as UsStateCode] ?? user.stateOfResidence}</dd>
              </div>
            ) : null}
          </dl>
          <div>
            <button type="button" className="btn btn--secondary" onClick={() => setEditing(true)}>
              {t('Edit profile')}
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

function VerificationSection({ user }: { user: User }) {
  const k = KYC[user.verification.status];
  const status = user.verification.status;

  return (
    <Section
      id="verification"
      title={t('Identity verification')}
      aside={<StatusBadge tone={k.tone === 'danger' ? 'danger' : k.tone}>{t(k.label)}</StatusBadge>}
    >
      <p>{t(k.body)}</p>
      <div>
        {status === 'rejected' ? (
          <Link className="btn btn--secondary" to="/support">
            {t('Open support messages')}
          </Link>
        ) : (
          <Link className={status === 'unverified' || status === 'needs_info' ? 'btn' : 'btn btn--secondary'} to="/verification">
            {status === 'unverified'
              ? t('Verify my identity')
              : status === 'needs_info'
                ? t('Update my documents')
                : t('View my documents')}
          </Link>
        )}
      </div>
    </Section>
  );
}

function PayoutSection() {
  const { account } = useServices();
  const { list: destinations, reload } = useDestinations();
  const [adding, setAdding] = useState<'bank' | 'courier' | 'card' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Section id="payout-methods" title={t('Payout methods')}>
      {destinations === null ? (
        <p className="muted">{t('Loading…')}</p>
      ) : destinations.length === 0 ? (
        <p className="muted">{t('No payout methods saved.')}</p>
      ) : (
        <ul className="dest-list">
          {destinations.map((d) => (
            <li key={d.id}>
              <span className="row" style={{ gap: 12 }}>
                <Icon name={d.kind === 'bank' ? 'bank' : d.kind === 'courier' ? 'cash' : 'card'} width={22} height={22} />
                <span>
                  <span className="tx-list__title">{d.label}</span>
                  <span className="small muted tabular" style={{ display: 'block' }}>
                    {describeDestination(d)} {t('· added')} {formatDateTime(d.createdAt)}
                  </span>
                </span>
              </span>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => act(() => account.removeDestination(d.id))}
                aria-label={t('Remove {0}', [destinationLabel(d.label, d.last4)])}
              >
                {t('Remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <Notice tone="danger" title={error} role="alert" /> : null}
      {adding === 'bank' ? (
        <AddBankForm
          onAdded={() => {
            setAdding(null);
            reload();
          }}
        />
      ) : adding === 'courier' ? (
        <AddCourierForm
          onAdded={() => {
            setAdding(null);
            reload();
          }}
          onCancel={() => setAdding(null)}
        />
      ) : adding === 'card' ? (
        <AddCardForm
          onAdded={() => {
            setAdding(null);
            reload();
          }}
          onCancel={() => setAdding(null)}
        />
      ) : (
        <div className="row">
          <button type="button" className="btn btn--secondary" onClick={() => setAdding('bank')}>
            {t('Add a bank account')}
          </button>
          {FEATURE_FLAGS.courierCashDelivery ? (
            <button type="button" className="btn btn--ghost" onClick={() => setAdding('courier')}>
              {t('Add a cash delivery address')}
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={() => setAdding('card')}>
            {t('Add a debit card')}
          </button>
        </div>
      )}
    </Section>
  );
}

function PasswordForm() {
  const { auth } = useServices();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = validatePassword(next);
    if (err) {
      setMsg({ tone: 'danger', text: err });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await auth.changePassword(current, next);
      setCurrent('');
      setNext('');
      setMsg({ tone: 'info', text: t('Password changed. Your other sessions were signed out.') });
    } catch (e2) {
      setMsg({ tone: 'danger', text: errorMessage(e2) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h3 className="title">{t('Change password')}</h3>
      <div className="form-grid">
        <Field label={t('Current password')} id="pw-current">
          {(p) => (
            <input
              className="input"
              {...p}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('New password')} id="pw-new" hint={t('At least 12 characters.')}>
          {(p) => (
            <input
              className="input"
              {...p}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          )}
        </Field>
      </div>
      {msg ? <Notice tone={msg.tone} title={t(msg.text)} role={msg.tone === 'danger' ? 'alert' : 'status'} /> : null}
      <div>
        <button type="submit" className="btn btn--secondary" disabled={busy || !current || !next}>
          {busy ? t('Saving…') : t('Change password')}
        </button>
      </div>
    </form>
  );
}

function TotpSetup({ user }: { user: User }) {
  const { auth } = useServices();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (user.totpEnabled && !disabling)
    return (
      <div className="stack">
        <h3 className="title">{t('Two-step sign-in')}</h3>
        <p>
          <StatusBadge tone="success">{t('On')}</StatusBadge> {t('Sign-in asks for a code from your authenticator app.')}
        </p>
        <div>
          <button type="button" className="btn btn--ghost" onClick={() => setDisabling(true)}>
            {t('Turn off')}
          </button>
        </div>
      </div>
    );

  return (
    <div className="stack">
      <h3 className="title">{t('Two-step sign-in')}</h3>
      {disabling ? (
        <p>{t('Enter a current code from your authenticator app to turn two-step sign-in off.')}</p>
      ) : setup ? (
        <>
          <p>{t('Add this account to your authenticator app, then enter the 6-digit code it shows.')}</p>
          <dl className="dl">
            <div>
              <dt>{t('Setup key')}</dt>
              <dd className="mono" style={{ wordBreak: 'break-all' }}>
                {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
              </dd>
            </div>
          </dl>
          <p className="small">
            {t('On a phone?')} <a href={setup.otpauthUrl}>{t('Open in your authenticator app')}</a>.
          </p>
        </>
      ) : (
        <p>{t('Add a code from an authenticator app (such as 1Password, Google Authenticator or Authy) to every sign-in.')}</p>
      )}
      {setup || disabling ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (disabling) {
                await auth.disableTotp(code);
                setDisabling(false);
              } else {
                await auth.confirmTotp(code);
                setSetup(null);
              }
              setCode('');
            });
          }}
        >
          <label className="visually-hidden" htmlFor="totp-code">
            {t('6-digit code')}
          </label>
          <input
            id="totp-code"
            className="input tabular"
            style={{ maxWidth: 160 }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
          />
          <button type="submit" className="btn btn--secondary" disabled={busy || code.length !== 6}>
            {disabling ? t('Turn off') : t('Confirm')}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setSetup(null);
              setDisabling(false);
              setCode('');
            }}
          >
            {t('Cancel')}
          </button>
        </form>
      ) : (
        <div>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy}
            onClick={() => void run(async () => setSetup(await auth.beginTotp()))}
          >
            {t('Set up two-step sign-in')}
          </button>
        </div>
      )}
      {error ? <Notice tone="danger" title={error} role="alert" /> : null}
    </div>
  );
}

function SessionsList() {
  const { auth } = useServices();
  const [list, setList] = useState<SessionInfo[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    auth
      .sessions()
      .then(setList)
      .catch(() => setList([]));
  }, [auth]);
  useEffect(load, [load]);
  return (
    <div className="stack">
      <h3 className="title">{t('Active sessions')}</h3>
      {list === null ? (
        <p className="muted small">{t('Loading…')}</p>
      ) : (
        <ul className="dest-list">
          {list.map((s) => (
            <li key={s.id}>
              <span>
                <span className="tx-list__title">
                  {s.userAgent ? summarizeAgent(s.userAgent) : t('Unknown device')}{' '}
                  {s.current ? <span className="badge badge--success">{t('This device')}</span> : null}
                </span>
                <span className="small muted" style={{ display: 'block' }}>
                  {t('Signed in')} {formatDateTime(s.createdAt)} {t('· last active')} {formatDateTime(s.lastSeenAt)}
                  {s.ip ? ` · ${s.ip}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {list && list.length > 1 ? (
        <div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={async () => {
              const n = await auth.revokeOtherSessions();
              setMsg(t(n === 1 ? 'Signed out {0} other session.' : 'Signed out {0} other sessions.', [n]));
              load();
            }}
          >
            {t('Sign out other sessions')}
          </button>
        </div>
      ) : null}
      {msg ? (
        <p className="small" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

function summarizeAgent(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : t('Browser');
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? t('{browser} on {os}', { browser, os }) : browser;
}

function NotificationsSection() {
  const { list, unread, markRead } = useNotifications();
  return (
    <Section
      id="notifications"
      title={t('Notifications')}
      aside={
        unread > 0 ? (
          <span className="badge badge--info">
            {unread} {t('unread')}
          </span>
        ) : null
      }
    >
      {list === null ? (
        <p className="muted">{t('Loading…')}</p>
      ) : list.length === 0 ? (
        <p className="muted">{t('No notifications yet.')}</p>
      ) : (
        <>
          {unread > 0 ? (
            <div>
              <button type="button" className="btn btn--ghost" onClick={() => void markRead()}>
                <Icon name="check" width={16} height={16} /> {t('Mark all as read')}
              </button>
            </div>
          ) : null}
          <ul className="notice-list">
            {list.slice(0, 30).map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={() => (n.readAt ? undefined : void markRead([n.id]))} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function LegalSection() {
  const { account, config } = useServices();
  const [list, setList] = useState<Acceptance[] | null>(null);
  useEffect(() => {
    account
      .acceptances()
      .then(setList)
      .catch(() => setList([]));
  }, [account]);
  const title = (slug: string) => config.legal.find((d) => d.slug === slug)?.title ?? slug;
  return (
    <Section id="legal" title={t('Documents you accepted')}>
      {list === null ? (
        <p className="muted">{t('Loading…')}</p>
      ) : list.length === 0 ? (
        <p className="muted">{t('No acceptances recorded.')}</p>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Legal acceptances')}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('Document')}</th>
                <th scope="col">{t('Version')}</th>
                <th scope="col">{t('When')}</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 30).map((a, i) => (
                <tr key={`${a.slug}-${a.acceptedAt}-${i}`}>
                  <td>
                    <Link to={`/legal/${a.slug}`}>{title(a.slug)}</Link>
                    {a.orderId ? <span className="small muted"> {t('· for an order')}</span> : null}
                  </td>
                  <td className="tabular">{a.version}</td>
                  <td className="tabular">{formatDateTime(a.acceptedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function AccountPage() {
  useDocumentTitle('Account');
  const user = useUser();
  const services = useServices();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <>
      <PageHeader eyebrow={t('Account')} title={user.fullName || user.email} lead={user.email}>
        <span className="small muted">
          {t('Member since')} {formatDateTime(user.createdAt)}
        </span>
      </PageHeader>
      <div className="container">
        <div className="content-grid account-grid">
          <nav className="account-nav" aria-label={t('Account sections')}>
            <a href="#profile">{t('Profile')}</a>
            <a href="#verification">{t('Verification')}</a>
            <a href="#payout-methods">{t('Payout methods')}</a>
            <a href="#security">{t('Security')}</a>
            <a href="#notifications">{t('Notifications')}</a>
            <a href="#legal">{t('Legal')}</a>
            <Link to="/orders">{t('Orders')}</Link>
            <Link to="/support">{t('Support messages')}</Link>
          </nav>
          <div className="stack stack--lg">
            <ProfileSection key={`${user.fullName}|${user.phone}|${user.countryOfResidence}|${user.stateOfResidence}`} user={user} />
            <VerificationSection user={user} />
            <PayoutSection />
            <Section id="security" title={t('Security')}>
              <PasswordForm />
              <hr className="divider" />
              <TotpSetup user={user} />
              <hr className="divider" />
              <SessionsList />
              <hr className="divider" />
              <div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={async () => {
                    await services.auth.signOut();
                    navigate('/');
                  }}
                >
                  <Icon name="logout" width={16} height={16} /> {t('Sign out')}
                </button>
              </div>
            </Section>
            <NotificationsSection />
            <LegalSection />
          </div>
        </div>
      </div>
    </>
  );
}
