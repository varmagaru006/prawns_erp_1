import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
// Lazy-load Login so initial bundle is smaller and login page loads faster
const Login = lazy(() => import('./pages/Login'));
// Lazy-load pages so initial load after login is faster
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Procurement = lazy(() => import('./pages/Procurement'));
const PreProcessing = lazy(() => import('./pages/PreProcessing'));
const Production = lazy(() => import('./pages/Production'));
const FinishedGoods = lazy(() => import('./pages/FinishedGoods'));
const Agents = lazy(() => import('./pages/Agents'));
const Notifications = lazy(() => import('./pages/Notifications'));
const QualityControl = lazy(() => import('./pages/QualityControl'));
const ColdStorage = lazy(() => import('./pages/ColdStorage'));
const Sales = lazy(() => import('./pages/Sales'));
const Accounts = lazy(() => import('./pages/Accounts'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const YieldBenchmarks = lazy(() => import('./pages/YieldBenchmarks'));
const WastageDashboard = lazy(() => import('./pages/WastageDashboard'));
const MarketRates = lazy(() => import('./pages/MarketRates'));
const LotWaterfall = lazy(() => import('./pages/LotWaterfall'));
const AttachmentsDemo = lazy(() => import('./pages/AttachmentsDemo'));
const CreateWageBill = lazy(() => import('./pages/CreateWageBill'));
const WageBillDetail = lazy(() => import('./pages/WageBillDetail'));
const AuditTrail = lazy(() => import('./pages/AuditTrail'));
const PurchaseInvoices = lazy(() => import('./pages/PurchaseInvoices'));
const PurchaseInvoiceForm = lazy(() => import('./pages/PurchaseInvoiceForm'));
const PurchaseRiskAlerts = lazy(() => import('./pages/PurchaseRiskAlerts'));
const CompanySettings = lazy(() => import('./pages/CompanySettings'));
const Parties = lazy(() => import('./pages/Parties'));
const PartyLedger = lazy(() => import('./pages/PartyLedger'));
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import { BrandingProvider } from './context/BrandingContext';
import { Toaster } from './components/ui/sonner';
import { canAccessDashboard } from './config/moduleConfig';
import './App.css';

const SuperAdminRedirect = lazy(() => import('./pages/SuperAdminRedirect'));

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
  </div>
);

// Minimal fallback for login route so login page appears fast
const LoginFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-blue-600" />
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingFallback />;
  }
  return user ? children : <Navigate to="/login" replace />;
};

const DashboardRoute = () => {
  const { user } = useAuth();
  
  // Redirect super_admin to the "use standalone portal" page (Option 2: no in-app panel)
  if (user?.role === 'super_admin') {
    return <Navigate to="/platform-admin" replace />;
  }
  
  // Check if user has dashboard access
  if (user && canAccessDashboard(user.role)) {
    return <Dashboard />;
  }
  
  // Redirect workers to their first accessible page
  return <Navigate to="/procurement" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<LoginFallback />}><Login /></Suspense>} />
      {/* Redirect to standalone Super Admin portal (Option 2: no in-app panel) */}
      <Route path="/super-admin" element={<Navigate to="/super-admin/login" replace />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardRoute />} />
        <Route path="procurement" element={<Procurement />} />
        <Route path="agents" element={<Agents />} />
        <Route path="preprocessing" element={<PreProcessing />} />
        <Route path="production" element={<Production />} />
        <Route path="finished-goods" element={<FinishedGoods />} />
        <Route path="qc" element={<QualityControl />} />
        <Route path="cold-storage" element={<ColdStorage />} />
        <Route path="sales" element={<Sales />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="accounts/create" element={<CreateWageBill />} />
        <Route path="accounts/:billId" element={<WageBillDetail />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="admin/yield-benchmarks" element={<YieldBenchmarks />} />
        <Route path="admin/market-rates" element={<MarketRates />} />
        <Route path="admin/wastage-dashboard" element={<WastageDashboard />} />
        <Route path="admin/lot/:lotId/wastage" element={<LotWaterfall />} />
        <Route path="admin/attachments-demo" element={<AttachmentsDemo />} />
        <Route path="admin/audit-trail" element={<AuditTrail />} />
        <Route path="purchase-invoices" element={<PurchaseInvoices />} />
        <Route path="purchase-invoices/create" element={<PurchaseInvoiceForm />} />
        <Route path="purchase-invoices/edit/:id" element={<PurchaseInvoiceForm />} />
        <Route path="purchase-risk-alerts" element={<PurchaseRiskAlerts />} />
        <Route path="risk-area-insights" element={<Navigate to="/purchase-risk-alerts?tab=insights" replace />} />
        <Route path="parties" element={<Parties />} />
        <Route path="party-ledger" element={<PartyLedger />} />
        <Route path="party-ledger/:partyId" element={<PartyLedger />} />
        <Route path="admin/company-settings" element={<CompanySettings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="platform-admin" element={<SuperAdminRedirect />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <BrandingProvider>
        <AuthProvider>
          <FeatureFlagProvider>
            <AppRoutes />
            <Toaster position="top-right" />
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
          </FeatureFlagProvider>
        </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  );
}

export default App;
