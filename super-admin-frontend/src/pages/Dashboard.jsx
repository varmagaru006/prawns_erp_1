import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientAPI } from '../api/auth';
import { Users, Search, ExternalLink, CheckCircle, XCircle, Plus, Loader2 } from 'lucide-react';
import CreateClientModal from '../components/CreateClientModal';
import EditClientModal from '../components/EditClientModal';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [opening, setOpening] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await clientAPI.getAll();
      setClients(data);
    } catch (err) {
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client) => {
    setSelectedClient(client);
    setShowEditModal(true);
  };

  const handleToggleActive = async (client) => {
    try {
      if (client.is_active) {
        await clientAPI.deleteClient(client.id);
      } else {
        await clientAPI.activateClient(client.id);
      }
      loadClients();
    } catch (err) {
      setError('Failed to update client status');
    }
  };

  const handleOpenERP = async (client) => {
    setOpening(client.id);
    try {
      const result = await clientAPI.openSession(client.id);
      window.open(result.session_url, '_blank');
    } catch (err) {
      setNotification({
        message: err.response?.data?.detail || 'Failed to open client ERP',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setOpening(null);
    }
  };

  const filteredClients = clients.filter(client =>
    client.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.tenant_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
          {notification.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2" />
          ) : (
            <XCircle className="h-5 w-5 mr-2" />
          )}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Users className="h-8 w-8 mr-3 text-primary-600" />
            Client Management
          </h1>
          <p className="mt-2 text-gray-600">Manage all client subscriptions and feature flags</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Client
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by business name or tenant ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Business Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  {searchTerm ? 'No clients found matching your search' : 'No clients yet'}
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{client.business_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                      {client.tenant_id}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                      {client.plan_name || 'No Plan'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      client.subscription_status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : client.subscription_status === 'trial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {client.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.is_active ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleOpenERP(client)}
                        disabled={opening === client.id || !client.is_active}
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                          client.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        title={client.is_active ? 'Open client ERP' : 'Cannot open suspended client'}
                        data-testid={`open-erp-${client.id}`}
                      >
                        {opening === client.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        <span className="ml-1">Open ERP</span>
                      </button>
                      <Link
                        to={`/clients/${client.id}`}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="ml-1">Manage</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Clients</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{clients.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Active Subscriptions</div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            {clients.filter(c => c.subscription_status === 'active').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Trial Accounts</div>
          <div className="mt-2 text-3xl font-bold text-yellow-600">
            {clients.filter(c => c.subscription_status === 'trial').length}
          </div>
        </div>
      </div>

      {/* Create Client Modal */}
      <CreateClientModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadClients}
      />

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={loadClients}
        client={selectedClient}
      />
    </div>
  );
}
