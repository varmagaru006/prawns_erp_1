import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from './AuthContext';
import { FEATURE_FLAGS_STORAGE_KEY } from '../constants/storageKeys';

const FeatureFlagContext = createContext();

function readCachedFeatureFlags() {
  try {
    if (typeof window === 'undefined') return {};
    if (!localStorage.getItem('token')) return {};
    const raw = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistFeatureFlags(flags) {
  try {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('token')) return;
    localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(flags || {}));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPersistedFeatureFlags() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FEATURE_FLAGS_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export const FeatureFlagProvider = ({ children }) => {
  // Hydrate from last successful /auth/me so sidebar respects Super Admin toggles immediately on refresh.
  const [features, setFeatures] = useState(() => readCachedFeatureFlags());
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
      clearPersistedFeatureFlags();
      return;
    }

    setLoading(true);
    try {
      // Must use same base as AuthContext: when REACT_APP_BACKEND_URL is empty, use relative `/api`
      // so nginx (Docker) proxies correctly. Hardcoding localhost:8000 breaks refresh on :3000.
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 25000
      });

      if (response.data.features) {
        setFeatures(response.data.features);
        persistFeatureFlags(response.data.features);
        setTenantInfo({
          tenantId: response.data.tenant_id,
          lotNumberPrefix: response.data.lot_number_prefix
        });
      }
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      // Keep cached flags so sidebar still reflects last known Super Admin state
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
        persistFeatureFlags(d.features);
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
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 25000
      });

      if (response.data.features) {
        setFeatures(response.data.features);
        persistFeatureFlags(response.data.features);
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
