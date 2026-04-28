import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Image, Users, Plus, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { ALL_PAGES } from '../config/moduleConfig';

// ── Helpers ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'procurement_manager', label: 'Procurement Manager' },
  { value: 'production_supervisor', label: 'Production Supervisor' },
  { value: 'cold_storage_incharge', label: 'Cold Storage Incharge' },
  { value: 'qc_officer', label: 'QC Officer' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'accounts_manager', label: 'Accounts Manager' },
  { value: 'risk_reviewer', label: 'Risk Reviewer' },
  { value: 'worker', label: 'Worker' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
];

const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

// Group pages by group key
const PAGE_GROUPS = ALL_PAGES.reduce((acc, p) => {
  (acc[p.group] = acc[p.group] || []).push(p);
  return acc;
}, {});

// ── User permissions checklist ─────────────────────────────────────────────

const PermissionsChecklist = ({ userId, currentPermissions, onSaved }) => {
  const [selected, setSelected] = useState(new Set(currentPermissions || []));
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (pages) => {
    const keys = pages.map((p) => p.key);
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/users/${userId}/permissions`, {
        page_permissions: selected.size > 0 ? [...selected] : [],
      });
      toast.success('Permissions saved');
      onSaved([...selected]);
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(ALL_PAGES.map((p) => p.key)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" variant="outline" onClick={selectAll}>Select All</Button>
        <Button size="sm" variant="outline" onClick={clearAll}>Clear All</Button>
        <span className="text-xs text-slate-500 ml-auto">{selected.size} of {ALL_PAGES.length} pages selected</span>
      </div>
      {Object.entries(PAGE_GROUPS).map(([group, pages]) => {
        const allOn = pages.every((p) => selected.has(p.key));
        const someOn = pages.some((p) => selected.has(p.key));
        const isOpen = expanded[group] !== false;
        return (
          <div key={group} className="border rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 text-sm font-medium"
              onClick={() => setExpanded((e) => ({ ...e, [group]: !isOpen }))}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => { if (el) el.indeterminate = someOn && !allOn; }}
                  onChange={() => toggleGroup(pages)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded"
                />
                <span>{group}</span>
                <span className="text-xs text-slate-400">({pages.filter((p) => selected.has(p.key)).length}/{pages.length})</span>
              </div>
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isOpen && (
              <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pages.map((page) => (
                  <label key={page.key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selected.has(page.key)}
                      onChange={() => toggle(page.key)}
                      className="rounded"
                    />
                    <span>{page.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <Button onClick={save} disabled={saving} className="w-full mt-2">
        {saving ? 'Saving…' : 'Save Permissions'}
      </Button>
    </div>
  );
};

// ── Create user form ───────────────────────────────────────────────────────

const CreateUserDialog = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'worker', phone: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.post(`${API}/users`, form);
      toast.success(`User ${res.data.name} created`);
      setOpen(false);
      setForm({ name: '', email: '', password: '', role: 'worker', phone: '' });
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={16} />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Password *</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Role *</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Creating…' : 'Create User'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Users & Access tab ─────────────────────────────────────────────────────

const UsersAccess = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permOpen, setPermOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (user) => {
    try {
      if (user.is_active) {
        await axios.delete(`${API}/users/${user.id}`);
        toast.success(`${user.name} deactivated`);
      } else {
        await axios.put(`${API}/users/${user.id}`, { is_active: true });
        toast.success(`${user.name} reactivated`);
      }
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    }
  };

  const changeRole = async (userId, role) => {
    try {
      await axios.put(`${API}/users/${userId}`, { role });
      toast.success('Role updated');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch {
      toast.error('Failed to update role');
    }
  };

  const openPermissions = (user) => {
    setSelectedUser(user);
    setPermOpen(true);
  };

  const onPermsSaved = (perms) => {
    setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, page_permissions: perms } : u)));
    setPermOpen(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} user{users.length !== 1 ? 's' : ''} in this tenant</p>
        <CreateUserDialog onCreated={(u) => setUsers((prev) => [...prev, u])} />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Page Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-slate-500 text-sm">{user.email}</TableCell>
                <TableCell>
                  {user.role === 'admin' || user.role === 'owner' ? (
                    <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {ROLE_LABEL[user.role] || user.role}
                    </span>
                  ) : (
                    <Select value={user.role} onValueChange={(v) => changeRole(user.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => r.value !== 'admin').map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {user.role === 'admin' || user.role === 'owner' ? (
                    <span className="text-xs text-slate-400">All pages</span>
                  ) : Array.isArray(user.page_permissions) && user.page_permissions.length > 0 ? (
                    <button
                      onClick={() => openPermissions(user)}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Shield size={12} />
                      {user.page_permissions.length} page{user.page_permissions.length !== 1 ? 's' : ''} granted
                    </button>
                  ) : (
                    <button
                      onClick={() => openPermissions(user)}
                      className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"
                    >
                      <Shield size={12} />
                      Role defaults
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  {user.role !== 'admin' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPermissions(user)}
                        className="gap-1 text-xs"
                      >
                        <Shield size={12} />
                        Permissions
                      </Button>
                      <Button
                        size="sm"
                        variant={user.is_active ? 'destructive' : 'default'}
                        onClick={() => toggleActive(user)}
                        className="text-xs"
                      >
                        {user.is_active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield size={16} />
              Page Access — {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 -mt-2">
            When pages are explicitly selected here, they override the default role-based access. Leave empty to use role defaults.
          </p>
          {selectedUser && (
            <PermissionsChecklist
              userId={selectedUser.id}
              currentPermissions={selectedUser.page_permissions}
              onSaved={onPermsSaved}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

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
        <p className="text-slate-600 mt-1">Manage users, approvals, photos, and system settings</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Users & Access
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <Clock className="h-4 w-4 mr-2" />
            Pending Approvals ({pendingApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="photos">
            <Image className="h-4 w-4 mr-2" />
            Photo Tracking ({photos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Users & Access Control</CardTitle>
            </CardHeader>
            <CardContent>
              <UsersAccess />
            </CardContent>
          </Card>
        </TabsContent>

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
              <div className="max-h-[600px] overflow-y-auto space-y-4">
                {photos.map((photo, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        {photo.photo_url ? (
                          <img
                            src={photo.photo_url}
                            alt={photo.entity_display}
                            className="w-full h-48 object-cover rounded-lg border border-slate-300"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        ) : (
                          <div className="w-full h-48 flex items-center justify-center bg-slate-200 rounded-lg border border-slate-300">
                            <Image className="h-12 w-12 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-slate-800">{photo.entity_display}</p>
                            <p className="text-sm text-slate-500">
                              Stage: <span className="capitalize font-medium">{photo.stage}</span>
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                            {photo.uploader_name}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {photo.count_per_kg_visible && (
                            <div className="text-sm">
                              <span className="font-semibold text-slate-700">Count/KG:</span>
                              <span className="ml-1 text-slate-600">{photo.count_per_kg_visible}</span>
                            </div>
                          )}
                          {photo.tray_count_visible && (
                            <div className="text-sm">
                              <span className="font-semibold text-slate-700">Trays:</span>
                              <span className="ml-1 text-slate-600">{photo.tray_count_visible}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          Uploaded: {new Date(photo.created_at).toLocaleString()}
                        </p>
                        {photo.notes && (
                          <p className="text-sm text-slate-600 mt-2 italic">
                            Note: {photo.notes}
                          </p>
                        )}
                      </div>
                    </div>
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
