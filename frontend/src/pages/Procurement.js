import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Download, Package } from 'lucide-react';

const Procurement = () => {
  const [lots, setLots] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    agent_id: '',
    vehicle_number: '',
    driver_name: '',
    arrival_time: new Date().toISOString().slice(0, 16),
    species: 'Vannamei',
    count_per_kg: '30/40',
    boxes_count: 0,
    gross_weight_kg: 0,
    ice_weight_kg: 0,
    rate_per_kg: 0,
    advance_paid: 0,
    ice_ratio_pct: 0,
    freshness_grade: 'A',
    is_rejected: false,
    rejection_reason: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [lotsRes, agentsRes] = await Promise.all([
        axios.get(`${API}/procurement/lots`),
        axios.get(`${API}/agents`)
      ]);
      setLots(lotsRes.data);
      setAgents(agentsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/procurement/lots`, formData);
      toast.success('Procurement lot added successfully');
      setOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add lot');
    }
  };

  const downloadReceipt = async (lotId) => {
    try {
      const response = await axios.get(`${API}/procurement/lots/${lotId}/receipt`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt_${lotId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Receipt downloaded');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="procurement-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Procurement</h1>
          <p className="text-slate-600 mt-1">Manage incoming prawn lots</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="add-lot-button">
              <Plus size={18} />
              Add Lot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Procurement Lot</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agent_id">Agent *</Label>
                  <select
                    id="agent_id"
                    value={formData.agent_id}
                    onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    data-testid="lot-agent-select"
                  >
                    <option value="">Select Agent</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="species">Species *</Label>
                  <select
                    id="species"
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="lot-species-select"
                  >
                    <option value="Vannamei">Vannamei</option>
                    <option value="Black Tiger">Black Tiger</option>
                    <option value="Sea Tiger">Sea Tiger</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_number">Vehicle Number *</Label>
                  <Input
                    id="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    required
                    data-testid="lot-vehicle-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver_name">Driver Name *</Label>
                  <Input
                    id="driver_name"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                    required
                    data-testid="lot-driver-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="arrival_time">Arrival Time *</Label>
                  <Input
                    id="arrival_time"
                    type="datetime-local"
                    value={formData.arrival_time}
                    onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                    required
                    data-testid="lot-arrival-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="count_per_kg">Count per KG *</Label>
                  <Input
                    id="count_per_kg"
                    value={formData.count_per_kg}
                    onChange={(e) => setFormData({ ...formData, count_per_kg: e.target.value })}
                    placeholder="e.g., 30/40"
                    required
                    data-testid="lot-count-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="boxes_count">Boxes/Crates *</Label>
                  <Input
                    id="boxes_count"
                    type="number"
                    value={formData.boxes_count}
                    onChange={(e) => setFormData({ ...formData, boxes_count: parseInt(e.target.value) })}
                    required
                    data-testid="lot-boxes-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gross_weight_kg">Gross Weight (KG) *</Label>
                  <Input
                    id="gross_weight_kg"
                    type="number"
                    step="0.01"
                    value={formData.gross_weight_kg}
                    onChange={(e) => setFormData({ ...formData, gross_weight_kg: parseFloat(e.target.value) })}
                    required
                    data-testid="lot-gross-weight-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ice_weight_kg">Ice Weight (KG) *</Label>
                  <Input
                    id="ice_weight_kg"
                    type="number"
                    step="0.01"
                    value={formData.ice_weight_kg}
                    onChange={(e) => setFormData({ ...formData, ice_weight_kg: parseFloat(e.target.value) })}
                    required
                    data-testid="lot-ice-weight-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate_per_kg">Rate per KG (₹) *</Label>
                  <Input
                    id="rate_per_kg"
                    type="number"
                    step="0.01"
                    value={formData.rate_per_kg}
                    onChange={(e) => setFormData({ ...formData, rate_per_kg: parseFloat(e.target.value) })}
                    required
                    data-testid="lot-rate-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advance_paid">Advance Paid (₹)</Label>
                  <Input
                    id="advance_paid"
                    type="number"
                    step="0.01"
                    value={formData.advance_paid}
                    onChange={(e) => setFormData({ ...formData, advance_paid: parseFloat(e.target.value) })}
                    data-testid="lot-advance-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ice_ratio_pct">Ice Ratio %</Label>
                  <Input
                    id="ice_ratio_pct"
                    type="number"
                    step="0.01"
                    value={formData.ice_ratio_pct}
                    onChange={(e) => setFormData({ ...formData, ice_ratio_pct: parseFloat(e.target.value) })}
                    data-testid="lot-ice-ratio-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="freshness_grade">Freshness Grade *</Label>
                  <select
                    id="freshness_grade"
                    value={formData.freshness_grade}
                    onChange={(e) => setFormData({ ...formData, freshness_grade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="lot-grade-select"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_rejected}
                      onChange={(e) => setFormData({ ...formData, is_rejected: e.target.checked })}
                      className="w-4 h-4"
                      data-testid="lot-rejected-checkbox"
                    />
                    <span className="text-sm font-medium">Mark as Rejected</span>
                  </label>
                </div>
              </div>

              {formData.is_rejected && (
                <div className="space-y-2">
                  <Label htmlFor="rejection_reason">Rejection Reason</Label>
                  <Input
                    id="rejection_reason"
                    value={formData.rejection_reason}
                    onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                    data-testid="lot-rejection-reason-input"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  data-testid="lot-notes-input"
                />
              </div>

              <Button type="submit" className="w-full" data-testid="submit-lot-button">
                Add Procurement Lot
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Procurement Lots</CardTitle>
          </CardHeader>
          <CardContent>
            {lots.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead>Net Weight (KG)</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Balance Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => (
                      <TableRow key={lot.id} data-testid={`lot-row-${lot.id}`}>
                        <TableCell className="font-medium">{lot.lot_number}</TableCell>
                        <TableCell>{lot.agent_name}</TableCell>
                        <TableCell>{lot.species}</TableCell>
                        <TableCell>{lot.net_weight_kg.toFixed(2)}</TableCell>
                        <TableCell>₹{lot.total_amount.toFixed(2)}</TableCell>
                        <TableCell>₹{lot.balance_due.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(lot.payment_status)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            lot.freshness_grade === 'A' ? 'bg-green-100 text-green-800' :
                            lot.freshness_grade === 'B' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {lot.freshness_grade}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadReceipt(lot.id)}
                            className="gap-1"
                            data-testid={`download-receipt-${lot.id}`}
                          >
                            <Download size={14} />
                            Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No procurement lots found. Add your first lot to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Procurement;
