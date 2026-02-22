import React, { useState, useEffect } from 'react';
import { userProvisioningAPI } from '../api/auth';
import { UserPlus, Users, Loader2, Check, AlertTriangle, Trash2, Edit3, Shield, X, Copy, Eye, EyeOff } from 'lucide-react';

export default function UsersTab({ client, isLinked }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [newUserCredentials, setNewUserCredentials] = useState(null);

  useEffect(() => {
    if (isLinked) {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [client?.id, isLinked]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userProvisioningAPI.getUsers(client.id);
      setUsers(data);
    } catch (err) {
      showNotif('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCreateUser = async (userData) => {
    try {
      const result = await userProvisioningAPI.provisionUser(client.id, userData);
      setNewUserCredentials({
        email: userData.email,
        temp_password: result.temp_password,
        user_id: result.user_id
      });
      showNotif('User provisioned successfully!');
      loadUsers();
      setShowCreateModal(false);
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to provision user', 'error');
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      await userProvisioningAPI.updateUser(client.id, userId, updates);
      showNotif('User updated successfully!');
      loadUsers();
      setShowEditModal(null);
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to update user', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
      await userProvisioningAPI.deleteUser(client.id, userId);
      showNotif('User deactivated successfully!');
      loadUsers();
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to deactivate user', 'error');
    }
  };

  if (!isLinked) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-yellow-900 mb-2">Client Not Linked</h3>
        <p className="text-yellow-700">
          You need to link this client first before you can manage users.
          Go to the "Link & Branding" tab to complete the linking process.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <Check className="h-5 w-5 mr-2" /> : <AlertTriangle className="h-5 w-5 mr-2" />}
          {notification.message}
        </div>
      )}

      {/* New User Credentials Modal */}
      {newUserCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-2" />
              User Created Successfully!
            </h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                Save these credentials now - the password won't be shown again!
              </p>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="flex items-center mt-1">
                  <input
                    type="text"
                    readOnly
                    value={newUserCredentials.email}
                    className="flex-1 px-3 py-2 border rounded-l-lg bg-gray-50"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newUserCredentials.email);
                      showNotif('Email copied!');
                    }}
                    className="px-3 py-2 bg-gray-200 border-l-0 border rounded-r-lg hover:bg-gray-300"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
                <div className="flex items-center mt-1">
                  <input
                    type="text"
                    readOnly
                    value={newUserCredentials.temp_password}
                    className="flex-1 px-3 py-2 border rounded-l-lg bg-gray-50 font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newUserCredentials.temp_password);
                      showNotif('Password copied!');
                    }}
                    className="px-3 py-2 bg-gray-200 border-l-0 border rounded-r-lg hover:bg-gray-300"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setNewUserCredentials(null)}
              className="w-full mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-primary-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
              <p className="text-sm text-gray-500">Provision and manage users for {client?.business_name}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            data-testid="provision-user-btn"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Provision New User
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No users provisioned yet</p>
            <p className="text-sm text-gray-400">Click "Provision New User" to create the first user</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provisioned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Push Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className={!user.is_active ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-medium">
                            {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'owner' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        <Shield className="h-3 w-3 mr-1" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.provisioned_at ? new Date(user.provisioned_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.push_status === 'success' ? 'bg-green-100 text-green-800' :
                        user.push_status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.push_status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setShowEditModal(user)}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                        data-testid={`edit-user-${user.email}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {user.is_active && (
                        <button
                          onClick={() => handleDeleteUser(user.user_id)}
                          className="text-red-600 hover:text-red-900"
                          data-testid={`delete-user-${user.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <EditUserModal
          user={showEditModal}
          onClose={() => setShowEditModal(null)}
          onSubmit={(updates) => handleUpdateUser(showEditModal.user_id, updates)}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'worker',
    send_welcome_email: true
  });
  const [submitting, setSubmitting] = useState(false);

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'owner', label: 'Owner' },
    { value: 'procurement_manager', label: 'Procurement Manager' },
    { value: 'production_supervisor', label: 'Production Supervisor' },
    { value: 'cold_storage_incharge', label: 'Cold Storage Incharge' },
    { value: 'qc_officer', label: 'QC Officer' },
    { value: 'sales_manager', label: 'Sales Manager' },
    { value: 'accounts_manager', label: 'Accounts Manager' },
    { value: 'worker', label: 'Worker' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <UserPlus className="h-5 w-5 text-primary-600 mr-2" />
            Provision New User
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="John Doe"
              data-testid="user-fullname-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="john@example.com"
              data-testid="user-email-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              data-testid="user-role-select"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="send_welcome_email"
              checked={formData.send_welcome_email}
              onChange={(e) => setFormData({ ...formData, send_welcome_email: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="send_welcome_email" className="ml-2 text-sm text-gray-700">
              Send welcome email with credentials
            </label>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              data-testid="create-user-submit-btn"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    role: user.role,
    is_active: user.is_active
  });
  const [submitting, setSubmitting] = useState(false);

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'owner', label: 'Owner' },
    { value: 'procurement_manager', label: 'Procurement Manager' },
    { value: 'production_supervisor', label: 'Production Supervisor' },
    { value: 'cold_storage_incharge', label: 'Cold Storage Incharge' },
    { value: 'qc_officer', label: 'QC Officer' },
    { value: 'sales_manager', label: 'Sales Manager' },
    { value: 'accounts_manager', label: 'Accounts Manager' },
    { value: 'worker', label: 'Worker' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Edit3 className="h-5 w-5 text-primary-600 mr-2" />
            Edit User
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              User is active
            </label>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
