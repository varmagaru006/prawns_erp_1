import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, useAuth } from '../context/AuthContext';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';

const SEVERITY_STYLES = {
  info: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const RiskTimelinePanel = ({ entityType, entityName, areaName, entityId = null }) => {
  const { user } = useAuth();
  const canWrite = ['admin', 'owner', 'risk_reviewer'].includes((user?.role || '').toLowerCase());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [draft, setDraft] = useState({ note_text: '', severity: 'warning', category: 'other' });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ note_text: '', severity: 'warning', category: 'other' });

  const targetPayload = useMemo(() => {
    const payload = { entity_type: entityType, entity_id: entityId || null };
    if (entityType === 'party') payload.party_name = entityName;
    if (entityType === 'agent') payload.agent_name = entityName;
    if (entityType === 'farmer') payload.farmer_name = entityName;
    if (areaName) payload.area_name = areaName;
    return payload;
  }, [entityType, entityName, areaName, entityId]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/purchase-risk-alerts`, {
        params: { is_active: showOnlyActive ? true : undefined, search: search.trim() || undefined },
      });
      const all = Array.isArray(res.data) ? res.data : [];
      const mine = all.filter((r) => {
        if (entityType === 'party') return (r.party_name || '').toLowerCase() === (entityName || '').toLowerCase();
        if (entityType === 'agent') return (r.agent_name || '').toLowerCase() === (entityName || '').toLowerCase();
        return (r.farmer_name || '').toLowerCase() === (entityName || '').toLowerCase();
      });
      setRows(mine);
    } catch (_err) {
      setRows([]);
      toast.error('Failed to load risk timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!entityName) return;
    fetchRows();
  }, [entityName, search, showOnlyActive]);

  const filteredRows = useMemo(() => {
    if (!severityFilter) return rows;
    return rows.filter((x) => (x.severity || '') === severityFilter);
  }, [rows, severityFilter]);

  const createComment = async () => {
    if (!canWrite) return;
    if (!draft.note_text.trim()) {
      toast.error('Comment is required');
      return;
    }
    try {
      await axios.post(`${API}/purchase-risk-alerts`, { ...targetPayload, ...draft, note_text: draft.note_text.trim() });
      toast.success('Risk comment added');
      setDraft({ note_text: '', severity: 'warning', category: 'other' });
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add risk comment');
    }
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setEditDraft({ note_text: row.note_text || '', severity: row.severity || 'warning', category: row.category || 'other' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await axios.patch(`${API}/purchase-risk-alerts/${editingId}`, editDraft);
      toast.success('Risk comment updated');
      setEditingId(null);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update comment');
    }
  };

  const resolveRow = async (id, resolve) => {
    try {
      await axios.post(`${API}/purchase-risk-alerts/${id}/${resolve ? 'resolve' : 'reopen'}`, { reason: '' });
      toast.success(resolve ? 'Comment resolved' : 'Comment reopened');
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Search comments" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="h-10 rounded-md border px-2 text-sm" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">All severity</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <Button variant="outline" onClick={() => setShowOnlyActive((v) => !v)}>
            {showOnlyActive ? 'Showing Active' : 'Showing All'}
          </Button>
          <Button variant="outline" onClick={fetchRows}>Refresh</Button>
        </div>

        {canWrite && (
          <div className="mb-4 rounded border bg-blue-50 p-3">
            <p className="text-sm font-semibold text-blue-900 mb-2">Add comment</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input className="md:col-span-2" value={draft.note_text} onChange={(e) => setDraft((p) => ({ ...p, note_text: e.target.value }))} placeholder="Risk comment" />
              <select className="h-10 rounded-md border px-2 text-sm" value={draft.severity} onChange={(e) => setDraft((p) => ({ ...p, severity: e.target.value }))}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
              <select className="h-10 rounded-md border px-2 text-sm" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}>
                <option value="quality">quality</option>
                <option value="payment">payment</option>
                <option value="quantity_mismatch">quantity_mismatch</option>
                <option value="fraud_suspected">fraud_suspected</option>
                <option value="other">other</option>
              </select>
            </div>
            <Button className="mt-2" onClick={createComment}>Save Comment</Button>
          </div>
        )}

        <div className="space-y-2">
          {loading ? <div className="text-sm text-gray-500">Loading...</div> : filteredRows.length === 0 ? (
            <div className="text-sm text-gray-500">No risk comments found.</div>
          ) : filteredRows.map((row) => (
            <div key={row.id} className="rounded border p-3">
              {editingId === row.id ? (
                <div className="space-y-2">
                  <Input value={editDraft.note_text} onChange={(e) => setEditDraft((p) => ({ ...p, note_text: e.target.value }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select className="h-10 rounded-md border px-2 text-sm" value={editDraft.severity} onChange={(e) => setEditDraft((p) => ({ ...p, severity: e.target.value }))}>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                    <select className="h-10 rounded-md border px-2 text-sm" value={editDraft.category} onChange={(e) => setEditDraft((p) => ({ ...p, category: e.target.value }))}>
                      <option value="quality">quality</option>
                      <option value="payment">payment</option>
                      <option value="quantity_mismatch">quantity_mismatch</option>
                      <option value="fraud_suspected">fraud_suspected</option>
                      <option value="other">other</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${SEVERITY_STYLES[row.severity] || SEVERITY_STYLES.warning}`}>{(row.severity || 'warning').toUpperCase()}</span>
                    <span className="text-xs text-gray-600">{row.category || 'other'}</span>
                    <span className="text-xs text-gray-500">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</span>
                  </div>
                  <p className="mt-2 text-sm">{row.note_text}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span>By: {row.created_by_name || '-'}</span>
                    <span>Status: {row.resolved_at ? 'Resolved' : 'Open'}</span>
                  </div>
                  {canWrite && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                      {row.resolved_at ? (
                        <Button size="sm" variant="outline" onClick={() => resolveRow(row.id, false)}>Reopen</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => resolveRow(row.id, true)}>Resolve</Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RiskTimelinePanel;
