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
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';

const MarketRates = () => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentRate, setCurrentRate] = useState(null);
  const [formData, setFormData] = useState({
    species: 'Vannamei',
    product_form: 'HLSO',
    rate_per_kg_inr: 0,
    rate_per_kg_usd: 0,
    effective_from: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await axios.get(`${API}/market-rates`);
      setRates(response.data);
    } catch (error) {
      toast.error('Failed to load market rates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode && currentRate) {
        await axios.put(`${API}/market-rates/${currentRate.id}`, formData);
        toast.success('Market rate updated successfully');
      } else {
        await axios.post(`${API}/market-rates`, formData);
        toast.success('Market rate added successfully');
      }
      setOpen(false);
      resetForm();
      fetchRates();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save market rate');
    }
  };

  const handleEdit = (rate) => {
    setCurrentRate(rate);
    setFormData({
      species: rate.species,
      product_form: rate.product_form,
      rate_per_kg_inr: rate.rate_per_kg_inr,
      rate_per_kg_usd: rate.rate_per_kg_usd || 0,
      effective_from: rate.effective_from,
      notes: rate.notes || ''
    });
    setEditMode(true);
    setOpen(true);
  };

  const handleDelete = async (rateId) => {
    if (!window.confirm('Are you sure you want to delete this market rate?')) return;
    try {
      await axios.delete(`${API}/market-rates/${rateId}`);
      toast.success('Market rate deleted');
      fetchRates();
    } catch (error) {
      toast.error('Failed to delete market rate');
    }
  };

  const resetForm = () => {
    setFormData({
      species: 'Vannamei',
      product_form: 'HLSO',
      rate_per_kg_inr: 0,
      rate_per_kg_usd: 0,
      effective_from: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setEditMode(false);
    setCurrentRate(null);
  };

  const handleDialogClose = (isOpen) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Market Rates</h1>
          <p className="text-slate-600 mt-1">Manage pricing for revenue loss calculations</p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto" onClick={() => { setEditMode(false); setOpen(true); }}>
              <Plus size={18} />
              Add Market Rate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Market Rate' : 'Add New Market Rate'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="species">Species *</Label>
                  <select
                    id="species"
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Vannamei">Vannamei</option>
                    <option value="Black Tiger">Black Tiger</option>
                    <option value="Sea Tiger">Sea Tiger</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product_form">Product Form *</Label>
                  <select
                    id="product_form"
                    value={formData.product_form}
                    onChange={(e) => setFormData({ ...formData, product_form: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="HLSO">HLSO (Headless)</option>
                    <option value="PD">PD (Peeled Deveined)</option>
                    <option value="PDTO">PDTO (Peeled Deveined Tail On)</option>
                    <option value="PUD">PUD (Peeled Undeveined)</option>
                    <option value="Cooked">Cooked</option>
                    <option value="Whole">Whole</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate_per_kg_inr">Rate per KG (INR) *</Label>
                  <Input
                    id="rate_per_kg_inr"
                    type="number"
                    step="0.01"
                    value={formData.rate_per_kg_inr}
                    onChange={(e) => setFormData({ ...formData, rate_per_kg_inr: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_per_kg_usd">Rate per KG (USD)</Label>
                  <Input
                    id="rate_per_kg_usd"
                    type="number"
                    step="0.01"
                    value={formData.rate_per_kg_usd}
                    onChange={(e) => setFormData({ ...formData, rate_per_kg_usd: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective_from">Effective From *</Label>
                <Input
                  id="effective_from"
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>

              <Button type="submit" className="w-full">
                {editMode ? 'Update Market Rate' : 'Add Market Rate'}
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
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={20} />
              Active Market Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rates.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Species</TableHead>
                      <TableHead>Product Form</TableHead>
                      <TableHead>Rate (INR/KG)</TableHead>
                      <TableHead>Rate (USD/KG)</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium">{rate.species}</TableCell>
                        <TableCell>{rate.product_form}</TableCell>
                        <TableCell className="font-semibold text-green-700">
                          ₹{rate.rate_per_kg_inr.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {rate.rate_per_kg_usd ? `$${rate.rate_per_kg_usd.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>{rate.effective_from}</TableCell>
                        <TableCell className="max-w-xs truncate">{rate.notes || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(rate)}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(rate.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <DollarSign className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No market rates found. Add your first rate to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MarketRates;
