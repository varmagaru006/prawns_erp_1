import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Save, Building2, PenLine, Trash2, Upload } from 'lucide-react';

const BACKEND_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const CompanySettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);
  const [signatureImageUrl, setSignatureImageUrl] = useState('');
  const sigFileRef = useRef(null);
  const sigReplaceRef = useRef(null);
  const [settings, setSettings] = useState({
    company_name: '',
    company_address_1: '',
    company_address_2: '',
    company_phone: '',
    company_email: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/tenant-config`);
      const config = {};
      response.data.forEach(item => {
        config[item.key] = item.value;
      });
      
      setSettings({
        company_name: config.company_name || '',
        company_address_1: config.company_address_1 || '',
        company_address_2: config.company_address_2 || '',
        company_phone: config.company_phone || '',
        company_email: config.company_email || ''
      });
      setSignatureImageUrl(config.invoice_signature_image || '');
    } catch (error) {
      toast.error('Failed to load company settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSigUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API}/tenant-config/signature-image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSignatureImageUrl(data.url || '');
      toast.success('Signature image saved — it will appear on purchase invoice PDFs.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload signature');
    } finally {
      setSigUploading(false);
    }
  };

  const handleRemoveSignature = async () => {
    if (!signatureImageUrl) return;
    if (!window.confirm('Remove the signature image from invoice PDFs?')) return;
    setSigUploading(true);
    try {
      await axios.delete(`${API}/tenant-config/signature-image`);
      setSignatureImageUrl('');
      toast.success('Signature image removed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove signature');
    } finally {
      setSigUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each config value
      for (const [key, value] of Object.entries(settings)) {
        await axios.post(`${API}/tenant-config`, {
          key: key,
          value: value
        });
      }
      
      toast.success('Company settings saved successfully');
      
      // Reload page to reflect changes in header/invoices
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">Company Settings</h1>
        </div>
        <p className="text-gray-600">Manage company information displayed on invoices and documents</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Company Name *
              </label>
              <Input
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="Enter company name"
              />
              <p className="text-xs text-gray-500 mt-1">
                This name appears on all purchase invoices and documents
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Address Line 1 *
              </label>
              <Input
                value={settings.company_address_1}
                onChange={(e) => setSettings({ ...settings, company_address_1: e.target.value })}
                placeholder="Enter address line 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Address Line 2
              </label>
              <Input
                value={settings.company_address_2}
                onChange={(e) => setSettings({ ...settings, company_address_2: e.target.value })}
                placeholder="Enter address line 2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Contact Phone *
                </label>
                <Input
                  value={settings.company_phone}
                  onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Email ID *
                </label>
                <Input
                  type="email"
                  value={settings.company_email}
                  onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="border-t pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-slate-600" />
                <h3 className="text-sm font-semibold text-gray-800">Invoice signature (PDF)</h3>
              </div>
              <p className="text-sm text-gray-600">
                Upload a clear scan or photo of your signature. It is printed on purchase invoice PDFs with the date and time the PDF was generated (UTC). Only Admin or Owner can change this.
              </p>
              {signatureImageUrl ? (
                <div className="flex flex-wrap items-end gap-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 inline-block">
                    <img
                      src={`${BACKEND_BASE}${signatureImageUrl}`}
                      alt="Saved signature"
                      className="max-h-24 object-contain"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={sigReplaceRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleSignatureUpload}
                      disabled={sigUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sigUploading}
                      onClick={() => sigReplaceRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      {sigUploading ? 'Uploading…' : 'Replace'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleRemoveSignature} disabled={sigUploading}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={sigFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleSignatureUpload}
                    disabled={sigUploading}
                  />
                  <Button type="button" variant="outline" disabled={sigUploading} onClick={() => sigFileRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {sigUploading ? 'Uploading…' : 'Upload signature image'}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">ℹ️ Invoice Preview</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p className="font-bold text-lg">{settings.company_name || 'COMPANY NAME'}</p>
                <p>{settings.company_address_1 || 'Address Line 1'}</p>
                <p>{settings.company_address_2 || 'Address Line 2'}</p>
                <p>Contact Number: {settings.company_phone || 'Phone'}, Email Id: {settings.company_email || 'Email'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={fetchSettings}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h3 className="font-medium text-amber-900 mb-2">⚠️ Important Notes</h3>
        <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
          <li>These details appear on all purchase invoices and official documents</li>
          <li>Changes take effect immediately for new documents</li>
          <li>Existing invoices will not be updated</li>
          <li>Only Admin and Owner roles can modify these settings</li>
        </ul>
      </div>
    </div>
  );
};

export default CompanySettings;
