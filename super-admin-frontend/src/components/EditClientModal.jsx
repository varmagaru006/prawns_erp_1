import React, { useState, useEffect } from 'react';
import { clientAPI } from '../api/auth';
import { X, AlertCircle } from 'lucide-react';

export default function EditClientModal({ isOpen, onClose, onSuccess, client }) {
  const [formData, setFormData] = useState({});
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && client) {
      setFormData({
        tenant_id: client.tenant_id || '',
        business_name: client.business_name || '',
        owner_name: client.owner_name || '',
        owner_email: client.owner_email || '',
        client_ui_url: client.client_ui_url || '',
        client_api_url: client.client_api_url || '',
        client_db_name: client.client_db_name || '',
        subscription_status: client.subscription_status || 'active'
      });
      loadPlans();
    }
  }, [isOpen, client]);

  const loadPlans = async () => {
    try {
      const data = await clientAPI.getPlans();
      setPlans(data);
    } catch (err) {
      setError('Failed to load subscription plans');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await clientAPI.updateClient(client.id, formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update client');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Edit Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tenant ID</label>
            <input
              type="text"
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
            <input
              type="text"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
            <input
              type="text"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Owner Email</label>
            <input
              type="email"
              value={formData.owner_email}
              onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client UI URL</label>
            <input
              type="url"
              value={formData.client_ui_url}
              onChange={(e) => setFormData({ ...formData, client_ui_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., http://localhost:3001"
            />
            <p className="mt-1 text-sm text-gray-500">
              Localhost Option B: run each client UI on a different port (example: Client A = `http://localhost:3001`, Client B = `http://localhost:3002`).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client API URL</label>
            <input
              type="url"
              value={formData.client_api_url}
              onChange={(e) => setFormData({ ...formData, client_api_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., http://localhost:8000"
            />
            <p className="mt-1 text-sm text-gray-500">
              If all client UIs share one backend locally, keep this as `http://localhost:8000`.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client DB Name</label>
            <input
              type="text"
              value={formData.client_db_name}
              onChange={(e) => setFormData({ ...formData, client_db_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="e.g., prawn_erp_cli_001"
            />
            <p className="mt-1 text-sm text-gray-500">
              Use a unique DB name per client (recommended format: `prawn_erp_&lt;tenant_id&gt;`).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Status</label>
            <select
              value={formData.subscription_status}
              onChange={(e) => setFormData({ ...formData, subscription_status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
