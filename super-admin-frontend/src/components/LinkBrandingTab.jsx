import React, { useState, useEffect, useRef } from 'react';
import { linkingAPI, clientAPI } from '../api/auth';
import { Link2, RefreshCw, Key, AlertTriangle, Check, Loader2, Eye, Palette, Globe, Zap, Upload, X } from 'lucide-react';

export default function LinkBrandingTab({ client, onUpdate }) {
  const [linking, setLinking] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [apiKeyShown, setApiKeyShown] = useState(null);
  const [notification, setNotification] = useState(null);
  const [branding, setBranding] = useState({
    company_name: '',
    sidebar_label: '',
    primary_color: '#1e40af',
    login_bg_color: '#0f1117',
    logo_url: '',
    favicon_url: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(null);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  useEffect(() => {
    if (client?.branding) {
      setBranding({
        company_name: client.branding.company_name || client.business_name || '',
        sidebar_label: client.branding.sidebar_label || '',
        primary_color: client.branding.primary_color || '#1e40af',
        login_bg_color: client.branding.login_bg_color || '#0f1117',
        logo_url: client.branding.logo_url || '',
        favicon_url: client.branding.favicon_url || ''
      });
    }
  }, [client]);

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLink = async () => {
    setLinking(true);
    try {
      const result = await linkingAPI.linkClient(client.id);
      setApiKeyShown(result.api_key);
      showNotif('Client linked successfully!');
      onUpdate?.();
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to link client', 'error');
    } finally {
      setLinking(false);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    try {
      const result = await linkingAPI.getHealth(client.id);
      setHealthData(result);
      showNotif('Health check successful');
    } catch (err) {
      setHealthData({ status: 'error', error: err.message });
      showNotif('Health check failed', 'error');
    } finally {
      setPinging(false);
    }
  };

  const handlePushBranding = async () => {
    setPushing(true);
    try {
      await linkingAPI.pushBranding(client.id, branding);
      showNotif('Branding pushed successfully!');
      onUpdate?.();
    } catch (err) {
      showNotif(err.response?.data?.detail || 'Failed to push branding', 'error');
    } finally {
      setPushing(false);
    }
  };

  const handleImageUpload = (field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setBranding(prev => ({ ...prev, [field]: e.target.result }));
    reader.readAsDataURL(file);
  };

  const handleLaunch = async () => {
    setLaunchProgress({ status: 'running' });
    try {
      const result = await clientAPI.openSession(client.id);
      window.open(result.session_url, '_blank');
      setLaunchProgress({ status: 'launched' });
      showNotif('Client ERP opened successfully!');
    } catch (err) {
      setLaunchProgress({ status: 'error', error: err.response?.data?.detail || err.message });
      showNotif(err.response?.data?.detail || 'Launch failed', 'error');
    }
  };

  const isLinked = client?.link_status === 'linked';

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

      {/* Connection Status Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Link2 className="h-5 w-5 mr-2 text-primary-600" />
          Connection Status
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <span className="text-sm text-gray-500">Link Status</span>
            <div className="flex items-center mt-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isLinked ? 'bg-green-100 text-green-800' : 
                client?.link_status === 'linking' ? 'bg-yellow-100 text-yellow-800' :
                client?.link_status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {isLinked ? '🟢 Linked' : 
                 client?.link_status === 'linking' ? '🟡 Linking...' :
                 client?.link_status === 'error' ? '🔴 Error' :
                 '⚪ Not Linked'}
              </span>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Linked At</span>
            <p className="text-sm font-medium">{client?.linked_at ? new Date(client.linked_at).toLocaleString() : '—'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Last Ping</span>
            <p className="text-sm font-medium">{client?.last_ping_at ? new Date(client.last_ping_at).toLocaleString() : '—'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Tenant ID</span>
            <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{client?.tenant_id || '—'}</p>
          </div>
        </div>

        {/* API Key Display (shown once after linking) */}
        {apiKeyShown && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ API Key (copy now — shown only once):</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono">{apiKeyShown}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(apiKeyShown);
                  showNotif('API key copied!');
                }}
                className="px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {!isLinked ? (
            <button
              onClick={handleLink}
              disabled={linking}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              data-testid="link-client-btn"
            >
              {linking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
              Generate API Key & Link
            </button>
          ) : (
            <>
              <button
                onClick={handlePing}
                disabled={pinging}
                className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {pinging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Ping Now
              </button>
              <button
                onClick={() => linkingAPI.pushFeatures(client.id).then(() => showNotif('Features pushed!')).catch(() => showNotif('Push failed', 'error'))}
                className="inline-flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                <Zap className="h-4 w-4 mr-2" />
                Push Features
              </button>
              <button
                onClick={handleLaunch}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                data-testid="launch-client-btn"
              >
                🚀 Launch Client ERP
              </button>
            </>
          )}
        </div>

        {/* Health Data */}
        {healthData && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium">Health Check Result:</p>
            <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(healthData, null, 2)}</pre>
          </div>
        )}

        {/* Launch Progress */}
        {launchProgress && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium mb-2">Launch Progress:</p>
            {launchProgress.steps?.map((step, i) => (
              <div key={i} className="flex items-center text-sm py-1">
                {step.status === 'success' ? (
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                )}
                <span>{step.name}</span>
                {step.count !== undefined && <span className="ml-2 text-gray-500">({step.count})</span>}
              </div>
            ))}
            {launchProgress.status === 'launched' && (
              <p className="text-sm text-green-600 mt-2 font-medium">✓ All synced. Client ERP is up to date.</p>
            )}
          </div>
        )}
      </div>

      {/* Branding Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Palette className="h-5 w-5 mr-2 text-primary-600" />
          Branding Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={branding.company_name}
              onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Blue Ocean Processing"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sidebar Label</label>
            <input
              type="text"
              value={branding.sidebar_label}
              onChange={(e) => setBranding({ ...branding, sidebar_label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Blue Ocean ERP"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <input
                type="text"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login Background Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={branding.login_bg_color}
                onChange={(e) => setBranding({ ...branding, login_bg_color: e.target.value })}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <input
                type="text"
                value={branding.login_bg_color}
                onChange={(e) => setBranding({ ...branding, login_bg_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <div className="flex items-center gap-3">
              {branding.logo_url ? (
                <div className="relative">
                  <img src={branding.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded border border-gray-200 bg-gray-50" />
                  <button
                    onClick={() => setBranding(prev => ({ ...prev, logo_url: '' }))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-12 w-12 rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload('logo_url', e.target.files[0])}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {branding.logo_url ? 'Change Logo' : 'Upload Logo'}
                </button>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG · stored in DB</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Favicon</label>
            <div className="flex items-center gap-3">
              {branding.favicon_url ? (
                <div className="relative">
                  <img src={branding.favicon_url} alt="Favicon" className="h-12 w-12 object-contain rounded border border-gray-200 bg-gray-50" />
                  <button
                    onClick={() => setBranding(prev => ({ ...prev, favicon_url: '' }))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-12 w-12 rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/*,.ico"
                  className="hidden"
                  onChange={(e) => handleImageUpload('favicon_url', e.target.files[0])}
                />
                <button
                  onClick={() => faviconInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {branding.favicon_url ? 'Change Favicon' : 'Upload Favicon'}
                </button>
                <p className="text-xs text-gray-400 mt-1">ICO, PNG · shown in browser tab</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </button>
          <button
            onClick={handlePushBranding}
            disabled={pushing}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            data-testid="push-branding-btn"
          >
            {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
            Save & Push Branding
          </button>
        </div>
      </div>

      {/* Branding Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Preview: {branding.company_name || 'Client'} Login Page</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div 
              className="p-8"
              style={{ backgroundColor: branding.login_bg_color || '#0f1117' }}
            >
              <div className="max-w-sm mx-auto bg-white rounded-lg p-8 shadow-xl">
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt="Logo" className="h-12 mx-auto mb-4" />
                ) : (
                  <div className="h-12 w-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: branding.primary_color }}>
                    <span className="text-white font-bold">{branding.company_name?.[0] || 'C'}</span>
                  </div>
                )}
                <h2 className="text-xl font-bold text-center text-gray-900">{branding.company_name || 'Company Name'}</h2>
                <p className="text-center text-gray-500 mb-6">{branding.sidebar_label || 'ERP System'}</p>
                <div className="space-y-4">
                  <input type="text" placeholder="Email" className="w-full px-3 py-2 border rounded" />
                  <input type="password" placeholder="Password" className="w-full px-3 py-2 border rounded" />
                  <button 
                    className="w-full py-2 rounded text-white font-medium"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
