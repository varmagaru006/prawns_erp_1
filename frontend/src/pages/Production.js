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
import { Plus, Factory } from 'lucide-react';

const Production = () => {
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    preprocessing_batch_ids: [],
    product_form: 'HOSO',
    target_size_count: '',
    glazing_pct: 0,
    block_weight_kg: 0,
    no_of_blocks: 0,
    input_weight_kg: 0,
    output_weight_kg: 0,
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, batchesRes] = await Promise.all([
        axios.get(`${API}/production/orders`),
        axios.get(`${API}/preprocessing/batches`)
      ]);
      setOrders(ordersRes.data);
      setBatches(batchesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/production/orders`, formData);
      toast.success('Production order added successfully');
      setOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add order');
    }
  };

  const toggleBatch = (batchId) => {
    setFormData(prev => ({
      ...prev,
      preprocessing_batch_ids: prev.preprocessing_batch_ids.includes(batchId)
        ? prev.preprocessing_batch_ids.filter(id => id !== batchId)
        : [...prev.preprocessing_batch_ids, batchId]
    }));
  };

  const getQCBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      passed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      on_hold: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="production-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Production</h1>
          <p className="text-slate-600 mt-1">Manage production orders and finished goods</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="add-production-order-button">
              <Plus size={18} />
              Add Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Production Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Select Preprocessing Batches *</Label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {batches.map(batch => (
                    <label key={batch.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.preprocessing_batch_ids.includes(batch.id)}
                        onChange={() => toggleBatch(batch.id)}
                        className="w-4 h-4"
                        data-testid={`batch-checkbox-${batch.id}`}
                      />
                      <span className="text-sm">
                        {batch.batch_number} - {batch.process_type} - {batch.output_weight_kg.toFixed(2)} KG
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product_form">Product Form *</Label>
                  <select
                    id="product_form"
                    value={formData.product_form}
                    onChange={(e) => setFormData({ ...formData, product_form: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="product-form-select"
                  >
                    <option value="HOSO">HOSO</option>
                    <option value="HLSO">HLSO</option>
                    <option value="PTO">PTO</option>
                    <option value="PD">PD</option>
                    <option value="PDTO">PDTO</option>
                    <option value="Butterfly">Butterfly</option>
                    <option value="Ring Cut">Ring Cut</option>
                    <option value="Cooked">Cooked</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_size_count">Target Size Count *</Label>
                  <Input
                    id="target_size_count"
                    value={formData.target_size_count}
                    onChange={(e) => setFormData({ ...formData, target_size_count: e.target.value })}
                    placeholder="e.g., 30/40"
                    required
                    data-testid="size-count-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="glazing_pct">Glazing %</Label>
                  <Input
                    id="glazing_pct"
                    type="number"
                    step="0.01"
                    value={formData.glazing_pct}
                    onChange={(e) => setFormData({ ...formData, glazing_pct: parseFloat(e.target.value) })}
                    data-testid="glazing-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block_weight_kg">Block Weight (KG)</Label>
                  <Input
                    id="block_weight_kg"
                    type="number"
                    step="0.01"
                    value={formData.block_weight_kg}
                    onChange={(e) => setFormData({ ...formData, block_weight_kg: parseFloat(e.target.value) })}
                    data-testid="block-weight-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="no_of_blocks">No. of Blocks *</Label>
                  <Input
                    id="no_of_blocks"
                    type="number"
                    value={formData.no_of_blocks}
                    onChange={(e) => setFormData({ ...formData, no_of_blocks: parseInt(e.target.value) })}
                    required
                    data-testid="blocks-count-input"
                  />
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
                    data-testid="order-input-weight"
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
                    data-testid="order-output-weight"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  data-testid="order-notes"
                />
              </div>

              <Button type="submit" className="w-full" data-testid="submit-order-button">
                Add Production Order
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
            <CardTitle>Production Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Product Form</TableHead>
                      <TableHead>Size Count</TableHead>
                      <TableHead>Blocks</TableHead>
                      <TableHead>Input (KG)</TableHead>
                      <TableHead>Output (KG)</TableHead>
                      <TableHead>Conversion %</TableHead>
                      <TableHead>QC Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.product_form}</TableCell>
                        <TableCell>{order.target_size_count}</TableCell>
                        <TableCell>{order.no_of_blocks}</TableCell>
                        <TableCell>{order.input_weight_kg.toFixed(2)}</TableCell>
                        <TableCell>{order.output_weight_kg.toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={order.conversion_rate_pct >= 85 ? 'text-green-600 font-medium' : ''}>
                            {order.conversion_rate_pct.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell>{getQCBadge(order.qc_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Factory className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No production orders found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Production;
