import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users, X } from 'lucide-react';

const Parties = () => {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [formData, setFormData] = useState({
    party_name: '',
    party_alias: '',
    short_code: '',
    mobile: '',
    address: '',
    gst_number: '',
    pan_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchParties();
  }, [search]);

  const fetchParties = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const response = await axios.get(`${API}/parties?${params}`);
      setParties(response.data);
    } catch (error) {
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      party_name: '',
      party_alias: '',
      short_code: '',
      mobile: '',
      address: '',
      gst_number: '',
      pan_number: '',
      notes: ''
    });
    setEditingParty(null);
  };

  const openDrawer = (party = null) => {
    if (party) {
      setEditingParty(party);
      setFormData({
        party_name: party.party_name || '',
        party_alias: party.party_alias || '',
        short_code: party.short_code || '',
        mobile: party.mobile || '',
        address: party.address || '',
        gst_number: party.gst_number || '',
        pan_number: party.pan_number || '',
        notes: party.notes || ''
      });
    } else {
      resetForm();
    }
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.party_name.trim()) {
      toast.error('Party name is required');
      return;
    }

    try {
      if (editingParty) {
        await axios.put(`${API}/parties/${editingParty.id}`, formData);
        toast.success('Party updated successfully');
      } else {
        await axios.post(`${API}/parties`, formData);
        toast.success('Party created successfully');
      }
      closeDrawer();
      fetchParties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save party');
    }
  };

  const handleDelete = async (party) => {
    if (!window.confirm(`Are you sure you want to delete "${party.party_name}"?`)) return;
    
    try {
      await axios.delete(`${API}/parties/${party.id}`);
      toast.success('Party deleted');
      fetchParties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete party');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Party Master</h1>
          <p className="text-gray-600">Manage suppliers and farmer parties</p>
        </div>
        <Button onClick={() => openDrawer()} data-testid="add-party-btn">
          <Plus className="h-4 w-4 mr-2" />
          Add Party
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, alias, or short code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="party-search"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Party List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Parties ({parties.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : parties.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No parties found. Click "Add Party" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party Name</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>Short Code</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead className="text-right">Current FY Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parties.map((party) => (
                  <TableRow key={party.id} data-testid={`party-row-${party.id}`}>
                    <TableCell className="font-medium">{party.party_name}</TableCell>
                    <TableCell className="text-gray-600">{party.party_alias || '-'}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                        {party.short_code || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {party.mobile ? (
                        <a href={`tel:${party.mobile}`} className="text-blue-600 hover:underline">
                          {party.mobile}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={party.current_fy_balance > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(party.current_fy_balance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        party.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {party.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openDrawer(party)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(party)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden" data-testid="party-drawer">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
            <div className="h-full flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-xl font-bold text-blue-900">
                  {editingParty ? 'Edit Party' : 'Add Party'}
                </h2>
                <Button variant="ghost" size="sm" onClick={closeDrawer}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Drawer Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Party Name *</label>
                  <Input
                    value={formData.party_name}
                    onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                    placeholder="e.g. SAI RAM AQUA TRADERS"
                    data-testid="party-name-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Alias</label>
                  <Input
                    value={formData.party_alias}
                    onChange={(e) => setFormData({ ...formData, party_alias: e.target.value })}
                    placeholder="e.g. RAMA RAO GARU (shown in brackets)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Short Code</label>
                  <Input
                    value={formData.short_code}
                    onChange={(e) => setFormData({ ...formData, short_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SRAT (used in PAID TO column)"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mobile</label>
                  <Input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="Enter mobile number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter full address"
                    className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">GST Number</label>
                    <Input
                      value={formData.gst_number}
                      onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                      placeholder="GSTIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">PAN Number</label>
                    <Input
                      value={formData.pan_number}
                      onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                      placeholder="PAN"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes"
                    className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none"
                  />
                </div>

                {/* Drawer Footer */}
                <div className="pt-4 flex gap-2">
                  <Button type="button" variant="outline" onClick={closeDrawer} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" data-testid="save-party-btn">
                    {editingParty ? 'Update Party' : 'Create Party'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Parties;
