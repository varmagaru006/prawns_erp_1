import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API, BACKEND_URL, useAuth } from '../context/AuthContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Download, Eye, Check, Trash2, Send, FileText, X, FileSpreadsheet, Lock, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSortableTable } from '../hooks/useSortableTable';
import SortableTableHead from '../components/SortableTableHead';

function formatFastApiDetail(detail) {
  if (detail == null) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x) => (typeof x === 'string' ? x : x?.msg || JSON.stringify(x)))
      .join('; ');
  }
  if (typeof detail === 'object') return JSON.stringify(detail);
  return String(detail);
}

async function parseAxiosBlobError(data) {
  if (!(data instanceof Blob)) return null;
  const text = await data.text();
  try {
    const parsed = JSON.parse(text);
    return formatFastApiDetail(parsed.detail) || text.slice(0, 300);
  } catch {
    return text.slice(0, 300) || null;
  }
}

const DEFAULT_PURCHASE_INVOICE_FILTERS = {
  from_date: '',
  to_date: '',
  payment_status: '',
  invoice_status: '',
  agent_name: '',
  party_name: '',
  search: ''
};

const PurchaseInvoices = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEnabled, loading: featureLoading } = useFeatureFlags();
  
  const [invoices, setInvoices] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [riskInsights, setRiskInsights] = useState(null);
  const [riskBadgeMap, setRiskBadgeMap] = useState({ farmer: {}, party: {}, agent: {} });
  const [loading, setLoading] = useState(true);
  const [agentOptions, setAgentOptions] = useState([]);
  const [partyOptions, setPartyOptions] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_PURCHASE_INVOICE_FILTERS }));
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 0
  });
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [weighmentLightboxOpen, setWeighmentLightboxOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushInvoiceId, setPushInvoiceId] = useState(null);
  const [applyDigitalSignature, setApplyDigitalSignature] = useState(false);
  const [fraudFeedback, setFraudFeedback] = useState('');
  const [pushing, setPushing] = useState(false);
  const [activeInvoiceSubTab, setActiveInvoiceSubTab] = useState('pending');

  // Sortable table hook
  const { sortedData: sortedInvoices, requestSort, getSortIcon } = useSortableTable(invoices, {
    key: 'invoice_date',
    direction: 'desc'
  });

  const subTabCounts = metrics?.sub_tab_counts;
  const pendingTabCount = subTabCounts?.pending ?? 0;
  const pushedTabCount = subTabCounts?.pushed ?? 0;
  const auditTabCount = subTabCounts?.audit ?? 0;

  // Compute isDashboardEnabled directly from isEnabled to ensure reactivity
  // If features are still loading, default to showing features enabled
  const isDashboardEnabled = featureLoading ? true : isEnabled('purchaseInvoiceDashboard');

  useEffect(() => {
    fetchInvoices();
  }, [filters, pagination.page, pagination.per_page, isDashboardEnabled, activeInvoiceSubTab]);

  useEffect(() => {
    fetchFilterOptions();
    fetchRiskInsights();
  }, []);

  const goToInvoiceSubTab = (tab) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setActiveInvoiceSubTab(tab);
  };

  const fetchFilterOptions = async () => {
    try {
      const res = await axios.get(`${API}/purchase-invoices/filter-options`);
      setAgentOptions(Array.isArray(res.data?.agents) ? res.data.agents : []);
      setPartyOptions(Array.isArray(res.data?.parties) ? res.data.parties : []);
    } catch (error) {
      setAgentOptions([]);
      setPartyOptions([]);
    }
  };

  const fetchRiskInsights = async () => {
    try {
      const [res, listRes] = await Promise.all([
        axios.get(`${API}/purchase-risk-alerts/insights`),
        axios.get(`${API}/purchase-risk-alerts`, { params: { is_active: true } }).catch(() => ({ data: [] })),
      ]);
      setRiskInsights(res.data || null);
      const rank = { info: 1, warning: 2, critical: 3 };
      const maps = { farmer: {}, party: {}, agent: {} };
      (Array.isArray(listRes.data) ? listRes.data : []).forEach((r) => {
        const sev = (r.severity || 'warning').toLowerCase();
        const apply = (bucket, key) => {
          const k = (key || '').trim().toLowerCase();
          if (!k) return;
          const prev = maps[bucket][k] || 'info';
          if ((rank[sev] || 0) >= (rank[prev] || 0)) maps[bucket][k] = sev;
        };
        apply('farmer', r.farmer_name);
        apply('party', r.party_name);
        apply('agent', r.agent_name);
      });
      setRiskBadgeMap(maps);
    } catch (error) {
      setRiskInsights(null);
      setRiskBadgeMap({ farmer: {}, party: {}, agent: {} });
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    setMetrics(null); // Clear so stats cards don't show stale numbers while refetching with new filters
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        per_page: pagination.per_page
      });
      // Include all filters so list and metrics both use date, search, payment status, invoice status
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.payment_status) params.append('payment_status', filters.payment_status);
      if (filters.invoice_status) params.append('invoice_status', filters.invoice_status);
      if (filters.agent_name) params.append('agent_name', filters.agent_name.trim());
      if (filters.party_name) params.append('party_name', filters.party_name.trim());
      if (filters.search && filters.search.trim()) params.append('search', filters.search.trim());
      params.append('list_sub_tab', activeInvoiceSubTab);

      const response = await axios.get(`${API}/purchase-invoices?${params}`);
      setInvoices(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        pages: response.data.pages
      }));
      // Prefer metrics from list response (same query = cards match table); fallback to metrics API if backend is older
      if (response.data.metrics != null) {
        setMetrics(response.data.metrics);
      } else if (isDashboardEnabled) {
        try {
          const metricsRes = await axios.get(`${API}/purchase-invoices/metrics?${params}`);
          setMetrics(metricsRes.data);
        } catch (e) {
          console.error('Failed to load metrics', e);
          setMetrics(null);
        }
      } else {
        setMetrics(null);
      }
    } catch (error) {
      const detail = formatFastApiDetail(error.response?.data?.detail);
      const msg = detail ? `Failed to load invoices: ${detail}` : 'Failed to load invoices';
      console.error('purchase-invoices list failed', error.response?.status, error.response?.data || error.message);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setFilters({ ...DEFAULT_PURCHASE_INVOICE_FILTERS });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const setQuickFilter = (type) => {
    const today = new Date();
    let from_date = '';
    
    if (type === 'today') {
      from_date = today.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, from_date, to_date: from_date }));
    } else if (type === 'week') {
      const weekAgo = new Date(today.setDate(today.getDate() - 7));
      from_date = weekAgo.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, from_date, to_date: new Date().toISOString().split('T')[0] }));
    } else if (type === 'month') {
      const monthAgo = new Date(today.setMonth(today.getMonth() - 1));
      from_date = monthAgo.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, from_date, to_date: new Date().toISOString().split('T')[0] }));
    }
  };

  const handleDelete = async (invoiceId) => {
    if (!window.confirm('Delete this draft invoice?')) return;
    
    try {
      await axios.delete(`${API}/purchase-invoices/${invoiceId}`);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete invoice');
    }
  };

  const handleApprove = async (invoiceId) => {
    if (!window.confirm('Approve and lock this invoice?')) return;
    
    try {
      await axios.post(`${API}/purchase-invoices/${invoiceId}/approve`);
      toast.success('Invoice approved');
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve invoice');
    }
  };

  const openPushModal = (invoiceId) => {
    setPushInvoiceId(invoiceId);
    setApplyDigitalSignature(false);
    setFraudFeedback('');
    setShowPushModal(true);
  };

  const handlePush = async () => {
    if (!pushInvoiceId) return;
    setPushing(true);
    try {
      const response = await axios.post(
        `${API}/purchase-invoices/${pushInvoiceId}/push-to-procurement`,
        {
          apply_digital_signature: user?.role === 'admin' ? applyDigitalSignature : false,
          fraud_feedback: user?.role === 'admin' && fraudFeedback.trim() ? fraudFeedback.trim() : undefined,
        }
      );
      const riskCreated = Number(response.data?.risk_alerts_created || 0);
      toast.success(
        `Pushed! Lot ${response.data.lot_number} created${applyDigitalSignature ? ' (digitally signed)' : ''}${riskCreated > 0 ? ` • ${riskCreated} fraud risk alert(s) created` : ''}`
      );
      setShowPushModal(false);
      setPushInvoiceId(null);
      setFraudFeedback('');
      fetchInvoices();
      fetchRiskInsights();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to push invoice');
    } finally {
      setPushing(false);
    }
  };

  const handleManualAuditToggle = async (invoiceId, isRecorded) => {
    try {
      await axios.patch(`${API}/purchase-invoices/${invoiceId}/manual-audit`, {
        is_manually_recorded: isRecorded
      });
      toast.success(isRecorded ? 'Marked as recorded' : 'Unmarked');
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update audit status');
    }
  };

  const downloadPDF = async (invoiceId, invoiceNo) => {
    if (!invoiceId) {
      toast.error('Missing invoice id — cannot download.');
      return;
    }
    try {
      // Keep download simple (same as earlier working behavior): blob on 2xx only.
      // Strict PDF sniffing caused false failures for some browsers / encodings / proxies.
      const response = await axios.get(
        `${API}/purchase-invoices/${encodeURIComponent(String(invoiceId))}/pdf`,
        { responseType: 'blob' }
      );
      const blob =
        response.data instanceof Blob ? response.data : new Blob([response.data]);
      const ct = (response.headers['content-type'] || '').toLowerCase();
      // Rare: server returns JSON body with 200 — treat as error instead of downloading garbage.
      if (ct.includes('application/json') && blob.size < 65536) {
        const msg = await parseAxiosBlobError(blob);
        toast.error(msg || 'Download failed');
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeInvoiceNo = String(invoiceNo || invoiceId || 'purchase_invoice').replace(/\//g, '_');
      link.setAttribute('download', `invoice_${safeInvoiceNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      let detail =
        (typeof data === 'object' && data && !(data instanceof Blob)
          ? formatFastApiDetail(data.detail)
          : null) ||
        (await parseAxiosBlobError(data)) ||
        error?.message ||
        'Failed to download PDF';
      if (status && !String(detail).includes(String(status))) {
        detail = `${detail} (HTTP ${status})`;
      }
      toast.error(detail);
    }
  };

  const openPreview = async (invoice) => {
    try {
      const response = await axios.get(`${API}/purchase-invoices/${invoice.id}`);
      setPreviewInvoice(response.data);
      setShowPreview(true);
    } catch (error) {
      toast.error('Failed to load invoice details');
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewInvoice(null);
    setWeighmentLightboxOpen(false);
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      // Build params same as list
      const params = new URLSearchParams();
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.payment_status) params.append('payment_status', filters.payment_status);
      if (filters.invoice_status) params.append('invoice_status', filters.invoice_status);
      if (filters.agent_name) params.append('agent_name', filters.agent_name.trim());
      if (filters.party_name) params.append('party_name', filters.party_name.trim());
      if (filters.search) params.append('search', filters.search);
      params.append('list_sub_tab', activeInvoiceSubTab);
      params.append('per_page', '10000'); // Get all

      const response = await axios.get(`${API}/purchase-invoices?${params}`);
      const data = response.data.data;

      if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Build CSV
      const headers = ['Invoice No', 'Date', 'Farmer Name', 'Mobile', 'Location', 'Driver Name', 'Seal No', 'Purchase Supervisor', 'Total Qty (kg)', 'Subtotal', 'TDS', 'Grand Total', 'Advance', 'Balance Due', 'Status', 'Manual Audit'];
      const rows = data.map(inv => [
        inv.invoice_no,
        inv.invoice_date,
        inv.farmer_name,
        inv.farmer_mobile || '',
        inv.farmer_location || '',
        inv.driver_name || '',
        inv.seal_no || '',
        inv.purchase_supervisor_name || '',
        inv.total_quantity_kg?.toFixed(3) || '0',
        inv.subtotal?.toFixed(2) || '0',
        inv.tds_amount?.toFixed(2) || '0',
        inv.grand_total?.toFixed(2) || '0',
        inv.advance_paid?.toFixed(2) || '0',
        inv.balance_due?.toFixed(2) || '0',
        inv.status || '',
        inv.is_manually_recorded ? 'Yes' : 'No'
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purchase_invoices_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Exported ${data.length} invoices to CSV`);
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.payment_status) params.append('payment_status', filters.payment_status);
      if (filters.invoice_status) params.append('invoice_status', filters.invoice_status);
      if (filters.agent_name) params.append('agent_name', filters.agent_name.trim());
      if (filters.party_name) params.append('party_name', filters.party_name.trim());
      if (filters.search) params.append('search', filters.search);
      params.append('list_sub_tab', activeInvoiceSubTab);
      params.append('per_page', '10000');

      const response = await axios.get(`${API}/purchase-invoices?${params}`);
      const data = response.data.data;

      if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Create simple HTML table for Excel
      const headers = ['Invoice No', 'Date', 'Farmer Name', 'Mobile', 'Location', 'Driver Name', 'Seal No', 'Purchase Supervisor', 'Total Qty (kg)', 'Subtotal', 'TDS', 'Grand Total', 'Advance', 'Balance Due', 'Status', 'Manual Audit'];
      let tableHTML = '<table border="1"><tr>' + headers.map(h => `<th style="background:#0d47a1;color:white;padding:8px">${h}</th>`).join('') + '</tr>';
      
      data.forEach(inv => {
        tableHTML += '<tr>';
        tableHTML += `<td>${inv.invoice_no || ''}</td>`;
        tableHTML += `<td>${inv.invoice_date || ''}</td>`;
        tableHTML += `<td>${inv.farmer_name || ''}</td>`;
        tableHTML += `<td>${inv.farmer_mobile || ''}</td>`;
        tableHTML += `<td>${inv.farmer_location || ''}</td>`;
        tableHTML += `<td>${inv.driver_name || ''}</td>`;
        tableHTML += `<td>${inv.seal_no || ''}</td>`;
        tableHTML += `<td>${inv.purchase_supervisor_name || ''}</td>`;
        tableHTML += `<td style="text-align:right">${inv.total_quantity_kg?.toFixed(3) || '0'}</td>`;
        tableHTML += `<td style="text-align:right">${inv.subtotal?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right">${inv.tds_amount?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right;font-weight:bold">${inv.grand_total?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right">${inv.advance_paid?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right;color:${inv.balance_due > 0 ? 'red' : 'green'}">${inv.balance_due?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td>${inv.status || ''}</td>`;
        tableHTML += `<td>${inv.is_manually_recorded ? 'Yes' : 'No'}</td>`;
        tableHTML += '</tr>';
      });
      tableHTML += '</table>';

      const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purchase_invoices_${new Date().toISOString().split('T')[0]}.xls`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Exported ${data.length} invoices to Excel`);
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const getStatusChip = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      approved: 'bg-green-100 text-green-800',
      pushed: 'bg-blue-100 text-blue-800'
    };
    const icons = {
      draft: '📝',
      approved: '✅',
      pushed: '🚀'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentChip = (status) => {
    const styles = {
      pending: 'bg-red-100 text-red-800',
      partial: 'bg-amber-100 text-amber-800',
      paid: 'bg-green-100 text-green-800'
    };
    const icons = {
      pending: '⏳',
      partial: '🔶',
      paid: '✅'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getSignatureChip = (invoice) => {
    const hasSignature = !!invoice?.digital_signature_value_b64;
    if (!hasSignature) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          Unsigned
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        Digitally Signed
      </span>
    );
  };

  return (
    <div className="w-full min-w-0 max-w-full px-2 py-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Material Purchase</h1>
          <p className="text-gray-600">Manage purchase records and push to lots</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
          {isDashboardEnabled && (
            <>
              <Button
                variant="outline"
                onClick={exportToCSV}
                disabled={exporting}
                data-testid="export-csv-btn"
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={exportToExcel}
                disabled={exporting}
                data-testid="export-excel-btn"
                className="w-full sm:w-auto"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </>
          )}
          <Button
            onClick={() => navigate('/purchase-invoices/create')}
            data-testid="create-invoice-btn"
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Purchase
          </Button>
        </div>
      </div>

      {/* Feature Disabled Banner */}
      {!isDashboardEnabled && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Dashboard Features Disabled</p>
                <p className="text-sm text-amber-700">Metrics dashboard, quick preview, and bulk export are disabled. Contact your administrator to enable the Purchase Invoice Dashboard feature.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Button variant="outline" onClick={() => setQuickFilter('today')}>Today</Button>
            <Button variant="outline" onClick={() => setQuickFilter('week')}>This Week</Button>
            <Button variant="outline" onClick={() => setQuickFilter('month')}>This Month</Button>
            
            <Input
              type="date"
              placeholder="From Date"
              value={filters.from_date}
              onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
            />
            <Input
              type="date"
              placeholder="To Date"
              value={filters.to_date}
              onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
            />
            <Input
              placeholder="Search farmer/invoice..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <select
              value={filters.agent_name}
              onChange={(e) => setFilters({ ...filters, agent_name: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              <option value="">All Agents</option>
              {agentOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={filters.party_name}
              onChange={(e) => setFilters({ ...filters, party_name: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              <option value="">All Parties</option>
              {partyOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={filters.payment_status}
              onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              <option value="">All Payment Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <select
              value={filters.invoice_status}
              onChange={(e) => setFilters({ ...filters, invoice_status: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              <option value="">All Invoice Status</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="pushed">Pushed</option>
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="sm" onClick={clearAllFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear all filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Dashboard - Only shown when feature is enabled */}
      {isDashboardEnabled && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filtered Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{metrics.total_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filtered Kg Purchased</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{(metrics.total_quantity_kg ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 3 })} kg</div>
              <div className="text-xs text-gray-500">Same filters and sub-tab as the table; sum of Total Qty (kg)</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filtered Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{metrics.total_value.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filtered Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">₹{(metrics.partial_total ?? 0).toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500">{metrics.partial_count ?? 0} invoices</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filtered Advances Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{(metrics.advances_paid_total ?? metrics.paid_total ?? 0).toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500">Total advance in filter · {(metrics.advances_paid_count ?? metrics.paid_count ?? 0)} with advance</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices Table */}
      {riskInsights && (
        <Card className="mb-6 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Area Risk Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-2">
              Active caution alerts: <span className="font-semibold text-amber-700">{riskInsights.total_active_alerts ?? 0}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(riskInsights.areas || []).slice(0, 6).map((row) => (
                <div key={row.area_name} className="rounded border bg-amber-50 px-3 py-2 text-sm">
                  <p className="font-medium text-gray-900">{row.area_name || 'Unspecified'}</p>
                  <p className="text-gray-700">Total alerts: {row.total_alerts || row.total_comments || 0}</p>
                  <p className="text-red-700">Critical alerts: {row.high_alerts || row.critical_last_90_days || 0}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={activeInvoiceSubTab === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => goToInvoiceSubTab('pending')}
            >
              Pending Invoices ({pendingTabCount})
            </Button>
            <Button
              variant={activeInvoiceSubTab === 'pushed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => goToInvoiceSubTab('pushed')}
            >
              Pushed Invoices ({pushedTabCount})
            </Button>
            <Button
              variant={activeInvoiceSubTab === 'audit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => goToInvoiceSubTab('audit')}
            >
              Audit Book Recorded ({auditTabCount})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Invoice No" sortKey="invoice_no" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Date" sortKey="invoice_date" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Farmer Name" sortKey="farmer_name" onSort={requestSort} getSortIcon={getSortIcon} />
                <TableHead>Mobile</TableHead>
                <SortableTableHead label="Party" sortKey="party_name_text" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Short Code" sortKey="party_short_code" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Location" sortKey="farmer_location" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Driver" sortKey="driver_name" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Seal No" sortKey="seal_no" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Supervisor" sortKey="purchase_supervisor_name" onSort={requestSort} getSortIcon={getSortIcon} />
                <SortableTableHead label="Total Qty (kg)" sortKey="total_quantity_kg" onSort={requestSort} getSortIcon={getSortIcon} className="text-right" />
                <SortableTableHead label="Grand Total" sortKey="grand_total" onSort={requestSort} getSortIcon={getSortIcon} className="text-right" />
                <SortableTableHead label="Advance Paid" sortKey="advance_paid" onSort={requestSort} getSortIcon={getSortIcon} className="text-right" />
                <SortableTableHead label="Balance Due" sortKey="balance_due" onSort={requestSort} getSortIcon={getSortIcon} className="text-right" />
                <SortableTableHead label="Status" sortKey="status" onSort={requestSort} getSortIcon={getSortIcon} />
                <TableHead>Signature</TableHead>
                <TableHead>Audit Book</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={18} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : sortedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={18} className="text-center text-gray-500">
                    No invoices found in this sub-tab
                  </TableCell>
                </TableRow>
              ) : (
                sortedInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoice_no}</TableCell>
                    <TableCell>{invoice.invoice_date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{invoice.farmer_name}</span>
                        {(() => {
                          const sev = riskBadgeMap.farmer[(invoice.farmer_name || '').trim().toLowerCase()];
                          if (!sev) return null;
                          return (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              sev === 'critical' ? 'bg-red-100 text-red-700' : sev === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {sev}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.farmer_mobile ? (
                        <a href={`tel:${invoice.farmer_mobile}`} className="text-blue-600 hover:underline">
                          {invoice.farmer_mobile}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{invoice.party_name_text || '-'}</span>
                        {(() => {
                          const sev = riskBadgeMap.party[(invoice.party_name_text || '').trim().toLowerCase()];
                          if (!sev) return null;
                          return (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              sev === 'critical' ? 'bg-red-100 text-red-700' : sev === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {sev}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.party_short_code ? (
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                          {invoice.party_short_code}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{invoice.farmer_location || '-'}</TableCell>
                    <TableCell>{invoice.driver_name || '-'}</TableCell>
                    <TableCell>{invoice.seal_no || '-'}</TableCell>
                    <TableCell>{invoice.purchase_supervisor_name || '-'}</TableCell>
                    <TableCell className="text-right">{invoice.total_quantity_kg?.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-medium">₹{invoice.grand_total?.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right font-medium text-green-700">₹{(invoice.advance_paid ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className={`text-right font-medium ${invoice.balance_due > 0 ? 'text-red-600' : ''}`}>
                      ₹{invoice.balance_due?.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>{getStatusChip(invoice.status)}</TableCell>
                    <TableCell>{getSignatureChip(invoice)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleManualAuditToggle(invoice.id, !invoice.is_manually_recorded)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.is_manually_recorded 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {invoice.is_manually_recorded ? '✅ Recorded' : '⬜ Pending'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isDashboardEnabled && (
                          <Button size="sm" variant="outline" onClick={() => openPreview(invoice)} title="Quick Preview" data-testid="preview-btn">
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        {(invoice.status === 'draft' || user?.role === 'admin') && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/purchase-invoices/edit/${invoice.id}`)}>
                              Edit
                            </Button>
                            {invoice.status === 'draft' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleApprove(invoice.id)}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(invoice.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                        {invoice.status === 'approved' && (
                          <Button size="sm" variant="outline" onClick={() => openPushModal(invoice.id)}>
                            <Send className="h-3 w-3 mr-1" />
                            Push
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => downloadPDF(invoice.id, invoice.invoice_no)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} invoices
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <span className="px-3 py-2 text-sm">Page {pagination.page} of {pagination.pages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Preview Slide-over Panel - Only shown when feature is enabled */}
      {isDashboardEnabled && showPreview && previewInvoice && (
        <div className="fixed inset-0 z-50 overflow-hidden" data-testid="quick-preview-panel">
          <div className="absolute inset-0 bg-black/50" onClick={closePreview}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl transform transition-transform">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <div>
                  <h2 className="text-xl font-bold text-blue-900">Invoice Preview</h2>
                  <p className="text-sm text-blue-700 font-mono">{previewInvoice.invoice_no}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={closePreview}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status & Payment */}
                <div className="flex gap-3">
                  {getStatusChip(previewInvoice.status)}
                  {getPaymentChip(previewInvoice.payment_status)}
                  {getSignatureChip(previewInvoice)}
                  {previewInvoice.is_manually_recorded && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      ✅ Audit Recorded
                    </span>
                  )}
                </div>

                {/* Farmer Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-3">Farmer Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Name:</span>
                      <p className="font-medium">{previewInvoice.farmer_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Mobile:</span>
                      <p className="font-medium">
                        {previewInvoice.farmer_mobile ? (
                          <a href={`tel:${previewInvoice.farmer_mobile}`} className="text-blue-600 hover:underline">
                            {previewInvoice.farmer_mobile}
                          </a>
                        ) : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <p className="font-medium">{previewInvoice.farmer_location || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Agent/Ref:</span>
                      <p className="font-medium">{previewInvoice.agent_ref_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Weighment Slip:</span>
                      <p className="font-medium">{previewInvoice.weighment_slip_no || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>
                      <p className="font-medium">{previewInvoice.invoice_date}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Driver Name:</span>
                      <p className="font-medium">{previewInvoice.driver_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Seal No:</span>
                      <p className="font-medium">{previewInvoice.seal_no || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Supervisor:</span>
                      <p className="font-medium">{previewInvoice.purchase_supervisor_name || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Weighment slip attachment */}
                {previewInvoice.weighment_slip_file_url && (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Weighment slip</h3>
                    <p className="text-xs text-gray-500 mb-3">Compressed scan/photo (opens larger on click)</p>
                    <button
                      type="button"
                      className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-md"
                      onClick={() => setWeighmentLightboxOpen(true)}
                    >
                      <img
                        src={`${BACKEND_URL}${previewInvoice.weighment_slip_file_url}`}
                        alt="Weighment slip"
                        className="max-h-56 w-full rounded-md border object-contain bg-gray-50"
                      />
                    </button>
                    <a
                      href={`${BACKEND_URL}${previewInvoice.weighment_slip_file_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                    >
                      Open full size in new tab
                    </a>
                  </div>
                )}

                {/* Line Items */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Line Items</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Variety</th>
                          <th className="px-3 py-2 text-left">Count</th>
                          <th className="px-3 py-2 text-right">Packing Trays</th>
                          <th className="px-3 py-2 text-right">Qty (kg)</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewInvoice.line_items?.map((line, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{line.line_no}</td>
                            <td className="px-3 py-2">{line.variety}</td>
                            <td className="px-3 py-2">{line.count_value || '-'}</td>
                            <td className="px-3 py-2 text-right">{line.packing_trays_packed ?? '-'}</td>
                            <td className="px-3 py-2 text-right">{line.quantity_kg?.toFixed(3)}</td>
                            <td className="px-3 py-2 text-right">₹{line.rate?.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-medium">₹{line.amount?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-3">Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Quantity:</span>
                      <span className="font-medium">{previewInvoice.total_quantity_kg?.toFixed(3)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">₹{previewInvoice.subtotal?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-blue-700">
                      <span>TDS @ {previewInvoice.tds_rate_pct}%:</span>
                      <span className="font-medium">-₹{previewInvoice.tds_amount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Rounded Off:</span>
                      <span className="font-medium">₹{previewInvoice.rounded_off?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-lg font-bold">
                      <span>Grand Total:</span>
                      <span className="text-green-700">₹{previewInvoice.grand_total?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span>Advance Paid:</span>
                      <span className="font-medium">₹{previewInvoice.advance_paid?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Balance Due:</span>
                      <span className={`font-bold ${previewInvoice.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{previewInvoice.balance_due?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {previewInvoice.notes && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Notes</h3>
                    <p className="text-sm text-gray-600">{previewInvoice.notes}</p>
                  </div>
                )}

                {/* Digital Signature */}
                {previewInvoice.digital_signature_value_b64 && (
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <h3 className="font-semibold text-emerald-800 mb-2">Digital Signature</h3>
                    <div className="text-sm text-emerald-900 space-y-1">
                      <p><span className="font-medium">Algorithm:</span> {previewInvoice.digital_signature_algo || 'N/A'}</p>
                      <p><span className="font-medium">Signed By:</span> {previewInvoice.digital_signature_signed_by || 'N/A'}</p>
                      <p><span className="font-medium">Signed At:</span> {previewInvoice.digital_signature_signed_at || 'N/A'}</p>
                      <p className="break-all"><span className="font-medium">Payload Hash:</span> {previewInvoice.digital_signature_payload_hash_sha256 || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t bg-gray-50 flex gap-2 justify-end">
                {(previewInvoice.status === 'draft' || user?.role === 'admin') && (
                  <Button variant="outline" onClick={() => navigate(`/purchase-invoices/edit/${previewInvoice.id}`)}>
                    Edit Invoice
                  </Button>
                )}
                <Button onClick={() => downloadPDF(previewInvoice.id, previewInvoice.invoice_no)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={weighmentLightboxOpen} onOpenChange={setWeighmentLightboxOpen}>
        <DialogContent className="max-w-[min(96vw,56rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weighment slip</DialogTitle>
          </DialogHeader>
          {previewInvoice?.weighment_slip_file_url && (
            <img
              src={`${BACKEND_URL}${previewInvoice.weighment_slip_file_url}`}
              alt="Weighment slip full size"
              className="w-full max-h-[75vh] object-contain rounded-md bg-gray-50"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Push Confirmation Modal */}
      <Dialog open={showPushModal} onOpenChange={(open) => {
        if (!pushing) {
          setShowPushModal(open);
          if (!open) {
            setPushInvoiceId(null);
            setApplyDigitalSignature(false);
            setFraudFeedback('');
          }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Push Invoice to Procurement</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              This will lock workflow for this invoice and create the procurement lot.
            </p>

            {user?.role === 'admin' && (
              <div className="space-y-3 rounded-md border p-3 bg-gray-50">
                <div className="flex items-start gap-3">
                  <input
                    id="apply-digital-signature"
                    type="checkbox"
                    checked={applyDigitalSignature}
                    onChange={(e) => setApplyDigitalSignature(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <Label htmlFor="apply-digital-signature" className="font-medium">
                      Apply digital signature to invoice PDF
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Optional. If unchecked, this invoice will not get a cryptographic seal, and the company
                      signature image from settings will not appear on the PDF footer for this pushed invoice.
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="fraud-feedback" className="font-medium">
                    Fraud feedback (optional)
                  </Label>
                  <Textarea
                    id="fraud-feedback"
                    value={fraudFeedback}
                    onChange={(e) => setFraudFeedback(e.target.value)}
                    placeholder="If you suspect fraud, add feedback here. On push, linked critical risk alerts will be auto-created for farmer, party, agent, and purchase supervisor."
                    className="mt-2 min-h-[90px]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    When filled, this note auto-creates fraud alerts in Risk Alerts tab for all related parties.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={pushing}
                onClick={() => {
                  setShowPushModal(false);
                  setPushInvoiceId(null);
                  setApplyDigitalSignature(false);
                  setFraudFeedback('');
                }}
              >
                Cancel
              </Button>
              <Button disabled={pushing} onClick={handlePush}>
                {pushing ? 'Pushing...' : 'Confirm Push'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseInvoices;
