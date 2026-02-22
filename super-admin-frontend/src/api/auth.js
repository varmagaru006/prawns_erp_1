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
      window.location.href = '/login';
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

export default api;
