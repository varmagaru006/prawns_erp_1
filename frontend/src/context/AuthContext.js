import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { FEATURE_FLAGS_STORAGE_KEY } from '../constants/storageKeys';

const AuthContext = createContext(null);

const rawBackendUrl = (process.env.REACT_APP_BACKEND_URL || '').trim();
const BACKEND_URL = rawBackendUrl ? rawBackendUrl.replace(/\/+$/, '') : '';
const API = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

/**
 * React 18 runs child useEffects before parent useEffects. Axios interceptors were only
 * registered in AuthProvider's effect, so the first API calls (e.g. purchase invoices) could
 * run without Authorization → 401 and "Failed to load invoices". Install interceptors and
 * sync defaults once at module load (browser only).
 */
function syncAxiosAuthHeaderFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const t = localStorage.getItem('token');
    if (t) {
      axios.defaults.headers.common.Authorization = `Bearer ${t}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  } catch {
    /* ignore */
  }
}

function handleAxios401(error) {
  const url = error.config?.url || '';
  if (url.includes('/auth/login')) {
    return;
  }
  try {
    if (window.location.pathname === '/login' || window.location.pathname.endsWith('/login')) {
      return;
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isImpersonation');
  localStorage.removeItem(FEATURE_FLAGS_STORAGE_KEY);
  syncAxiosAuthHeaderFromStorage();
  window.location.href = '/login';
}

let _axiosAuthInterceptorsInstalled = false;
function installAxiosAuthInterceptors() {
  if (typeof window === 'undefined' || _axiosAuthInterceptorsInstalled) return;
  _axiosAuthInterceptorsInstalled = true;
  syncAxiosAuthHeaderFromStorage();

  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if ((config.url || '').includes('/auth/login')) {
        const hintedTenant = localStorage.getItem('tenant_id_hint');
        if (hintedTenant) {
          config.headers['X-Tenant-ID'] = hintedTenant;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // Silently drop requests cancelled on component unmount
      if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
        return Promise.reject(error);
      }
      if (error.response?.status === 401) {
        handleAxios401(error);
      }
      return Promise.reject(error);
    }
  );
}

installAxiosAuthInterceptors();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // When no token, show login immediately (no loading frame)
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return !!new URLSearchParams(window.location.search).get('impersonation_token') || !!localStorage.getItem('token');
    } catch {
      return false;
    }
  });
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    // Check for impersonation token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const impersonationToken = urlParams.get('impersonation_token');
    const tenantHintFromUrl = urlParams.get('tenant_id');
    if (tenantHintFromUrl) {
      localStorage.setItem('tenant_id_hint', tenantHintFromUrl);
    }
    
    if (impersonationToken) {
      handleImpersonationLogin(impersonationToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      setIsImpersonating(userData.is_impersonated || false);
      syncAxiosAuthHeaderFromStorage();
    }
    setLoading(false);
  }, []);

  const handleImpersonationLogin = async (token) => {
    try {
      setLoading(true);
      // Set the token
      localStorage.setItem('token', token);
      localStorage.setItem('isImpersonation', 'true');
      syncAxiosAuthHeaderFromStorage();
      
      // Fetch user info
      const response = await axios.get(`${API}/auth/me`);
      const userData = {
        ...response.data,
        token: token,
        tenant_id: response.data.tenant_id || localStorage.getItem('tenant_id_hint') || null,
        is_impersonated: response.data.is_impersonated || true
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setIsImpersonating(true);
      
      // Force navigation to home page after successful impersonation
      // Use setTimeout to ensure state is saved before navigation
      setTimeout(() => {
        window.location.replace('/');
      }, 100);
    } catch (err) {
      console.error('Impersonation login failed:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('isImpersonation');
      localStorage.removeItem(FEATURE_FLAGS_STORAGE_KEY);
      syncAxiosAuthHeaderFromStorage();
      setLoading(false);
    }
  };

  const loginWithToken = async (token) => {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('isImpersonation', 'true');
      syncAxiosAuthHeaderFromStorage();

      const response = await axios.get(`${API}/auth/me`);
      const userData = {
        ...response.data,
        token,
        tenant_id: response.data.tenant_id || localStorage.getItem('tenant_id_hint') || null,
        is_impersonated: true,
      };

      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setIsImpersonating(true);

      // Pass features directly so FeatureFlagContext applies them immediately
      // (no second /auth/me round-trip, no flash of all-tabs-visible)
      window.dispatchEvent(new CustomEvent('tokenChanged', {
        detail: {
          features: response.data.features || {},
          tenant_id: response.data.tenant_id,
          lot_number_prefix: response.data.lot_number_prefix,
        },
      }));

      return userData;
    } catch (err) {
      console.error('Token login failed:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('isImpersonation');
      localStorage.removeItem(FEATURE_FLAGS_STORAGE_KEY);
      syncAxiosAuthHeaderFromStorage();
      throw err;
    }
  };

  const login = async (email, password) => {
    const tenantHint = localStorage.getItem('tenant_id_hint');
    const response = await axios.post(
      `${API}/auth/login`,
      { email, password },
      tenantHint ? { headers: { 'X-Tenant-ID': tenantHint } } : undefined
    );
    const { access_token, user: userData, features, tenant_id, lot_number_prefix } = response.data;
    const normalizedUser = { ...userData, tenant_id: userData?.tenant_id || tenant_id || null };
    
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.removeItem('tenant_id_hint');
    localStorage.removeItem('isImpersonation');
    syncAxiosAuthHeaderFromStorage();
    setUser(normalizedUser);
    setIsImpersonating(false);
    
    // Pass features in event so FeatureFlagProvider can skip /auth/me (faster load)
    window.dispatchEvent(new CustomEvent('tokenChanged', { detail: { features, tenant_id, lot_number_prefix } }));

    // Prefetch dashboard so it can be ready when user lands on /.
    // Keep a shared in-flight promise to dedupe immediate duplicate fetches.
    if (typeof window !== 'undefined' && !window.__dashboardPrefetchPromise) {
      window.__dashboardPrefetchPromise = axios
        .get(`${API}/dashboard/overview`)
        .then((r) => {
          window.__dashboardPrefetch = r.data;
          return r.data;
        })
        .catch(() => null)
        .finally(() => {
          window.__dashboardPrefetchPromise = null;
        });
    }

    return userData;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isImpersonation');
    localStorage.removeItem(FEATURE_FLAGS_STORAGE_KEY);
    syncAxiosAuthHeaderFromStorage();
    setUser(null);
    setIsImpersonating(false);
  };

  const endImpersonation = () => {
    logout();
    // Close the tab if opened via impersonation
    if (window.opener) {
      window.close();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      loginWithToken,
      register, 
      logout, 
      loading, 
      isImpersonating,
      endImpersonation
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export { API, BACKEND_URL };
