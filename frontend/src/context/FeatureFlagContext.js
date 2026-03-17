import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const FeatureFlagContext = createContext();

export const FeatureFlagProvider = ({ children }) => {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(false); // No token = no /auth/me, so don't block login
  const [tenantInfo, setTenantInfo] = useState({
    tenantId: null,
    lotNumberPrefix: null
  });

  const loadFeatures = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setFeatures({});
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.features) {
        setFeatures(response.data.features);
        setTenantInfo({
          tenantId: response.data.tenant_id,
          lotNumberPrefix: response.data.lot_number_prefix
        });
      }
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load features on mount (and when token is present after login)
    loadFeatures();

    // Listen for storage changes (e.g. token set in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'token' && e.newValue) {
        loadFeatures();
      }
    };
    // Same-tab login: use features from event detail to skip /auth/me
    const handleTokenChanged = (e) => {
      const d = e?.detail;
      if (d?.features && typeof d.features === 'object') {
        setFeatures(d.features);
        setTenantInfo({ tenantId: d.tenant_id || null, lotNumberPrefix: d.lot_number_prefix || null });
        setLoading(false);
        return;
      }
      loadFeatures();
    };

    // Refetch features when user returns to this tab (e.g. after toggling in Super Admin)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('token')) {
        loadFeatures();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tokenChanged', handleTokenChanged);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenChanged', handleTokenChanged);
    };
  }, [loadFeatures]);

  const isEnabled = (featureCode) => {
    return features[featureCode] === true;
  };

  const refreshFeatures = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.features) {
        setFeatures(response.data.features);
        setTenantInfo({
          tenantId: response.data.tenant_id,
          lotNumberPrefix: response.data.lot_number_prefix
        });
      }
    } catch (error) {
      console.error('Failed to refresh feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureFlagContext.Provider 
      value={{ 
        features, 
        isEnabled, 
        loading, 
        tenantInfo,
        refreshFeatures 
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
};

export default FeatureFlagContext;
