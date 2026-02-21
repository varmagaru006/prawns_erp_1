// Module Configuration - Flat structure for easy access
export const moduleConfig = {
  procurement: {
    enabled: true,
    name: 'Procurement',
    description: 'Incoming prawn lots management',
    roles: ['admin', 'owner', 'procurement_manager']
  },
  preprocessing: {
    enabled: true,
    name: 'Pre-Processing',
    description: 'Batch processing and yield tracking',
    roles: ['admin', 'owner', 'production_supervisor']
  },
  production: {
    enabled: true,
    name: 'Production',
    description: 'Production orders and conversion',
    roles: ['admin', 'owner', 'production_supervisor']
  },
  qc: {
    enabled: true,
    name: 'Quality Control',
    description: 'QC inspections and quality assurance',
    roles: ['admin', 'owner', 'qc_officer']
  },
  coldStorage: {
    enabled: true,
    name: 'Cold Storage',
    description: 'Inventory and temperature monitoring',
    roles: ['admin', 'owner', 'cold_storage_incharge']
  },
  finishedGoods: {
    enabled: true,
    name: 'Finished Goods',
    description: 'Ready inventory for dispatch',
    roles: ['admin', 'owner', 'production_supervisor']
  },
  agents: {
    enabled: true,
    name: 'Agents & Vendors',
    description: 'Vendor management',
    roles: ['admin', 'owner', 'procurement_manager']
  },
  sales: {
    enabled: true,
    name: 'Sales & Dispatch',
    description: 'Buyer management and orders',
    roles: ['admin', 'owner', 'sales_manager']
  },
  accounts: {
    enabled: true,
    name: 'Accounts',
    description: 'Wage bills and payments',
    roles: ['admin', 'owner', 'accounts_manager']
  },
  admin: {
    enabled: true,
    name: 'Admin Panel',
    description: 'Approvals, photos, and system management',
    roles: ['admin', 'owner']
  },
  wastageDashboard: {
    enabled: true,
    name: 'Wastage Dashboard',
    description: 'Yield tracking and revenue loss monitoring',
    roles: ['admin', 'owner', 'production_supervisor']
  },
  yieldBenchmarks: {
    enabled: true,
    name: 'Yield Benchmarks',
    description: 'Configure wastage thresholds',
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
