import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Receipt, DollarSign, TrendingUp, Plus, Filter, Eye, CheckCircle, X } from 'lucide-react';

const Accounts = () => {
  const navigate = useNavigate();
  const [wageBills, setWageBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    bill_type: '',
    department: '',
    payment_status: '',
    search: ''
  });
  const [stats, setStats] = useState({
    totalBills: 0,
    totalGross: 0,
    totalNet: 0,
    pendingPayments: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [wageBills, filters]);

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

  const applyFilters = () => {
    let filtered = [...wageBills];

    if (filters.bill_type) {
      filtered = filtered.filter(b => b.bill_type === filters.bill_type);
    }
    if (filters.department) {
      filtered = filtered.filter(b => b.department === filters.department);
    }
    if (filters.payment_status) {
      filtered = filtered.filter(b => b.payment_status === filters.payment_status);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(b => 
        b.bill_number.toLowerCase().includes(search) ||
        b.department.toLowerCase().includes(search)
      );
    }

    setFilteredBills(filtered);
  };

  const clearFilters = () => {
    setFilters({ bill_type: '', department: '', payment_status: '', search: '' });
  };

  const handleMarkPaid = async (billId) => {
    if (!window.confirm('Mark this bill as paid?')) return;

    try {
      await axios.post(`${API}/wage-bills/${billId}/mark-paid`);
      toast.success('Bill marked as paid');
      fetchData();
    } catch (error) {
      toast.error('Failed to mark bill as paid');
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

  const displayBills = filteredBills.length > 0 || Object.values(filters).some(v => v) ? filteredBills : wageBills;

  return (
    <div className="space-y-6" data-testid="accounts-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Accounts & Billing</h1>
          <p className="text-slate-600 mt-1">Manage wage bills and payments</p>
        </div>
        <Button onClick={() => navigate('/accounts/create')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Wage Bill
        </Button>
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
          <div className="flex items-center justify-between">
            <CardTitle>Wage Bills ({displayBills.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          {showFilters && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg space-y-3">
              <div className="grid md:grid-cols-4 gap-3">
                <Input
                  placeholder="Search bill number..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                <select
                  value={filters.bill_type}
                  onChange={(e) => setFilters({ ...filters, bill_type: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="VA">VA</option>
                  <option value="TDS">TDS</option>
                  <option value="contractor">Contractor</option>
                  <option value="daily">Daily</option>
                </select>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  <option value="Processing">Processing</option>
                  <option value="Cold Storage">Cold Storage</option>
                  <option value="Quality Control">Quality Control</option>
                  <option value="Procurement">Procurement</option>
                  <option value="Dispatch">Dispatch</option>
                  <option value="Administration">Administration</option>
                </select>
                <select
                  value={filters.payment_status}
                  onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}

          {displayBills.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Gross Amount</TableHead>
                    <TableHead>Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayBills.map(bill => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.bill_number}</TableCell>
                      <TableCell className="uppercase">{bill.bill_type}</TableCell>
                      <TableCell>{bill.department}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(bill.period_from).toLocaleDateString()} - {new Date(bill.period_to).toLocaleDateString()}
                      </TableCell>
                      <TableCell>₹{bill.gross_amount.toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-green-600">
                        ₹{bill.net_payable.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(bill.payment_status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/accounts/${bill.id}`)}
                            className="p-2 hover:bg-slate-100 rounded transition"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </button>
                          {bill.payment_status !== 'paid' && (
                            <button
                              onClick={() => handleMarkPaid(bill.id)}
                              className="p-2 hover:bg-green-50 rounded transition"
                              title="Mark as Paid"
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">No wage bills found.</p>
              {Object.values(filters).some(v => v) && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Accounts;
