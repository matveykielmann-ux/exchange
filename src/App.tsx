import { lazy, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { isStaff, useUser } from './state/auth';
import { DraftProvider } from './state/draft';
import { LanguageRoot } from './i18n/react';
import { ServicesProvider } from './state/services';
import type { Services } from './services/types';

// Route-level code splitting: the homepage ships eagerly, everything else on demand.
const named = <T extends Record<string, unknown>, K extends keyof T>(load: () => Promise<T>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] as ComponentType })));
const ExchangePage = named(() => import('./pages/ExchangePage'), 'ExchangePage');
const OrderPage = named(() => import('./pages/OrderPage'), 'OrderPage');
const OrdersPage = named(() => import('./pages/OrdersPage'), 'OrdersPage');
const AccountPage = named(() => import('./pages/AccountPage'), 'AccountPage');
const VerificationPage = named(() => import('./pages/VerificationPage'), 'VerificationPage');
const SignInPage = named(() => import('./pages/AuthPages'), 'SignInPage');
const SignUpPage = named(() => import('./pages/AuthPages'), 'SignUpPage');
const StaffSignInPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: () => <m.SignInPage staff /> })));
const ResetRequestPage = named(() => import('./pages/AuthPages'), 'ResetRequestPage');
const ResetConfirmPage = named(() => import('./pages/AuthPages'), 'ResetConfirmPage');
const SupportPage = named(() => import('./pages/SupportPage'), 'SupportPage');
const CashDeliveryPage = named(() => import('./pages/CashDeliveryPage'), 'CashDeliveryPage');
const HowItWorksPage = named(() => import('./pages/ContentPages'), 'HowItWorksPage');
const FeesPage = named(() => import('./pages/ContentPages'), 'FeesPage');
const SecurityPage = named(() => import('./pages/ContentPages'), 'SecurityPage');
const FaqPage = named(() => import('./pages/ContentPages'), 'FaqPage');
const HelpPage = named(() => import('./pages/ContentPages'), 'HelpPage');
const NotFoundPage = named(() => import('./pages/ContentPages'), 'NotFoundPage');
const LegalIndexPage = named(() => import('./pages/LegalPages'), 'LegalIndexPage');
const LegalDocumentPage = named(() => import('./pages/LegalPages'), 'LegalDocumentPage');

// Admin workspace: its own layout and bundle.
const AdminLayout = named(() => import('./admin/AdminLayout'), 'AdminLayout');
const AdminOverview = named(() => import('./admin/OverviewPage'), 'OverviewPage');
const AdminQueue = named(() => import('./admin/QueuePage'), 'QueuePage');
const AdminOrder = named(() => import('./admin/OrderDetailPage'), 'OrderDetailPage');
const AdminInbox = named(() => import('./admin/InboxPage'), 'InboxPage');
const AdminUsers = named(() => import('./admin/UsersPage'), 'UsersPage');
const AdminAudit = named(() => import('./admin/AuditPage'), 'AuditPage');
const AdminSystem = named(() => import('./admin/SystemPage'), 'SystemPage');
const AdminSandbox = named(() => import('./admin/SandboxLabPage'), 'SandboxLabPage');
const AdminVerifications = named(() => import('./admin/VerificationsPage'), 'VerificationsPage');
const AdminVerification = named(() => import('./admin/VerificationsPage'), 'VerificationDetailPage');

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useUser();
  const location = useLocation();
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/**
 * Hides the admin workspace from customers. This is navigation only: every
 * admin API call is authorized on the server by role (and staff MFA), so a
 * customer who forces the URL sees nothing but "access denied" errors.
 */
function RequireStaff({ children }: { children: ReactNode }) {
  const user = useUser();
  const location = useLocation();
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  if (!isStaff(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LegacyTransactionRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/orders/${id}`} replace />;
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="admin"
        element={
          <RequireStaff>
            <AdminLayout />
          </RequireStaff>
        }
      >
        {/* The order queue is the CRM home; statistics moved to /admin/overview. */}
        <Route index element={<Navigate to="/admin/orders" replace />} />
        <Route path="overview" element={<AdminOverview />} />
        <Route path="orders" element={<AdminQueue />} />
        <Route path="orders/:id" element={<AdminOrder />} />
        <Route path="inbox" element={<AdminInbox />} />
        <Route path="inbox/:id" element={<AdminInbox />} />
        <Route path="verification" element={<AdminVerifications />} />
        <Route path="verification/:id" element={<AdminVerification />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="system" element={<AdminSystem />} />
        <Route path="sandbox" element={<AdminSandbox />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="admin/login" element={<StaffSignInPage />} />
        <Route index element={<HomePage />} />
        {/* Exchanges need an account (owner decision, 2026-10-14). The server also requires a session for firm quotes and orders. */}
        <Route path="exchange" element={auth(<ExchangePage />)} />
        <Route path="cash-delivery" element={<CashDeliveryPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="fees" element={<FeesPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="legal" element={<LegalIndexPage />} />
        <Route path="legal/:slug" element={<LegalDocumentPage />} />
        {/* Paths the Service Rules link to (Sections 8 and 15); they open the matching existing pages. */}
        <Route path="en/kyc-aml-policy" element={<Navigate to="/legal/kyc-aml" replace />} />
        <Route path="en/privacy-policy" element={<Navigate to="/legal/privacy" replace />} />
        <Route path="signin" element={<SignInPage />} />
        <Route path="signup" element={<SignUpPage />} />
        <Route path="reset-password" element={<ResetRequestPage />} />
        <Route path="reset-password/confirm" element={<ResetConfirmPage />} />
        <Route path="account" element={auth(<AccountPage />)} />
        <Route path="verification" element={auth(<VerificationPage />)} />
        <Route path="orders" element={auth(<OrdersPage />)} />
        <Route path="orders/:id" element={auth(<OrderPage />)} />
        <Route path="support" element={auth(<SupportPage />)} />
        <Route path="support/:id" element={auth(<SupportPage />)} />
        <Route path="transactions" element={<Navigate to="/orders" replace />} />
        <Route path="transactions/:id" element={<LegacyTransactionRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App({ services }: { services: Services }) {
  return (
    <ServicesProvider services={services}>
      <DraftProvider>
        <BrowserRouter>
          <LanguageRoot>
            <AppRoutes />
          </LanguageRoot>
        </BrowserRouter>
      </DraftProvider>
    </ServicesProvider>
  );
}
