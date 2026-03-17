import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

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
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  // Setup axios interceptor to add token to every request
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const handleImpersonationLogin = async (token) => {
    try {
      setLoading(true);
      // Set the token
      localStorage.setItem('token', token);
      localStorage.setItem('isImpersonation', 'true');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Fetch user info
      const response = await axios.get(`${API}/auth/me`);
      const userData = {
        ...response.data,
        token: token,
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
      setLoading(false);
    }
  };

  const loginWithToken = async (token) => {
    try {
      // Set the token
      localStorage.setItem('token', token);
      localStorage.setItem('isImpersonation', 'true');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Fetch user info
      const response = await axios.get(`${API}/auth/me`);
      const userData = {
        ...response.data,
        token: token,
        is_impersonated: response.data.is_impersonated || true
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setIsImpersonating(true);
      
      // Dispatch custom event to refresh features
      window.dispatchEvent(new CustomEvent('tokenChanged'));
      
      return userData;
    } catch (err) {
      console.error('Token login failed:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('isImpersonation');
      throw err;
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData, features, tenant_id, lot_number_prefix } = response.data;
    
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.removeItem('isImpersonation');
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setUser(userData);
    setIsImpersonating(false);
    
    // Pass features in event so FeatureFlagProvider can skip /auth/me (faster load)
    window.dispatchEvent(new CustomEvent('tokenChanged', { detail: { features, tenant_id, lot_number_prefix } }));

    // Prefetch dashboard so it can be ready when user lands on /
    axios.get(`${API}/dashboard/overview`).then((r) => {
      window.__dashboardPrefetch = r.data;
    }).catch(() => {});

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
    delete axios.defaults.headers.common['Authorization'];
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

export { API };
