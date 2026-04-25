import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
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

const RiskAreaInsights = () => {
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [filters, setFilters] = useState({ from_date: ninetyDaysAgo, to_date: today, area_name: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/purchase-risk-alerts/insights`, { params: { ...filters, area_name: filters.area_name || undefined } });
      setData(res.data || null);
    } catch (_err) {
      toast.error('Failed to load area insights');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const rows = useMemo(() => (Array.isArray(data?.areas) ? data.areas : []), [data]);

  const exportCsv = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk_area_insights_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Area Risk Insights</h1>
        <p className="text-gray-600">Critical trends, top categories, and risky counterparties by area.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input type="date" value={filters.from_date} onChange={(e) => setFilters((p) => ({ ...p, from_date: e.target.value }))} />
            <Input type="date" value={filters.to_date} onChange={(e) => setFilters((p) => ({ ...p, to_date: e.target.value }))} />
            <Input placeholder="Area name (optional)" value={filters.area_name} onChange={(e) => setFilters((p) => ({ ...p, area_name: e.target.value }))} />
            <Button variant="outline" onClick={fetchInsights}>{loading ? 'Loading...' : 'Apply'}</Button>
            <Button onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Active Alerts</div><div className="text-2xl font-bold">{data?.total_active_alerts ?? 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Critical (Period)</div><div className="text-2xl font-bold text-red-700">{data?.critical_comments_last_90_days ?? 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Trend vs Previous</div><div className={`text-2xl font-bold ${(data?.trend_vs_previous_period ?? 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>{data?.trend_vs_previous_period ?? 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">Top Categories</div><div className="text-sm">{(data?.top_categories || []).map((x) => `${x.category} (${x.count})`).join(', ') || '-'}</div></CardContent></Card>
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
                {loading ? (
                  <tr><td className="p-3" colSpan={5}>Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td className="p-3 text-gray-500" colSpan={5}>No area insights.</td></tr>
                ) : rows.map((r) => (
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
    </div>
  );
};

export default RiskAreaInsights;
