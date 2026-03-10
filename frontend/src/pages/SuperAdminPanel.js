import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { 
  Shield, 
  Building2, 
  Users, 
  Settings, 
  Plus, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Eye,
  UserPlus,
  BarChart3
} from 'lucide-react';

const SuperAdminPanel = () => {
  const [tenants, setTenants] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  
  // Wizard form data
  const [wizardData, setWizardData] = useState({
    // Step 1: Company Info
    name: '',
    slug: '',
    plan: 'starter',
    gst_number: '',
    // Step 2: Owner Info
    owner_name: '',
    owner_email: '',
    owner_password: '',
    // Step 3: Feature Flags
    feature_flags: {
      procurement: true,
      preprocessing: true,
      coldStorage: true,
      production: true,
      qualityControl: true,
      sales: true,
      accounts: true,
      wastageDashboard: false,
      yieldBenchmarks: false,
      marketRates: false,
      purchaseInvoiceDashboard: true,
      partyLedger: true,
      admin: true
    }
  });

  const featureList = [
    { code: 'procurement', name: 'Procurement', description: 'Manage prawn procurement' },
    { code: 'preprocessing', name: 'Pre-Processing', description: 'Processing operations' },
    { code: 'coldStorage', name: 'Cold Storage', description: 'Cold storage management' },
    { code: 'production', name: 'Production', description: 'Production tracking' },
    { code: 'qualityControl', name: 'Quality Control', description: 'Quality checks' },
    { code: 'sales', name: 'Sales & Dispatch', description: 'Sales and dispatch' },
    { code: 'accounts', name: 'Accounts & Billing', description: 'Financial management' },
    { code: 'wastageDashboard', name: 'Wastage Dashboard', description: 'Track wastage' },
    { code: 'yieldBenchmarks', name: 'Yield Benchmarks', description: 'Yield tracking' },
    { code: 'marketRates', name: 'Market Rates', description: 'Market price tracking' },
    { code: 'purchaseInvoiceDashboard', name: 'Purchase Invoice', description: 'Invoice management' },
    { code: 'partyLedger', name: 'Party Ledger', description: 'Party master and ledger' },
    { code: 'admin', name: 'Admin Panel', description: 'Administrative functions' }
  ];

  const loadTenants = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/super-admin/tenants`);
      setTenants(response.data);
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') toast.error('Failed to load tenants');
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/super-admin/metrics`);
      setMetrics(response.data);
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') console.error('Failed to load metrics:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadTenants(), loadMetrics()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadTenants, loadMetrics]);

  const handleCreateTenant = async () => {
    try {
      const response = await axios.post(`${API}/super-admin/tenants`, wizardData);
      toast.success(`Tenant "${wizardData.name}" created successfully!`);
      setShowWizard(false);
      setWizardStep(1);
      setWizardData({
        name: '',
        slug: '',
        plan: 'starter',
        gst_number: '',
        owner_name: '',
        owner_email: '',
        owner_password: '',
        feature_flags: {
          procurement: true,
          preprocessing: true,
          coldStorage: true,
          production: true,
          qualityControl: true,
          sales: true,
          accounts: true,
          wastageDashboard: false,
          yieldBenchmarks: false,
          marketRates: false,
          purchaseInvoiceDashboard: true,
          partyLedger: true,
          admin: true
        }
      });
      loadTenants();
      loadMetrics();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create tenant');
    }
  };

  const handleUpdateFeatures = async () => {
    if (!selectedTenant) return;
    
    try {
      await axios.put(`${API}/super-admin/tenants/${selectedTenant.id}/features`, {
        feature_flags: selectedTenant.feature_flags
      });
      toast.success('Feature flags updated successfully');
      setShowFeatureModal(false);
      loadTenants();
    } catch (error) {
      toast.error('Failed to update features');
    }
  };

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="super-admin-loading">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="super-admin-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Shield className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Panel</h1>
            <p className="text-gray-500">Manage tenants, features, and platform settings</p>
          </div>
        </div>
        <Button onClick={() => setShowWizard(true)} className="bg-purple-600 hover:bg-purple-700" data-testid="new-client-btn">
          <Plus className="h-4 w-4 mr-2" />
          New Client
        </Button>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.total_tenants}</p>
                  <p className="text-sm text-gray-500">Total Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.active_tenants}</p>
                  <p className="text-sm text-gray-500">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.total_users}</p>
                  <p className="text-sm text-gray-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Object.keys(metrics.users_by_plan || {}).length}</p>
                  <p className="text-sm text-gray-500">Plans Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tenants List */}
      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>Manage your client organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tenants.map((tenant) => (
              <div 
                key={tenant.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${tenant.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Building2 className={`h-5 w-5 ${tenant.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                    <p className="text-sm text-gray-500">
                      {tenant.slug} • {tenant.plan} plan • {tenant.user_count || 0} users
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setShowFeatureModal(true);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Modules
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            ))}
            
            {tenants.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No clients yet. Click "New Client" to create your first one.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4-Step Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            {/* Wizard Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">New Client Wizard</h2>
                <button 
                  onClick={() => {
                    setShowWizard(false);
                    setWizardStep(1);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>
              
              {/* Step Indicator */}
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      wizardStep >= step 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {wizardStep > step ? <Check className="h-4 w-4" /> : step}
                    </div>
                    {step < 4 && (
                      <div className={`w-16 h-1 mx-2 ${
                        wizardStep > step ? 'bg-purple-600' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Company</span>
                <span>Owner</span>
                <span>Modules</span>
                <span>Review</span>
              </div>
            </div>

            {/* Wizard Content */}
            <div className="p-6">
              {/* Step 1: Company Info */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Company Information</h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">Company Name *</label>
                    <Input
                      value={wizardData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setWizardData({
                          ...wizardData,
                          name,
                          slug: generateSlug(name)
                        });
                      }}
                      placeholder="e.g., Coastal Seafoods Pvt Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tenant Slug/ID *</label>
                    <Input
                      value={wizardData.slug}
                      onChange={(e) => setWizardData({...wizardData, slug: e.target.value})}
                      placeholder="e.g., coastal_seafoods"
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique identifier (auto-generated from name)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Plan</label>
                    <select
                      value={wizardData.plan}
                      onChange={(e) => setWizardData({...wizardData, plan: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="starter">Starter</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">GST Number</label>
                    <Input
                      value={wizardData.gst_number}
                      onChange={(e) => setWizardData({...wizardData, gst_number: e.target.value})}
                      placeholder="e.g., 22AAAAA0000A1Z5"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Owner Info */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Owner / Admin User</h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">Owner Name *</label>
                    <Input
                      value={wizardData.owner_name}
                      onChange={(e) => setWizardData({...wizardData, owner_name: e.target.value})}
                      placeholder="e.g., John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Owner Email *</label>
                    <Input
                      type="email"
                      value={wizardData.owner_email}
                      onChange={(e) => setWizardData({...wizardData, owner_email: e.target.value})}
                      placeholder="e.g., john@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password *</label>
                    <Input
                      type="password"
                      value={wizardData.owner_password}
                      onChange={(e) => setWizardData({...wizardData, owner_password: e.target.value})}
                      placeholder="Enter a strong password"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Feature Flags */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Enable Modules</h3>
                  <p className="text-sm text-gray-500 mb-4">Select which modules this client can access</p>
                  <div className="grid grid-cols-2 gap-3">
                    {featureList.map((feature) => (
                      <div
                        key={feature.code}
                        onClick={() => setWizardData({
                          ...wizardData,
                          feature_flags: {
                            ...wizardData.feature_flags,
                            [feature.code]: !wizardData.feature_flags[feature.code]
                          }
                        })}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          wizardData.feature_flags[feature.code]
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{feature.name}</span>
                          {wizardData.feature_flags[feature.code] ? (
                            <ToggleRight className="h-5 w-5 text-purple-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{feature.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Review & Launch</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-500 mb-2">Company</h4>
                      <p className="font-semibold">{wizardData.name}</p>
                      <p className="text-sm text-gray-600">{wizardData.slug} • {wizardData.plan} plan</p>
                      {wizardData.gst_number && <p className="text-sm text-gray-600">GST: {wizardData.gst_number}</p>}
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-500 mb-2">Admin User</h4>
                      <p className="font-semibold">{wizardData.owner_name}</p>
                      <p className="text-sm text-gray-600">{wizardData.owner_email}</p>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-500 mb-2">
                        Enabled Modules ({Object.values(wizardData.feature_flags).filter(Boolean).length})
                      </h4>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {featureList
                          .filter(f => wizardData.feature_flags[f.code])
                          .map(f => (
                            <span key={f.code} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                              {f.name}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer */}
            <div className="p-6 border-t flex justify-between">
              <Button
                variant="outline"
                onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
                disabled={wizardStep === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              
              {wizardStep < 4 ? (
                <Button
                  onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={
                    (wizardStep === 1 && (!wizardData.name || !wizardData.slug)) ||
                    (wizardStep === 2 && (!wizardData.owner_name || !wizardData.owner_email || !wizardData.owner_password))
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleCreateTenant} className="bg-purple-600 hover:bg-purple-700">
                  <Check className="h-4 w-4 mr-1" />
                  Launch Client
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feature Modal */}
      {showFeatureModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Manage Modules</h2>
                <button 
                  onClick={() => setShowFeatureModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>
              <p className="text-gray-500 mt-1">{selectedTenant.name}</p>
            </div>
            
            <div className="p-6 space-y-3">
              {featureList.map((feature) => (
                <div
                  key={feature.code}
                  onClick={() => setSelectedTenant({
                    ...selectedTenant,
                    feature_flags: {
                      ...selectedTenant.feature_flags,
                      [feature.code]: !selectedTenant.feature_flags?.[feature.code]
                    }
                  })}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTenant.feature_flags?.[feature.code]
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{feature.name}</span>
                      <p className="text-xs text-gray-500">{feature.description}</p>
                    </div>
                    {selectedTenant.feature_flags?.[feature.code] ? (
                      <ToggleRight className="h-6 w-6 text-purple-600" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFeatureModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateFeatures} className="bg-purple-600 hover:bg-purple-700">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPanel;
