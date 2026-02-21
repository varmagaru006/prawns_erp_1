import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Bell, CheckCircle } from 'lucide-react';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      setNotifications(response.data);
    } catch (error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const getModuleColor = (module) => {
    const colors = {
      procurement: 'bg-blue-100 text-blue-800',
      preprocessing: 'bg-purple-100 text-purple-800',
      production: 'bg-green-100 text-green-800',
      qc: 'bg-yellow-100 text-yellow-800',
      sales: 'bg-orange-100 text-orange-800',
      system: 'bg-slate-100 text-slate-800',
    };
    return colors[module] || colors.system;
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Notifications</h1>
        <p className="text-slate-600 mt-1">Stay updated with system alerts and messages</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <Card key={notif.id} data-testid={`notification-${notif.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      notif.is_read ? 'bg-slate-100' : 'bg-blue-100'
                    }`}>
                      {notif.is_read ? (
                        <CheckCircle className="h-5 w-5 text-slate-600" />
                      ) : (
                        <Bell className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-slate-800">{notif.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getModuleColor(notif.module)}`}>
                          {notif.module}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{notif.message}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No notifications yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
