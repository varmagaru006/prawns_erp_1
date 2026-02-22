import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientAPI } from '../api/auth';
import { ArrowLeft, Building2, Package, ToggleLeft, ToggleRight, Check, AlertCircle, Zap, Edit } from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [notification, setNotification] = useState(null);

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
    setToggling({ ...toggling, [feature.feature_code]: true });

    try {
      await clientAPI.toggleFeature(id, {
        tenant_id: client.tenant_id,
        feature_code: feature.feature_code,
        is_enabled: !feature.is_enabled,
        is_override: false
      });

      setFeatures(features.map(f => 
        f.feature_code === feature.feature_code 
          ? { ...f, is_enabled: !f.is_enabled }
          : f
      ));

      showNotification(
        `Feature "${feature.feature_name}" ${!feature.is_enabled ? 'enabled' : 'disabled'}`,
        'success'
      );
    } catch (err) {
      showNotification(`Failed to toggle feature: ${err.message}`, 'error');
    } finally {
      setToggling({ ...toggling, [feature.feature_code]: false });
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

      // Update local state immediately - don't reload to avoid race condition
      setFeatures(prev => prev.map(f => 
        featureCodes.includes(f.feature_code)
          ? { ...f, is_enabled: isEnabled }
          : f
      ));

      showNotification(`${label} - ${featureCodes.length} features ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      showNotification(`Bulk update failed: ${err.message}`, 'error');
      // Only reload on error to restore correct state
      loadClientData();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleModule = async (module) => {
    const moduleFeatures = features.filter(f => f.module === module);
    const allEnabled = moduleFeatures.every(f => f.is_enabled);
    
    // Only get features that need to be changed
    const featuresToChange = allEnabled 
      ? moduleFeatures.filter(f => f.is_enabled).map(f => f.feature_code)  // Disable only enabled ones
      : moduleFeatures.filter(f => !f.is_enabled).map(f => f.feature_code); // Enable only disabled ones
    
    if (featuresToChange.length === 0) return;
    
    await handleBulkToggle(featuresToChange, !allEnabled, `${module} module`);
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
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg shadow-lg p-6 mb-8 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="bg-white/20 p-3 rounded-lg">
              <Building2 className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <h1 className="text-3xl font-bold">{client.business_name}</h1>
              <div className="mt-3 flex items-center space-x-4">
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
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-white/70 text-sm">Features Enabled</p>
            <p className="mt-1 text-2xl font-bold">{enabledCount} / {totalCount}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-white/70 text-sm">Contact</p>
            <p className="mt-1 text-sm font-medium truncate">{client.contact_email || 'Not set'}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-white/70 text-sm">Onboarded</p>
            <p className="mt-1 text-sm font-medium">
              {new Date(client.onboarded_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

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
  );
}
