import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import PreProcessing from './pages/PreProcessing';
import Production from './pages/Production';
import FinishedGoods from './pages/FinishedGoods';
import Agents from './pages/Agents';
import Notifications from './pages/Notifications';
import QualityControl from './pages/QualityControl';
import ColdStorage from './pages/ColdStorage';
import Sales from './pages/Sales';
import Accounts from './pages/Accounts';
import AdminPanel from './pages/AdminPanel';
import YieldBenchmarks from './pages/YieldBenchmarks';
import WastageDashboard from './pages/WastageDashboard';
import MarketRates from './pages/MarketRates';
import LotWaterfall from './pages/LotWaterfall';
import AttachmentsDemo from './pages/AttachmentsDemo';
import CreateWageBill from './pages/CreateWageBill';
import WageBillDetail from './pages/WageBillDetail';
import AuditTrail from './pages/AuditTrail';
import PurchaseInvoices from './pages/PurchaseInvoices';
import PurchaseInvoiceForm from './pages/PurchaseInvoiceForm';
import CompanySettings from './pages/CompanySettings';
import Parties from './pages/Parties';
import PartyLedger from './pages/PartyLedger';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import { BrandingProvider } from './context/BrandingContext';
import { Toaster } from './components/ui/sonner';
import { canAccessDashboard } from './config/moduleConfig';
import './App.css';

// Lazy load SuperAdminPanel for code splitting
const SuperAdminPanel = lazy(() => import('./pages/SuperAdminPanel'));

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

const DashboardRoute = () => {
  const { user } = useAuth();
  
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
      <Route path="/login" element={<Login />} />
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
        <Route path="parties" element={<Parties />} />
        <Route path="party-ledger" element={<PartyLedger />} />
        <Route path="party-ledger/:partyId" element={<PartyLedger />} />
        <Route path="admin/company-settings" element={<CompanySettings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route 
          path="super-admin" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <SuperAdminPanel />
            </Suspense>
          } 
        />
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
