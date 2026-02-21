import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Package, Weight, DollarSign, Factory, Box, AlertTriangle, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Procurement Lots',
      value: stats?.total_procurement_lots || 0,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Weight Procured',
      value: `${(stats?.total_weight_procured_kg || 0).toFixed(2)} KG`,
      icon: Weight,
      color: 'bg-green-500',
    },
    {
      title: 'Procurement Value',
      value: `₹${(stats?.total_procurement_value || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      title: 'Active Batches',
      value: stats?.active_preprocessing_batches || 0,
      icon: Factory,
      color: 'bg-orange-500',
    },
    {
      title: 'Finished Goods Inventory',
      value: `${(stats?.finished_goods_inventory_kg || 0).toFixed(2)} KG`,
      icon: Box,
      color: 'bg-teal-500',
    },
    {
      title: 'Pending QC Items',
      value: stats?.pending_qc_items || 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
    },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800" data-testid="dashboard-title">
          Dashboard Overview
        </h1>
        <p className="text-slate-600 mt-1">Monitor your aquaculture export operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} data-testid={`stat-card-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.color} p-2 rounded-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-800" data-testid={`stat-value-${index}`}>
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="recent-activities-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Activities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recent_activities?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_activities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  data-testid={`activity-${index}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{activity.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {activity.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No recent activities</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
