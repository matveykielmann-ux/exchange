import { Suspense } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LiveIndicator } from '@/components/chat/Chat';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { MockBadge } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { Role } from '@/services/types';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { useLiveState } from '@/state/useLive';
import { atLeast, ROLE_LABEL } from './lib';

const NAV: { to: string; label: string; icon: IconName; min: Role; end?: boolean; sandboxOnly?: boolean }[] = [
  { to: '/admin', label: 'Overview', icon: 'grid', min: 'support', end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'list', min: 'support' },
  { to: '/admin/inbox', label: 'Support inbox', icon: 'inbox', min: 'support' },
  { to: '/admin/desk', label: 'Large-transaction desk', icon: 'briefcase', min: 'support' },
  { to: '/admin/audit', label: 'Audit log', icon: 'file', min: 'reviewer' },
  { to: '/admin/users', label: 'Users and roles', icon: 'users', min: 'admin' },
  { to: '/admin/system', label: 'System', icon: 'activity', min: 'admin' },
  { to: '/admin/sandbox', label: 'Sandbox lab', icon: 'flask', min: 'support', sandboxOnly: true },
];

/** The staff workspace: its own layout and navigation. Every request it makes is authorized on the server by role. */
export function AdminLayout() {
  useDocumentTitle('Admin');
  const user = useUser();
  const config = useConfig();
  const { auth } = useServices();
  const live = useLiveState();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const items = NAV.filter((n) => atLeast(user?.role, n.min) && (!n.sandboxOnly || config.mode === 'sandbox'));

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <aside className="admin-side">
        <Link to="/admin" className="brand admin-brand" aria-label="Admin overview">
          <Logo />
        </Link>
        <p className="admin-side__label">Operations</p>
        <nav aria-label="Admin">
          <ul className="admin-nav">
            {items.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.end}>
                  <Icon name={n.icon} width={18} height={18} />
                  <span>{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="admin-body">
        <header className="admin-bar">
          <div className="row" style={{ gap: 10 }}>
            {config.mode === 'sandbox' ? (
              <MockBadge label="Sandbox environment" />
            ) : (
              <span className="badge badge--danger">Production</span>
            )}
            <LiveIndicator state={live} />
          </div>
          <div className="row admin-bar__user" style={{ gap: 8 }}>
            <span className="small">
              <span className="admin-bar__email">{user?.email}</span>{' '}
              <span className="badge badge--neutral">{user ? ROLE_LABEL[user.role] : ''}</span>
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} width={18} height={18} />
            </button>
            <Link className="btn btn--ghost" to="/">
              Customer site
            </Link>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={async () => {
                await auth.signOut();
                navigate('/signin');
              }}
            >
              <Icon name="logout" width={16} height={16} /> Sign out
            </button>
          </div>
        </header>
        <main id="admin-main" className="admin-main">
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
