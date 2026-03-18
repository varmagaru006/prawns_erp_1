import React, { useState, Suspense } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { useBranding } from '../context/BrandingContext';
import { moduleConfig, isModuleAccessible, canAccessDashboard } from '../config/moduleConfig';
import { Button } from './ui/button';
import AnnouncementBanner from './AnnouncementBanner';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  Factory, 
  Box, 
  Bell,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  Snowflake,
  Ship,
  Receipt,
  Settings,
  TrendingDown,
  Target,
  Paperclip,
  History,
  DollarSign,
  FileText,
  Building2,
  BookOpen,
  Shield
} from 'lucide-react';

const Layout = () => {
  const { user, logout, isImpersonating, endImpersonation } = useAuth();
  const { isEnabled, refreshFeatures, loading: featuresLoading, features } = useFeatureFlags();
  const { branding } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEndImpersonation = () => {
    endImpersonation();
    navigate('/login');
  };

  const iconMap = {
    LayoutDashboard,
    ShoppingCart,
    Users,
    Package,
    Factory,
    Box,
    ClipboardCheck,
    Snowflake,
    Ship,
    Receipt,
    Settings,
    Bell,
    TrendingDown,
    Target,
    Paperclip,
    DollarSign,
    History,
    FileText,
    Building2,
    BookOpen,
    Shield
  };

  // Each item has moduleKey (role check) and featureCode (super-admin feature flag)
  const navigation = [
    { name: 'Dashboard', path: '/', icon: 'LayoutDashboard', moduleKey: 'dashboard', featureCode: 'dashboard' },
    { name: 'Procurement', path: '/procurement', icon: 'ShoppingCart', moduleKey: 'procurement', featureCode: 'procurement' },
    { name: 'Agents', path: '/agents', icon: 'Users', moduleKey: 'agents', featureCode: 'agents' },
    { name: 'Pre-Processing', path: '/preprocessing', icon: 'Package', moduleKey: 'preprocessing', featureCode: 'preprocessing' },
    { name: 'Production', path: '/production', icon: 'Factory', moduleKey: 'production', featureCode: 'production' },
    { name: 'Quality Control', path: '/qc', icon: 'ClipboardCheck', moduleKey: 'qc', featureCode: 'qualityControl' },
    { name: 'Cold Storage', path: '/cold-storage', icon: 'Snowflake', moduleKey: 'coldStorage', featureCode: 'coldStorage' },
    { name: 'Finished Goods', path: '/finished-goods', icon: 'Box', moduleKey: 'finishedGoods', featureCode: 'finishedGoods' },
    { name: 'Sales & Dispatch', path: '/sales', icon: 'Ship', moduleKey: 'sales', featureCode: 'sales' },
    { name: 'Accounts', path: '/accounts', icon: 'Receipt', moduleKey: 'accounts', featureCode: 'accounts' },
    { name: 'Material Purchase', path: '/purchase-invoices', icon: 'FileText', moduleKey: 'procurement', featureCode: 'purchaseInvoiceDashboard' },
    { name: 'Party Master', path: '/parties', icon: 'Users', moduleKey: 'procurement', featureCode: 'parties' },
    { name: 'Party Ledger', path: '/party-ledger', icon: 'BookOpen', moduleKey: 'partyLedger', featureCode: 'partyLedger' },
    { name: 'Wastage Dashboard', path: '/admin/wastage-dashboard', icon: 'TrendingDown', moduleKey: 'wastageDashboard', featureCode: 'wastageDashboard' },
    { name: 'Yield Benchmarks', path: '/admin/yield-benchmarks', icon: 'Target', moduleKey: 'yieldBenchmarks', featureCode: 'yieldBenchmarks' },
    { name: 'Market Rates', path: '/admin/market-rates', icon: 'DollarSign', moduleKey: 'marketRates', featureCode: 'marketRates' },
    { name: 'Attachments Demo', path: '/admin/attachments-demo', icon: 'Paperclip', moduleKey: 'admin', featureCode: 'admin' },
    { name: 'Audit Trail', path: '/admin/audit-trail', icon: 'History', moduleKey: 'admin', featureCode: 'admin' },
    { name: 'Company Settings', path: '/admin/company-settings', icon: 'Building2', moduleKey: 'admin', featureCode: 'admin' },
    { name: 'Admin Panel', path: '/admin', icon: 'Settings', moduleKey: 'admin', featureCode: 'admin' },
    { name: 'Notifications', path: '/notifications', icon: 'Bell', moduleKey: 'notifications', featureCode: 'notifications' },
  ];

  // Path → feature code: redirect if user opens a URL for a disabled feature
  const pathToFeature = {
    '/': 'dashboard',
    '/procurement': 'procurement',
    '/agents': 'agents',
    '/preprocessing': 'preprocessing',
    '/production': 'production',
    '/qc': 'qualityControl',
    '/cold-storage': 'coldStorage',
    '/finished-goods': 'finishedGoods',
    '/sales': 'sales',
    '/accounts': 'accounts',
    '/purchase-invoices': 'purchaseInvoiceDashboard',
    '/parties': 'parties',
    '/party-ledger': 'partyLedger',
    '/admin/wastage-dashboard': 'wastageDashboard',
    '/admin/yield-benchmarks': 'yieldBenchmarks',
    '/admin/market-rates': 'marketRates',
    '/admin/attachments-demo': 'admin',
    '/admin/audit-trail': 'admin',
    '/admin/company-settings': 'admin',
    '/admin': 'admin',
    '/notifications': 'notifications',
  };
  const pathname = location.pathname;
  const normalized = pathname.replace(/\/$/, '') || '/';
  const matchedKey = pathToFeature[normalized] != null
    ? normalized
    : Object.keys(pathToFeature)
        .filter((k) => k !== '/' && pathname.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
  const featureForPath = matchedKey ? pathToFeature[matchedKey] : null;
  const hasFeatures = Object.keys(features).length > 0;
  // Don't block while flags are loading (avoid showing "not enabled" before /auth/me returns)
  // If flags never loaded (empty after load), allow access so user isn't locked out
  // Super admin always passes through so they can reach the /platform-admin redirect page
  const featureBlocked =
    !featuresLoading &&
    hasFeatures &&
    featureForPath &&
    !isEnabled(featureForPath) &&
    user?.role !== 'super_admin';

  // Filter navigation: role (moduleKey) + feature flag (featureCode) from super admin — only show tabs enabled in Super Admin
  const visibleNav = navigation.filter((item) => {
    if (item.moduleKey === 'dashboard') {
      if (!canAccessDashboard(user?.role)) return false;
      return item.featureCode ? isEnabled(item.featureCode) : true;
    }
    if (!item.moduleKey) return true;
    if (!isModuleAccessible(item.moduleKey, user?.role)) return false;
    if (item.featureCode && !isEnabled(item.featureCode)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-medium">
              You are impersonating this account
            </span>
            {user?.impersonator_name && (
              <span className="ml-2 text-purple-200">
                (as {user.impersonator_name})
              </span>
            )}
          </div>
          <button
            onClick={handleEndImpersonation}
            className="px-3 py-1 bg-white text-purple-600 rounded text-sm font-medium hover:bg-purple-100"
            data-testid="end-impersonation-btn"
          >
            End Impersonation
          </button>
        </div>
      )}
      
      {/* Announcement Banners */}
      <AnnouncementBanner token={user?.token} />
      
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
              data-testid="mobile-menu-toggle"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.sidebar_label} className="h-8" />
            ) : (
              <h1 className="text-xl font-semibold text-slate-800" style={{ color: branding.primary_color }}>
                {branding.sidebar_label || 'Prawn ERP'}
              </h1>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => refreshFeatures()}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
              title="Refresh feature flags (e.g. after Super Admin changes)"
            >
              Refresh features
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800" data-testid="user-name">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize" data-testid="user-role">{user?.role?.replace('_', ' ')}</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="gap-2"
              data-testid="logout-button"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            mt-[57px] lg:mt-0
          `}
          data-testid="sidebar"
        >
          <nav className="p-4 space-y-1">
            {visibleNav.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm
                    transition-all duration-200 group
                    ${isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                      : 'text-slate-600 hover:bg-slate-100'
                    }
                  `}
                  data-testid={`nav-${item.name.toLowerCase().replace(/ /g, '-')}`}
                >
                  <Icon size={20} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-blue-600" />
            </div>
          }>
            {featureBlocked ? (
              normalized === '/' && visibleNav[0]?.path ? (
                <Navigate to={visibleNav[0].path} replace />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[200px] text-slate-600">
                  <p className="font-medium">This feature is not enabled for your organization.</p>
                  <p className="text-sm mt-1">Contact your administrator to enable it.</p>
                  <Link to="/" className="mt-4 text-blue-600 hover:underline">Go to Dashboard</Link>
                </div>
              )
            ) : (
              <Outlet />
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Layout;
