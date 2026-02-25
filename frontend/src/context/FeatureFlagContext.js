import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const FeatureFlagContext = createContext();

export const FeatureFlagProvider = ({ children }) => {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState({
    tenantId: null,
    lotNumberPrefix: null
  });

  const loadFeatures = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
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
    // Load features on mount
    loadFeatures();
    
    // Listen for storage changes (e.g., when token is set after login)
    const handleStorageChange = (e) => {
      if (e.key === 'token' && e.newValue) {
        loadFeatures();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadFeatures]);

  const isEnabled = (featureCode) => {
    return features[featureCode] === true;
  };

  const refreshFeatures = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
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
