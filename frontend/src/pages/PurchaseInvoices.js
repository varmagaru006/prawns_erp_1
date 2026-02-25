import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Download, Eye, Check, Trash2, Send, FileText, X, FileSpreadsheet, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PurchaseInvoices = () => {
  const navigate = useNavigate();
  const { isEnabled, loading: featureLoading } = useFeatureFlags();
  
  const [invoices, setInvoices] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    payment_status: '',
    invoice_status: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 0
  });
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Compute isDashboardEnabled directly from isEnabled to ensure reactivity
  // If features are still loading, default to showing features enabled
  const isDashboardEnabled = featureLoading ? true : isEnabled('purchaseInvoiceDashboard');

  useEffect(() => {
    fetchInvoices();
    if (isDashboardEnabled) {
      fetchMetrics();
    }
  }, [filters, pagination.page, pagination.per_page, isDashboardEnabled]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        per_page: pagination.per_page
      });

      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.payment_status) params.append('payment_status', filters.payment_status);
      if (filters.invoice_status) params.append('invoice_status', filters.invoice_status);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(`${API}/purchase-invoices?${params}`);
      setInvoices(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        pages: response.data.pages
      }));
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.payment_status) params.append('payment_status', filters.payment_status);
      if (filters.invoice_status) params.append('invoice_status', filters.invoice_status);

      const response = await axios.get(`${API}/purchase-invoices/metrics?${params}`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to load metrics', error);
    }
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
      fetchMetrics();
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
      fetchMetrics();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve invoice');
    }
  };

  const handlePush = async (invoiceId) => {
    if (!window.confirm('Push this invoice to procurement?')) return;
    
    try {
      const response = await axios.post(`${API}/purchase-invoices/${invoiceId}/push-to-procurement`);
      toast.success(`Pushed! Lot ${response.data.lot_number} created`);
      fetchInvoices();
      fetchMetrics();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to push invoice');
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
    try {
      const response = await axios.get(`${API}/purchase-invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoiceNo.replace('/', '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download PDF');
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
      if (filters.search) params.append('search', filters.search);
      params.append('per_page', '10000'); // Get all

      const response = await axios.get(`${API}/purchase-invoices?${params}`);
      const data = response.data.data;

      if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Build CSV
      const headers = ['Invoice No', 'Date', 'Farmer Name', 'Mobile', 'Location', 'Total Qty (kg)', 'Subtotal', 'TDS', 'Grand Total', 'Advance', 'Balance Due', 'Payment Status', 'Status', 'Manual Audit'];
      const rows = data.map(inv => [
        inv.invoice_no,
        inv.invoice_date,
        inv.farmer_name,
        inv.farmer_mobile || '',
        inv.farmer_location || '',
        inv.total_quantity_kg?.toFixed(3) || '0',
        inv.subtotal?.toFixed(2) || '0',
        inv.tds_amount?.toFixed(2) || '0',
        inv.grand_total?.toFixed(2) || '0',
        inv.advance_paid?.toFixed(2) || '0',
        inv.balance_due?.toFixed(2) || '0',
        inv.payment_status || '',
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
      if (filters.search) params.append('search', filters.search);
      params.append('per_page', '10000');

      const response = await axios.get(`${API}/purchase-invoices?${params}`);
      const data = response.data.data;

      if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Create simple HTML table for Excel
      const headers = ['Invoice No', 'Date', 'Farmer Name', 'Mobile', 'Location', 'Total Qty (kg)', 'Subtotal', 'TDS', 'Grand Total', 'Advance', 'Balance Due', 'Payment Status', 'Status', 'Manual Audit'];
      let tableHTML = '<table border="1"><tr>' + headers.map(h => `<th style="background:#0d47a1;color:white;padding:8px">${h}</th>`).join('') + '</tr>';
      
      data.forEach(inv => {
        tableHTML += '<tr>';
        tableHTML += `<td>${inv.invoice_no || ''}</td>`;
        tableHTML += `<td>${inv.invoice_date || ''}</td>`;
        tableHTML += `<td>${inv.farmer_name || ''}</td>`;
        tableHTML += `<td>${inv.farmer_mobile || ''}</td>`;
        tableHTML += `<td>${inv.farmer_location || ''}</td>`;
        tableHTML += `<td style="text-align:right">${inv.total_quantity_kg?.toFixed(3) || '0'}</td>`;
        tableHTML += `<td style="text-align:right">${inv.subtotal?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right">${inv.tds_amount?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right;font-weight:bold">${inv.grand_total?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right">${inv.advance_paid?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td style="text-align:right;color:${inv.balance_due > 0 ? 'red' : 'green'}">${inv.balance_due?.toFixed(2) || '0'}</td>`;
        tableHTML += `<td>${inv.payment_status || ''}</td>`;
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Purchase Invoices</h1>
          <p className="text-gray-600">Manage procurement invoices and push to lots</p>
        </div>
        <div className="flex gap-2">
          {isDashboardEnabled && (
            <>
              <Button variant="outline" onClick={exportToCSV} disabled={exporting} data-testid="export-csv-btn">
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" onClick={exportToExcel} disabled={exporting} data-testid="export-excel-btn">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </>
          )}
          <Button onClick={() => navigate('/purchase-invoices/create')} data-testid="create-invoice-btn">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
        </CardContent>
      </Card>

      {/* Metrics Dashboard - Only shown when feature is enabled */}
      {isDashboardEnabled && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{metrics.total_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{metrics.total_value.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending ⏳</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₹{metrics.pending_total.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500">{metrics.pending_count} invoices</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Partial 🔶</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">₹{metrics.partial_total.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500">{metrics.partial_count} invoices</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Paid ✅</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{metrics.paid_total.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500">{metrics.paid_count} invoices</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Farmer Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Total Qty (kg)</TableHead>
                <TableHead className="text-right">Grand Total</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audit Book</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-gray-500">No invoices found</TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoice_no}</TableCell>
                    <TableCell>{invoice.invoice_date}</TableCell>
                    <TableCell>{invoice.farmer_name}</TableCell>
                    <TableCell>
                      {invoice.farmer_mobile ? (
                        <a href={`tel:${invoice.farmer_mobile}`} className="text-blue-600 hover:underline">
                          {invoice.farmer_mobile}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>{invoice.farmer_location || '-'}</TableCell>
                    <TableCell className="text-right">{invoice.total_quantity_kg?.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-medium">₹{invoice.grand_total?.toLocaleString('en-IN')}</TableCell>
                    <TableCell className={`text-right font-medium ${invoice.balance_due > 0 ? 'text-red-600' : ''}`}>
                      ₹{invoice.balance_due?.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>{getPaymentChip(invoice.payment_status)}</TableCell>
                    <TableCell>{getStatusChip(invoice.status)}</TableCell>
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
                        {invoice.status === 'draft' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/purchase-invoices/edit/${invoice.id}`)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleApprove(invoice.id)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(invoice.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {invoice.status === 'approved' && (
                          <Button size="sm" variant="outline" onClick={() => handlePush(invoice.id)}>
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
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
                  </div>
                </div>

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
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t bg-gray-50 flex gap-2 justify-end">
                {previewInvoice.status === 'draft' && (
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
    </div>
  );
};

export default PurchaseInvoices;
