import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Download, Edit, Trash2, Calendar, DollarSign, Users } from 'lucide-react';
import Attachments from '../components/Attachments';
import { useAlert } from '../context/AlertContext';

export default function WageBillDetail() {
  const { confirm } = useAlert();
  const { billId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBill();
  }, [billId]);

  const fetchBill = async () => {
    try {
      const response = await axios.get(`${API}/wage-bills/${billId}`);
      setBill(response.data);
    } catch (error) {
      toast.error('Failed to load wage bill');
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    const ok = await confirm({ title: 'Mark wage bill as paid?', description: 'This will update the payment status to paid.', confirmLabel: 'Mark Paid', variant: 'success' });
    if (!ok) return;

    try {
      await axios.post(`${API}/wage-bills/${billId}/mark-paid`);
      toast.success('Wage bill marked as paid');
      fetchBill();
    } catch (error) {
      toast.error('Failed to mark as paid');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: 'Delete wage bill?', description: 'This action cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;

    try {
      await axios.delete(`${API}/wage-bills/${billId}`);
      toast.success('Wage bill deleted');
      navigate('/accounts');
    } catch (error) {
      toast.error('Failed to delete wage bill');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await axios.get(`${API}/wage-bills/${billId}/pdf`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `wage_bill_${bill.bill_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!bill) return null;

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      paid: 'bg-green-100 text-green-800 border-green-300',
      partial: 'bg-blue-100 text-blue-800 border-blue-300',
      overdue: 'bg-red-100 text-red-800 border-red-300'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">{bill.bill_number}</h1>
            {getStatusBadge(bill.payment_status)}
          </div>
          <p className="text-slate-600 mt-1">
            {new Date(bill.period_from).toLocaleDateString()} - {new Date(bill.period_to).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/accounts')} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Accounts
        </Button>
      </div>

      {/* Bill Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Gross Amount</p>
                <p className="text-xl font-bold text-slate-900">₹{bill.gross_amount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">TDS Deduction</p>
                <p className="text-xl font-bold text-red-600">₹{bill.tds_deduction.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Net Payable</p>
                <p className="text-xl font-bold text-green-600">₹{bill.net_payable.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Workers</p>
                <p className="text-xl font-bold text-slate-900">{bill.line_items?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bill Details */}
      <Card>
        <CardHeader>
          <CardTitle>Bill Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-600">Bill Type</p>
                <p className="font-semibold uppercase">{bill.bill_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Department</p>
                <p className="font-semibold">{bill.department}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Created At</p>
                <p className="font-semibold">{new Date(bill.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-600">Payment Status</p>
                <div className="mt-1">{getStatusBadge(bill.payment_status)}</div>
              </div>
              {bill.payment_date && (
                <div>
                  <p className="text-sm text-slate-600">Payment Date</p>
                  <p className="font-semibold">{new Date(bill.payment_date).toLocaleString()}</p>
                </div>
              )}
              {bill.notes && (
                <div>
                  <p className="text-sm text-slate-600">Notes</p>
                  <p className="font-semibold">{bill.notes}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worker Line Items */}
      {bill.line_items && bill.line_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Worker Line Items ({bill.line_items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Worker Name</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Days</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Rate/Day</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Basic</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">VA</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">TDS</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.line_items.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{item.worker_code}</td>
                      <td className="px-4 py-3">{item.worker_name}</td>
                      <td className="px-4 py-3 text-right">{item.days_worked}</td>
                      <td className="px-4 py-3 text-right">₹{item.rate_per_day}</td>
                      <td className="px-4 py-3 text-right">₹{item.basic_amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-green-600">₹{item.va_allowance?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-600">₹{item.tds_deducted?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">
                        ₹{item.net_amount?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr>
                    <td colSpan="4" className="px-4 py-3 text-right">Totals:</td>
                    <td className="px-4 py-3 text-right">
                      ₹{bill.line_items.reduce((sum, item) => sum + (item.basic_amount || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      ₹{bill.line_items.reduce((sum, item) => sum + (item.va_allowance || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      ₹{bill.line_items.reduce((sum, item) => sum + (item.tds_deducted || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      ₹{bill.line_items.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attachments Section */}
      <Attachments
        entityType="wage_bill"
        entityId={bill.id}
        readOnly={bill.payment_status === 'paid'}
      />

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {bill.payment_status !== 'paid' && (
              <Button onClick={handleMarkPaid} className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Mark as Paid
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            {bill.payment_status !== 'paid' && (
              <>
                <Button variant="outline" className="gap-2" disabled>
                  <Edit className="h-4 w-4" />
                  Edit Bill
                </Button>
                <Button variant="destructive" onClick={handleDelete} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Bill
                </Button>
              </>
            )}
          </div>
          {bill.payment_status === 'paid' && (
            <p className="text-sm text-slate-600 mt-3">
              ℹ️ Paid bills cannot be edited or deleted
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
