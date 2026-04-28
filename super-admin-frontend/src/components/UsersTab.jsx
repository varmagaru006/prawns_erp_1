import React, { useState, useEffect } from 'react';
import { userProvisioningAPI } from '../api/auth';
import { UserPlus, Users, Loader2, Check, AlertTriangle, Edit3, Shield, X, Copy, Eye, EyeOff, KeyRound, UserX, UserCheck, CheckCircle, XCircle } from 'lucide-react';
import { useAlert } from '../contexts/AlertContext';

export default function UsersTab({ client, isLinked }) {
  const { confirm } = useAlert();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [newUserCredentials, setNewUserCredentials] = useState(null);
  const [resetCredentials, setResetCredentials] = useState(null);
  const [resetting, setResetting] = useState({});
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    if (isLinked) {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [client?.id, isLinked, dateRange, customFrom, customTo]);

  const buildDateParams = () => {
    const now = new Date();
    let from = null;
    let to = null;
    if (dateRange === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = now;
    } else if (dateRange === '7d') {
      from = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      to = now;
    } else if (dateRange === '30d') {
      from = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      to = now;
    } else if (dateRange === 'custom') {
      if (customFrom) from = new Date(`${customFrom}T00:00:00`);
      if (customTo) to = new Date(`${customTo}T23:59:59`);
    }
    const params = {};
    if (from && !Number.isNaN(from.getTime())) params.from_ts = from.toISOString();
    if (to && !Number.isNaN(to.getTime())) params.to_ts = to.toISOString();
    return params;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersData, logsData] = await Promise.all([
        userProvisioningAPI.getUsers(client.id),
        userProvisioningAPI.getActivityLogs({ entity_id: client.id, limit: 200, ...buildDateParams() })
      ]);
      setUsers(usersData);
      const interesting = (logsData?.logs || []).filter((l) =>
        ['PROVISION_USER', 'UPDATE_CLIENT_USER', 'RESET_PASSWORD', 'DISABLE_USER', 'ENABLE_USER'].includes(l.action)
      );
      setAuditLogs(interesting);
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
      const result = await userProvisioningAPI.updateUser(client.id, userId, updates);
      showNotif('User updated successfully!');
      if (result?.temp_password) {
        setResetCredentials({
          email: (users.find(u => u.user_id === userId || u.id === userId)?.email) || '',
          temp_password: result.temp_password
        });
      }
      loadUsers();
      setShowEditModal(null);
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to update user', 'error');
    }
  };

  const handleResetPassword = async (user) => {
    const ok = await confirm({ title: 'Reset password?', description: `A new temporary password will be generated for ${user.full_name} (${user.email}).`, confirmLabel: 'Reset', variant: 'warning' });
    if (!ok) return;
    setResetting((p) => ({ ...p, [user.id]: true }));
    try {
      const result = await userProvisioningAPI.resetPassword(client.id, user.id);
      setResetCredentials({ email: result.email, temp_password: result.new_password });
      showNotif('Password reset successfully');
      await loadUsers();
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Reset failed', 'error');
    } finally {
      setResetting((p) => ({ ...p, [user.id]: false }));
    }
  };

  const handleToggleActive = async (user) => {
    const action = user.is_active ? 'disable' : 'enable';
    const ok = await confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} user?`,
      description: `${user.full_name} will be ${action === 'disable' ? 'prevented from logging in' : 'allowed to log in again'}.`,
      confirmLabel: action.charAt(0).toUpperCase() + action.slice(1),
      variant: action === 'disable' ? 'destructive' : 'success',
    });
    if (!ok) return;
    setToggling((p) => ({ ...p, [user.id]: true }));
    try {
      const result = await userProvisioningAPI.toggleActive(client.id, user.id);
      showNotif(`User ${result.is_active ? 'enabled' : 'disabled'} successfully`);
      await loadUsers();
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Update failed', 'error');
    } finally {
      setToggling((p) => ({ ...p, [user.id]: false }));
    }
  };

  const handleBulkDisable = async () => {
    const activeUsers = users.filter((u) => u.is_active);
    if (!activeUsers.length) {
      showNotif('No active users to disable', 'error');
      return;
    }
    const ok = await confirm({ title: `Disable all ${activeUsers.length} active users?`, description: 'All active users for this client will be prevented from logging in.', confirmLabel: 'Disable All', variant: 'destructive' });
    if (!ok) return;
    try {
      await Promise.all(activeUsers.map((u) => userProvisioningAPI.deleteUser(client.id, u.user_id || u.id)));
      showNotif(`Disabled ${activeUsers.length} users successfully`);
      loadUsers();
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to disable users', 'error');
    }
  };

  const classifyAuditLog = (log) => {
    if (log?.action === 'PROVISION_USER') return 'provision';
    if (log?.action === 'RESET_PASSWORD') return 'password_reset';
    if (log?.action === 'DISABLE_USER') return 'disable';
    if (log?.action === 'ENABLE_USER') return 'other';
    const fields = Array.isArray(log?.details?.fields) ? log.details.fields : [];
    if (fields.includes('password_changed_at') || fields.includes('password_hash')) return 'password_reset';
    if (fields.includes('is_active') && log?.details?.is_active === false) return 'disable';
    if (fields.includes('role')) return 'role_change';
    return 'other';
  };

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditFilter === 'all') return true;
    return classifyAuditLog(log) === auditFilter;
  });

  const exportAuditCsv = async () => {
    try {
      // pull a larger window for export than the on-screen latest list
      const dateParams = buildDateParams();
      const logsData = await userProvisioningAPI.getActivityLogs({ entity_id: client.id, limit: 1000, ...dateParams });
      const interesting = (logsData?.logs || []).filter((l) =>
        ['PROVISION_USER', 'UPDATE_CLIENT_USER', 'RESET_PASSWORD', 'DISABLE_USER', 'ENABLE_USER'].includes(l.action)
      );
      const rows = interesting
        .filter((log) => auditFilter === 'all' || classifyAuditLog(log) === auditFilter)
        .map((log) => ({
          timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : '',
          action: log.action || '',
          category: classifyAuditLog(log),
          user: log.details?.email || log.details?.user_id || '',
          fields: Array.isArray(log.details?.fields) ? log.details.fields.join('|') : '',
          force_logout: log.details?.force_logout ? 'yes' : 'no',
          is_active: typeof log.details?.is_active === 'boolean' ? String(log.details.is_active) : '',
        }));
      if (!rows.length) {
        showNotif('No audit logs to export', 'error');
        return;
      }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_audit_${client?.tenant_id || 'client'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotif('Audit CSV exported');
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to export audit CSV', 'error');
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

      {/* Reset Password Credentials Modal */}
      {resetCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-2" />
              Password Reset Successful
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="text" readOnly value={resetCredentials.email} className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tenant ID</label>
                <input type="text" readOnly value={client?.tenant_id || ''} className="w-full px-3 py-2 border rounded-lg bg-gray-50 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Temporary Password</label>
                <div className="flex items-center mt-1">
                  <input type="text" readOnly value={resetCredentials.temp_password} className="flex-1 px-3 py-2 border rounded-l-lg bg-gray-50 font-mono" />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resetCredentials.temp_password);
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
              onClick={() => {
                const tuple = `Email: ${resetCredentials.email}\nTenant: ${client?.tenant_id || ''}\nPassword: ${resetCredentials.temp_password}`;
                navigator.clipboard.writeText(tuple);
                showNotif('Login details copied!');
              }}
              className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Copy Login Details
            </button>
            <button onClick={() => setResetCredentials(null)} className="w-full mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
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
              <p className="text-sm text-gray-500">View all client users and manage access for {client?.business_name}</p>
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
          <button
            onClick={handleBulkDisable}
            className="inline-flex items-center ml-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            data-testid="bulk-disable-users-btn"
          >
            Disable All Active
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
                        {user.is_active
                          ? <><CheckCircle className="h-3 w-3 mr-1" />Active</>
                          : <><XCircle className="h-3 w-3 mr-1" />Disabled</>}
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setShowEditModal(user)}
                          title="Edit role"
                          className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                          data-testid={`edit-user-${user.email}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleResetPassword(user)}
                          title="Reset password"
                          disabled={resetting[user.id] || !user.is_active}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded disabled:opacity-40"
                          data-testid={`reset-user-${user.email}`}
                        >
                          {resetting[user.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        </button>

                        <button
                          onClick={() => handleToggleActive(user)}
                          title={user.is_active ? 'Disable user' : 'Enable user'}
                          disabled={toggling[user.id]}
                          className={`p-1.5 rounded disabled:opacity-40 ${
                            user.is_active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                          data-testid={`toggle-user-${user.email}`}
                        >
                          {toggling[user.id]
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : user.is_active
                              ? <UserX className="h-4 w-4" />
                              : <UserCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User audit trail */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-semibold text-gray-900">User Audit Trail</h4>
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
              <option value="custom">Custom</option>
            </select>
            {dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </>
            )}
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All activity</option>
              <option value="provision">Provisioned users</option>
              <option value="password_reset">Password resets</option>
              <option value="disable">Disabled users</option>
              <option value="role_change">Role changes</option>
            </select>
            <button
              onClick={exportAuditCsv}
              className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
            >
              Export CSV
            </button>
          </div>
        </div>
        {filteredAuditLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No recent user activity logs.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredAuditLogs.slice(0, 25).map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-sm text-gray-600">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-800">{log.action}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{log.details?.email || log.details?.user_id || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {classifyAuditLog(log).replace('_', ' ')}
                      {Array.isArray(log.details?.fields) ? ` · ${log.details.fields.join(', ')}` : ''}
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
    password: '',
    send_welcome_email: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password (optional)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Leave empty to auto-generate"
                data-testid="user-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Set your own password, or leave blank for a temporary one.</p>
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
    is_active: user.is_active,
    reset_password: false,
    new_password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
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
      const payload = {
        role: formData.role,
        is_active: formData.is_active
      };
      if (formData.reset_password) {
        payload.new_password = formData.new_password || '';
      }
      await onSubmit(payload);
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

          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="reset_password"
                checked={formData.reset_password}
                onChange={(e) => setFormData({ ...formData, reset_password: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="reset_password" className="ml-2 text-sm text-gray-700 font-medium">
                Reset password
              </label>
            </div>
            {formData.reset_password && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password (optional)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.new_password}
                    onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Leave empty to auto-generate"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-gray-500">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
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
