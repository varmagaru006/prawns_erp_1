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
import { Plus, ClipboardCheck, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const QualityControl = () => {
  const [inspections, setInspections] = useState([]);
  const [lots, setLots] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    entity_type: 'procurement_lot',
    entity_id: '',
    qc_officer: '',
    parameters: {
      temperature: '',
      color: '',
      texture: '',
      odor: '',
      size_uniformity: '',
      foreign_material: '',
    },
    overall_grade: 'A',
    pass_fail: true,
    failure_reason: '',
    lab_report_ref: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [inspectionsRes, lotsRes, goodsRes] = await Promise.all([
        axios.get(`${API}/qc/inspections`),
        axios.get(`${API}/procurement/lots`),
        axios.get(`${API}/finished-goods`)
      ]);
      setInspections(inspectionsRes.data);
      setLots(lotsRes.data);
      setFinishedGoods(goodsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/qc/inspections`, formData);
      toast.success('QC inspection recorded successfully');
      setOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record inspection');
    }
  };

  const getStatusBadge = (passFail) => {
    return passFail ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
        <CheckCircle size={12} />
        PASSED
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
        <XCircle size={12} />
        FAILED
      </span>
    );
  };

  const getGradeBadge = (grade) => {
    const styles = {
      A: 'bg-green-100 text-green-800',
      B: 'bg-yellow-100 text-yellow-800',
      C: 'bg-orange-100 text-orange-800',
      Rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[grade] || 'bg-gray-100 text-gray-800'}`}>
        Grade {grade}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="qc-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Quality Control</h1>
          <p className="text-slate-600 mt-1">Inspection and quality assurance tracking</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="add-inspection-button">
              <Plus size={18} />
              New Inspection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record QC Inspection</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entity_type">Entity Type *</Label>
                  <select
                    id="entity_type"
                    value={formData.entity_type}
                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value, entity_id: '' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="procurement_lot">Procurement Lot</option>
                    <option value="finished_good">Finished Goods</option>
                    <option value="cold_storage_slot">Cold Storage Slot</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entity_id">Select Entity *</Label>
                  <select
                    id="entity_id"
                    value={formData.entity_id}
                    onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select...</option>
                    {formData.entity_type === 'procurement_lot' && lots.map(lot => (
                      <option key={lot.id} value={lot.id}>{lot.lot_number}</option>
                    ))}
                    {formData.entity_type === 'finished_good' && finishedGoods.map(fg => (
                      <option key={fg.id} value={fg.id}>{fg.fg_code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qc_officer">QC Officer Name *</Label>
                <Input
                  id="qc_officer"
                  value={formData.qc_officer}
                  onChange={(e) => setFormData({ ...formData, qc_officer: e.target.value })}
                  placeholder="Officer name"
                  required
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 text-slate-700">Inspection Parameters</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature (C)</Label>
                    <Input
                      id="temperature"
                      value={formData.parameters.temperature}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, temperature: e.target.value }
                      })}
                      placeholder="e.g., -18"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Color Assessment</Label>
                    <Input
                      id="color"
                      value={formData.parameters.color}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, color: e.target.value }
                      })}
                      placeholder="e.g., Normal, Discolored"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="texture">Texture</Label>
                    <Input
                      id="texture"
                      value={formData.parameters.texture}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, texture: e.target.value }
                      })}
                      placeholder="e.g., Firm, Soft"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="odor">Odor</Label>
                    <Input
                      id="odor"
                      value={formData.parameters.odor}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, odor: e.target.value }
                      })}
                      placeholder="e.g., Fresh, Off-odor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size_uniformity">Size Uniformity</Label>
                    <Input
                      id="size_uniformity"
                      value={formData.parameters.size_uniformity}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, size_uniformity: e.target.value }
                      })}
                      placeholder="e.g., Uniform, Mixed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foreign_material">Foreign Material</Label>
                    <Input
                      id="foreign_material"
                      value={formData.parameters.foreign_material}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, foreign_material: e.target.value }
                      })}
                      placeholder="e.g., None, Detected"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="overall_grade">Overall Grade *</Label>
                  <select
                    id="overall_grade"
                    value={formData.overall_grade}
                    onChange={(e) => setFormData({ ...formData, overall_grade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass_fail">Status *</Label>
                  <select
                    id="pass_fail"
                    value={formData.pass_fail}
                    onChange={(e) => setFormData({ ...formData, pass_fail: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">PASS</option>
                    <option value="false">FAIL</option>
                  </select>
                </div>
              </div>

              {!formData.pass_fail && (
                <div className="space-y-2">
                  <Label htmlFor="failure_reason">Failure Reason</Label>
                  <textarea
                    id="failure_reason"
                    value={formData.failure_reason}
                    onChange={(e) => setFormData({ ...formData, failure_reason: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lab_report_ref">Lab Report Reference</Label>
                  <Input
                    id="lab_report_ref"
                    value={formData.lab_report_ref}
                    onChange={(e) => setFormData({ ...formData, lab_report_ref: e.target.value })}
                    placeholder="Lab report ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Record Inspection
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
            <CardTitle>QC Inspections</CardTitle>
          </CardHeader>
          <CardContent>
            {inspections.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inspection Code</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>QC Officer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspections.map((inspection) => (
                      <TableRow key={inspection.id}>
                        <TableCell className="font-medium">{inspection.inspection_code}</TableCell>
                        <TableCell className="capitalize">{inspection.entity_type.replace('_', ' ')}</TableCell>
                        <TableCell>{inspection.qc_officer}</TableCell>
                        <TableCell>{new Date(inspection.inspection_date).toLocaleDateString()}</TableCell>
                        <TableCell>{getGradeBadge(inspection.overall_grade)}</TableCell>
                        <TableCell>{getStatusBadge(inspection.pass_fail)}</TableCell>
                        <TableCell className="max-w-xs truncate">{inspection.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ClipboardCheck className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No QC inspections recorded yet. Add your first inspection to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QualityControl;
