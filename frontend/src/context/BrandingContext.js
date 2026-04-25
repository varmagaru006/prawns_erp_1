import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const BrandingContext = createContext(null);

// Match AuthContext: empty env → same-origin `/api` (nginx / dev proxy). Avoid localhost:8000 in Docker.
const rawBackend = (process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/+$/, '');
const API = rawBackend ? `${rawBackend}/api` : '/api';

// Default branding config
const DEFAULT_BRANDING = {
  company_name: 'Sun Bitess',
  sidebar_label: 'Sun Bitess ERP',
  primary_color: '#0f5ea8',
  login_bg_color: 'linear-gradient(135deg, #0b2a4a 0%, #0f5ea8 55%, #1f7fbd 100%)',
  logo_url: '/assets/sunbitess/logo.png',
  favicon_url: '/assets/sunbitess/favicon.ico'
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(false); // Don't block first paint; fetch in background

  useEffect(() => {
    // Defer fetch so login form can paint immediately with defaults
    const t = setTimeout(() => { fetchBranding(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const fetchBranding = async () => {
    try {
      const response = await axios.get(`${API}/public-config`);
      const config = response.data;
      
      // Merge with defaults
      const newBranding = {
        company_name: config.company_name || DEFAULT_BRANDING.company_name,
        sidebar_label: config.sidebar_label || config.company_name || DEFAULT_BRANDING.sidebar_label,
        primary_color: config.primary_color || DEFAULT_BRANDING.primary_color,
        login_bg_color: config.login_bg_color || DEFAULT_BRANDING.login_bg_color,
        logo_url: config.logo_url || DEFAULT_BRANDING.logo_url,
        favicon_url: config.favicon_url || DEFAULT_BRANDING.favicon_url
      };
      
      setBranding(newBranding);
      applyBranding(newBranding);
    } catch (err) {
      console.error('Failed to fetch branding config:', err);
      // Use defaults on error
      applyBranding(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  };

  const applyBranding = (config) => {
    // Apply CSS variables for primary color
    const root = document.documentElement;
    root.style.setProperty('--primary-color', config.primary_color);
    
    // Convert hex to RGB for Tailwind-style variants
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const rgb = hexToRgb(config.primary_color);
    if (rgb) {
      root.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
    
    // Update page title
    if (config.company_name) {
      document.title = config.company_name;
    }
    
    // Update favicon
    if (config.favicon_url) {
      let favicon = document.querySelector("link[rel='icon']");
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = config.favicon_url;
    }
  };

  const refreshBranding = async () => {
    await fetchBranding();
  };

  return (
    <BrandingContext.Provider value={{ 
      branding, 
      loading,
      refreshBranding
    }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return context;
};

export default BrandingContext;
