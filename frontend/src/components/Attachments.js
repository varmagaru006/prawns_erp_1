import React, { useState, useEffect, useRef } from 'react';
import { Upload, File, Trash2, Download, Image, FileText, X, Loader2, Paperclip } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'weighment_slip', label: 'Weighment Slip' },
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'gate_pass', label: 'Gate Pass' },
  { value: 'photo', label: 'Photo' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' }
];

const getFileIcon = (mimeType) => {
  if (mimeType?.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
  if (mimeType?.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-gray-500" />;
};

const formatFileSize = (sizeKb) => {
  if (sizeKb < 1024) return `${sizeKb.toFixed(1)} KB`;
  return `${(sizeKb / 1024).toFixed(1)} MB`;
};

export default function Attachments({ entityType, entityId, readOnly = false }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (entityType && entityId) {
      fetchAttachments();
    }
  }, [entityType, entityId]);

  const fetchAttachments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/attachments/${entityType}/${entityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('category', selectedCategory);
    if (description) formData.append('description', description);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/attachments/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        toast.success('File uploaded successfully');
        fetchAttachments();
        setShowUpload(false);
        setDescription('');
        setSelectedCategory('other');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Upload failed');
      }
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('Delete this attachment?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Attachment deleted');
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      }
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleDownload = (attachment) => {
    window.open(`${API_URL}${attachment.file_url}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="attachments-section">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <Paperclip className="h-4 w-4 mr-2" />
          Attachments ({attachments.length})
        </h3>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUpload(!showUpload)}
            data-testid="add-attachment-btn"
          >
            <Upload className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <div className="space-y-3">
            <div className="flex gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                data-testid="attachment-category-select"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleUpload}
                className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                disabled={uploading}
                data-testid="attachment-file-input"
              />
              {uploading && <Loader2 className="h-5 w-5 animate-spin text-primary-600" />}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowUpload(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">Max file size: 10MB</p>
          </div>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No attachments</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              data-testid={`attachment-${attachment.id}`}
            >
              <div className="flex items-center gap-3">
                {getFileIcon(attachment.mime_type)}
                <div>
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                    {attachment.file_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.file_size_kb)} • {attachment.category}
                    {attachment.description && ` • ${attachment.description}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDownload(attachment)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition"
                  title="Download"
                >
                  <Download className="h-4 w-4 text-gray-600" />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    className="p-2 hover:bg-red-100 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white p-2 rounded-lg max-w-3xl max-h-[80vh] overflow-auto">
            <img src={previewUrl} alt="Preview" className="max-w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
