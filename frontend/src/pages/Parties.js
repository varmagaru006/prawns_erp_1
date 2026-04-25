import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users, X } from 'lucide-react';
import { useSortableTable } from '../hooks/useSortableTable';
import SortableTableHead from '../components/SortableTableHead';
import RiskTimelinePanel from '../components/RiskTimelinePanel';

const Parties = () => {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showRiskDrawer, setShowRiskDrawer] = useState(false);
  const [riskParty, setRiskParty] = useState(null);
  const [editingParty, setEditingParty] = useState(null);
  const [insights, setInsights] = useState(null);
  const [riskByParty, setRiskByParty] = useState({});
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

  // Add sorting hook
  const { sortedData, requestSort, getSortIcon } = useSortableTable(parties, {
    key: 'party_name',
    direction: 'asc'
  });

  useEffect(() => {
    fetchParties();
  }, [search]);

  const fetchParties = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const [partiesRes, insightsRes] = await Promise.all([
        axios.get(`${API}/parties?${params}`, { timeout: 10000 }),
        axios.get(`${API}/parties/insights`, { timeout: 10000 }),
      ]);
      let riskRows = [];
      try {
        const riskRes = await axios.get(`${API}/purchase-risk-alerts`, { params: { is_active: true } });
        riskRows = Array.isArray(riskRes.data) ? riskRes.data : [];
      } catch (_err) {
        riskRows = [];
      }
      const partyRows = partiesRes.data || [];
      const byParty = insightsRes.data?.by_party || [];
      const kgMap = new Map(byParty.map((x) => [x.party_id, x.fy_kg || 0]));
      const merged = partyRows.map((p) => ({
        ...p,
        fy_kg_provided: kgMap.get(p.id) || 0,
      }));
      setParties(merged);
      setInsights(insightsRes.data || null);
      const sevRank = { info: 1, warning: 2, critical: 3 };
      const riskMap = {};
      riskRows.forEach((r) => {
        const k = (r.party_name || '').trim().toLowerCase();
        if (!k) return;
        const prev = riskMap[k] || 'info';
        const next = (r.severity || 'warning').toLowerCase();
        if ((sevRank[next] || 0) >= (sevRank[prev] || 0)) riskMap[k] = next;
      });
      setRiskByParty(riskMap);
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        toast.error('Request timed out');
      } else {
        toast.error('Failed to load parties');
      }
      setParties([]);
      setInsights(null);
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

  const openRiskDrawer = (party) => {
    setRiskParty(party);
    setShowRiskDrawer(true);
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
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Party Master</h1>
          <p className="text-gray-600">Manage suppliers and farmer parties</p>
        </div>
        <Button onClick={() => openDrawer()} data-testid="add-party-btn" className="w-full sm:w-auto">
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
          {insights && (
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-md border bg-blue-50 p-3">
                  <div className="text-xs text-blue-700">Current FY</div>
                  <div className="text-lg font-bold text-blue-900">{insights.fy}</div>
                </div>
                <div className="rounded-md border bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">KG Provided This FY</div>
                  <div className="text-lg font-bold text-emerald-900">{(insights.summary?.total_fy_kg || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg</div>
                </div>
                <div className="rounded-md border bg-indigo-50 p-3">
                  <div className="text-xs text-indigo-700">Top Performing Parties</div>
                  <div className="text-lg font-bold text-indigo-900">{insights.summary?.top_performing_count || 0}</div>
                </div>
                <div className="rounded-md border bg-amber-50 p-3">
                  <div className="text-xs text-amber-700">Parties Getting Away</div>
                  <div className="text-lg font-bold text-amber-900">{insights.summary?.declining_count || 0}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <h3 className="font-semibold text-sm mb-2">Top Performing Parties (FY KG)</h3>
                  {insights.top_performing_parties?.length ? (
                    <div className="space-y-1">
                      {insights.top_performing_parties.slice(0, 5).map((row, i) => (
                        <div key={row.party_id} className="flex justify-between text-sm">
                          <span>{i + 1}. {row.party_name}</span>
                          <span className="font-medium">{(row.fy_kg || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-sm text-gray-500">No FY supply data yet.</div>}
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="font-semibold text-sm mb-2">Parties Getting Away (90-day drop)</h3>
                  {insights.declining_parties?.length ? (
                    <div className="space-y-1">
                      {insights.declining_parties.slice(0, 5).map((row) => (
                        <div key={row.party_id} className="flex justify-between text-sm">
                          <span>{row.party_name}</span>
                          <span className="font-medium text-amber-700">-{row.drop_pct}% ({row.drop_kg} kg)</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-sm text-gray-500">No declining trend detected.</div>}
                </div>
              </div>
            </div>
          )}
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
                  <SortableTableHead 
                    label="Party Name" 
                    sortKey="party_name" 
                    onSort={requestSort} 
                    getSortIcon={getSortIcon} 
                  />
                  <TableHead>Risk</TableHead>
                  <SortableTableHead 
                    label="Alias" 
                    sortKey="party_alias" 
                    onSort={requestSort} 
                    getSortIcon={getSortIcon} 
                  />
                  <SortableTableHead 
                    label="Short Code" 
                    sortKey="short_code" 
                    onSort={requestSort} 
                    getSortIcon={getSortIcon} 
                  />
                  <SortableTableHead 
                    label="Mobile" 
                    sortKey="mobile" 
                    onSort={requestSort} 
                    getSortIcon={getSortIcon} 
                  />
                  <SortableTableHead 
                    label="FY KG Provided" 
                    sortKey="fy_kg_provided" 
                    onSort={requestSort} 
                    getSortIcon={getSortIcon} 
                    className="text-right"
                  />
                  <SortableTableHead 
                    label="Current FY Balance" 
                    sortKey="current_fy_balance" 
                    onSort={requestSort} 
                    getSortIcon={getSortIcon} 
                    className="text-right"
                  />
                  <SortableTableHead 
                    label="Status" 
                    sortKey="is_active" 
                    onSort={requestSort} 
                    getSortIcon={getSortIcon} 
                  />
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((party) => (
                  <TableRow key={party.id} data-testid={`party-row-${party.id}`}>
                    <TableCell className="font-medium">{party.party_name}</TableCell>
                    <TableCell>
                      {riskByParty[(party.party_name || '').trim().toLowerCase()] ? (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          riskByParty[(party.party_name || '').trim().toLowerCase()] === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : riskByParty[(party.party_name || '').trim().toLowerCase()] === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                        }`}>
                          {riskByParty[(party.party_name || '').trim().toLowerCase()]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">none</span>
                      )}
                    </TableCell>
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
                    <TableCell className="text-right font-medium text-indigo-700">
                      {(party.fy_kg_provided || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
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
                        <Button size="sm" variant="outline" onClick={() => openRiskDrawer(party)}>
                          Risk
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

      {showRiskDrawer && riskParty && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRiskDrawer(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
                <h2 className="text-xl font-bold text-amber-900">Risk - {riskParty.party_name}</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowRiskDrawer(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto">
                <RiskTimelinePanel entityType="party" entityName={riskParty.party_name} entityId={riskParty.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Parties;
