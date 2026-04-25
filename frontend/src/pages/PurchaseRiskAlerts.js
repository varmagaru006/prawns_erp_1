import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const toCsv = (rows) => {
  const headers = ['area_name', 'critical_last_90_days', 'total_comments', 'top_categories', 'risky_entities'];
  const body = rows.map((r) => [
    r.area_name || 'Unspecified',
    r.critical_last_90_days || 0,
    r.total_comments || 0,
    (r.top_categories || []).map((x) => `${x.category}:${x.count}`).join('; '),
    (r.risky_entities || []).slice(0, 5).map((x) => `${x.name}:${x.score}`).join('; '),
  ]);
  return [headers, ...body].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
};

const PurchaseRiskAlerts = () => {
  const { user } = useAuth();
  const isAdminUser = ['admin', 'owner', 'risk_reviewer'].includes((user?.role || '').toLowerCase());
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ note_text: '', severity: 'warning', category: 'other' });
  const [form, setForm] = useState({
    farmer_name: '',
    party_name: '',
    agent_name: '',
    purchase_supervisor_name: '',
    area_name: '',
    severity: 'warning',
    category: 'other',
    note_text: ''
  });
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [insightFilters, setInsightFilters] = useState({ from_date: ninetyDaysAgo, to_date: today, area_name: '' });
  const [insightData, setInsightData] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/purchase-risk-alerts`, {
        params: {
          is_active: showOnlyActive ? true : undefined,
          search: search.trim() || undefined
        }
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setAlerts(severityFilter ? rows.filter((x) => (x.severity || '') === severityFilter) : rows);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load risk alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [showOnlyActive, severityFilter]);

  const fetchInsights = async () => {
    setInsightLoading(true);
    try {
      const res = await axios.get(`${API}/purchase-risk-alerts/insights`, {
        params: { ...insightFilters, area_name: insightFilters.area_name || undefined }
      });
      setInsightData(res.data || null);
    } catch (_err) {
      toast.error('Failed to load area insights');
      setInsightData(null);
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    if (!insightData && !insightLoading) {
      fetchInsights();
    }
  }, []);

  const insightRows = useMemo(() => (Array.isArray(insightData?.areas) ? insightData.areas : []), [insightData]);

  const exportInsightsCsv = () => {
    const csv = toCsv(insightRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk_area_insights_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createAlert = async () => {
    if (!isAdminUser) return;
    if (!form.note_text.trim()) {
      toast.error('Alert note is required');
      return;
    }
    if (!form.farmer_name.trim() && !form.party_name.trim() && !form.agent_name.trim() && !form.purchase_supervisor_name.trim() && !form.area_name.trim()) {
      toast.error('At least one target is required');
      return;
    }
    try {
      await axios.post(`${API}/purchase-risk-alerts`, {
        farmer_name: form.farmer_name || null,
        party_name: form.party_name || null,
        agent_name: form.agent_name || null,
        purchase_supervisor_name: form.purchase_supervisor_name || null,
        area_name: form.area_name || null,
        note_text: form.note_text.trim(),
        category: form.category,
        severity: form.severity
      });
      toast.success('Risk alert created');
      setForm({
        farmer_name: '',
        party_name: '',
        agent_name: '',
        purchase_supervisor_name: '',
        area_name: '',
        severity: 'warning',
        category: 'other',
        note_text: ''
      });
      fetchAlerts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create risk alert');
    }
  };

  const setActive = async (id, is_active) => {
    if (!isAdminUser) return;
    try {
      await axios.patch(`${API}/purchase-risk-alerts/${id}/active`, { is_active });
      toast.success(is_active ? 'Alert reactivated' : 'Alert deactivated');
      fetchAlerts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update alert');
    }
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setEditDraft({
      note_text: row.note_text || '',
      severity: row.severity || 'warning',
      category: row.category || 'other',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await axios.patch(`${API}/purchase-risk-alerts/${editingId}`, editDraft);
      toast.success('Risk comment updated');
      setEditingId(null);
      fetchAlerts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update risk comment');
    }
  };

  const resolveToggle = async (id, resolved) => {
    try {
      await axios.post(`${API}/purchase-risk-alerts/${id}/${resolved ? 'reopen' : 'resolve'}`, { reason: '' });
      toast.success(resolved ? 'Comment reopened' : 'Comment resolved');
      fetchAlerts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update resolution');
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full px-2 py-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Purchase Risk Alerts</h1>
        <p className="text-gray-600">Manage caution notes and area risk trends in one continuous page.</p>
      </div>

      {isAdminUser && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Risk Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Farmer name (optional)" value={form.farmer_name} onChange={(e) => setForm((p) => ({ ...p, farmer_name: e.target.value }))} />
              <Input placeholder="Party name (optional)" value={form.party_name} onChange={(e) => setForm((p) => ({ ...p, party_name: e.target.value }))} />
              <Input placeholder="Agent name (optional)" value={form.agent_name} onChange={(e) => setForm((p) => ({ ...p, agent_name: e.target.value }))} />
              <Input placeholder="Purchase supervisor (optional)" value={form.purchase_supervisor_name} onChange={(e) => setForm((p) => ({ ...p, purchase_supervisor_name: e.target.value }))} />
              <Input placeholder="Area/location (optional)" value={form.area_name} onChange={(e) => setForm((p) => ({ ...p, area_name: e.target.value }))} />
              <select
                value={form.severity}
                onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="quality">quality</option>
                <option value="payment">payment</option>
                <option value="quantity_mismatch">quantity_mismatch</option>
                <option value="fraud_suspected">fraud_suspected</option>
                <option value="other">other</option>
              </select>
              <Input placeholder="Risk/caution note" value={form.note_text} onChange={(e) => setForm((p) => ({ ...p, note_text: e.target.value }))} />
            </div>
            <div className="mt-3">
              <Button onClick={createAlert}>Save Risk Alert</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Risk Alerts Master</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Search farmer/party/agent/supervisor/area/note" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">All severity</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <Button variant="outline" onClick={fetchAlerts}>Search</Button>
            <Button variant="outline" onClick={() => setShowOnlyActive((v) => !v)}>
              {showOnlyActive ? 'Showing Active Only' : 'Showing All'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2 text-left">Severity</th>
                  <th className="p-2 text-left">Farmer</th>
                  <th className="p-2 text-left">Party</th>
                  <th className="p-2 text-left">Agent</th>
                  <th className="p-2 text-left">Supervisor</th>
                  <th className="p-2 text-left">Area</th>
                  <th className="p-2 text-left">Note</th>
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Created By</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="p-3 text-center" colSpan={11}>Loading...</td></tr>
                ) : alerts.length === 0 ? (
                  <tr><td className="p-3 text-center text-gray-500" colSpan={11}>No alerts found</td></tr>
                ) : (
                  alerts.map((a) => (
                    <tr key={a.id} className="border-b">
                      <td className="p-2 font-medium uppercase">
                        <span className={`rounded px-2 py-1 text-xs ${
                          (a.severity || 'warning') === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : (a.severity || 'warning') === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                        }`}>
                          {a.severity || 'warning'}
                        </span>
                      </td>
                      <td className="p-2">{a.farmer_name || '-'}</td>
                      <td className="p-2">{a.party_name || '-'}</td>
                      <td className="p-2">{a.agent_name || '-'}</td>
                      <td className="p-2">{a.purchase_supervisor_name || '-'}</td>
                      <td className="p-2">{a.area_name || '-'}</td>
                      <td className="p-2">
                        {editingId === a.id ? (
                          <Input value={editDraft.note_text} onChange={(e) => setEditDraft((p) => ({ ...p, note_text: e.target.value }))} />
                        ) : a.note_text}
                      </td>
                      <td className="p-2">
                        {editingId === a.id ? (
                          <select value={editDraft.category} onChange={(e) => setEditDraft((p) => ({ ...p, category: e.target.value }))} className="h-9 rounded border px-2 text-xs">
                            <option value="quality">quality</option>
                            <option value="payment">payment</option>
                            <option value="quantity_mismatch">quantity_mismatch</option>
                            <option value="fraud_suspected">fraud_suspected</option>
                            <option value="other">other</option>
                          </select>
                        ) : (a.category || 'other')}
                      </td>
                      <td className="p-2">{a.resolved_at ? 'Resolved' : (a.is_active ? 'Active' : 'Inactive')}</td>
                      <td className="p-2">{a.created_by_name || '-'}</td>
                      <td className="p-2">
                        {isAdminUser && (
                          <div className="flex gap-2">
                            {editingId === a.id ? (
                              <>
                                <select value={editDraft.severity} onChange={(e) => setEditDraft((p) => ({ ...p, severity: e.target.value }))} className="h-9 rounded border px-2 text-xs">
                                  <option value="info">Info</option>
                                  <option value="warning">Warning</option>
                                  <option value="critical">Critical</option>
                                </select>
                                <Button size="sm" variant="outline" onClick={saveEdit}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openEdit(a)}>Edit</Button>
                                <Button size="sm" variant="outline" onClick={() => resolveToggle(a.id, Boolean(a.resolved_at))}>
                                  {a.resolved_at ? 'Reopen' : 'Resolve'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setActive(a.id, !a.is_active)}>
                                  {a.is_active ? 'Deactivate' : 'Reactivate'}
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <>
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-gray-800">Area Risk Insights</h2>
            <p className="text-sm text-gray-600">Area trends and risk concentration by period.</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Area Insight Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input type="date" value={insightFilters.from_date} onChange={(e) => setInsightFilters((p) => ({ ...p, from_date: e.target.value }))} />
                <Input type="date" value={insightFilters.to_date} onChange={(e) => setInsightFilters((p) => ({ ...p, to_date: e.target.value }))} />
                <Input placeholder="Area name (optional)" value={insightFilters.area_name} onChange={(e) => setInsightFilters((p) => ({ ...p, area_name: e.target.value }))} />
                <Button variant="outline" onClick={fetchInsights}>{insightLoading ? 'Loading...' : 'Apply'}</Button>
                <Button onClick={exportInsightsCsv} disabled={!insightRows.length}>Export CSV</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Active Alerts</div><div className="text-2xl font-bold">{insightData?.total_active_alerts ?? 0}</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Critical (Period)</div><div className="text-2xl font-bold text-red-700">{insightData?.critical_comments_last_90_days ?? 0}</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Trend vs Previous</div><div className={`text-2xl font-bold ${(insightData?.trend_vs_previous_period ?? 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>{insightData?.trend_vs_previous_period ?? 0}</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Top Categories</div><div className="text-sm">{(insightData?.top_categories || []).map((x) => `${x.category} (${x.count})`).join(', ') || '-'}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Area Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-2 text-left">Area</th>
                      <th className="p-2 text-left">Critical</th>
                      <th className="p-2 text-left">Total</th>
                      <th className="p-2 text-left">Top Categories</th>
                      <th className="p-2 text-left">Risky Farmers/Parties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insightLoading ? (
                      <tr><td className="p-3" colSpan={5}>Loading...</td></tr>
                    ) : insightRows.length === 0 ? (
                      <tr><td className="p-3 text-gray-500" colSpan={5}>No area insights.</td></tr>
                    ) : insightRows.map((r) => (
                      <tr key={r.area_name} className="border-b">
                        <td className="p-2 font-medium">{r.area_name || 'Unspecified'}</td>
                        <td className="p-2 text-red-700 font-semibold">{r.critical_last_90_days || 0}</td>
                        <td className="p-2">{r.total_comments || 0}</td>
                        <td className="p-2">{(r.top_categories || []).map((x) => `${x.category} (${x.count})`).join(', ') || '-'}</td>
                        <td className="p-2">{(r.risky_entities || []).slice(0, 5).map((x) => `${x.name} (${x.score})`).join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
      </>
    </div>
  );
};

export default PurchaseRiskAlerts;
