import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Receipt, DollarSign, TrendingUp } from 'lucide-react';

const Accounts = () => {
  const [wageBills, setWageBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBills: 0,
    totalGross: 0,
    totalNet: 0,
    pendingPayments: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API}/wage-bills`);
      const bills = response.data;
      setWageBills(bills);
      
      setStats({
        totalBills: bills.length,
        totalGross: bills.reduce((sum, bill) => sum + bill.gross_amount, 0),
        totalNet: bills.reduce((sum, bill) => sum + bill.net_payable, 0),
        pendingPayments: bills.filter(b => b.payment_status === 'pending').length
      });
    } catch (error) {
      toast.error('Failed to load wage bills');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="accounts-page">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Accounts & Billing</h1>
        <p className="text-slate-600 mt-1">Manage wage bills and payments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-slate-800">{stats.totalBills}</div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Gross Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-slate-800">
                ₹{(stats.totalGross / 100000).toFixed(1)}L
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Net Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">
                ₹{(stats.totalNet / 100000).toFixed(1)}L
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingPayments}</div>
              <Receipt className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wage Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {wageBills.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross Amount</TableHead>
                  <TableHead>TDS</TableHead>
                  <TableHead>Net Payable</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wageBills.map(bill => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.bill_number}</TableCell>
                    <TableCell className="uppercase">{bill.bill_type}</TableCell>
                    <TableCell>{bill.department}</TableCell>
                    <TableCell>
                      {new Date(bill.period_from).toLocaleDateString()} - {new Date(bill.period_to).toLocaleDateString()}
                    </TableCell>
                    <TableCell>₹{bill.gross_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">₹{bill.tds_deduction.toLocaleString()}</TableCell>
                    <TableCell className="font-bold text-green-600">
                      ₹{bill.net_payable.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(bill.payment_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">No wage bills found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Accounts;
