// Module Configuration - can be customized per client
export const moduleConfig = {
  procurement: {
    enabled: true,
    name: 'Procurement',
    description: 'Manage incoming prawn lots and vendor payments',
    roles: ['admin', 'owner', 'procurement_manager']
  },
  preprocessing: {
    enabled: true,
    name: 'Pre-Processing',
    description: 'Track processing batches and worker productivity',
    roles: ['admin', 'owner', 'production_supervisor']
  },
  production: {
    enabled: true,
    name: 'Production',
    description: 'Manage production orders and finished goods',
    roles: ['admin', 'owner', 'production_supervisor']
  },
  qc: {
    enabled: true,
    name: 'Quality Control',
    description: 'QC inspections and quality parameter tracking',
    roles: ['admin', 'owner', 'qc_officer']
  },
  coldStorage: {
    enabled: true,
    name: 'Cold Storage',
    description: 'Manage cold storage chambers and inventory',
    roles: ['admin', 'owner', 'cold_storage_incharge']
  },
  sales: {
    enabled: true,
    name: 'Sales & Dispatch',
    description: 'Buyer management, orders, and shipments',
    roles: ['admin', 'owner', 'sales_manager']
  },
  accounts: {
    enabled: true,
    name: 'Accounts & Billing',
    description: 'Wage bills and payment management',
    roles: ['admin', 'owner', 'accounts_manager']
  },
  agents: {
    enabled: true,
    name: 'Agents',
    description: 'Vendor and agent management',
    roles: ['admin', 'owner', 'procurement_manager']
  },
  finishedGoods: {
    enabled: true,
    name: 'Finished Goods',
    description: 'Finished goods inventory tracking',
    roles: ['admin', 'owner', 'qc_officer', 'sales_manager', 'cold_storage_incharge']
  },
  notifications: {
    enabled: true,
    name: 'Notifications',
    description: 'System notifications and alerts',
    roles: '*'
  }
};

// Helper to check if a module is enabled and accessible by user role
export const isModuleAccessible = (moduleKey, userRole) => {
  const module = moduleConfig[moduleKey];
  if (!module || !module.enabled) return false;
  if (module.roles === '*') return true;
  return module.roles.includes(userRole);
};

// Get all accessible modules for a user
export const getAccessibleModules = (userRole) => {
  return Object.entries(moduleConfig)
    .filter(([key, module]) => isModuleAccessible(key, userRole))
    .map(([key, module]) => ({ key, ...module }));
};
