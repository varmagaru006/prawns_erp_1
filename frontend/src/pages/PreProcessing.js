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
import { Plus, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const PreProcessing = () => {
  const [batches, setBatches] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    procurement_lot_id: '',
    process_type: 'heading',
    input_weight_kg: 0,
    output_weight_kg: 0,
    start_time: new Date().toISOString().slice(0, 16),
    end_time: '',
    workers: [],
    supervisor: '',
    notes: '',
  });
  const [workerInput, setWorkerInput] = useState({
    worker_code: '',
    name: '',
    kg_processed: 0,
    hours_worked: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [batchesRes, lotsRes] = await Promise.all([
        axios.get(`${API}/preprocessing/batches`),
        axios.get(`${API}/procurement/lots`)
      ]);
      setBatches(batchesRes.data);
      setLots(lotsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addWorker = () => {
    if (!workerInput.name) {
      toast.error('Please fill worker details');
      return;
    }
    setFormData({
      ...formData,
      workers: [...formData.workers, workerInput]
    });
    setWorkerInput({
      worker_code: '',
      name: '',
      kg_processed: 0,
      hours_worked: 0,
    });
  };

  const removeWorker = (index) => {
    setFormData({
      ...formData,
      workers: formData.workers.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        end_time: formData.end_time ? formData.end_time : null
      };
      await axios.post(`${API}/preprocessing/batches`, submitData);
      toast.success('Preprocessing batch added successfully');
      setOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add batch');
    }
  };

  return (
    <div className="space-y-6" data-testid="preprocessing-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Pre-Processing</h1>
          <p className="text-slate-600 mt-1">Manage processing batches and worker assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="add-batch-button">
              <Plus size={18} />
              Add Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Preprocessing Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="procurement_lot_id">Procurement Lot *</Label>
                  <select
                    id="procurement_lot_id"
                    value={formData.procurement_lot_id}
                    onChange={(e) => setFormData({ ...formData, procurement_lot_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    data-testid="batch-lot-select"
                  >
                    <option value="">Select Lot</option>
                    {lots.map(lot => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lot_number} - {lot.net_weight_kg.toFixed(2)} KG
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="process_type">Process Type *</Label>
                  <select
                    id="process_type"
                    value={formData.process_type}
                    onChange={(e) => setFormData({ ...formData, process_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="batch-process-select"
                  >
                    <option value="heading">Heading</option>
                    <option value="peeling">Peeling</option>
                    <option value="deveining">Deveining</option>
                    <option value="iqf">IQF</option>
                    <option value="blanching">Blanching</option>
                    <option value="grading">Grading</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="input_weight_kg">Input Weight (KG) *</Label>
                  <Input
                    id="input_weight_kg"
                    type="number"
                    step="0.01"
                    value={formData.input_weight_kg}
                    onChange={(e) => setFormData({ ...formData, input_weight_kg: parseFloat(e.target.value) })}
                    required
                    data-testid="batch-input-weight"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="output_weight_kg">Output Weight (KG) *</Label>
                  <Input
                    id="output_weight_kg"
                    type="number"
                    step="0.01"
                    value={formData.output_weight_kg}
                    onChange={(e) => setFormData({ ...formData, output_weight_kg: parseFloat(e.target.value) })}
                    required
                    data-testid="batch-output-weight"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                    data-testid="batch-start-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    data-testid="batch-end-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor *</Label>
                <Input
                  id="supervisor"
                  value={formData.supervisor}
                  onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                  required
                  data-testid="batch-supervisor"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Workers</h3>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <Input
                    placeholder="Worker Code"
                    value={workerInput.worker_code}
                    onChange={(e) => setWorkerInput({ ...workerInput, worker_code: e.target.value })}
                    data-testid="worker-code-input"
                  />
                  <Input
                    placeholder="Name"
                    value={workerInput.name}
                    onChange={(e) => setWorkerInput({ ...workerInput, name: e.target.value })}
                    data-testid="worker-name-input"
                  />
                  <Input
                    placeholder="KG Processed"
                    type="number"
                    step="0.01"
                    value={workerInput.kg_processed}
                    onChange={(e) => setWorkerInput({ ...workerInput, kg_processed: parseFloat(e.target.value) })}
                    data-testid="worker-kg-input"
                  />
                  <Input
                    placeholder="Hours"
                    type="number"
                    step="0.5"
                    value={workerInput.hours_worked}
                    onChange={(e) => setWorkerInput({ ...workerInput, hours_worked: parseFloat(e.target.value) })}
                    data-testid="worker-hours-input"
                  />
                </div>
                <Button type="button" onClick={addWorker} size="sm" data-testid="add-worker-button">
                  Add Worker
                </Button>
                
                {formData.workers.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.workers.map((worker, index) => (
                      <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                        <span className="text-sm">
                          {worker.name} - {worker.kg_processed} KG - {worker.hours_worked} hrs
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWorker(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  data-testid="batch-notes"
                />
              </div>

              <Button type="submit" className="w-full" data-testid="submit-batch-button">
                Add Preprocessing Batch
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
            <CardTitle>Preprocessing Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {batches.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Number</TableHead>
                      <TableHead>Process Type</TableHead>
                      <TableHead>Input (KG)</TableHead>
                      <TableHead>Output (KG)</TableHead>
                      <TableHead>Yield %</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Workers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id} data-testid={`batch-row-${batch.id}`}>
                        <TableCell className="font-medium">{batch.batch_number}</TableCell>
                        <TableCell className="capitalize">{batch.process_type}</TableCell>
                        <TableCell>{batch.input_weight_kg.toFixed(2)}</TableCell>
                        <TableCell>{batch.output_weight_kg.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={batch.yield_alert ? 'text-red-600 font-medium' : ''}>
                              {batch.yield_pct.toFixed(2)}%
                            </span>
                            {batch.yield_alert ? (
                              <AlertTriangle size={16} className="text-red-600" />
                            ) : batch.yield_pct >= 85 ? (
                              <TrendingUp size={16} className="text-green-600" />
                            ) : (
                              <TrendingDown size={16} className="text-yellow-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            batch.end_time ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {batch.end_time ? 'Completed' : 'Active'}
                          </span>
                        </TableCell>
                        <TableCell>{batch.supervisor}</TableCell>
                        <TableCell>{batch.workers.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-slate-500">No preprocessing batches found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PreProcessing;
