import { Suspense, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BRAND, SUPPORT } from '@/config/brand';
import { TelegramLink } from './SupportContact';
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
 * Says plainly what this site can and cannot do right now, based on the
 * server's mode: in sandbox everything is simulated; in production with real
 * money disabled, no exchange can be placed.
 */
function ModeBanner() {
  const config = useConfig();
  if (config.mode === 'sandbox') {
    return (
      <div className="preview-banner" role="region" aria-label={t('Sandbox notice')}>
        <div className="container">
          <span>
            <strong>{t('Sandbox.')}</strong> {t('Prices, deposits, verification and payouts are simulated. No real funds move.')}
          </span>
          <Link to="/security#status">{t('About the sandbox')}</Link>
        </div>
      </div>
    );
  }
  if (!config.realMoneyEnabled) {
    return (
      <div className="preview-banner" role="region" aria-label={t('Service notice')}>
        <div className="container">
          <span>
            <strong>{t('Not yet accepting exchanges.')}</strong> {t('Payment and verification providers are still being set up.')}
          </span>
          <Link to="/help">{t('Contact us')}</Link>
        </div>
      </div>
    );
  }
  return null;
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
    const ro = new ResizeObserver(() => {
      if (!compact && el.scrollWidth > el.clientWidth + 1) setState({ key, compact: true, needed: el.scrollWidth });
      else if (compact && el.clientWidth >= state.needed) setState({ key, compact: false, needed: 0 });
    });
    ro.observe(el);
    return () => ro.disconnect();
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
  const config = useConfig();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack">
            <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
              <Logo />
            </Link>
            <p className="muted" style={{ maxWidth: '34ch' }}>
              {config.mode === 'sandbox'
                ? t(
                    'Sell crypto for US dollars, or buy crypto with cash. This is the sandbox: every price, deposit and payout is simulated.',
                  )
                : t('Sell crypto for US dollars, or buy crypto with cash collected by courier.')}
            </p>
            <p className="small">
              {t('Support:')} <TelegramLink /> · {SUPPORT.hours.label}
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
            {config.mode === 'sandbox'
              ? t(' This is the sandbox: its prices and exchange conditions are simulated and are not an offer to buy or sell any asset.')
              : null}
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
