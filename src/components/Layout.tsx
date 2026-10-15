import { Suspense, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BRAND, SUPPORT } from '@/config/brand';
import { TelegramLink } from './SupportContact';
import { useTheme } from '@/lib/theme';
import { isStaff, useUser } from '@/state/auth';
import { useNotifications } from '@/state/useNotifications';
import { LanguageSwitch } from '@/i18n/react';
import { useConfig } from '@/state/config';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { PriceTape } from './PriceTape';
import { SupportLauncher } from './SupportWidget';
import { t } from '@/i18n';

const NAV = [
  { to: '/exchange', label: 'Sell crypto' },
  { to: '/fees', label: 'Fees' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/security', label: 'Security' },
  { to: '/help', label: 'Help' },
];

const LEGAL_LINKS = [
  { slug: 'terms', label: 'Service Rules (public offer)' },
  { slug: 'privacy', label: 'Privacy Policy' },
  { slug: 'kyc-aml', label: 'AML/KYC Notice' },
  { slug: 'risk', label: 'Risk Disclosure' },
  { slug: 'fees', label: 'Fees and exchange rates' },
  { slug: 'refunds', label: 'Cancellations and refunds' },
  { slug: 'contact', label: 'Contact and notices' },
];

/**
 * Service status banner. When money-moving providers are not connected, say so
 * plainly. Internal testing instances also warn not to transfer real funds.
 */
function ModeBanner() {
  const config = useConfig();
  const moneyKeys = new Set(['custody', 'bankPayout', 'cardPayout', 'cash']);
  const moneyReady = config.providers.filter((p) => moneyKeys.has(p.key)).every((p) => p.state === 'configured');
  if (config.mode === 'sandbox') {
    return (
      <div className="preview-banner" role="region" aria-label={t('Service notice')}>
        <div className="container">
          <span>
            <strong>{t('Do not transfer real funds.')}</strong>{' '}
            {t('Addresses and payment details shown here must not be used for live transfers.')}
          </span>
          <Link to="/help">{t('Help')}</Link>
        </div>
      </div>
    );
  }
  if (!config.realMoneyEnabled || !moneyReady) {
    return (
      <div className="preview-banner" role="region" aria-label={t('Service notice')}>
        <div className="container">
          <span>
            <strong>{t('Exchanges require connected providers.')}</strong>{' '}
            {t('Custody, payout and verification services must be configured before funds can move.')}
          </span>
          <Link to="/help">{t('Help')}</Link>
        </div>
      </div>
    );
  }
  return null;
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn btn--ghost theme-toggle"
      aria-label={t('Switch to {0} theme', [next])}
      onClick={() => setTheme(next)}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} width={18} height={18} />
    </button>
  );
}

/** Unread notices for the signed-in customer; opens the notifications section of the account page. */
function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Link
      className="btn btn--ghost header-bell"
      to="/account#notifications"
      aria-label={unread > 0 ? t('Notifications, {0} unread', [unread]) : t('Notifications')}
    >
      <Icon name="bell" width={18} height={18} />
      {unread > 0 ? (
        <span className="header-bell__count tabular" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Collapses the header into the menu button whenever the full navigation does
 * not fit on one line. Labels differ in length between languages and between
 * signed-in roles, so this measures instead of relying on a fixed breakpoint
 * (the CSS breakpoint still applies first on narrow screens).
 */
function useCompactHeader(inner: RefObject<HTMLDivElement | null>, key: string) {
  // Keyed by who is signed in: a different set of buttons is measured afresh.
  const [state, setState] = useState({ key, compact: false, needed: 0 });
  const compact = state.key === key && state.compact;
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // The observer reports once on observe, then on every size change.
    const check = () => {
      if (!compact && el.scrollWidth > el.clientWidth + 1) setState({ key, compact: true, needed: el.scrollWidth });
      else if (compact && el.clientWidth >= state.needed) setState({ key, compact: false, needed: 0 });
    };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    // Labels get wider when the web font arrives without the header changing size: measure again then.
    let live = true;
    void document.fonts?.ready.then(() => live && check());
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [inner, compact, key, state.needed]);
  return compact;
}

function SiteHeader() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  const compact = useCompactHeader(inner, `${user?.id ?? ''}|${user?.role ?? ''}`);

  return (
    <header className={`site-header${compact ? ' is-compact' : ''}`}>
      <div className="container site-header__inner" ref={inner}>
        <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <nav className="primary-nav" aria-label={t('Primary')}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <LanguageSwitch className="hide-on-phone" />
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell />
              {isStaff(user) ? (
                <Link className="btn btn--ghost hide-on-compact" to="/admin" title={t('Admin workspace')}>
                  <Icon name="grid" width={18} height={18} />
                  <span className="visually-hidden">{t('Admin workspace')}</span>
                </Link>
              ) : null}
              <Link className="btn btn--ghost hide-on-compact" to="/orders">
                {t('Orders')}
              </Link>
              <Link className="btn btn--secondary hide-on-compact" to="/account">
                <Icon name="user" width={18} height={18} /> {t('Account')}
              </Link>
            </>
          ) : (
            <Link className="btn btn--ghost hide-on-compact" to="/signin">
              {t('Sign in')}
            </Link>
          )}
          <Link className="btn btn--dark hide-on-compact" to="/exchange">
            {t('Start an exchange')} <Icon name="arrowUpRight" width={16} height={16} />
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className="btn btn--secondary menu-button">
                <Icon name="menu" width={18} height={18} />
                <span className="menu-button__label">{t('Menu')}</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="mobile-sheet"
              aria-describedby={undefined}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) setOpen(false);
              }}
            >
              <SheetTitle className="mobile-sheet__title">{t('Menu')}</SheetTitle>
              <nav className="mobile-nav" aria-label={t('Mobile')}>
                <ul>
                  {NAV.map((n) => (
                    <li key={n.to}>
                      <NavLink to={n.to}>{t(n.label)}</NavLink>
                    </li>
                  ))}
                  {user ? (
                    <>
                      <li>
                        <NavLink to="/orders">{t('Orders')}</NavLink>
                      </li>
                      <li>
                        <NavLink to="/support">{t('Support messages')}</NavLink>
                      </li>
                      <li>
                        <NavLink to="/account">{t('Account')}</NavLink>
                      </li>
                      {isStaff(user) ? (
                        <li>
                          <NavLink to="/admin">{t('Admin workspace')}</NavLink>
                        </li>
                      ) : null}
                    </>
                  ) : null}
                </ul>
                <div className="mobile-nav__actions">
                  <LanguageSwitch className="mobile-nav__lang" />
                  <Link className="btn btn--lg" to="/exchange">
                    {t('Start an exchange')}
                  </Link>
                  {!user ? (
                    <Link className="btn btn--secondary btn--lg" to="/signin">
                      {t('Sign in')}
                    </Link>
                  ) : null}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack">
            <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
              <Logo />
            </Link>
            <p className="muted" style={{ maxWidth: '34ch' }}>
              {t('Sell crypto for US dollars, or buy crypto with cash collected by courier.')}
            </p>
            <p className="small">
              {t('Support:')} <TelegramLink /> · {t(SUPPORT.hours.label)}
            </p>
          </div>
          <div>
            <h2>{t('Product')}</h2>
            <ul>
              <li>
                <Link to="/exchange">{t('Sell crypto')}</Link>
              </li>
              <li>
                <Link to="/exchange?direction=buy">{t('Buy crypto with cash')}</Link>
              </li>
              <li>
                <Link to="/cash-delivery">{t('Cash delivery')}</Link>
              </li>
              <li>
                <Link to="/fees">{t('Fees')}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t('Learn')}</h2>
            <ul>
              <li>
                <Link to="/how-it-works">{t('How it works')}</Link>
              </li>
              <li>
                <Link to="/security">{t('Security')}</Link>
              </li>
              <li>
                <Link to="/faq">FAQ</Link>
              </li>
              <li>
                <Link to="/help">{t('Help and support')}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t('Legal')}</h2>
            <ul>
              {LEGAL_LINKS.map((l) => (
                <li key={l.slug}>
                  <Link to={`/legal/${l.slug}`}>{t(l.label)}</Link>
                </li>
              ))}
              <li>
                <Link to="/legal">{t('All legal documents')}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-legal">
          <p>
            {t(
              'CryptoBit Exchange, a company incorporated under the laws of the Republic of Panama, registration number No. 155778934, operating under the brand',
            )}{' '}
            {BRAND.name}
            {t('. It is not a bank. Every Exchange Request is governed by the')} <Link to="/legal/terms">{t('Service Rules')}</Link>.
          </p>
          <p>
            {t(
              'Crypto assets are not legal tender, are not FDIC or SIPC insured, and can lose value. Blockchain transactions generally cannot be reversed.',
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Moves focus to the page heading on route change so screen-reader users hear the new page. */
function useRouteFocus() {
  const location = useLocation();
  // Compare against the last handled location (not a "first run" flag) so
  // StrictMode's double-invoked effects don't steal focus on initial load.
  const last = useRef(location.pathname + location.hash);
  useEffect(() => {
    const current = location.pathname + location.hash;
    if (last.current === current) return;
    last.current = current;
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
  }, [location.pathname, location.hash]);
}

/** Routes that open with the live price strip. */
const TAPE_ROUTES = new Set(['/exchange']);

export function Layout() {
  useRouteFocus();
  const { pathname } = useLocation();
  return (
    <>
      <a className="skip-link" href="#main">
        {t('Skip to content')}
      </a>
      <ModeBanner />
      <SiteHeader />
      {TAPE_ROUTES.has(pathname) ? (
        <div className="container tape-wrap">
          <PriceTape />
        </div>
      ) : null}
      <main id="main">
        <Suspense
          fallback={
            <div className="container flow" aria-busy="true">
              <p className="muted">{t('Loading…')}</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
      <SupportLauncher />
    </>
  );
}
