import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sa_token');
      window.location.href = '/super-admin/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const clientAPI = {
  getAll: async () => {
    const response = await api.get('/clients');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },
  
  getFeatures: async (id) => {
    const response = await api.get(`/clients/${id}/features`);
    return response.data;
  },
  
  toggleFeature: async (clientId, data) => {
    const response = await api.post(`/clients/${clientId}/features/toggle`, data);
    return response.data;
  },

  createClient: async (data) => {
    const response = await api.post('/clients', data);
    return response.data;
  },

  updateClient: async (id, data) => {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  deleteClient: async (id) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },

  activateClient: async (id) => {
    const response = await api.post(`/clients/${id}/activate`);
    return response.data;
  },

  bulkToggleFeatures: async (clientId, data) => {
    const response = await api.post(`/clients/${clientId}/bulk-features`, data);
    return response.data;
  },

  bootstrapTenant: async (clientId, data = {}) => {
    const response = await api.post(`/clients/${clientId}/bootstrap`, data);
    return response.data;
  },

  openSession: async (clientId) => {
    const response = await api.post(`/clients/${clientId}/open-session`);
    return response.data;
  },

  getPlans: async () => {
    const response = await api.get('/subscription-plans');
    return response.data;
  },
};

export const featureAPI = {
  getRegistry: async () => {
    const response = await api.get('/feature-registry');
    return response.data;
  },
};

export const announcementAPI = {
  getAll: async () => {
    const response = await api.get('/announcements');
    return response.data;
  },
  
  create: async (data) => {
    const response = await api.post('/announcements', data);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/announcements/${id}`);
    return response.data;
  },
};

export const impersonationAPI = {
  start: async (clientId, data = {}) => {
    const response = await api.post(`/clients/${clientId}/impersonate`, {
      reason: data.reason || '',
      duration_mins: data.duration_mins || 60
    });
    return response.data;
  },
  
  end: async (sessionId) => {
    const response = await api.post(`/impersonation/${sessionId}/end`);
    return response.data;
  },
  
  getActive: async () => {
    const response = await api.get('/impersonation/active');
    return response.data;
  },
};

// A3: Client Linking, Branding & User Provisioning APIs
export const linkingAPI = {
  linkClient: async (clientId, webhookUrl = null) => {
    const response = await api.post(`/clients/${clientId}/link`, { webhook_url: webhookUrl });
    return response.data;
  },
  
  getHealth: async (clientId) => {
    const response = await api.get(`/clients/${clientId}/health`);
    return response.data;
  },
  
  pushFeatures: async (clientId) => {
    const response = await api.post(`/clients/${clientId}/push-features`);
    return response.data;
  },
  
  pushBranding: async (clientId, branding) => {
    const response = await api.post(`/clients/${clientId}/push-branding`, branding);
    return response.data;
  },
  
  launchClient: async (clientId) => {
    const response = await api.post(`/clients/${clientId}/launch`);
    return response.data;
  },
};

export const userProvisioningAPI = {
  getUsers: async (clientId) => {
    const response = await api.get(`/clients/${clientId}/users`);
    return response.data;
  },
  
  provisionUser: async (clientId, userData) => {
    const response = await api.post(`/clients/${clientId}/users`, userData);
    return response.data;
  },
  
  updateUser: async (clientId, userId, updates) => {
    const response = await api.patch(`/clients/${clientId}/users/${userId}`, updates);
    return response.data;
  },
  
  deleteUser: async (clientId, userId) => {
    const response = await api.delete(`/clients/${clientId}/users/${userId}`);
    return response.data;
  },

  resetPassword: async (clientId, userId, newPassword = null) => {
    const response = await api.patch(`/clients/${clientId}/users/${userId}/reset-password`, {
      new_password: newPassword
    });
    return response.data;
  },

  toggleActive: async (clientId, userId) => {
    const response = await api.patch(`/clients/${clientId}/users/${userId}/toggle-active`);
    return response.data;
  },

  getActivityLogs: async (params = {}) => {
    const response = await api.get('/activity-logs', { params });
    return response.data;
  },
};

export default api;
