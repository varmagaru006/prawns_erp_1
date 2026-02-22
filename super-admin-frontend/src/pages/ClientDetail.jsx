import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientAPI } from '../api/auth';
import { ArrowLeft, Building2, Package, ToggleLeft, ToggleRight, Check, AlertCircle } from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});
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

      // Update local state
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

  // Group features by module
  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.module]) {
      acc[feature.module] = [];
    }
    acc[feature.module].push(feature);
    return acc;
  }, {});

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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="bg-primary-100 p-3 rounded-lg">
              <Building2 className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-900">{client.business_name}</h1>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Tenant ID:</span>{' '}
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">{client.tenant_id}</span>
                </p>
                {client.contact_email && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Contact:</span> {client.contact_email}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
              client.subscription_status === 'active' 
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {client.subscription_status}
            </span>
            <div className="mt-2 text-sm text-gray-600">
              <Package className="inline h-4 w-4 mr-1" />
              {client.plan_name || 'No Plan'}
            </div>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Max Users</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {client.max_users || 'Unlimited'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Max Lots/Month</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {client.max_lots_per_month || 'Unlimited'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Storage Limit</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {client.storage_limit_gb ? `${client.storage_limit_gb} GB` : 'Unlimited'}
            </p>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Feature Flags</h2>
        <p className="text-sm text-gray-600">
          Toggle features to enable or disable modules for this client. Changes are synced in real-time.
        </p>
      </div>

      {/* Feature Groups */}
      <div className="space-y-6">
        {Object.entries(groupedFeatures).map(([module, moduleFeatures]) => (
          <div key={module} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Module Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {module} Module
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {moduleFeatures.length} features • {moduleFeatures.filter(f => f.is_enabled).length} enabled
              </p>
            </div>

            {/* Features List */}
            <div className="divide-y divide-gray-200">
              {moduleFeatures.map((feature) => (
                <div
                  key={feature.feature_code}
                  className="px-6 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">
                          {feature.feature_name}
                        </h4>
                        {feature.is_beta && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            BETA
                          </span>
                        )}
                        {feature.parent_feature_code && (
                          <span className="ml-2 text-xs text-gray-500">
                            (sub-feature)
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span className="font-mono">{feature.feature_code}</span>
                        {feature.is_available_on && feature.is_available_on.length > 0 && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
                            Available on: {feature.is_available_on.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Toggle Button */}
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
        ))}
      </div>
    </div>
  );
}
