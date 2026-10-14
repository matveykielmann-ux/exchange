import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BRAND, SUPPORT } from '@/config/brand';
import { TelegramLink } from './SupportContact';
import { useTheme } from '@/lib/theme';
import { isStaff, useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { PriceTape } from './PriceTape';
import { SupportLauncher } from './SupportWidget';

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
      <div className="preview-banner" role="region" aria-label="Sandbox notice">
        <div className="container">
          <span>
            <strong>Sandbox.</strong> Prices, deposits, verification and payouts are simulated. No real funds move.
          </span>
          <Link to="/security#status">About the sandbox</Link>
        </div>
      </div>
    );
  }
  if (!config.realMoneyEnabled) {
    return (
      <div className="preview-banner" role="region" aria-label="Service notice">
        <div className="container">
          <span>
            <strong>Not yet accepting exchanges.</strong> Payment and verification providers are still being set up.
          </span>
          <Link to="/help">Contact us</Link>
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
    <button type="button" className="btn btn--ghost theme-toggle" aria-label={`Switch to ${next} theme`} onClick={() => setTheme(next)}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} width={18} height={18} />
    </button>
  );
}

function SiteHeader() {
  const user = useUser();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <nav className="primary-nav" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          {user ? (
            <>
              {isStaff(user) ? (
                <Link className="btn btn--ghost hide-on-compact" to="/admin">
                  <Icon name="grid" width={18} height={18} /> Admin
                </Link>
              ) : null}
              <Link className="btn btn--ghost hide-on-compact" to="/orders">
                Orders
              </Link>
              <Link className="btn btn--secondary hide-on-compact" to="/account">
                <Icon name="user" width={18} height={18} /> Account
              </Link>
            </>
          ) : (
            <Link className="btn btn--ghost hide-on-compact" to="/signin">
              Sign in
            </Link>
          )}
          <Link className="btn btn--dark hide-on-compact" to="/exchange">
            Start an exchange <Icon name="arrowUpRight" width={16} height={16} />
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className="btn btn--secondary menu-button">
                <Icon name="menu" width={18} height={18} />
                <span className="menu-button__label">Menu</span>
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
              <SheetTitle className="mobile-sheet__title">Menu</SheetTitle>
              <nav className="mobile-nav" aria-label="Mobile">
                <ul>
                  {NAV.map((n) => (
                    <li key={n.to}>
                      <NavLink to={n.to}>{n.label}</NavLink>
                    </li>
                  ))}
                  {user ? (
                    <>
                      <li>
                        <NavLink to="/orders">Orders</NavLink>
                      </li>
                      <li>
                        <NavLink to="/support">Support messages</NavLink>
                      </li>
                      <li>
                        <NavLink to="/account">Account</NavLink>
                      </li>
                      {isStaff(user) ? (
                        <li>
                          <NavLink to="/admin">Admin workspace</NavLink>
                        </li>
                      ) : null}
                    </>
                  ) : null}
                </ul>
                <div className="mobile-nav__actions">
                  <Link className="btn btn--lg" to="/exchange">
                    Start an exchange
                  </Link>
                  {!user ? (
                    <Link className="btn btn--secondary btn--lg" to="/signin">
                      Sign in
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
                ? 'Sell crypto for US dollars, or buy crypto with cash. This is the sandbox: every price, deposit and payout is simulated.'
                : 'Sell crypto for US dollars, or buy crypto with cash collected by courier.'}
            </p>
            <p className="small">
              Support: <TelegramLink /> · {SUPPORT.hours.label}
            </p>
          </div>
          <div>
            <h2>Product</h2>
            <ul>
              <li>
                <Link to="/exchange">Sell crypto</Link>
              </li>
              <li>
                <Link to="/exchange?direction=buy">Buy crypto with cash</Link>
              </li>
              <li>
                <Link to="/cash-delivery">Cash delivery</Link>
              </li>
              <li>
                <Link to="/fees">Fees</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Learn</h2>
            <ul>
              <li>
                <Link to="/how-it-works">How it works</Link>
              </li>
              <li>
                <Link to="/security">Security</Link>
              </li>
              <li>
                <Link to="/faq">FAQ</Link>
              </li>
              <li>
                <Link to="/help">Help and support</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Legal</h2>
            <ul>
              {LEGAL_LINKS.map((l) => (
                <li key={l.slug}>
                  <Link to={`/legal/${l.slug}`}>{l.label}</Link>
                </li>
              ))}
              <li>
                <Link to="/legal">All legal documents</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-legal">
          <p>
            CryptoBit Exchange, a company incorporated under the laws of the Republic of Panama, registration number No. 155778934,
            operating under the brand {BRAND.name}. It is not a bank. Every Exchange Request is governed by the{' '}
            <Link to="/legal/terms">Service Rules</Link>.
            {config.mode === 'sandbox'
              ? ' This is the sandbox: its prices and exchange conditions are simulated and are not an offer to buy or sell any asset.'
              : null}
          </p>
          <p>
            Crypto assets are not legal tender, are not FDIC or SIPC insured, and can lose value. Blockchain transactions generally cannot
            be reversed.
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
        Skip to content
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
              <p className="muted">Loading…</p>
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
