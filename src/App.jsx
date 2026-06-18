import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { setRefreshHandler, setUnauthorizedHandler } from './api/client.js';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { ModalProvider } from './components/ModalProvider.jsx';
import { ToastProvider, useToast } from './components/ToastProvider.jsx';
import { I18nProvider, useI18n } from './i18n/I18nContext.jsx';
import { AppShell } from './layout/AppShell.jsx';
import { AuditPage } from './pages/AuditPage.jsx';
import { ClientsPage } from './pages/ClientsPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { EsfPage } from './pages/EsfPage.jsx';
import { KaspiPage } from './pages/KaspiPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NktPage } from './pages/NktPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { PurchasesPage } from './pages/PurchasesPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { SalesPage } from './pages/SalesPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { SntPage } from './pages/SntPage.jsx';
import { SonoPage } from './pages/SonoPage.jsx';
import { TariffPage } from './pages/TariffPage.jsx';
import { WarehousePage } from './pages/WarehousePage.jsx';
import { WbPage } from './pages/WbPage.jsx';
import { ThemeProvider } from './theme/ThemeContext.jsx';

function AppRoutes() {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const { t } = useI18n();
  const tariffToken = new URLSearchParams(location.search).get('token')?.trim() || '';
  const isTariffTokenRoute = location.pathname === '/tariff' && Boolean(tariffToken);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      auth.logout();
      toast.error(t('sessionExpired'));
    });
    setRefreshHandler(auth.refresh);
  }, [auth, t, toast]);

  if (auth.isBootstrapping && !isTariffTokenRoute) {
    return (
      <div className="loading-overlay">
        <div className="spinner-ring" />
      </div>
    );
  }

  const loginNext = (() => {
    const value = new URLSearchParams(location.search).get('next');
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
  })();

  if (isTariffTokenRoute) {
    return (
      <Routes>
        <Route path="tariff" element={<TariffPage />} />
        <Route path="login" element={auth.isLoggedIn ? <Navigate to={loginNext} replace /> : <LoginPage />} />
        <Route path="*" element={<Navigate to={auth.isLoggedIn ? '/dashboard' : '/login'} replace />} />
      </Routes>
    );
  }

  if (!auth.isLoggedIn) {
    return (
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="login" element={<Navigate to={loginNext} replace />} />
      <Route element={<AppShell key={auth.selectedShop?.shop_id || 'no-shop'} />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="tariff" element={<TariffPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="nkt" element={<NktPage />} />
        <Route path="esf" element={<EsfPage />} />
        <Route path="snt" element={<SntPage />} />
        <Route path="sono" element={<SonoPage />} />
        <Route path="kaspi" element={<KaspiPage />} />
        <Route path="wb" element={<WbPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <ModalProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </ModalProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
