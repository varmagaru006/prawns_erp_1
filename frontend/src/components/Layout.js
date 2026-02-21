import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
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
  X
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: '*' },
    { name: 'Procurement', path: '/procurement', icon: ShoppingCart, roles: ['admin', 'owner', 'procurement_manager'] },
    { name: 'Agents', path: '/agents', icon: Users, roles: ['admin', 'owner', 'procurement_manager'] },
    { name: 'Pre-Processing', path: '/preprocessing', icon: Package, roles: ['admin', 'owner', 'production_supervisor'] },
    { name: 'Production', path: '/production', icon: Factory, roles: ['admin', 'owner', 'production_supervisor'] },
    { name: 'Finished Goods', path: '/finished-goods', icon: Box, roles: ['admin', 'owner', 'qc_officer', 'sales_manager'] },
    { name: 'Notifications', path: '/notifications', icon: Bell, roles: '*' },
  ];

  const visibleNav = navigation.filter(item => 
    item.roles === '*' || item.roles.includes(user?.role)
  );

  return (
    <div className="min-h-screen bg-slate-50">
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
            <h1 className="text-xl font-semibold text-slate-800">Prawn ERP</h1>
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
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm
                    transition-colors duration-150
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-100'
                    }
                  `}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon size={20} />
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
