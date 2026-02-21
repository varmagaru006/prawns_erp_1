// Updated Module Configuration with Lifecycle Hierarchy
export const moduleConfig = {
  // Core Lifecycle Modules (Grouped in hierarchy)
  lifecycle: {
    enabled: true,
    name: 'Product Lifecycle',
    description: 'Complete prawn processing lifecycle',
    modules: {
      procurement: {
        enabled: true,
        name: 'Procurement',
        path: '/lifecycle/procurement',
        roles: ['admin', 'owner', 'procurement_manager']
      },
      preprocessing: {
        enabled: true,
        name: 'Pre-Processing',
        path: '/lifecycle/preprocessing',
        roles: ['admin', 'owner', 'production_supervisor']
      },
      production: {
        enabled: true,
        name: 'Production',
        path: '/lifecycle/production',
        roles: ['admin', 'owner', 'production_supervisor']
      },
      qc: {
        enabled: true,
        name: 'Quality Control',
        path: '/lifecycle/qc',
        roles: ['admin', 'owner', 'qc_officer']
      },
      coldStorage: {
        enabled: true,
        name: 'Cold Storage',
        path: '/lifecycle/cold-storage',
        roles: ['admin', 'owner', 'cold_storage_incharge']
      },
      dispatch: {
        enabled: true,
        name: 'Dispatch',
        path: '/lifecycle/dispatch',
        roles: ['admin', 'owner', 'sales_manager']
      }
    }
  },
  
  // Supporting Modules (Separate)
  agents: {
    enabled: true,
    name: 'Agents & Vendors',
    description: 'Vendor management',
    roles: ['admin', 'owner', 'procurement_manager']
  },
  sales: {
    enabled: true,
    name: 'Sales & Orders',
    description: 'Buyer management and orders',
    roles: ['admin', 'owner', 'sales_manager']
  },
  accounts: {
    enabled: true,
    name: 'Accounts & Billing',
    description: 'Wage bills and payments',
    roles: ['admin', 'owner', 'accounts_manager']
  },
  admin: {
    enabled: true,
    name: 'Admin Panel',
    description: 'Approvals, photos, and system management',
    roles: ['admin', 'owner']
  },
  notifications: {
    enabled: true,
    name: 'Notifications',
    description: 'System notifications',
    roles: '*'
  }
};

// Dashboard access control
export const dashboardAccessRoles = [
  'admin',
  'owner',
  'procurement_manager',
  'production_supervisor',
  'cold_storage_incharge',
  'qc_officer',
  'sales_manager'
];

export const canAccessDashboard = (userRole) => {
  return dashboardAccessRoles.includes(userRole);
};

export const isModuleAccessible = (moduleKey, userRole) => {
  const module = moduleConfig[moduleKey];
  if (!module || !module.enabled) return false;
  if (module.roles === '*') return true;
  return module.roles.includes(userRole);
};

export const isLifecycleModuleAccessible = (lifecycleModuleKey, userRole) => {
  const lifecycleModule = moduleConfig.lifecycle.modules[lifecycleModuleKey];
  if (!lifecycleModule || !lifecycleModule.enabled) return false;
  return lifecycleModule.roles.includes(userRole);
};
