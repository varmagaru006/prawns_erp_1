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
import { Plus, Edit2, Trash2, TrendingUp } from 'lucide-react';

const YieldBenchmarks = () => {
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    species: 'Vannamei',
    process_type: 'heading',
    min_yield_pct: '',
    optimal_yield_pct: '',
    max_yield_pct: '',
    tolerance_pct: '',
    reference_rate_per_kg: '',
    description: '',
  });

  const processTypes = [
    { value: 'gate_ice', label: 'Gate Ice Deduction' },
    { value: 'heading', label: 'Heading' },
    { value: 'peeling', label: 'Peeling' },
    { value: 'deveining', label: 'Deveining' },
    { value: 'grading', label: 'Grading / Sizing' },
    { value: 'cooking', label: 'Cooking / Blanching' },
    { value: 'iqf_freezing', label: 'IQF Freezing' },
    { value: 'glazing', label: 'Glazing' },
    { value: 'breading', label: 'Breading / Coating' },
    { value: 'cold_storage_monthly', label: 'Cold Storage (Monthly)' },
  ];

  useEffect(() => {
    fetchBenchmarks();
  }, []);

  const fetchBenchmarks = async () => {
    try {
      const response = await axios.get(`${API}/yield-benchmarks`);
      setBenchmarks(response.data);
    } catch (error) {
      toast.error('Failed to load benchmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Clean up data - send null for empty strings
      const cleanData = {
        ...formData,
        min_yield_pct: formData.min_yield_pct ? parseFloat(formData.min_yield_pct) : null,
        optimal_yield_pct: formData.optimal_yield_pct ? parseFloat(formData.optimal_yield_pct) : null,
        max_yield_pct: formData.max_yield_pct ? parseFloat(formData.max_yield_pct) : null,
        tolerance_pct: formData.tolerance_pct ? parseFloat(formData.tolerance_pct) : null,
        reference_rate_per_kg: formData.reference_rate_per_kg ? parseFloat(formData.reference_rate_per_kg) : null,
      };

      if (editingId) {
        await axios.put(`${API}/yield-benchmarks/${editingId}`, cleanData);
        toast.success('Benchmark updated successfully');
      } else {
        await axios.post(`${API}/yield-benchmarks`, cleanData);
        toast.success('Benchmark created successfully');
      }
      
      setOpen(false);
      setEditingId(null);
      resetForm();
      fetchBenchmarks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save benchmark');
    }
  };

  const handleEdit = (benchmark) => {
    setFormData({
      species: benchmark.species,
      process_type: benchmark.process_type,
      min_yield_pct: benchmark.min_yield_pct || '',
      optimal_yield_pct: benchmark.optimal_yield_pct || '',
      max_yield_pct: benchmark.max_yield_pct || '',
      tolerance_pct: benchmark.tolerance_pct || '',
      reference_rate_per_kg: benchmark.reference_rate_per_kg || '',
      description: benchmark.description || '',
    });
    setEditingId(benchmark.id);
    setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this benchmark?')) return;
    
    try {
      await axios.delete(`${API}/yield-benchmarks/${id}`);
      toast.success('Benchmark deleted successfully');
      fetchBenchmarks();
    } catch (error) {
      toast.error('Failed to delete benchmark');
    }
  };

  const resetForm = () => {
    setFormData({
      species: 'Vannamei',
      process_type: 'heading',
      min_yield_pct: '',
      optimal_yield_pct: '',
      max_yield_pct: '',
      tolerance_pct: '',
      reference_rate_per_kg: '',
      description: '',
    });
  };

  const groupedBenchmarks = benchmarks.reduce((acc, b) => {
    if (!acc[b.species]) acc[b.species] = [];
    acc[b.species].push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="yield-benchmarks-page">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Yield Benchmarks</h1>
          <p className="text-slate-600 mt-1">Configure threshold standards for wastage tracking</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto">
              <Plus size={18} />
              Add Benchmark
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Add'} Yield Benchmark</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="species">Species *</Label>
                  <select
                    id="species"
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    required
                  >
                    <option value="Vannamei">Vannamei</option>
                    <option value="Black Tiger">Black Tiger</option>
                    <option value="Sea Tiger">Sea Tiger</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="process_type">Process Type *</Label>
                  <select
                    id="process_type"
                    value={formData.process_type}
                    onChange={(e) => setFormData({ ...formData, process_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    required
                  >
                    {processTypes.map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_yield_pct">Min Yield %</Label>
                  <Input
                    id="min_yield_pct"
                    type="number"
                    step="0.01"
                    value={formData.min_yield_pct}
                    onChange={(e) => setFormData({ ...formData, min_yield_pct: e.target.value })}
                    placeholder="e.g., 65"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="optimal_yield_pct">Optimal Yield %</Label>
                  <Input
                    id="optimal_yield_pct"
                    type="number"
                    step="0.01"
                    value={formData.optimal_yield_pct}
                    onChange={(e) => setFormData({ ...formData, optimal_yield_pct: e.target.value })}
                    placeholder="e.g., 68"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_yield_pct">Max Yield %</Label>
                  <Input
                    id="max_yield_pct"
                    type="number"
                    step="0.01"
                    value={formData.max_yield_pct}
                    onChange={(e) => setFormData({ ...formData, max_yield_pct: e.target.value })}
                    placeholder="e.g., 72"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tolerance_pct">Tolerance % (for glazing/breading)</Label>
                  <Input
                    id="tolerance_pct"
                    type="number"
                    step="0.01"
                    value={formData.tolerance_pct}
                    onChange={(e) => setFormData({ ...formData, tolerance_pct: e.target.value })}
                    placeholder="e.g., 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference_rate_per_kg">Reference Rate per KG (₹)</Label>
                  <Input
                    id="reference_rate_per_kg"
                    type="number"
                    step="0.01"
                    value={formData.reference_rate_per_kg}
                    onChange={(e) => setFormData({ ...formData, reference_rate_per_kg: e.target.value })}
                    placeholder="e.g., 350"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  rows="2"
                  placeholder="e.g., Vannamei heading: 68-72% typical"
                />
              </div>

              <Button type="submit" className="w-full">
                {editingId ? 'Update' : 'Create'} Benchmark
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
        <div className="space-y-6">
          {Object.keys(groupedBenchmarks).map(species => (
            <Card key={species}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  {species} Benchmarks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Process Type</TableHead>
                      <TableHead className="text-center">Min %</TableHead>
                      <TableHead className="text-center">Optimal %</TableHead>
                      <TableHead className="text-center">Max %</TableHead>
                      <TableHead className="text-center">Tolerance</TableHead>
                      <TableHead className="text-right">Rate (₹/kg)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedBenchmarks[species].map((benchmark) => (
                      <TableRow key={benchmark.id}>
                        <TableCell className="font-medium">
                          {processTypes.find(p => p.value === benchmark.process_type)?.label || benchmark.process_type}
                        </TableCell>
                        <TableCell className="text-center">
                          {benchmark.min_yield_pct ? `${benchmark.min_yield_pct}%` : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {benchmark.optimal_yield_pct ? `${benchmark.optimal_yield_pct}%` : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {benchmark.max_yield_pct ? `${benchmark.max_yield_pct}%` : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {benchmark.tolerance_pct ? `±${benchmark.tolerance_pct}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {benchmark.reference_rate_per_kg ? `₹${benchmark.reference_rate_per_kg}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(benchmark)}
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(benchmark.id)}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default YieldBenchmarks;
