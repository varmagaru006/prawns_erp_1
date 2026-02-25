import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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
  Building2
} from 'lucide-react';

const Layout = () => {
  const { user, logout, isImpersonating, endImpersonation } = useAuth();
  const { isEnabled } = useFeatureFlags();
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
    Building2
  };

  const navigation = [
    { name: 'Dashboard', path: '/', icon: 'LayoutDashboard', moduleKey: 'dashboard' },
    { name: 'Procurement', path: '/procurement', icon: 'ShoppingCart', moduleKey: 'procurement' },
    { name: 'Agents', path: '/agents', icon: 'Users', moduleKey: 'agents' },
    { name: 'Pre-Processing', path: '/preprocessing', icon: 'Package', moduleKey: 'preprocessing' },
    { name: 'Production', path: '/production', icon: 'Factory', moduleKey: 'production' },
    { name: 'Quality Control', path: '/qc', icon: 'ClipboardCheck', moduleKey: 'qc' },
    { name: 'Cold Storage', path: '/cold-storage', icon: 'Snowflake', moduleKey: 'coldStorage' },
    { name: 'Finished Goods', path: '/finished-goods', icon: 'Box', moduleKey: 'finishedGoods' },
    { name: 'Sales & Dispatch', path: '/sales', icon: 'Ship', moduleKey: 'sales' },
    { name: 'Accounts', path: '/accounts', icon: 'Receipt', moduleKey: 'accounts' },
    { name: 'Purchase Invoices', path: '/purchase-invoices', icon: 'FileText', moduleKey: 'procurement' },
    { name: 'Party Master', path: '/parties', icon: 'Users', moduleKey: 'procurement' },
    { name: 'Party Ledger', path: '/party-ledger', icon: 'BookOpen', moduleKey: 'partyLedger' },
    { name: 'Wastage Dashboard', path: '/admin/wastage-dashboard', icon: 'TrendingDown', moduleKey: 'wastageDashboard' },
    { name: 'Yield Benchmarks', path: '/admin/yield-benchmarks', icon: 'Target', moduleKey: 'yieldBenchmarks' },
    { name: 'Market Rates', path: '/admin/market-rates', icon: 'DollarSign', moduleKey: 'marketRates' },
    { name: 'Attachments Demo', path: '/admin/attachments-demo', icon: 'Paperclip', moduleKey: 'admin' },
    { name: 'Audit Trail', path: '/admin/audit-trail', icon: 'History', moduleKey: 'admin' },
    { name: 'Company Settings', path: '/admin/company-settings', icon: 'Building2', moduleKey: 'admin' },
    { name: 'Admin Panel', path: '/admin', icon: 'Settings', moduleKey: 'admin' },
    { name: 'Notifications', path: '/notifications', icon: 'Bell', moduleKey: 'notifications' },
  ];

  // Filter navigation based on module configuration and user role
  const visibleNav = navigation.filter(item => {
    // Dashboard needs special handling based on canAccessDashboard
    if (item.moduleKey === 'dashboard') {
      return canAccessDashboard(user?.role);
    }
    if (!item.moduleKey) return true;
    return isModuleAccessible(item.moduleKey, user?.role);
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
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
