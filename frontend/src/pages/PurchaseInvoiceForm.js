import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Eye } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const PurchaseInvoiceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    farmer_name: '',
    farmer_location: '',
    agent_ref_name: '',
    weighment_slip_no: '',
    custom_field_1_label: '',
    custom_field_1_value: '',
    custom_field_2_label: '',
    custom_field_2_value: '',
    tds_rate_pct: 0.1,
    advance_paid: 0,
    notes: ''
  });

  const [lineItems, setLineItems] = useState([
    { line_no: 1, variety: 'Vannamei', count_value: '', quantity_kg: 0, rate: 0, custom_variety_notes: '', custom_count_notes: '' }
  ]);

  const [totals, setTotals] = useState({
    total_quantity_kg: 0,
    subtotal: 0,
    tds_amount: 0,
    rounded_off: 0,
    grand_total: 0,
    balance_due: 0
  });

  useEffect(() => {
    if (isEdit) {
      fetchInvoice();
    }
  }, [id]);

  useEffect(() => {
    calculateTotals();
  }, [lineItems, formData.tds_rate_pct, formData.advance_paid]);

  const fetchInvoice = async () => {
    try {
      const response = await axios.get(`${API}/purchase-invoices/${id}`);
      const inv = response.data;
      setFormData({
        invoice_date: inv.invoice_date,
        farmer_name: inv.farmer_name,
        farmer_location: inv.farmer_location || '',
        agent_ref_name: inv.agent_ref_name || '',
        weighment_slip_no: inv.weighment_slip_no || '',
        custom_field_1_label: inv.custom_field_1_label || '',
        custom_field_1_value: inv.custom_field_1_value || '',
        custom_field_2_label: inv.custom_field_2_label || '',
        custom_field_2_value: inv.custom_field_2_value || '',
        tds_rate_pct: inv.tds_rate_pct,
        advance_paid: inv.advance_paid,
        notes: inv.notes || ''
      });
      if (inv.line_items && inv.line_items.length > 0) {
        setLineItems(inv.line_items);
      }
    } catch (error) {
      toast.error('Failed to load invoice');
      navigate('/purchase-invoices');
    }
  };

  const calculateTotals = () => {
    let total_qty = 0;
    let subtotal = 0;

    lineItems.forEach(line => {
      const qty = parseFloat(line.quantity_kg) || 0;
      const rate = parseFloat(line.rate) || 0;
      total_qty += qty;
      subtotal += qty * rate;
    });

    subtotal = Math.round(subtotal * 100) / 100;

    const tds_amount = Math.round(subtotal * (formData.tds_rate_pct / 100) * 100) / 100;
    const pre_round = subtotal - tds_amount;
    const grand_total = Math.round(pre_round);
    const rounded_off = Math.round((grand_total - pre_round) * 100) / 100;
    const balance_due = grand_total - (parseFloat(formData.advance_paid) || 0);

    setTotals({
      total_quantity_kg: Math.round(total_qty * 1000) / 1000,
      subtotal,
      tds_amount,
      rounded_off,
      grand_total,
      balance_due
    });
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...lineItems];
    newLines[index][field] = value;
    setLineItems(newLines);
  };

  const addLine = () => {
    setLineItems([...lineItems, {
      line_no: lineItems.length + 1,
      variety: 'Vannamei',
      count_value: '',
      quantity_kg: 0,
      rate: 0,
      custom_variety_notes: '',
      custom_count_notes: ''
    }]);
  };

  const removeLine = (index) => {
    if (lineItems.length === 1) {
      toast.error('Must have at least one line item');
      return;
    }
    const newLines = lineItems.filter((_, i) => i !== index);
    // Renumber lines
    newLines.forEach((line, i) => {
      line.line_no = i + 1;
    });
    setLineItems(newLines);
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.farmer_name) {
      toast.error('Farmer name is required');
      return;
    }

    if (lineItems.length === 0 || !lineItems[0].variety) {
      toast.error('At least one line item is required');
      return;
    }

    const payload = {
      ...formData,
      line_items: lineItems.map(line => ({
        line_no: line.line_no,
        variety: line.variety,
        count_value: line.count_value,
        quantity_kg: parseFloat(line.quantity_kg) || 0,
        rate: parseFloat(line.rate) || 0,
        custom_variety_notes: line.custom_variety_notes,
        custom_count_notes: line.custom_count_notes
      }))
    };

    try {
      if (isEdit) {
        await axios.put(`${API}/purchase-invoices/${id}`, payload);
        toast.success('Invoice updated');
      } else {
        const response = await axios.post(`${API}/purchase-invoices`, payload);
        toast.success(`Invoice created: ${response.data.invoice_no}`);
      }
      navigate('/purchase-invoices');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save invoice');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {isEdit ? 'Edit' : 'Create'} Purchase Invoice
          </h1>
          <p className="text-gray-600">Fill in invoice details and line items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/purchase-invoices')}>Cancel</Button>
          <Button onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>

      {/* Header Fields */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Farmer Name *</label>
              <Input
                value={formData.farmer_name}
                onChange={(e) => setFormData({ ...formData, farmer_name: e.target.value })}
                placeholder="Enter farmer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Invoice Date</label>
              <Input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <Input
                value={formData.farmer_location}
                onChange={(e) => setFormData({ ...formData, farmer_location: e.target.value })}
                placeholder="Enter location"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Weighment Slip No</label>
              <Input
                value={formData.weighment_slip_no}
                onChange={(e) => setFormData({ ...formData, weighment_slip_no: e.target.value })}
                placeholder="Enter slip number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Agent/Ref Name</label>
              <Input
                value={formData.agent_ref_name}
                onChange={(e) => setFormData({ ...formData, agent_ref_name: e.target.value })}
                placeholder="Enter agent name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Field 1 Label</label>
              <Input
                value={formData.custom_field_1_label}
                onChange={(e) => setFormData({ ...formData, custom_field_1_label: e.target.value })}
                placeholder="e.g., Vehicle No"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Custom Field 1 Value</label>
              <Input
                value={formData.custom_field_1_value}
                onChange={(e) => setFormData({ ...formData, custom_field_1_value: e.target.value })}
                placeholder="Enter value"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2 text-left text-sm font-medium">S.NO</th>
                  <th className="p-2 text-left text-sm font-medium">Variety</th>
                  <th className="p-2 text-left text-sm font-medium">Count</th>
                  <th className="p-2 text-left text-sm font-medium">Qty (kg)</th>
                  <th className="p-2 text-left text-sm font-medium">Rate (₹)</th>
                  <th className="p-2 text-right text-sm font-medium">Amount (₹)</th>
                  <th className="p-2 text-center text-sm font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line, index) => {
                  const amount = (parseFloat(line.quantity_kg) || 0) * (parseFloat(line.rate) || 0);
                  return (
                    <tr key={index} className="border-b">
                      <td className="p-2 text-sm">{line.line_no}</td>
                      <td className="p-2">
                        <Input
                          value={line.variety}
                          onChange={(e) => handleLineChange(index, 'variety', e.target.value)}
                          placeholder="Vannamei"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={line.count_value}
                          onChange={(e) => handleLineChange(index, 'count_value', e.target.value)}
                          placeholder="86/90"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={line.quantity_kg}
                          onChange={(e) => handleLineChange(index, 'quantity_kg', e.target.value)}
                          placeholder="0.000"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={line.rate}
                          onChange={(e) => handleLineChange(index, 'rate', e.target.value)}
                          placeholder="0.00"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2 text-right text-sm font-medium">
                        {amount.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeLine(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Totals & Payment */}
      <Card>
        <CardHeader>
          <CardTitle>Payment & Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Calculation Display */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm">Subtotal:</span>
                <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm">TDS @</span>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.tds_rate_pct}
                    onChange={(e) => setFormData({ ...formData, tds_rate_pct: parseFloat(e.target.value) || 0.1 })}
                    className="h-7 w-16 text-sm"
                  />
                  <span className="text-sm">%:</span>
                </div>
                <span className="font-medium text-blue-600">₹{totals.tds_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-blue-600">Rounded Off:</span>
                <span className="font-medium text-red-600">₹{totals.rounded_off.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-4 pt-2 border-t-2">
                <span className="font-bold">Grand Total:</span>
                <span className="font-bold text-lg">₹{totals.grand_total.toLocaleString('en-IN')}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Advance Paid</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.advance_paid}
                    onChange={(e) => setFormData({ ...formData, advance_paid: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Balance Due</label>
                  <Input
                    type="text"
                    value={`₹${totals.balance_due.toLocaleString('en-IN')}`}
                    readOnly
                    className="bg-gray-100 font-medium"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="w-full h-20 p-2 border rounded-md"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseInvoiceForm;
