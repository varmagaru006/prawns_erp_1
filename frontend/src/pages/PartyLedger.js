import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { BookOpen, Download, Eye, Plus, X, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

const PartyLedger = () => {
  const navigate = useNavigate();
  const { partyId } = useParams();
  const [searchParams] = useSearchParams();
  const fyParam = searchParams.get('fy');
  
  const [ledgers, setLedgers] = useState([]);
  const [ledgerDetail, setLedgerDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFY, setSelectedFY] = useState(fyParam || '');
  const [availableFYs, setAvailableFYs] = useState([]);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [showManualDrawer, setShowManualDrawer] = useState(false);
  const [manualEntryType, setManualEntryType] = useState('manual_debit');
  const [paymentForm, setPaymentForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    payment_amount: '',
    paid_to: '',
    payment_mode: 'bank_transfer',
    payment_reference: '',
    notes: ''
  });
  const [manualForm, setManualForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    amount: '',
    description: ''
  });

  useEffect(() => {
    fetchAvailableFYs();
  }, []);

  useEffect(() => {
    if (partyId) {
      fetchLedgerDetail();
    } else if (selectedFY) {
      fetchLedgers();
    }
  }, [partyId, selectedFY]);

  const fetchAvailableFYs = async () => {
    try {
      const response = await axios.get(`${API}/party-ledger/available-fys`);
      setAvailableFYs(response.data);
      if (!selectedFY && response.data.length > 0) {
        setSelectedFY(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch FYs');
    }
  };

  const fetchLedgers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFY) params.append('fy', selectedFY);
      if (search) params.append('search', search);
      const response = await axios.get(`${API}/party-ledger?${params}`, { timeout: 10000 });
      setLedgers(response.data || []);
    } catch (error) {
      console.error('Failed to load ledgers:', error);
      toast.error('Failed to load ledgers');
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgerDetail = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fyParam) params.append('fy', fyParam);
      const response = await axios.get(`${API}/party-ledger/${partyId}?${params}`);
      setLedgerDetail(response.data);
      if (response.data.party?.short_code) {
        setPaymentForm(prev => ({ ...prev, paid_to: response.data.party.short_code }));
      }
    } catch (error) {
      toast.error('Failed to load ledger detail');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.payment_amount || parseFloat(paymentForm.payment_amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await axios.post(`${API}/party-ledger/payment`, {
        party_id: partyId,
        entry_date: paymentForm.entry_date,
        payment_amount: parseFloat(paymentForm.payment_amount),
        payment_date: paymentForm.entry_date,
        paid_to: paymentForm.paid_to,
        payment_mode: paymentForm.payment_mode,
        payment_reference: paymentForm.payment_reference,
        notes: paymentForm.notes
      });
      toast.success('Payment recorded successfully');
      setShowPaymentDrawer(false);
      setPaymentForm({
        entry_date: new Date().toISOString().split('T')[0],
        payment_amount: '',
        paid_to: ledgerDetail?.party?.short_code || '',
        payment_mode: 'bank_transfer',
        payment_reference: '',
        notes: ''
      });
      fetchLedgerDetail();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    }
  };

  const handleAddManualEntry = async (e) => {
    e.preventDefault();
    if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!manualForm.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    try {
      await axios.post(`${API}/party-ledger/manual-entry`, {
        party_id: partyId,
        entry_date: manualForm.entry_date,
        entry_type: manualEntryType,
        amount: parseFloat(manualForm.amount),
        description: manualForm.description
      });
      toast.success(`Manual ${manualEntryType === 'manual_debit' ? 'debit' : 'credit'} recorded`);
      setShowManualDrawer(false);
      setManualForm({
        entry_date: new Date().toISOString().split('T')[0],
        amount: '',
        description: ''
      });
      fetchLedgerDetail();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record entry');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0).replace('₹', '₹ ');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Render ledger detail view
  if (partyId && ledgerDetail) {
    const { party, ledger, entries, tenant_config, financial_year } = ledgerDetail;
    
    // Group entries by bill/payment for rendering
    const renderEntries = () => {
      const rows = [];
      let currentBillEntry = null;
      let currentBillLines = [];

      for (const entry of entries) {
        if (entry.entry_type === 'opening') {
          rows.push(
            <TableRow key={entry.id} className="bg-gray-50">
              <TableCell colSpan={7} className="font-medium">
                {formatDate(entry.entry_date)} - OPENING BALANCE
              </TableCell>
              <TableCell colSpan={5}></TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(entry.balance_after)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          );
        } else if (entry.entry_type === 'bill') {
          // Render bill with line items
          const lineItems = entry.line_items || [];
          lineItems.forEach((line, idx) => {
            const isLastLine = idx === lineItems.length - 1;
            rows.push(
              <TableRow key={`${entry.id}-${idx}`}>
                <TableCell>{idx === 0 ? formatDate(entry.entry_date) : ''}</TableCell>
                <TableCell className="font-mono text-sm">{idx === 0 ? entry.invoice_no : ''}</TableCell>
                <TableCell className="text-center">{line.count_value || '-'}</TableCell>
                <TableCell className="text-right">{line.quantity_kg?.toFixed(3)}</TableCell>
                <TableCell className="text-right">{line.rate?.toFixed(2)}</TableCell>
                <TableCell className="text-right">{formatCurrency(line.amount)}</TableCell>
                <TableCell className="text-right font-medium">{isLastLine ? formatCurrency(entry.bill_subtotal) : ''}</TableCell>
                <TableCell className="text-right text-blue-600">{isLastLine ? formatCurrency(entry.tds_amount) : ''}</TableCell>
                <TableCell className="text-right">{isLastLine ? formatCurrency(entry.tds_after_bill) : ''}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold">{isLastLine ? formatCurrency(entry.balance_after) : ''}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            );
          });
          if (lineItems.length === 0) {
            // No line items, show summary row
            rows.push(
              <TableRow key={entry.id}>
                <TableCell>{formatDate(entry.entry_date)}</TableCell>
                <TableCell className="font-mono text-sm">{entry.invoice_no}</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(entry.bill_subtotal)}</TableCell>
                <TableCell className="text-right text-blue-600">{formatCurrency(entry.tds_amount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(entry.tds_after_bill)}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(entry.balance_after)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            );
          }
        } else if (entry.entry_type === 'payment') {
          rows.push(
            <TableRow key={entry.id} className="bg-green-50">
              <TableCell>{formatDate(entry.entry_date)}</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right text-green-700 font-medium">{formatCurrency(entry.payment_amount)}</TableCell>
              <TableCell className="text-center">{formatDate(entry.payment_date)}</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(entry.balance_after)}</TableCell>
              <TableCell className="text-center font-mono text-sm">{entry.paid_to || '-'}</TableCell>
            </TableRow>
          );
        } else if (entry.entry_type === 'manual_debit') {
          rows.push(
            <TableRow key={entry.id} className="bg-yellow-50">
              <TableCell>{formatDate(entry.entry_date)}</TableCell>
              <TableCell colSpan={5} className="text-sm italic">{entry.description}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(entry.bill_subtotal)}</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right">{formatCurrency(entry.tds_after_bill)}</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(entry.balance_after)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          );
        } else if (entry.entry_type === 'manual_credit') {
          rows.push(
            <TableRow key={entry.id} className="bg-blue-50">
              <TableCell>{formatDate(entry.entry_date)}</TableCell>
              <TableCell colSpan={5} className="text-sm italic">{entry.description}</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right text-blue-700 font-medium">{formatCurrency(entry.payment_amount)}</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(entry.balance_after)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          );
        }
      }

      return rows;
    };

    return (
      <div className="p-6">
        {/* Back Button */}
        <Button variant="outline" onClick={() => navigate('/party-ledger')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ledger List
        </Button>

        {/* Ledger Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold">{tenant_config?.company_name || 'KRISH AQUA TRADERS'}</h1>
              <p className="text-gray-600">{tenant_config?.company_address_1}</p>
              <p className="text-gray-600">{tenant_config?.company_address_2}</p>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <div>
                <p className="text-lg font-bold">
                  PARTY NAME: {party.party_name}
                  {party.party_alias && <span className="text-gray-600"> ({party.party_alias})</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-medium">FY: {financial_year}</p>
                <p className="text-sm text-gray-600">
                  Opening Balance: {formatCurrency(ledger.opening_balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <Button onClick={() => setShowPaymentDrawer(true)} data-testid="add-payment-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
          <Button variant="outline" onClick={() => { setManualEntryType('manual_debit'); setShowManualDrawer(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Manual Debit
          </Button>
          <Button variant="outline" onClick={() => { setManualEntryType('manual_credit'); setShowManualDrawer(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Manual Credit
          </Button>
          <Button variant="outline" className="ml-auto">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </div>

        {/* Ledger Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-900 text-white">
                    <TableHead className="text-white w-24">DATE</TableHead>
                    <TableHead className="text-white w-20">BILL NO</TableHead>
                    <TableHead className="text-white text-center w-16">COUNT</TableHead>
                    <TableHead className="text-white text-right w-20">QTY</TableHead>
                    <TableHead className="text-white text-right w-16">RATE</TableHead>
                    <TableHead className="text-white text-right w-24">AMOUNT</TableHead>
                    <TableHead className="text-white text-right w-24">TOTAL BILL</TableHead>
                    <TableHead className="text-white text-right w-20">TDS@0.1%</TableHead>
                    <TableHead className="text-white text-right w-24">TDS AFTER</TableHead>
                    <TableHead className="text-white text-right w-24">PAYMENT</TableHead>
                    <TableHead className="text-white text-center w-24">PAY DATE</TableHead>
                    <TableHead className="text-white text-right w-28">BALANCE</TableHead>
                    <TableHead className="text-white text-center w-20">PAID TO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500">Loading...</TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                        No entries yet. Push invoices to create ledger entries.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {renderEntries()}
                      {/* Totals Row */}
                      <TableRow className="bg-cyan-100 font-bold">
                        <TableCell colSpan={6} className="text-right">TOTAL VALUES</TableCell>
                        <TableCell className="text-right">{formatCurrency(ledger.total_billed)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ledger.total_tds)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{formatCurrency(ledger.total_payments)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-lg">{formatCurrency(ledger.closing_balance)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Drawer */}
        {showPaymentDrawer && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPaymentDrawer(false)}></div>
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
                  <h2 className="text-xl font-bold text-green-900">Add Payment</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowPaymentDrawer(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <form onSubmit={handleAddPayment} className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Payment Date *</label>
                    <Input
                      type="date"
                      value={paymentForm.entry_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, entry_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Amount *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={paymentForm.payment_amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_amount: e.target.value })}
                      placeholder="Enter payment amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Paid To</label>
                    <Input
                      value={paymentForm.paid_to}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paid_to: e.target.value })}
                      placeholder="e.g. SRAT"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Payment Mode</label>
                    <select
                      value={paymentForm.payment_mode}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                      className="w-full h-9 rounded-md border px-3 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Reference No</label>
                    <Input
                      value={paymentForm.payment_reference}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                      placeholder="UTR / Cheque No"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Notes</label>
                    <textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none"
                    />
                  </div>

                  {/* Balance Preview */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Running Balance Preview:</p>
                    <p className="text-sm">Before: {formatCurrency(ledger.closing_balance)}</p>
                    <p className="text-lg font-bold text-green-600">
                      After: {formatCurrency(ledger.closing_balance - (parseFloat(paymentForm.payment_amount) || 0))}
                    </p>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowPaymentDrawer(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                      Save Payment
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Manual Entry Drawer */}
        {showManualDrawer && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowManualDrawer(false)}></div>
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
              <div className="h-full flex flex-col">
                <div className={`flex items-center justify-between px-6 py-4 border-b ${manualEntryType === 'manual_debit' ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                  <h2 className={`text-xl font-bold ${manualEntryType === 'manual_debit' ? 'text-yellow-900' : 'text-blue-900'}`}>
                    {manualEntryType === 'manual_debit' ? 'Manual Debit' : 'Manual Credit'}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowManualDrawer(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <form onSubmit={handleAddManualEntry} className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Entry Date *</label>
                    <Input
                      type="date"
                      value={manualForm.entry_date}
                      onChange={(e) => setManualForm({ ...manualForm, entry_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Amount *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={manualForm.amount}
                      onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description *</label>
                    <textarea
                      value={manualForm.description}
                      onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                      placeholder="Reason for manual adjustment"
                      className="w-full h-24 px-3 py-2 border rounded-md text-sm resize-none"
                    />
                  </div>

                  <div className="pt-4 flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowManualDrawer(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className={`flex-1 ${manualEntryType === 'manual_debit' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                      Save Entry
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render ledger list view
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Party Ledger</h1>
          <p className="text-gray-600">View party account ledgers by financial year</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Financial Year</label>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="h-9 w-40 rounded-md border px-3 text-sm"
              >
                {availableFYs.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Search Party</label>
              <Input
                placeholder="Search by party name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Party Ledgers - FY {selectedFY}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : ledgers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No ledger records found for FY {selectedFY}. Push invoices with linked parties to create ledger entries.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party Name</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead className="text-right">Opening Bal</TableHead>
                  <TableHead className="text-right">Total Billed</TableHead>
                  <TableHead className="text-right">Total TDS</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Closing Bal</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgers.map((ledger) => (
                  <TableRow key={ledger.id}>
                    <TableCell className="font-medium">
                      {ledger.party_name}
                      {ledger.party_alias && <span className="text-gray-500 text-sm ml-1">({ledger.party_alias})</span>}
                    </TableCell>
                    <TableCell>{ledger.financial_year}</TableCell>
                    <TableCell className="text-right">{formatCurrency(ledger.opening_balance)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(ledger.total_billed)}</TableCell>
                    <TableCell className="text-right text-blue-600">{formatCurrency(ledger.total_tds)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(ledger.total_payments)}</TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={ledger.closing_balance > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(ledger.closing_balance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => navigate(`/party-ledger/${ledger.party_id}?fy=${ledger.financial_year}`)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
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
    </div>
  );
};

export default PartyLedger;
