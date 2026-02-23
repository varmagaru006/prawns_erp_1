import React, { useState } from 'react';
import Attachments from '../components/Attachments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FileText, Package, FileCheck, Truck, Layers } from 'lucide-react';

const ENTITY_TYPES = [
  { value: 'procurement_lot', label: 'Procurement Lot', icon: Truck, color: 'text-blue-600' },
  { value: 'preprocessing_batch', label: 'Preprocessing Batch', icon: Layers, color: 'text-purple-600' },
  { value: 'cold_storage_entry', label: 'Cold Storage Entry', icon: Package, color: 'text-cyan-600' },
  { value: 'quality_check', label: 'Quality Check', icon: FileCheck, color: 'text-green-600' },
  { value: 'invoice', label: 'Invoice', icon: FileText, color: 'text-orange-600' }
];

export default function AttachmentsDemo() {
  const [selectedEntityType, setSelectedEntityType] = useState('procurement_lot');
  const [entityId, setEntityId] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);

  const handleLoadAttachments = () => {
    if (!entityId.trim()) {
      alert('Please enter an Entity ID');
      return;
    }
    setShowAttachments(true);
  };

  const handleQuickTest = (type) => {
    setSelectedEntityType(type);
    setEntityId(`demo-${type}-${Date.now()}`);
    setShowAttachments(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Universal Attachments System</h1>
        <p className="text-gray-600">Upload and manage files for any entity in your ERP system</p>
      </div>

      {/* Features Card */}
      <Card>
        <CardHeader>
          <CardTitle>System Features</CardTitle>
          <CardDescription>Complete file management capabilities across all ERP modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700">✓ File Upload & Storage</h3>
              <p className="text-sm text-gray-600">Upload files up to 10MB across multiple formats</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700">✓ Categorization</h3>
              <p className="text-sm text-gray-600">Organize files by type: invoices, reports, certificates, photos</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700">✓ Universal Linking</h3>
              <p className="text-sm text-gray-600">Attach files to any entity: lots, batches, shipments, QC records</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700">✓ Download & Delete</h3>
              <p className="text-sm text-gray-600">Full file lifecycle management with soft delete</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Test Attachments</CardTitle>
          <CardDescription>Select an entity type and ID to view/manage attachments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity Type Selection */}
          <div className="space-y-3">
            <Label>Entity Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {ENTITY_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedEntityType(type.value)}
                    className={`p-3 border-2 rounded-lg transition-all hover:shadow-md ${
                      selectedEntityType === type.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mx-auto mb-2 ${type.color}`} />
                    <p className="text-xs font-medium text-center">{type.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entity ID Input */}
          <div className="space-y-2">
            <Label htmlFor="entity-id">Entity ID</Label>
            <Input
              id="entity-id"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="Enter entity ID (e.g., lot-123, batch-456)"
              className="max-w-md"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={handleLoadAttachments}>
              Load Attachments
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickTest(selectedEntityType)}
            >
              Quick Test (Generate Demo ID)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attachments Component */}
      {showAttachments && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {ENTITY_TYPES.find(t => t.value === selectedEntityType)?.label || selectedEntityType}
              <span className="text-sm font-normal text-gray-500">ID: {entityId}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Attachments
              entityType={selectedEntityType}
              entityId={entityId}
              readOnly={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-semibold text-sm mb-2">Usage in React Components</h3>
              <pre className="text-xs bg-gray-800 text-gray-100 p-3 rounded overflow-x-auto">
{`import Attachments from '../components/Attachments';

// In your detail/view page:
<Attachments 
  entityType="procurement_lot" 
  entityId={lot.id} 
  readOnly={false}
/>`}
              </pre>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-semibold text-sm mb-2">Supported Entity Types</h3>
              <ul className="text-sm text-gray-700 space-y-1 ml-4">
                <li>• <code className="bg-gray-200 px-1 rounded">procurement_lot</code> - Procurement entries</li>
                <li>• <code className="bg-gray-200 px-1 rounded">preprocessing_batch</code> - Processing batches</li>
                <li>• <code className="bg-gray-200 px-1 rounded">cold_storage_entry</code> - Cold storage records</li>
                <li>• <code className="bg-gray-200 px-1 rounded">quality_check</code> - Quality inspection records</li>
                <li>• <code className="bg-gray-200 px-1 rounded">invoice</code> - Sales invoices</li>
                <li>• Any custom entity type your ERP uses</li>
              </ul>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-semibold text-sm mb-2">File Categories</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-700">
                <span>📄 Invoice</span>
                <span>⚖️ Weighment Slip</span>
                <span>🔬 Lab Report</span>
                <span>🚪 Gate Pass</span>
                <span>📸 Photo</span>
                <span>📜 Certificate</span>
                <span>📝 Contract</span>
                <span>📁 Other</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
