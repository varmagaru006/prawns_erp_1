import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { TrendingUp, AlertCircle, Box, DollarSign, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const WastageDashboard = () => {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [stageSummary, setStageSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, alertsRes, stageRes] = await Promise.all([
        axios.get(`${API}/wastage/dashboard-stats`),
        axios.get(`${API}/wastage/breach-alerts`),
        axios.get(`${API}/wastage/stage-summary`)
      ]);
      
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
      setStageSummary(stageRes.data);
    } catch (error) {
      toast.error('Failed to load wastage data');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (wastageId) => {
    try {
      await axios.post(`${API}/wastage/acknowledge/${wastageId}`);
      toast.success('Alert acknowledged');
      fetchData();
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'green') return <div className="h-3 w-3 rounded-full bg-green-500"></div>;
    if (status === 'amber') return <div className="h-3 w-3 rounded-full bg-yellow-500"></div>;
    return <div className="h-3 w-3 rounded-full bg-red-500"></div>;
  };

  const chartData = stageSummary.map(stage => ({
    name: stage._id.replace('_', ' ').toUpperCase(),
    wastage_kg: stage.total_wastage_kg,
    input_kg: stage.total_input_kg,
    loss_pct: ((stage.total_wastage_kg / stage.total_input_kg) * 100).toFixed(1),
    status: stage.red_count > 0 ? 'red' : stage.amber_count > 0 ? 'amber' : 'green'
  }));

  return (
    <div className="space-y-6" data-testid="wastage-dashboard-page">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Wastage Dashboard</h1>
        <p className="text-slate-600 mt-1">Real-time yield tracking and revenue loss monitoring</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Today's Wastage</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.today_wastage_kg.toFixed(2)} kg</p>
                      <p className="text-xs text-slate-500 mt-1">{stats.today_lots_count} lots</p>
                    </div>
                    <Box className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Month Revenue Loss</p>
                      <p className="text-2xl font-bold text-red-600">₹{stats.month_revenue_loss_inr.toFixed(0)}</p>
                      <p className="text-xs text-slate-500 mt-1">{stats.month_lots_count} lots</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Active RED Alerts</p>
                      <p className="text-2xl font-bold text-red-600">{stats.active_red_alerts}</p>
                      <p className="text-xs text-red-600 mt-1">Needs action</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Byproduct Revenue</p>
                      <p className="text-2xl font-bold text-green-600">₹{stats.byproduct_revenue_inr.toFixed(0)}</p>
                      <p className="text-xs text-slate-500 mt-1">Recovered</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stage-wise Wastage Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Stage-wise Wastage (This Month)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis label={{ value: 'Weight (KG)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
                              <p className="font-semibold">{payload[0].payload.name}</p>
                              <p className="text-sm text-red-600">Wastage: {payload[0].value} kg</p>
                              <p className="text-sm text-slate-600">Input: {payload[0].payload.input_kg} kg</p>
                              <p className="text-sm font-medium">Loss: {payload[0].payload.loss_pct}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="wastage_kg" fill="#ef4444" name="Wastage KG" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Breach Alerts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Threshold Breach Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead className="text-center">Actual Yield</TableHead>
                      <TableHead className="text-center">Min Threshold</TableHead>
                      <TableHead className="text-center">Variance</TableHead>
                      <TableHead className="text-right">Loss ₹</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id} className="bg-red-50">
                        <TableCell className="font-medium">{alert.lot_number}</TableCell>
                        <TableCell className="capitalize">{alert.stage_name.replace('_', ' ')}</TableCell>
                        <TableCell>{alert.species}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-red-600">{alert.actual_yield_pct.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell className="text-center">{alert.min_threshold_pct.toFixed(2)}%</TableCell>
                        <TableCell className="text-center">
                          <span className="text-red-600 font-semibold">{alert.variance_pct.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          ₹{alert.loss_inr.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledge(alert.id)}
                            className="gap-1"
                          >
                            <CheckCircle size={14} />
                            Acknowledge
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No unacknowledged alerts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WastageDashboard;
