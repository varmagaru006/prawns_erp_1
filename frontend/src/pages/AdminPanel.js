import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Image, FileText } from 'lucide-react';

const AdminPanel = () => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [approvalsRes, photosRes] = await Promise.all([
        axios.get(`${API}/admin/pending-approvals`),
        axios.get(`${API}/admin/photos`)
      ]);
      setPendingApprovals(approvalsRes.data);
      setPhotos(photosRes.data);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approvalId, action) => {
    try {
      await axios.post(`${API}/admin/approve-action`, {
        approval_id: approvalId,
        action: action,
        notes: action === 'approve' ? 'Approved' : 'Rejected'
      });
      toast.success(`Successfully ${action}d`);
      fetchData();
    } catch (error) {
      toast.error(`Failed to ${action}`);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6" data-testid="admin-page">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Admin Panel</h1>
        <p className="text-slate-600 mt-1">Manage approvals, photos, and system settings</p>
      </div>

      <Tabs defaultValue="approvals" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="approvals">
            <Clock className="h-4 w-4 mr-2" />
            Pending Approvals ({pendingApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="photos">
            <Image className="h-4 w-4 mr-2" />
            Photo Tracking ({photos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovals.map((approval) => (
                        <TableRow key={approval.id}>
                          <TableCell className="font-medium">{approval.entity_display}</TableCell>
                          <TableCell className="capitalize">{approval.entity_type.replace('_', ' ')}</TableCell>
                          <TableCell>{approval.requester_name}</TableCell>
                          <TableCell>{new Date(approval.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{getStatusBadge(approval.approval_status)}</TableCell>
                          <TableCell>
                            {approval.approval_status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApproval(approval.id, 'approve')}
                                  className="gap-1"
                                >
                                  <CheckCircle size={14} />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleApproval(approval.id, 'reject')}
                                  className="gap-1"
                                >
                                  <XCircle size={14} />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No pending approvals</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Photo Tracking - All Stages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {photos.map((photo, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-slate-800">{photo.entity_display}</p>
                        <p className="text-sm text-slate-500">Stage: <span className="capitalize font-medium">{photo.stage}</span></p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {photo.uploader_name}
                      </span>
                    </div>
                    {photo.count_per_kg_visible && (
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>Count/KG:</strong> {photo.count_per_kg_visible}
                      </p>
                    )}
                    {photo.tray_count_visible && (
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>Trays:</strong> {photo.tray_count_visible}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">{new Date(photo.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              {photos.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Image className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No photos uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
