import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LiveIndicator } from '@/components/chat/Chat';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { syncThemeForScope } from '@/lib/theme';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { Role } from '@/services/types';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { useLiveState } from '@/state/useLive';
import { atLeast, staffRoleLabel } from './lib';
import { LanguageSwitch } from '@/i18n/react';
import { t } from '@/i18n';

type NavItem = { to: string; label: string; icon: IconName; min: Role; end?: boolean };
/** Daily work: orders and customer messages. */
const NAV: NavItem[] = [
  { to: '/admin/orders', label: 'Orders', icon: 'list', min: 'admin' },
  { to: '/admin/inbox', label: 'Support inbox', icon: 'inbox', min: 'admin' },
  { to: '/admin/credentials', label: 'Credentials & wallets', icon: 'bank', min: 'admin' },
  { to: '/admin/verification', label: 'Identity verification', icon: 'shield', min: 'admin' },
];
/** Occasional: statistics and people. */
const NAV_ADMIN: NavItem[] = [
  { to: '/admin/overview', label: 'Statistics', icon: 'grid', min: 'admin' },
  { to: '/admin/users', label: 'Users', icon: 'users', min: 'admin' },
];

/** The staff workspace: its own layout and navigation. Every request it makes is authorized on the server by role. */
export function AdminLayout() {
  useDocumentTitle('Admin');
  const user = useUser();
  const config = useConfig();
  const { auth } = useServices();
  const live = useLiveState();
  const navigate = useNavigate();
  const visible = (n: NavItem) => atLeast(user?.role, n.min);
  const items = NAV.filter(visible);
  const adminItems = NAV_ADMIN.filter(visible);
  const customerSiteHref = config.crmOrigin ? config.publicOrigin : '/';
  // CRM keeps its own light default (and toggle) separate from the customer site.
  useEffect(() => {
    syncThemeForScope('crm');
    return () => syncThemeForScope('site');
  }, []);

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">
        {t('Skip to content')}
      </a>
      <aside className="admin-side">
        <Link to="/admin/orders" className="brand admin-brand" aria-label={t('Orders')}>
          <Logo />
        </Link>
        <nav aria-label={t('Admin')}>
          <p className="admin-side__label">{t('Work')}</p>
          <ul className="admin-nav">
            {items.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.end}>
                  <Icon name={n.icon} width={18} height={18} />
                  <span>{t(n.label)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          {adminItems.length ? (
            <>
              <p className="admin-side__label admin-side__label--secondary">{t('Administration')}</p>
              <ul className="admin-nav admin-nav--secondary">
                {adminItems.map((n) => (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.end}>
                      <Icon name={n.icon} width={16} height={16} />
                      <span>{t(n.label)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>
      </aside>
      <div className="admin-body">
        <header className="admin-bar">
          <div className="row" style={{ gap: 10 }}>
            <LiveIndicator state={live} />
          </div>
          <div className="row admin-bar__user" style={{ gap: 8 }}>
            <ThemeToggle scope="crm" />
            <LanguageSwitch />
            <span className="small">
              <span className="admin-bar__email">{user?.email}</span>{' '}
              <span className="badge badge--neutral">{user ? t(staffRoleLabel(user.role)) : ''}</span>
            </span>
            {config.crmOrigin ? (
              <a className="btn btn--ghost" href={customerSiteHref}>
                {t('Customer site')}
              </a>
            ) : (
              <Link className="btn btn--ghost" to="/">
                {t('Customer site')}
              </Link>
            )}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={async () => {
                await auth.signOut();
                navigate('/admin/login');
              }}
            >
              <Icon name="logout" width={16} height={16} /> {t('Sign out')}
            </button>
          </div>
        </header>
        <main id="admin-main" className="admin-main">
          <Suspense fallback={<p className="muted">{t('Loading…')}</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
