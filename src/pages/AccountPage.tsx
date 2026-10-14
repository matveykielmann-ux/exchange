import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddBankForm } from '@/components/AddBankForm';
import { AddCourierForm } from '@/components/AddCourierForm';
import { FEATURE_FLAGS } from '@/config/runtime';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { MockBadge, Notice, PageHeader, StatusBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { US_STATE_NAMES, US_STATES, type UsStateCode } from '@/domain/usStates';
import { validatePassword } from '@/domain/validation';
import { errorMessage, isNotConfigured } from '@/lib/errors';
import { describeDestination, destinationLabel, formatDateTime } from '@/lib/format';
import type { Acceptance, KycStatus, Notification, SessionInfo, User } from '@/services/types';
import { useDestinations } from '@/state/useDestinations';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';

const KYC: Record<KycStatus, { label: string; tone: 'neutral' | 'success' | 'info' | 'warn' | 'danger'; body: string }> = {
  unverified: {
    label: 'Not verified',
    tone: 'neutral',
    body: 'Verify your identity before your first exchange. You only need to do this once.',
  },
  pending: { label: 'In progress', tone: 'info', body: 'We are checking your details. This page updates when the result arrives.' },
  verified: { label: 'Verified', tone: 'success', body: 'You can place online exchanges up to the per-order limit.' },
  needs_info: {
    label: 'More information needed',
    tone: 'warn',
    body: 'Our team needs more information to finish verifying you. Check your support messages.',
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
  const [state, setState] = useState(user.stateOfResidence ?? '');
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
        stateOfResidence: state || null,
      });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section id="profile" title="Profile">
      {editing ? (
        <form className="stack" onSubmit={save} noValidate>
          <div className="form-grid">
            <Field
              label="Full legal name"
              id="pf-name"
              hint={locked ? 'Contact support to change a verified name.' : undefined}
              className="span-2"
            >
              {(p) => (
                <input className="input" {...p} value={name} readOnly={locked} onChange={(e) => setName(e.target.value)} maxLength={120} />
              )}
            </Field>
            <Field label="Phone (optional)" id="pf-phone">
              {(p) => (
                <input className="input" {...p} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              )}
            </Field>
            <Field label="State of residence" id="pf-state">
              {(p) => (
                <select className="select" {...p} value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="">Choose a state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {US_STATE_NAMES[s]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          {error ? <Notice tone="danger" title={error} role="alert" /> : null}
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="dl">
            <div>
              <dt>Name</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user.phone ?? 'Not added'}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>
                {user.stateOfResidence ? (US_STATE_NAMES[user.stateOfResidence as UsStateCode] ?? user.stateOfResidence) : 'Not added'}
              </dd>
            </div>
          </dl>
          <div>
            <button type="button" className="btn btn--secondary" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

function VerificationSection({ user }: { user: User }) {
  const { account, config } = useServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = KYC[user.verification.status];

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await account.startVerification();
      if (r.hostedUrl) window.location.assign(r.hostedUrl);
    } catch (e) {
      setError(isNotConfigured(e) ? 'Identity verification is not available yet: the provider is not connected.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="verification"
      title="Identity verification"
      aside={<StatusBadge tone={k.tone === 'danger' ? 'danger' : k.tone}>{k.label}</StatusBadge>}
    >
      <p>{k.body}</p>
      {config.mode === 'sandbox' ? (
        <p className="small muted">
          Sandbox: results come from test rules based on your name (“Review” needs more information, “Reject” is rejected, “Sanctioned”
          fails screening). No documents are collected. <MockBadge />
        </p>
      ) : null}
      {user.verification.status === 'unverified' ? (
        <div>
          <button type="button" className="btn" disabled={busy} onClick={start}>
            {busy ? 'Starting…' : 'Verify my identity'}
          </button>
        </div>
      ) : user.verification.status === 'needs_info' || user.verification.status === 'rejected' ? (
        <div>
          <Link className="btn btn--secondary" to="/support">
            Open support messages
          </Link>
        </div>
      ) : null}
      {error ? <Notice tone={error.includes('not available yet') ? 'warn' : 'danger'} title={error} role="alert" /> : null}
    </Section>
  );
}

function PayoutSection() {
  const { account, config } = useServices();
  const { list: destinations, reload } = useDestinations();
  const [adding, setAdding] = useState<'bank' | 'courier' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(isNotConfigured(e) ? 'Card payouts are not available yet: the card provider is not connected.' : errorMessage(e));
    }
  }

  return (
    <Section id="payout-methods" title="Payout methods">
      {destinations === null ? (
        <p className="muted">Loading…</p>
      ) : destinations.length === 0 ? (
        <p className="muted">No payout methods saved.</p>
      ) : (
        <ul className="dest-list">
          {destinations.map((d) => (
            <li key={d.id}>
              <span className="row" style={{ gap: 12 }}>
                <Icon name={d.kind === 'bank' ? 'bank' : d.kind === 'courier' ? 'cash' : 'card'} width={22} height={22} />
                <span>
                  <span className="tx-list__title">{d.label}</span>
                  <span className="small muted tabular" style={{ display: 'block' }}>
                    {describeDestination(d)} · added {formatDateTime(d.createdAt)}
                  </span>
                </span>
                <MockBadge />
              </span>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => act(() => account.removeDestination(d.id))}
                aria-label={`Remove ${destinationLabel(d.label, d.last4)}`}
              >
                Remove
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
      ) : (
        <div className="row">
          <button type="button" className="btn btn--secondary" onClick={() => setAdding('bank')}>
            Add a bank account
          </button>
          {FEATURE_FLAGS.courierCashDelivery ? (
            <button type="button" className="btn btn--ghost" onClick={() => setAdding('courier')}>
              Add a cash delivery address
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={() => act(() => account.addCard('Debit card'))}>
            {config.mode === 'sandbox' ? 'Add test debit card' : 'Add a debit card'}
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
      setMsg({ tone: 'info', text: 'Password changed. Your other sessions were signed out.' });
    } catch (e2) {
      setMsg({ tone: 'danger', text: errorMessage(e2) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h3 className="title">Change password</h3>
      <div className="form-grid">
        <Field label="Current password" id="pw-current">
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
        <Field label="New password" id="pw-new" hint="At least 12 characters.">
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
      {msg ? <Notice tone={msg.tone} title={msg.text} role={msg.tone === 'danger' ? 'alert' : 'status'} /> : null}
      <div>
        <button type="submit" className="btn btn--secondary" disabled={busy || !current || !next}>
          {busy ? 'Saving…' : 'Change password'}
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
        <h3 className="title">Two-step sign-in</h3>
        <p>
          <StatusBadge tone="success">On</StatusBadge> Sign-in asks for a code from your authenticator app.
        </p>
        <div>
          <button type="button" className="btn btn--ghost" onClick={() => setDisabling(true)}>
            Turn off
          </button>
        </div>
      </div>
    );

  return (
    <div className="stack">
      <h3 className="title">Two-step sign-in</h3>
      {disabling ? (
        <p>Enter a current code from your authenticator app to turn two-step sign-in off.</p>
      ) : setup ? (
        <>
          <p>Add this account to your authenticator app, then enter the 6-digit code it shows.</p>
          <dl className="dl">
            <div>
              <dt>Setup key</dt>
              <dd className="mono" style={{ wordBreak: 'break-all' }}>
                {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
              </dd>
            </div>
          </dl>
          <p className="small">
            On a phone? <a href={setup.otpauthUrl}>Open in your authenticator app</a>.
          </p>
        </>
      ) : (
        <p>Add a code from an authenticator app (such as 1Password, Google Authenticator or Authy) to every sign-in.</p>
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
            6-digit code
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
            {disabling ? 'Turn off' : 'Confirm'}
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
            Cancel
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
            Set up two-step sign-in
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
      <h3 className="title">Active sessions</h3>
      {list === null ? (
        <p className="muted small">Loading…</p>
      ) : (
        <ul className="dest-list">
          {list.map((s) => (
            <li key={s.id}>
              <span>
                <span className="tx-list__title">
                  {s.userAgent ? summarizeAgent(s.userAgent) : 'Unknown device'}{' '}
                  {s.current ? <span className="badge badge--success">This device</span> : null}
                </span>
                <span className="small muted" style={{ display: 'block' }}>
                  Signed in {formatDateTime(s.createdAt)} · last active {formatDateTime(s.lastSeenAt)}
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
              setMsg(`Signed out ${n} other ${n === 1 ? 'session' : 'sessions'}.`);
              load();
            }}
          >
            Sign out other sessions
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
          : 'Browser';
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
  return os ? `${browser} on ${os}` : browser;
}

function NotificationsSection() {
  const { account } = useServices();
  const [list, setList] = useState<Notification[] | null>(null);
  const load = useCallback(() => {
    account
      .notifications()
      .then(setList)
      .catch(() => setList([]));
  }, [account]);
  useEffect(load, [load]);
  useLiveEvents((e) => {
    if (e.type === 'notification.created') load();
  });
  return (
    <Section id="notifications" title="Notifications" aside={<MockBadge label="Sandbox: not emailed" />}>
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">No notifications yet.</p>
      ) : (
        <ul className="dest-list">
          {list.slice(0, 20).map((n) => (
            <li key={n.id}>
              <span>
                <span className="tx-list__title">{n.subject}</span>
                <span className="small muted" style={{ display: 'block' }}>
                  {formatDateTime(n.createdAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
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
    <Section id="legal" title="Documents you accepted">
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">No acceptances recorded.</p>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Legal acceptances">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Version</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 30).map((a, i) => (
                <tr key={`${a.slug}-${a.acceptedAt}-${i}`}>
                  <td>
                    <Link to={`/legal/${a.slug}`}>{title(a.slug)}</Link>
                    {a.orderId ? <span className="small muted"> · for an order</span> : null}
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
  const config = useConfig();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <>
      <PageHeader eyebrow="Account" title={user.fullName || user.email} lead={user.email}>
        <div className="row">
          {config.mode === 'sandbox' ? <MockBadge label="Sandbox account" /> : null}
          <span className="small muted">Member since {formatDateTime(user.createdAt)}</span>
        </div>
      </PageHeader>
      <div className="container">
        <div className="content-grid account-grid">
          <nav className="account-nav" aria-label="Account sections">
            <a href="#profile">Profile</a>
            <a href="#verification">Verification</a>
            <a href="#payout-methods">Payout methods</a>
            <a href="#security">Security</a>
            <a href="#notifications">Notifications</a>
            <a href="#legal">Legal</a>
            <Link to="/orders">Orders</Link>
            <Link to="/support">Support messages</Link>
          </nav>
          <div className="stack stack--lg">
            <ProfileSection key={`${user.fullName}|${user.phone}|${user.stateOfResidence}`} user={user} />
            <VerificationSection user={user} />
            <PayoutSection />
            <Section id="security" title="Security">
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
                  <Icon name="logout" width={16} height={16} /> Sign out
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
