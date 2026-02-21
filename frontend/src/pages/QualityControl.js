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
import { Plus, ClipboardCheck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const QualityControl = () => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    entity_type: 'finished_good',
    entity_id: '',
    qc_officer: '',
    parameters: {
      sulfite_ppm: '',
      temperature_c: '',
      count_per_kg: '',
      moisture_pct: '',
      salinity_ppt: ''
    },
    overall_grade: 'A',
    pass_fail: true,
    failure_reason: '',
    lab_report_ref: '',
    notes: ''
  });

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async () => {
    try {
      const response = await axios.get(`${API}/qc/inspections`);
      setInspections(response.data);
    } catch (error) {
      toast.error('Failed to load inspections');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/qc/inspections`, formData);
      toast.success('QC Inspection created successfully');
      setOpen(false);
      fetchInspections();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create inspection');
    }
  };

  const getStatusIcon = (passFail) => {
    return passFail ? (
      <CheckCircle2 className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );
  };

  const getGradeBadge = (grade) => {
    const styles = {
      A: 'bg-green-100 text-green-800',
      B: 'bg-yellow-100 text-yellow-800',
      C: 'bg-orange-100 text-orange-800',
      Rejected: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[grade]}`}>
        Grade {grade}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="qc-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Quality Control</h1>
          <p className="text-slate-600 mt-1">Manage QC inspections and quality parameters</p>
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
              <DialogTitle>Create QC Inspection</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entity_type">Entity Type *</Label>
                  <select
                    id="entity_type"
                    value={formData.entity_type}
                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    data-testid="entity-type-select"
                  >
                    <option value="procurement_lot">Procurement Lot</option>
                    <option value="finished_good">Finished Good</option>
                    <option value="cold_storage_slot">Cold Storage Slot</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entity_id">Entity ID *</Label>
                  <Input
                    id="entity_id"
                    value={formData.entity_id}
                    onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                    required
                    placeholder="Enter lot/FG/slot ID"
                    data-testid="entity-id-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qc_officer">QC Officer *</Label>
                <Input
                  id="qc_officer"
                  value={formData.qc_officer}
                  onChange={(e) => setFormData({ ...formData, qc_officer: e.target.value })}
                  required
                  data-testid="qc-officer-input"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Quality Parameters</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sulfite_ppm">Sulfite (PPM)</Label>
                    <Input
                      id="sulfite_ppm"
                      type="number"
                      step="0.01"
                      value={formData.parameters.sulfite_ppm}
                      onChange={(e) => setFormData({ ...formData, parameters: { ...formData.parameters, sulfite_ppm: e.target.value }})}
                      data-testid="sulfite-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature_c">Temperature (C)</Label>
                    <Input
                      id="temperature_c"
                      type="number"
                      step="0.1"
                      value={formData.parameters.temperature_c}
                      onChange={(e) => setFormData({ ...formData, parameters: { ...formData.parameters, temperature_c: e.target.value }})}
                      data-testid="temp-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="count_per_kg">Count per KG</Label>
                    <Input
                      id="count_per_kg"
                      value={formData.parameters.count_per_kg}
                      onChange={(e) => setFormData({ ...formData, parameters: { ...formData.parameters, count_per_kg: e.target.value }})}
                      placeholder="e.g., 30/40"
                      data-testid="count-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="moisture_pct">Moisture %</Label>
                    <Input
                      id="moisture_pct"
                      type="number"
                      step="0.01"
                      value={formData.parameters.moisture_pct}
                      onChange={(e) => setFormData({ ...formData, parameters: { ...formData.parameters, moisture_pct: e.target.value }})}
                      data-testid="moisture-input"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="overall_grade">Overall Grade *</Label>
                  <select
                    id="overall_grade"
                    value={formData.overall_grade}
                    onChange={(e) => setFormData({ ...formData, overall_grade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="grade-select"
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
                      checked={formData.pass_fail}
                      onChange={(e) => setFormData({ ...formData, pass_fail: e.target.checked })}
                      className="w-4 h-4"
                      data-testid="pass-fail-checkbox"
                    />
                    <span className="text-sm font-medium">Pass Inspection</span>
                  </label>
                </div>
              </div>

              {!formData.pass_fail && (
                <div className="space-y-2">
                  <Label htmlFor="failure_reason">Failure Reason</Label>
                  <Input
                    id="failure_reason"
                    value={formData.failure_reason}
                    onChange={(e) => setFormData({ ...formData, failure_reason: e.target.value })}
                    data-testid="failure-reason-input"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="lab_report_ref">Lab Report Reference</Label>
                <Input
                  id="lab_report_ref"
                  value={formData.lab_report_ref}
                  onChange={(e) => setFormData({ ...formData, lab_report_ref: e.target.value })}
                  data-testid="lab-report-input"
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
                  data-testid="notes-input"
                />
              </div>

              <Button type="submit" className="w-full" data-testid="submit-inspection-button">
                Create Inspection
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
                      <TableHead>Grade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspections.map((inspection) => (
                      <TableRow key={inspection.id} data-testid={`inspection-row-${inspection.id}`}>
                        <TableCell className="font-medium">{inspection.inspection_code}</TableCell>
                        <TableCell className="capitalize">{inspection.entity_type.replace('_', ' ')}</TableCell>
                        <TableCell>{inspection.qc_officer}</TableCell>
                        <TableCell>{getGradeBadge(inspection.overall_grade)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(inspection.pass_fail)}
                            <span className="text-sm">
                              {inspection.pass_fail ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(inspection.inspection_date).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ClipboardCheck className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No QC inspections found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QualityControl;
