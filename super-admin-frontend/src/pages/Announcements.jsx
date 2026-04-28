import React, { useEffect, useState } from 'react';
import { announcementAPI, clientAPI } from '../api/auth';
import { Megaphone, Plus, Trash2, AlertCircle, Info, AlertTriangle, X, Check, Users, Globe } from 'lucide-react';
import { useAlert } from '../contexts/AlertContext';

export default function Announcements() {
  const { confirm } = useAlert();
  const [announcements, setAnnouncements] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [annData, clientsData] = await Promise.all([
        announcementAPI.getAll(),
        clientAPI.getAll()
      ]);
      setAnnouncements(annData);
      setClients(clientsData);
    } catch (err) {
      showNotification('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete announcement?', description: 'This announcement will be removed from all tenants immediately.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    
    try {
      await announcementAPI.delete(id);
      showNotification('Announcement deleted');
      loadData();
    } catch (err) {
      showNotification('Failed to delete announcement', 'error');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

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
          <Check className="h-5 w-5 mr-2" />
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Megaphone className="h-8 w-8 mr-3 text-primary-600" />
            Announcements
          </h1>
          <p className="mt-2 text-gray-600">Broadcast messages to all or selected clients</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          data-testid="create-announcement-btn"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Announcement
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No announcements yet</h3>
            <p className="text-gray-500 mt-2">Create your first announcement to broadcast to clients</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div 
              key={announcement.id} 
              className="bg-white rounded-lg shadow overflow-hidden"
              data-testid={`announcement-${announcement.id}`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    {getTypeIcon(announcement.announcement_type)}
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                      <p className="mt-1 text-gray-600">{announcement.body}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                    data-testid={`delete-announcement-${announcement.id}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeClass(announcement.announcement_type)}`}>
                    {announcement.announcement_type}
                  </span>
                  <span className="flex items-center text-gray-500">
                    {announcement.target_all ? (
                      <><Globe className="h-4 w-4 mr-1" /> All Clients</>
                    ) : (
                      <><Users className="h-4 w-4 mr-1" /> {announcement.target_clients?.length || 0} Clients</>
                    )}
                  </span>
                  <span className="text-gray-500">
                    From: {new Date(announcement.show_from).toLocaleDateString()}
                  </span>
                  {announcement.show_until && (
                    <span className="text-gray-500">
                      Until: {new Date(announcement.show_until).toLocaleDateString()}
                    </span>
                  )}
                  {announcement.created_by_name && (
                    <span className="text-gray-500">
                      By: {announcement.created_by_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAnnouncementModal
          clients={clients}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            showNotification('Announcement created');
            loadData();
          }}
        />
      )}
    </div>
  );
}

function CreateAnnouncementModal({ clients, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    announcement_type: 'info',
    target_all: true,
    target_client_ids: [],
    show_from: new Date().toISOString().slice(0, 16),
    show_until: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        ...formData,
        show_from: formData.show_from ? new Date(formData.show_from).toISOString() : null,
        show_until: formData.show_until ? new Date(formData.show_until).toISOString() : null
      };
      
      await announcementAPI.create(payload);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleClientToggle = (clientId) => {
    setFormData(prev => ({
      ...prev,
      target_client_ids: prev.target_client_ids.includes(clientId)
        ? prev.target_client_ids.filter(id => id !== clientId)
        : [...prev.target_client_ids, clientId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Create Announcement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Announcement title"
              data-testid="announcement-title-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea
              required
              rows={4}
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Announcement message"
              data-testid="announcement-body-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.announcement_type}
              onChange={(e) => setFormData({ ...formData, announcement_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              data-testid="announcement-type-select"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Show From</label>
              <input
                type="datetime-local"
                value={formData.show_from}
                onChange={(e) => setFormData({ ...formData, show_from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Show Until (optional)</label>
              <input
                type="datetime-local"
                value={formData.show_until}
                onChange={(e) => setFormData({ ...formData, show_until: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="target"
                  checked={formData.target_all}
                  onChange={() => setFormData({ ...formData, target_all: true, target_client_ids: [] })}
                  className="h-4 w-4 text-primary-600"
                />
                <span className="ml-2 text-gray-700">All Clients</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="target"
                  checked={!formData.target_all}
                  onChange={() => setFormData({ ...formData, target_all: false })}
                  className="h-4 w-4 text-primary-600"
                />
                <span className="ml-2 text-gray-700">Select Specific Clients</span>
              </label>
            </div>

            {!formData.target_all && (
              <div className="mt-3 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {clients.map((client) => (
                  <label key={client.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={formData.target_client_ids.includes(client.id)}
                      onChange={() => handleClientToggle(client.id)}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {client.business_name} ({client.tenant_id})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              data-testid="create-announcement-submit"
            >
              {saving ? 'Creating...' : 'Create Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
