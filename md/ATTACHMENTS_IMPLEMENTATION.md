# Universal Attachments System - Implementation Guide

## Overview
The Universal Attachments System is a complete file management solution that enables users to attach, view, download, and manage files for any entity across all modules in the Prawn ERP system.

## Features
✅ **File Upload & Storage** - Upload files up to 10MB in multiple formats
✅ **Universal Linking** - Attach files to any entity (lots, batches, invoices, QC records, etc.)
✅ **Categorization** - Organize files by type (Invoice, Report, Certificate, Photo, etc.)
✅ **Download & Delete** - Full file lifecycle management with soft delete
✅ **Reusable Component** - Drop-in component for any page
✅ **Demo & Documentation** - Interactive testing page with integration examples

## Backend Implementation

### Database Schema (MongoDB)
```javascript
// Collection: attachments
{
  id: "uuid",
  entity_type: "procurement_lot",
  entity_id: "lot-123",
  file_name: "invoice.pdf",
  file_url: "/uploads/unique-file-id.pdf",
  file_size_kb: 245.6,
  mime_type: "application/pdf",
  category: "invoice",
  description: "Supplier invoice for lot 123",
  uploaded_by: "user-id",
  is_deleted: false,
  created_at: "2026-02-23T06:42:13.571108Z"
}
```

### API Endpoints

#### 1. Upload Attachment
```bash
POST /api/attachments/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form Data:
- file: (binary file)
- entity_type: "procurement_lot"
- entity_id: "lot-123"
- category: "invoice"
- description: "Optional description" (optional)

Response:
{
  "id": "attachment-uuid",
  "file_name": "invoice.pdf",
  "file_url": "/uploads/unique-id.pdf",
  "file_size_kb": 245.6,
  "category": "invoice"
}
```

#### 2. Get Attachments for Entity
```bash
GET /api/attachments/{entity_type}/{entity_id}
Authorization: Bearer {token}

Response: Array<Attachment>
```

#### 3. Delete Attachment
```bash
DELETE /api/attachments/{attachment_id}
Authorization: Bearer {token}

Response:
{
  "status": "deleted"
}
```

### File Storage
- **Location**: `/app/backend/uploads/`
- **Naming**: UUID-based unique filenames to prevent conflicts
- **Access**: Files served via FastAPI static files middleware
- **Security**: JWT authentication required for all operations

### Validations
- **File Size**: Maximum 10MB per file
- **Authentication**: All endpoints require valid JWT token
- **Soft Delete**: Files marked as `is_deleted` instead of physical deletion

## Frontend Implementation

### Attachments Component

**Location**: `/app/frontend/src/components/Attachments.js`

**Props**:
```javascript
<Attachments 
  entityType="procurement_lot"  // Required: type of entity
  entityId="lot-123"             // Required: unique entity ID
  readOnly={false}               // Optional: disable upload/delete
/>
```

**Features**:
- Auto-loads attachments on mount
- Real-time upload with progress indication
- Category dropdown with 8 predefined categories
- Optional description field
- File type icons (images, PDFs, documents)
- Download and delete actions
- Empty state handling
- Toast notifications for success/errors

### Demo Page

**Location**: `/app/frontend/src/pages/AttachmentsDemo.js`
**Route**: `/admin/attachments-demo`

The demo page includes:
- **System Features Overview** - Complete capability showcase
- **Entity Type Selector** - Visual buttons for 5 supported entity types
- **Entity ID Input** - Manual ID entry or quick test ID generation
- **Live Attachments Component** - Real-time testing interface
- **Integration Examples** - Code snippets for React components
- **Supported Entity Types** - Complete list of entity types
- **File Categories** - Visual display of all categories

## Integration Guide

### Step 1: Import the Component
```javascript
import Attachments from '../components/Attachments';
```

### Step 2: Add to Your Page
```javascript
// In a detail page for procurement lot
function ProcurementLotDetail({ lot }) {
  return (
    <div>
      <h2>{lot.lot_number}</h2>
      
      {/* Other lot details */}
      
      {/* Add attachments section */}
      <Attachments
        entityType="procurement_lot"
        entityId={lot.id}
        readOnly={false}
      />
    </div>
  );
}
```

### Step 3: Supported Entity Types
You can use the Attachments component with any entity type:
- `procurement_lot`
- `preprocessing_batch`
- `cold_storage_entry`
- `quality_check`
- `invoice`
- `shipment`
- `customer_order`
- Or any custom entity type

## File Categories

The system supports 8 predefined file categories:
1. **Invoice** - Supplier/customer invoices
2. **Weighment Slip** - Weight measurement documents
3. **Lab Report** - Quality test reports
4. **Gate Pass** - Entry/exit documentation
5. **Photo** - Visual documentation
6. **Certificate** - Certifications and approvals
7. **Contract** - Legal agreements
8. **Other** - Miscellaneous files

## Testing

### Backend Testing (curl)
```bash
# Login
TOKEN=$(curl -s http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@aquapremium.com","password":"Admin123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Upload attachment
curl -X POST "http://localhost:8001/api/attachments/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf" \
  -F "entity_type=procurement_lot" \
  -F "entity_id=test-123" \
  -F "category=invoice" \
  -F "description=Test invoice"

# Get attachments
curl "http://localhost:8001/api/attachments/procurement_lot/test-123" \
  -H "Authorization: Bearer $TOKEN"
```

### Frontend Testing
1. Navigate to `/admin/attachments-demo`
2. Select an entity type
3. Enter or generate an entity ID
4. Click "Load Attachments"
5. Click "Add" to upload a file
6. Test download and delete functionality

## Code Structure

```
/app
├── backend/
│   ├── server.py                    # API endpoints (lines 1995-2085)
│   ├── uploads/                     # File storage directory
│   └── services/
│       └── multi_tenant.py          # Updated with Redis error handling
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Attachments.js       # Reusable attachments component
│   │   ├── pages/
│   │   │   └── AttachmentsDemo.js   # Demo & documentation page
│   │   ├── components/
│   │   │   └── Layout.js            # Updated navigation
│   │   └── App.js                   # Updated routes
```

## Security Considerations

1. **Authentication**: All API endpoints require valid JWT token
2. **File Size Limits**: 10MB maximum to prevent abuse
3. **Unique Filenames**: UUID-based naming prevents overwrites and conflicts
4. **Soft Delete**: Files marked as deleted rather than removed (audit trail)
5. **User Tracking**: `uploaded_by` field tracks who uploaded each file
6. **MIME Type Validation**: File types validated on upload

## Database Queries

### Create Attachment
```javascript
await db.attachments.insert_one({
  id: "uuid",
  entity_type: "procurement_lot",
  entity_id: "lot-123",
  file_name: "invoice.pdf",
  file_url: "/uploads/uuid.pdf",
  file_size_kb: 245.6,
  mime_type: "application/pdf",
  category: "invoice",
  description: "Test invoice",
  uploaded_by: "user-id",
  is_deleted: false,
  created_at: datetime.now()
});
```

### Query Attachments
```javascript
// Get all attachments for an entity
await db.attachments.find({
  entity_type: "procurement_lot",
  entity_id: "lot-123",
  is_deleted: false
}, { _id: 0 }).to_list(1000);
```

### Soft Delete
```javascript
await db.attachments.update_one(
  { id: "attachment-id" },
  { $set: { is_deleted: true } }
);
```

## Future Enhancements

Potential improvements for future iterations:
- [ ] Cloud storage integration (S3, Google Cloud Storage)
- [ ] Image thumbnail generation
- [ ] Bulk upload support
- [ ] File preview in modal (PDF, images)
- [ ] Advanced search and filtering
- [ ] File versioning
- [ ] Access control per attachment
- [ ] Virus scanning integration
- [ ] Compressed file support (.zip, .rar)
- [ ] Attachment templates by entity type

## Troubleshooting

### Issue: Upload fails with 401 error
**Solution**: Check that the JWT token is valid and not expired

### Issue: File not found after upload
**Solution**: Verify the `/app/backend/uploads/` directory exists and has write permissions

### Issue: Upload fails with file size error
**Solution**: Ensure file is under 10MB limit

### Issue: Attachments not displaying
**Solution**: Check browser console for API errors and verify entity_type and entity_id are correct

## Performance Considerations

- **MongoDB Indexing**: Consider adding indexes on `entity_type` and `entity_id` for faster queries
- **File Serving**: Static files served via FastAPI; consider CDN for production
- **Caching**: Add HTTP caching headers for static files
- **Pagination**: Implement pagination for entities with many attachments

## Conclusion

The Universal Attachments System is a production-ready feature that provides complete file management capabilities across all ERP modules. It's designed to be:
- **Easy to integrate** - Single component import
- **Flexible** - Works with any entity type
- **Secure** - Full authentication and validation
- **User-friendly** - Intuitive UI with clear feedback
- **Scalable** - Ready for future enhancements
