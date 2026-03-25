import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowLeft, Calculator } from 'lucide-react';

const BILL_TYPES = [
  { value: 'VA', label: 'VA (Variable Allowance)' },
  { value: 'TDS', label: 'TDS Deduction' },
  { value: 'contractor', label: 'Contractor Payment' },
  { value: 'daily', label: 'Daily Wages' }
];

const DEPARTMENTS = [
  'Processing',
  'Cold Storage',
  'Quality Control',
  'Procurement',
  'Dispatch',
  'Administration'
];

export default function CreateWageBill() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [billInfo, setBillInfo] = useState({
    bill_type: 'VA',
    period_from: '',
    period_to: '',
    department: 'Processing',
    notes: ''
  });

  const [lineItems, setLineItems] = useState([
    { worker_code: '', worker_name: '', days_worked: '', rate_per_day: '', basic_amount: 0, va_allowance: 0, tds_deducted: 0, net_amount: 0 }
  ]);

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      worker_code: '', 
      worker_name: '', 
      days_worked: '', 
      rate_per_day: '', 
      basic_amount: 0, 
      va_allowance: 0, 
      tds_deducted: 0, 
      net_amount: 0 
    }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) {
      toast.error('At least one line item is required');
      return;
    }
    const newItems = lineItems.filter((_, i) => i !== index);
    setLineItems(newItems);
  };

  const updateLineItem = (index, field, value) => {
    const newItems = [...lineItems];
    newItems[index][field] = value;
    
    // Auto-calculate amounts when days_worked or rate_per_day changes
    if (field === 'days_worked' || field === 'rate_per_day') {
      const days = parseFloat(newItems[index].days_worked) || 0;
      const rate = parseFloat(newItems[index].rate_per_day) || 0;
      const basic = days * rate;
      
      newItems[index].basic_amount = basic;
      newItems[index].va_allowance = basic * 0.15; // 15% VA
      newItems[index].tds_deducted = basic * 0.10; // 10% TDS
      newItems[index].net_amount = basic + newItems[index].va_allowance - newItems[index].tds_deducted;
    }
    
    setLineItems(newItems);
  };

  const calculateTotals = () => {
    const gross = lineItems.reduce((sum, item) => sum + (item.basic_amount || 0) + (item.va_allowance || 0), 0);
    const tds = lineItems.reduce((sum, item) => sum + (item.tds_deducted || 0), 0);
    const net = gross - tds;
    return { gross, tds, net };
  };

  const handleSubmit = async () => {
    const totals = calculateTotals();
    
    // Validation
    if (!billInfo.period_from || !billInfo.period_to) {
      toast.error('Please select period dates');
      return;
    }

    const hasEmptyWorkers = lineItems.some(item => !item.worker_code || !item.worker_name);
    if (hasEmptyWorkers) {
      toast.error('Please fill in all worker details');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...billInfo,
        period_from: new Date(billInfo.period_from).toISOString(),
        period_to: new Date(billInfo.period_to).toISOString(),
        gross_amount: totals.gross,
        tds_deduction: totals.tds,
        line_items: lineItems
      };

      await axios.post(`${API}/wage-bills`, payload);
      toast.success('Wage bill created successfully');
      navigate('/accounts');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create wage bill');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Create Wage Bill</h1>
          <p className="text-slate-600 mt-1">Step {step} of 3</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/accounts')} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Accounts
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`h-2 rounded-full flex-1 ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            {s < 3 && <div className="w-4" />}
          </div>
        ))}
      </div>

      {/* Step 1: Bill Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Bill Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bill_type">Bill Type *</Label>
                <select
                  id="bill_type"
                  value={billInfo.bill_type}
                  onChange={(e) => setBillInfo({ ...billInfo, bill_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {BILL_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <select
                  id="department"
                  value={billInfo.department}
                  onChange={(e) => setBillInfo({ ...billInfo, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="period_from">Period From *</Label>
                <Input
                  id="period_from"
                  type="date"
                  value={billInfo.period_from}
                  onChange={(e) => setBillInfo({ ...billInfo, period_from: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period_to">Period To *</Label>
                <Input
                  id="period_to"
                  type="date"
                  value={billInfo.period_to}
                  onChange={(e) => setBillInfo({ ...billInfo, period_to: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <textarea
                id="notes"
                value={billInfo.notes}
                onChange={(e) => setBillInfo({ ...billInfo, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>
                Next: Add Workers
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Line Items */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Worker Line Items</CardTitle>
              <Button size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Worker
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-700">Worker #{index + 1}</h3>
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLineItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                  <div>
                    <Label>Worker Code *</Label>
                    <Input
                      value={item.worker_code}
                      onChange={(e) => updateLineItem(index, 'worker_code', e.target.value)}
                      placeholder="W001"
                    />
                  </div>
                  <div>
                    <Label>Worker Name *</Label>
                    <Input
                      value={item.worker_name}
                      onChange={(e) => updateLineItem(index, 'worker_name', e.target.value)}
                      placeholder="Full Name"
                    />
                  </div>
                  <div>
                    <Label>Days Worked *</Label>
                    <Input
                      type="number"
                      value={item.days_worked}
                      onChange={(e) => updateLineItem(index, 'days_worked', e.target.value)}
                      placeholder="26"
                    />
                  </div>
                  <div>
                    <Label>Rate/Day (₹) *</Label>
                    <Input
                      type="number"
                      value={item.rate_per_day}
                      onChange={(e) => updateLineItem(index, 'rate_per_day', e.target.value)}
                      placeholder="500"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-slate-600">Basic Amount</p>
                    <p className="font-semibold">₹{item.basic_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">VA (15%)</p>
                    <p className="font-semibold text-green-600">₹{item.va_allowance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">TDS (10%)</p>
                    <p className="font-semibold text-red-600">₹{item.tds_deducted.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Net Amount</p>
                    <p className="font-bold text-blue-600">₹{item.net_amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Next: Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bill Info Summary */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Bill Information</h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600">Type:</span>
                  <span className="ml-2 font-medium">{BILL_TYPES.find(t => t.value === billInfo.bill_type)?.label}</span>
                </div>
                <div>
                  <span className="text-slate-600">Department:</span>
                  <span className="ml-2 font-medium">{billInfo.department}</span>
                </div>
                <div>
                  <span className="text-slate-600">Period:</span>
                  <span className="ml-2 font-medium">
                    {new Date(billInfo.period_from).toLocaleDateString()} - {new Date(billInfo.period_to).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Workers:</span>
                  <span className="ml-2 font-medium">{lineItems.length}</span>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Bill Totals</h3>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-blue-700">Gross Amount</p>
                  <p className="text-2xl font-bold text-blue-900">₹{totals.gross.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-red-700">TDS Deduction</p>
                  <p className="text-2xl font-bold text-red-600">₹{totals.tds.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Net Payable</p>
                  <p className="text-2xl font-bold text-green-600">₹{totals.net.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Worker Summary */}
            <div>
              <h3 className="font-semibold mb-3">Workers Summary ({lineItems.length})</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-right">Days</th>
                        <th className="px-4 py-2 text-right">Rate</th>
                        <th className="px-4 py-2 text-right">Net Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2 font-medium">{item.worker_code}</td>
                          <td className="px-4 py-2">{item.worker_name}</td>
                          <td className="px-4 py-2 text-right">{item.days_worked}</td>
                          <td className="px-4 py-2 text-right">₹{item.rate_per_day}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600">
                            ₹{item.net_amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : 'Create Wage Bill'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
