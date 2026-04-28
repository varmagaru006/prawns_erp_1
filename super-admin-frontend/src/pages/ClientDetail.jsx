import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientAPI } from '../api/auth';
import LinkBrandingTab from '../components/LinkBrandingTab';
import UsersTab from '../components/UsersTab';
import { ArrowLeft, Building2, Package, ToggleLeft, ToggleRight, Check, AlertCircle, Zap, Link2, Users, Settings, Eye, EyeOff, ExternalLink, Loader2, Pencil, X } from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [showBootstrapPassword, setShowBootstrapPassword] = useState(false);
  const [bootstrapForm, setBootstrapForm] = useState({
    admin_email: '',
    admin_name: '',
    admin_password: 'admin123'
  });
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('features');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    loadClientData();
  }, [id]);

  const loadClientData = async () => {
    try {
      const [clientData, featuresData] = await Promise.all([
        clientAPI.getById(id),
        clientAPI.getFeatures(id)
      ]);
      setClient(clientData);
      setFeatures(featuresData);
    } catch (err) {
      showNotification('Failed to load client data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleToggleFeature = async (feature) => {
    const newState = !feature.is_enabled;
    setToggling(prev => ({ ...prev, [feature.feature_code]: true }));

    try {
      await clientAPI.toggleFeature(id, {
        tenant_id: client.tenant_id,
        feature_code: feature.feature_code,
        is_enabled: newState,
        is_override: false
      });

      setFeatures(prev => prev.map(f => 
        f.feature_code === feature.feature_code 
          ? { ...f, is_enabled: newState }
          : f
      ));

      showNotification(
        `Feature "${feature.feature_name}" ${newState ? 'enabled' : 'disabled'}`,
        'success'
      );
    } catch (err) {
      showNotification(`Failed to toggle feature: ${err.message}`, 'error');
    } finally {
      setToggling(prev => ({ ...prev, [feature.feature_code]: false }));
    }
  };

  const handleBulkToggle = async (featureCodes, isEnabled, label) => {
    if (featureCodes.length === 0) return;
    
    setBulkLoading(true);
    try {
      await clientAPI.bulkToggleFeatures(id, {
        feature_codes: featureCodes,
        is_enabled: isEnabled
      });

      setFeatures(prev => prev.map(f => 
        featureCodes.includes(f.feature_code)
          ? { ...f, is_enabled: isEnabled }
          : f
      ));

      showNotification(`${label} - ${featureCodes.length} features ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      showNotification(`Bulk update failed: ${err.message}`, 'error');
      loadClientData();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleModule = async (module) => {
    const moduleFeatures = features.filter(f => f.module === module);
    const allEnabled = moduleFeatures.every(f => f.is_enabled);
    const targetState = !allEnabled;
    const featuresToChange = moduleFeatures
      .filter(f => f.is_enabled !== targetState)
      .map(f => f.feature_code);
    
    if (featuresToChange.length === 0) return;
    await handleBulkToggle(featuresToChange, targetState, `${module} module`);
  };

  const handleOpenClientERP = async () => {
    setOpening(true);
    try {
      const result = await clientAPI.openSession(id);
      window.open(result.session_url, '_blank');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to open client ERP', 'error');
    } finally {
      setOpening(false);
    }
  };

  const openBootstrapModal = () => {
    setBootstrapForm({
      admin_email: client?.owner_email || '',
      admin_name: client?.owner_name || '',
      admin_password: 'admin123'
    });
    setShowBootstrapPassword(false);
    setShowBootstrapModal(true);
  };

  const handleBootstrapTenant = async (e) => {
    if (e) e.preventDefault();
    setBootstrapping(true);
    try {
      const res = await clientAPI.bootstrapTenant(id, {
        admin_email: bootstrapForm.admin_email,
        admin_name: bootstrapForm.admin_name,
        admin_password: bootstrapForm.admin_password,
      });
      showNotification(
        `Bootstrap done. DB: ${res.client_db_name}${res.admin_created ? `, admin: ${res.admin_email}` : ''}`,
        'success'
      );
      setShowBootstrapModal(false);
      await loadClientData();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Tenant bootstrap failed', 'error');
    } finally {
      setBootstrapping(false);
    }
  };

  const startEditName = () => {
    setNameValue(client.business_name);
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameValue('');
  };

  const saveBusinessName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === client.business_name) { cancelEditName(); return; }
    setSavingName(true);
    try {
      await clientAPI.updateClient(id, { business_name: trimmed });
      setClient((prev) => ({ ...prev, business_name: trimmed }));
      showNotification('Business name updated');
      setEditingName(false);
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update name', 'error');
    } finally {
      setSavingName(false);
    }
  };

  // Group features by module
  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.module]) {
      acc[feature.module] = [];
    }
    acc[feature.module].push(feature);
    return acc;
  }, {});

  // Quick setup presets
  const quickSetups = [
    {
      label: 'Enable All Features',
      action: () => {
        const disabledFeatures = features.filter(f => !f.is_enabled).map(f => f.feature_code);
        if (disabledFeatures.length > 0) {
          handleBulkToggle(disabledFeatures, true, 'All features');
        }
      },
      color: 'green'
    },
    {
      label: 'Basic Features Only',
      action: () => {
        const basicModules = ['procurement', 'preprocessing', 'production', 'qc'];
        const featuresToEnable = features.filter(f => basicModules.includes(f.module) && !f.is_enabled).map(f => f.feature_code);
        const featuresToDisable = features.filter(f => !basicModules.includes(f.module) && f.is_enabled).map(f => f.feature_code);
        
        if (featuresToDisable.length > 0) {
          handleBulkToggle(featuresToDisable, false, 'Non-basic features').then(() => {
            if (featuresToEnable.length > 0) {
              handleBulkToggle(featuresToEnable, true, 'Basic features');
            }
          });
        } else if (featuresToEnable.length > 0) {
          handleBulkToggle(featuresToEnable, true, 'Basic features');
        }
      },
      color: 'blue'
    },
    {
      label: 'Production Setup',
      action: () => {
        const productionModules = ['procurement', 'preprocessing', 'production', 'cold_storage'];
        const featuresToEnable = features.filter(f => productionModules.includes(f.module) && !f.is_enabled).map(f => f.feature_code);
        if (featuresToEnable.length > 0) {
          handleBulkToggle(featuresToEnable, true, 'Production setup');
        }
      },
      color: 'purple'
    },
    {
      label: 'Disable All',
      action: () => {
        const enabledFeatures = features.filter(f => f.is_enabled).map(f => f.feature_code);
        if (enabledFeatures.length > 0) {
          handleBulkToggle(enabledFeatures, false, 'All features');
        }
      },
      color: 'red'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Client not found</h3>
        <Link to="/dashboard" className="mt-4 text-primary-600 hover:text-primary-700">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const enabledCount = features.filter(f => f.is_enabled).length;
  const totalCount = features.length;
  const isLinked = client?.link_status === 'linked';

  const tabs = [
    { id: 'features', label: 'Features', icon: Settings },
    { id: 'link-branding', label: 'Link & Branding', icon: Link2, badge: isLinked ? '🟢' : '⚪' },
    { id: 'users', label: 'Users', icon: Users },
  ];

  return (
    <div>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center ${
          notification.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          <Check className="h-5 w-5 mr-2" />
          {notification.message}
        </div>
      )}

      {/* Back Button */}
      <Link
        to="/dashboard"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Clients
      </Link>

      {/* Client Info Card */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg shadow-lg p-6 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="bg-white/20 p-3 rounded-lg">
              <Building2 className="h-8 w-8" />
            </div>
            <div className="ml-4">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveBusinessName(); if (e.key === 'Escape') cancelEditName(); }}
                    className="text-2xl font-bold bg-white/20 text-white placeholder-white/60 border border-white/40 rounded-lg px-3 py-1 focus:outline-none focus:border-white w-80"
                  />
                  <button onClick={saveBusinessName} disabled={savingName} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-50">
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={cancelEditName} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-3xl font-bold">{client.business_name}</h1>
                  <button onClick={startEditName} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-white/20 hover:bg-white/30 transition-opacity">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="mt-3 flex items-center space-x-4 flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  {client.tenant_id}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  client.subscription_status === 'active' 
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                }`}>
                  {client.subscription_status}
                </span>
                <span className="flex items-center text-sm">
                  <Package className="h-4 w-4 mr-1" />
                  {client.plan_name}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isLinked ? 'bg-green-400' : 'bg-gray-400'
                }`}>
                  {isLinked ? '🔗 Linked' : 'Not Linked'}
                </span>
              </div>
            </div>
          </div>
          <div className="ml-4 flex items-center gap-3">
            <button
              onClick={handleOpenClientERP}
              disabled={opening}
              className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-400 disabled:opacity-60 flex items-center gap-2"
            >
              {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {opening ? 'Opening...' : 'Open Client ERP'}
            </button>
            <button
              onClick={openBootstrapModal}
              disabled={bootstrapping}
              className="px-4 py-2 rounded-lg bg-white text-primary-700 font-medium hover:bg-primary-50 disabled:opacity-60"
            >
              {bootstrapping ? 'Bootstrapping...' : 'Re-bootstrap / Reset DB'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-white/70 text-sm">Features Enabled</p>
            <p className="mt-1 text-2xl font-bold">{enabledCount} / {totalCount}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-white/70 text-sm">Contact</p>
            <p className="mt-1 text-sm font-medium truncate">{client.contact_email || 'Not set'}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-white/70 text-sm">Last Bootstrap</p>
            <p className="mt-1 text-sm font-medium">
              {client.bootstrapped_at
                ? new Date(client.bootstrapped_at).toLocaleString()
                : 'Auto-done on creation'}
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-white/70 text-sm">Last Ping</p>
            <p className="mt-1 text-sm font-medium">
              {client.last_ping_at ? new Date(client.last_ping_at).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
                {tab.badge && <span className="ml-2">{tab.badge}</span>}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'features' && (
        <div>
          {/* Quick Setup */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Zap className="h-6 w-6 mr-2 text-yellow-500" />
                  Quick Setup
                </h2>
                <p className="text-sm text-gray-600 mt-1">Apply feature presets instantly</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {quickSetups.map((setup, index) => (
                <button
                  key={index}
                  onClick={setup.action}
                  disabled={bulkLoading}
                  className={`px-4 py-3 rounded-lg font-medium transition disabled:opacity-50 ${
                    setup.color === 'green' ? 'bg-green-500 hover:bg-green-600 text-white' :
                    setup.color === 'blue' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                    setup.color === 'purple' ? 'bg-purple-500 hover:bg-purple-600 text-white' :
                    'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {bulkLoading ? 'Applying...' : setup.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feature Management */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Feature Management</h2>
          </div>

          {/* Feature Groups */}
          <div className="space-y-4">
            {Object.entries(groupedFeatures).map(([module, moduleFeatures]) => {
              const enabledInModule = moduleFeatures.filter(f => f.is_enabled).length;
              const allEnabled = moduleFeatures.every(f => f.is_enabled);
              
              return (
                <div key={module} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  {/* Module Header with Toggle */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">{module} Module</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {enabledInModule} / {moduleFeatures.length} enabled
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleModule(module)}
                      disabled={bulkLoading}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        allEnabled
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {bulkLoading ? 'Updating...' : allEnabled ? 'Disable All' : 'Enable All'}
                    </button>
                  </div>

                  {/* Features List */}
                  <div className="divide-y divide-gray-200">
                    {moduleFeatures.map((feature) => (
                      <div key={feature.feature_code} className="px-6 py-4 hover:bg-gray-50 transition">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <h4 className="text-sm font-medium text-gray-900">{feature.feature_name}</h4>
                              {feature.is_beta && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                                  BETA
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
                            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                              <span className="font-mono">{feature.feature_code}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggleFeature(feature)}
                            disabled={toggling[feature.feature_code]}
                            className={`ml-4 p-2 rounded-lg transition ${
                              feature.is_enabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            } ${toggling[feature.feature_code] ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {toggling[feature.feature_code] ? (
                              <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full"></div>
                            ) : feature.is_enabled ? (
                              <ToggleRight className="h-6 w-6" />
                            ) : (
                              <ToggleLeft className="h-6 w-6" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'link-branding' && (
        <LinkBrandingTab client={client} onUpdate={loadClientData} />
      )}

      {activeTab === 'users' && (
        <UsersTab client={client} isLinked={isLinked} />
      )}

      {showBootstrapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Re-bootstrap / Reset DB</h3>
              <p className="mt-1 text-sm text-gray-600">
                Re-run provisioning: refreshes indexes, flags, and creates an admin user if one does not exist. Safe to run on an active tenant.
              </p>
            </div>
            <form onSubmit={handleBootstrapTenant} className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Admin Email</label>
                <input
                  type="email"
                  required
                  value={bootstrapForm.admin_email}
                  onChange={(e) => setBootstrapForm(prev => ({ ...prev, admin_email: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Admin Name</label>
                <input
                  type="text"
                  required
                  value={bootstrapForm.admin_name}
                  onChange={(e) => setBootstrapForm(prev => ({ ...prev, admin_name: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Admin Password</label>
                <div className="relative">
                  <input
                    type={showBootstrapPassword ? 'text' : 'password'}
                    required
                    value={bootstrapForm.admin_password}
                    onChange={(e) => setBootstrapForm(prev => ({ ...prev, admin_password: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBootstrapPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                    aria-label={showBootstrapPassword ? 'Hide password' : 'Show password'}
                  >
                    {showBootstrapPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBootstrapModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bootstrapping}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {bootstrapping ? 'Bootstrapping...' : 'Re-bootstrap'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
