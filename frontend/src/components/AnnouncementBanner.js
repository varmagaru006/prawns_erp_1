import React, { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, Info, Megaphone } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export default function AnnouncementBanner({ token }) {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchAnnouncements();
    }
  }, [token]);

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch(`${API_URL}/api/announcements/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (announcementId) => {
    try {
      await fetch(`${API_URL}/api/announcements/${announcementId}/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setDismissed(prev => [...prev, announcementId]);
    } catch (err) {
      console.error('Failed to dismiss announcement:', err);
    }
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-yellow-900';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 flex-shrink-0" />;
      default:
        return <Info className="h-5 w-5 flex-shrink-0" />;
    }
  };

  const visibleAnnouncements = announcements.filter(
    ann => !dismissed.includes(ann.id)
  );

  if (loading || visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="announcement-banners">
      {visibleAnnouncements.map((announcement) => (
        <div
          key={announcement.id}
          className={`${getTypeStyles(announcement.type)} px-4 py-3`}
          data-testid={`announcement-banner-${announcement.id}`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {getTypeIcon(announcement.type)}
              <div>
                <span className="font-semibold">{announcement.title}</span>
                {announcement.body && (
                  <span className="ml-2 opacity-90">{announcement.body}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDismiss(announcement.id)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Dismiss announcement"
              data-testid={`dismiss-announcement-${announcement.id}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
