import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AccountPage } from './pages/AccountPage';
import { SignInPage, SignUpPage } from './pages/AuthPages';
import { CashDeliveryPage } from './pages/CashDeliveryPage';
import { FaqPage, FeesPage, HelpPage, HowItWorksPage, LegalPage, NotFoundPage, SecurityPage } from './pages/ContentPages';
import { ExchangePage } from './pages/ExchangePage';
import { HomePage } from './pages/HomePage';
import { LargeTransactionsPage } from './pages/LargeTransactionsPage';
import { TransactionPage } from './pages/TransactionPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { useUser } from './state/auth';
import { DraftProvider } from './state/draft';
import { ServicesProvider } from './state/services';
import type { Services } from './services/types';

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
