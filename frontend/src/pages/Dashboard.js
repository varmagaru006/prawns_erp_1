import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { formatLoadErrorMessage } from '../utils/apiError';
import { Package, Weight, DollarSign, Factory, Box, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lots, setLots] = useState([]);
  const [batches, setBatches] = useState([]);
  const [livePrices, setLivePrices] = useState([]);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 2 minutes (less load but keeps data reasonably fresh)
    const interval = setInterval(() => {
      fetchData();
    }, 120000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      let res;
      if (typeof window !== 'undefined' && window.__dashboardPrefetch) {
        res = { data: window.__dashboardPrefetch };
        window.__dashboardPrefetch = null;
      } else if (typeof window !== 'undefined' && window.__dashboardPrefetchPromise) {
        const prefetched = await window.__dashboardPrefetchPromise;
        if (prefetched) {
          res = { data: prefetched };
        }
      } else {
        try {
          res = await axios.get(`${API}/dashboard/overview`);
        } catch (overviewErr) {
        if (overviewErr.response?.status === 404) {
          const statsRes = await axios.get(`${API}/dashboard/stats`);
          res = {
            data: {
              stats: statsRes.data,
              lots: [],
              batches: [],
              live_prices: [],
            },
          };
        } else {
          throw overviewErr;
        }
      }
      }
      setStats(res.data.stats);
      setLots(res.data.lots || []);
      setBatches(res.data.batches || []);
      setLivePrices(res.data.live_prices || []);
    } catch (error) {
      toast.error(formatLoadErrorMessage('Failed to load dashboard stats', error));
    } finally {
      setLoading(false);
    }
  };

  // Show dashboard shell + skeleton immediately so layout and sidebar are visible; data fills in when ready
  const showSkeleton = loading;

  // Prepare chart data (safe when stats/lots/batches empty)
  const speciesData = useMemo(() => {
    const bucket = new Map();
    for (const lot of lots) {
      const key = lot?.species || 'Unknown';
      bucket.set(key, (bucket.get(key) || 0) + (lot?.net_weight_kg || 0));
    }
    return Array.from(bucket.entries()).map(([name, value]) => ({ name, value }));
  }, [lots]);

  const paymentStatusData = useMemo(() => {
    const bucket = new Map();
    for (const lot of lots) {
      const key = lot?.payment_status || 'unknown';
      const existing = bucket.get(key) || { value: 0, amount: 0 };
      existing.value += 1;
      existing.amount += lot?.total_amount || 0;
      bucket.set(key, existing);
    }
    return Array.from(bucket.entries()).map(([name, agg]) => ({ name, ...agg }));
  }, [lots]);

  const yieldTrendData = useMemo(() => (
    batches.map((batch, index) => ({
      name: `Batch ${index + 1}`,
      yield: batch.yield_pct,
      target: 80
    }))
  ), [batches]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const statCards = [
    {
      title: 'Total Procurement',
      value: stats?.total_procurement_lots || 0,
      change: '+12%',
      trend: 'up',
      icon: Package,
      color: 'bg-blue-500',
      description: 'Total lots received'
    },
    {
      title: 'Weight Procured',
      value: `${(stats?.total_weight_procured_kg || 0).toFixed(0)} KG`,
      change: '+8%',
      trend: 'up',
      icon: Weight,
      color: 'bg-green-500',
      description: 'Net weight after ice'
    },
    {
      title: 'Procurement Value',
      value: `₹${((stats?.total_procurement_value || 0) / 100000).toFixed(1)}L`,
      change: '+15%',
      trend: 'up',
      icon: DollarSign,
      color: 'bg-purple-500',
      description: 'Total procurement cost'
    },
    {
      title: 'Active Batches',
      value: stats?.active_preprocessing_batches || 0,
      change: '-2',
      trend: 'down',
      icon: Factory,
      color: 'bg-orange-500',
      description: 'Currently processing'
    },
    {
      title: 'Finished Inventory',
      value: `${(stats?.finished_goods_inventory_kg || 0).toFixed(0)} KG`,
      change: '+23%',
      trend: 'up',
      icon: Box,
      color: 'bg-teal-500',
      description: 'Ready for dispatch'
    },
    {
      title: 'Pending QC',
      value: stats?.pending_qc_items || 0,
      change: 'Low',
      trend: 'neutral',
      icon: AlertTriangle,
      color: 'bg-red-500',
      description: 'Awaiting inspection'
    },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-medium text-slate-800">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}{entry.name.includes('yield') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight" data-testid="dashboard-title">
            Dashboard Overview
          </h1>
          <p className="text-slate-600 mt-1">
            {showSkeleton ? (
              <span className="inline-flex items-center gap-2">
                <span className="animate-pulse bg-slate-200 h-4 w-48 rounded" />
                Loading…
              </span>
            ) : (
              'Real-time insights into your aquaculture operations'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className={`h-2 w-2 rounded-full ${showSkeleton ? 'bg-slate-300 animate-pulse' : 'bg-green-500'}`}></div>
          {showSkeleton ? 'Loading…' : 'Live Data'}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {showSkeleton ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="h-12 w-12 bg-slate-200 rounded-lg animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))
        ) : statCards.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === 'up' ? ArrowUpRight : stat.trend === 'down' ? ArrowDownRight : TrendingUp;
          
          return (
            <Card 
              key={index} 
              className="group hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
              data-testid={`stat-card-${index}`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    {stat.title}
                  </CardTitle>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors" data-testid={`stat-value-${index}`}>
                      {stat.value}
                    </div>
                    <div className={`flex items-center text-xs font-medium ${
                      stat.trend === 'up' ? 'text-green-600' : 
                      stat.trend === 'down' ? 'text-red-600' : 'text-slate-500'
                    }`}>
                      <TrendIcon className="h-3 w-3 mr-1" />
                      {stat.change}
                    </div>
                  </div>
                </div>
                <div className={`${stat.color} p-3 rounded-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showSkeleton ? (
          <>
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full bg-slate-100 rounded animate-pulse" />
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full bg-slate-100 rounded animate-pulse" />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
        {/* Species Distribution */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-4 w-1 bg-blue-600 rounded"></div>
              Species Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {speciesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={speciesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {speciesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-4 w-1 bg-green-600 rounded"></div>
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={paymentStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

      {/* Yield Trend */}
      {yieldTrendData.length > 0 && (
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-4 w-1 bg-purple-600 rounded"></div>
              Yield Performance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={yieldTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="yield" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', r: 5 }}
                  activeDot={{ r: 8 }}
                  animationDuration={800}
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#64748b" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}



      {/* Live Prawn Prices - Andhra Pradesh */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Live Prawn Prices - Andhra Pradesh
            <span className="ml-auto text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              Live
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {livePrices.map((price, index) => (
              <div
                key={index}
                className="group border-2 border-slate-200 rounded-xl p-4 hover:border-green-500 hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-700">{price.category}</h4>
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-green-600 mb-1">
                  ₹{price.price_per_kg.toFixed(0)}
                </div>
                <p className="text-sm text-slate-500">per KG</p>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-600">
                    <strong>Market:</strong> {price.market}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Updated: {new Date(price.date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card data-testid="recent-activities-card" className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Recent Activities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recent_activities?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_activities.map((activity, index) => (
                <div
                  key={index}
                  className="group flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-blue-50 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
                  data-testid={`activity-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{activity.description}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full font-medium group-hover:bg-blue-200 transition-colors">
                    {activity.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-slate-500">No recent activities</p>
            </div>
          )}
        </CardContent>
      </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
