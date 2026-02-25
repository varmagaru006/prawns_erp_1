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
  const [wastageData, setWastageData] = useState({});
  const [viewWastageDialog, setViewWastageDialog] = useState(false);
  const [selectedLotWastage, setSelectedLotWastage] = useState(null);
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
    no_of_trays: 0,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

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
      
      // Fetch wastage data for each lot
      const wastagePromises = lotsRes.data.map(lot => 
        axios.get(`${API}/lot-stage-wastage/${lot.id}`).catch(() => ({ data: [] }))
      );
      const wastageResults = await Promise.all(wastagePromises);
      
      const wastageMap = {};
      lotsRes.data.forEach((lot, index) => {
        wastageMap[lot.id] = wastageResults[index].data;
      });
      setWastageData(wastageMap);
      
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/procurement/lots`, formData);
      const lotId = response.data.id;
      
      // Upload photo if provided
      if (photoFile) {
        const photoFormData = new FormData();
        photoFormData.append('file', photoFile);
        photoFormData.append('entity_type', 'procurement_lot');
        photoFormData.append('entity_id', lotId);
        photoFormData.append('entity_display', response.data.lot_number);
        photoFormData.append('stage', 'procurement');
        photoFormData.append('count_per_kg_visible', formData.count_per_kg);
        photoFormData.append('tray_count_visible', formData.no_of_trays.toString());
        
        await axios.post(`${API}/upload-file`, photoFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      toast.success('Procurement lot added successfully');
      setOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add lot');
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
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

  const getYieldBadge = (yieldPct, thresholdStatus) => {
    const styles = {
      green: 'bg-green-100 text-green-800 border-green-300',
      amber: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      red: 'bg-red-100 text-red-800 border-red-300',
      info: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return (
      <span className={`px-2 py-1 rounded border text-xs font-semibold ${styles[thresholdStatus] || styles.info}`}>
        {yieldPct ? `${yieldPct.toFixed(1)}%` : 'N/A'}
      </span>
    );
  };

  const handleViewWastage = (lot) => {
    setSelectedLotWastage({ lot, wastage: wastageData[lot.id] || [] });
    setViewWastageDialog(true);
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

              <div className="grid grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="no_of_trays">Number of Trays</Label>
                  <Input
                    id="no_of_trays"
                    type="number"
                    value={formData.no_of_trays}
                    onChange={(e) => setFormData({ ...formData, no_of_trays: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    data-testid="lot-trays-input"
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

              <div className="space-y-2">
                <Label htmlFor="photo">Upload Prawn Photo (Optional)</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="cursor-pointer"
                  data-testid="lot-photo-input"
                />
                {photoPreview && (
                  <div className="mt-2">
                    <img 
                      src={photoPreview} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-md border border-slate-300"
                    />
                  </div>
                )}
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
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead>Count/KG</TableHead>
                      <TableHead>Trays</TableHead>
                      <TableHead>Net Weight (KG)</TableHead>
                      <TableHead>Ice %</TableHead>
                      <TableHead>Gate Yield</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Balance Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => {
                      const gateWastage = wastageData[lot.id]?.find(w => w.process_type === 'gate_ice');
                      const icePercent = lot.gross_weight_kg > 0 
                        ? ((lot.ice_weight_kg / lot.gross_weight_kg) * 100).toFixed(1) 
                        : 0;
                      
                      return (
                      <TableRow key={lot.id} data-testid={`lot-row-${lot.id}`}>
                        <TableCell className="font-medium">{lot.lot_number}</TableCell>
                        <TableCell>
                          {lot.purchase_invoice_no ? (
                            <span className="text-blue-600 font-mono text-sm">{lot.purchase_invoice_no}</span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>{lot.agent_name}</TableCell>
                        <TableCell>{lot.species}</TableCell>
                        <TableCell>{lot.count_per_kg || 'N/A'}</TableCell>
                        <TableCell>{lot.no_of_trays || 0}</TableCell>
                        <TableCell>{lot.net_weight_kg.toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            icePercent < 15 ? 'bg-green-100 text-green-800' :
                            icePercent < 20 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {icePercent}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {gateWastage ? getYieldBadge(gateWastage.yield_pct, gateWastage.threshold_status) : '-'}
                        </TableCell>
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
                          {lot.is_update_pending_approval ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              PENDING
                            </span>
                          ) : lot.approval_status === 'approved' ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              APPROVED
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadReceipt(lot.id)}
                              className="gap-1"
                              data-testid={`download-receipt-${lot.id}`}
                            >
                              <Download size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewWastage(lot)}
                              className="gap-1"
                              title="View Wastage"
                            >
                              <Package size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
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

      {/* View Wastage Dialog */}
      <Dialog open={viewWastageDialog} onOpenChange={setViewWastageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Wastage Details - {selectedLotWastage?.lot?.lot_number}</DialogTitle>
          </DialogHeader>
          {selectedLotWastage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Species</p>
                  <p className="font-semibold">{selectedLotWastage.lot.species}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Agent</p>
                  <p className="font-semibold">{selectedLotWastage.lot.agent_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Gross Weight</p>
                  <p className="font-semibold">{selectedLotWastage.lot.gross_weight_kg.toFixed(2)} KG</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Net Weight</p>
                  <p className="font-semibold">{selectedLotWastage.lot.net_weight_kg.toFixed(2)} KG</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Stage-wise Wastage</h3>
                {selectedLotWastage.wastage.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead>Input (KG)</TableHead>
                        <TableHead>Output (KG)</TableHead>
                        <TableHead>Wastage (KG)</TableHead>
                        <TableHead>Yield %</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Revenue Loss</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLotWastage.wastage.map((w, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium capitalize">
                            {w.process_type?.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>{w.input_weight_kg?.toFixed(2)}</TableCell>
                          <TableCell>{w.output_weight_kg?.toFixed(2)}</TableCell>
                          <TableCell className="text-red-600 font-semibold">
                            {w.wastage_kg?.toFixed(2)}
                          </TableCell>
                          <TableCell>{getYieldBadge(w.yield_pct, w.threshold_status)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              w.threshold_status === 'green' ? 'bg-green-100 text-green-800' :
                              w.threshold_status === 'amber' ? 'bg-yellow-100 text-yellow-800' :
                              w.threshold_status === 'red' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {w.threshold_status || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="text-red-600 font-semibold">
                            ₹{w.revenue_loss_inr?.toFixed(2) || '0.00'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-slate-500 text-center py-4">No wastage data available for this lot</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Procurement;
