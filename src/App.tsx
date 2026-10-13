import { lazy, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { useUser } from './state/auth';
import { DraftProvider } from './state/draft';
import { ServicesProvider } from './state/services';
import type { Services } from './services/types';

// Route-level code splitting: the homepage ships eagerly, everything else on demand.
const named = <T extends Record<string, unknown>, K extends keyof T>(load: () => Promise<T>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] as ComponentType })));
const ExchangePage = named(() => import('./pages/ExchangePage'), 'ExchangePage');
const TransactionPage = named(() => import('./pages/TransactionPage'), 'TransactionPage');
const TransactionsPage = named(() => import('./pages/TransactionsPage'), 'TransactionsPage');
const AccountPage = named(() => import('./pages/AccountPage'), 'AccountPage');
const SignInPage = named(() => import('./pages/AuthPages'), 'SignInPage');
const SignUpPage = named(() => import('./pages/AuthPages'), 'SignUpPage');
const LargeTransactionsPage = named(() => import('./pages/LargeTransactionsPage'), 'LargeTransactionsPage');
const CashDeliveryPage = named(() => import('./pages/CashDeliveryPage'), 'CashDeliveryPage');
const HowItWorksPage = named(() => import('./pages/ContentPages'), 'HowItWorksPage');
const FeesPage = named(() => import('./pages/ContentPages'), 'FeesPage');
const SecurityPage = named(() => import('./pages/ContentPages'), 'SecurityPage');
const FaqPage = named(() => import('./pages/ContentPages'), 'FaqPage');
const HelpPage = named(() => import('./pages/ContentPages'), 'HelpPage');
const LegalPage = named(() => import('./pages/ContentPages'), 'LegalPage');
const NotFoundPage = named(() => import('./pages/ContentPages'), 'NotFoundPage');

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useUser();
  const location = useLocation();
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="exchange" element={<ExchangePage />} />
        <Route path="large-transactions" element={<LargeTransactionsPage />} />
        <Route path="cash-delivery" element={<CashDeliveryPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="fees" element={<FeesPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="signin" element={<SignInPage />} />
        <Route path="signup" element={<SignUpPage />} />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="transactions"
          element={
            <RequireAuth>
              <TransactionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="transactions/:id"
          element={
            <RequireAuth>
              <TransactionPage />
            </RequireAuth>
          }
        />
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
          <AppRoutes />
        </BrowserRouter>
      </DraftProvider>
    </ServicesProvider>
  );
}
