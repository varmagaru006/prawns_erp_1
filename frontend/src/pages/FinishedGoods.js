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
import { formatLoadErrorMessage } from '../utils/apiError';
import { Plus, Box } from 'lucide-react';

const FinishedGoods = () => {
  const [goods, setGoods] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    production_order_id: '',
    product_form: 'HOSO',
    size_count: '',
    weight_kg: 0,
    storage_location: '',
    temperature_c: -18,
    expiry_date: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [goodsRes, ordersRes] = await Promise.all([
        axios.get(`${API}/finished-goods`),
        axios.get(`${API}/production/orders`)
      ]);
      setGoods(goodsRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      toast.error(formatLoadErrorMessage('Failed to load data', error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/finished-goods`, {
        ...formData,
        expiry_date: formData.expiry_date || null
      });
      toast.success('Finished good added successfully');
      setOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add finished good');
    }
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
    <div className="space-y-6" data-testid="finished-goods-page">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Finished Goods</h1>
          <p className="text-slate-600 mt-1">Track finished goods inventory and cold storage</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto" data-testid="add-finished-good-button">
              <Plus size={18} />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Finished Good</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="production_order_id">Production Order *</Label>
                <select
                  id="production_order_id"
                  value={formData.production_order_id}
                  onChange={(e) => setFormData({ ...formData, production_order_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  data-testid="fg-order-select"
                >
                  <option value="">Select Order</option>
                  {orders.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.order_number} - {order.product_form}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product_form">Product Form *</Label>
                  <select
                    id="product_form"
                    value={formData.product_form}
                    onChange={(e) => setFormData({ ...formData, product_form: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="fg-form-select"
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
                  <Label htmlFor="size_count">Size Count *</Label>
                  <Input
                    id="size_count"
                    value={formData.size_count}
                    onChange={(e) => setFormData({ ...formData, size_count: e.target.value })}
                    placeholder="e.g., 30/40"
                    required
                    data-testid="fg-size-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight_kg">Weight (KG) *</Label>
                  <Input
                    id="weight_kg"
                    type="number"
                    step="0.01"
                    value={formData.weight_kg}
                    onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) })}
                    required
                    data-testid="fg-weight-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_location">Storage Location</Label>
                  <Input
                    id="storage_location"
                    value={formData.storage_location}
                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    placeholder="e.g., Cold Room A-1"
                    data-testid="fg-location-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature_c">Temperature (°C)</Label>
                  <Input
                    id="temperature_c"
                    type="number"
                    step="0.1"
                    value={formData.temperature_c}
                    onChange={(e) => setFormData({ ...formData, temperature_c: parseFloat(e.target.value) })}
                    data-testid="fg-temperature-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Expiry Date</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    data-testid="fg-expiry-input"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" data-testid="submit-fg-button">
                Add Finished Good
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
            <CardTitle>Finished Goods Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {goods.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>FG Code</TableHead>
                      <TableHead>Product Form</TableHead>
                      <TableHead>Size Count</TableHead>
                      <TableHead>Weight (KG)</TableHead>
                      <TableHead>Storage Location</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>QC Status</TableHead>
                      <TableHead>Manufactured</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goods.map((item) => (
                      <TableRow key={item.id} data-testid={`fg-row-${item.id}`}>
                        <TableCell className="font-medium">{item.fg_code}</TableCell>
                        <TableCell>{item.product_form}</TableCell>
                        <TableCell>{item.size_count}</TableCell>
                        <TableCell>{item.weight_kg.toFixed(2)}</TableCell>
                        <TableCell>{item.storage_location || 'N/A'}</TableCell>
                        <TableCell>
                          {item.temperature_c ? `${item.temperature_c}°C` : 'N/A'}
                        </TableCell>
                        <TableCell>{getQCBadge(item.qc_status)}</TableCell>
                        <TableCell>
                          {new Date(item.manufactured_date).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Box className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No finished goods found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinishedGoods;
