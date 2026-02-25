import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Save, Building2 } from 'lucide-react';

const CompanySettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    } catch (error) {
      toast.error('Failed to load company settings');
    } finally {
      setLoading(false);
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
