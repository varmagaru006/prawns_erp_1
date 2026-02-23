# Prawn/Aquaculture Export ERP - Product Requirements Document

## Original Problem Statement
Build a full-stack, production-ready Prawn/Aquaculture Export ERP web application with a Super Admin Portal (Amendment A2) for multi-tenant SaaS management.

## Architecture
- **Super Admin Portal**: React frontend + FastAPI backend + PostgreSQL (`saas_control_db`)
- **Client ERP**: React frontend + FastAPI backend + MongoDB (multi-tenant with `tenant_id`)

## What's Been Implemented

### Session Date: Feb 23, 2026

#### Universal Attachments System ✅ (COMPLETED & TESTED)

**Feature Overview:**
Complete file management system that allows users to upload, view, download, and delete attachments for any entity across all ERP modules.

**Backend Implementation:**
1. ✅ **Attachment Model** (`Attachment` Pydantic model with full metadata)
2. ✅ **API Endpoints**:
   - `POST /api/attachments/upload` - Upload files (multipart/form-data)
   - `GET /api/attachments/{entity_type}/{entity_id}` - List all attachments for an entity
   - `DELETE /api/attachments/{attachment_id}` - Soft delete attachment
3. ✅ **File Storage**: Local filesystem storage in `/app/backend/uploads/`
4. ✅ **Validations**: 10MB file size limit, unique filename generation
5. ✅ **Security**: JWT authentication required for all endpoints

**Frontend Implementation:**
1. ✅ **Attachments Component** (`/frontend/src/components/Attachments.js`):
   - Reusable component for any entity type
   - Upload interface with category selection
   - File list with download/delete actions
   - File type icons (images, PDFs, documents)
   - Real-time updates after upload/delete
2. ✅ **AttachmentsDemo Page** (`/frontend/src/pages/AttachmentsDemo.js`):
   - Comprehensive demo/documentation page
   - Entity type selector (5 types supported)
   - Live testing interface
   - Integration examples and code snippets
3. ✅ **Navigation**: Added to sidebar under Admin section

**Supported Entity Types:**
- `procurement_lot` - Procurement entries
- `preprocessing_batch` - Processing batches
- `cold_storage_entry` - Cold storage records
- `quality_check` - Quality inspection records
- `invoice` - Sales invoices
- Any custom entity type

**File Categories:**
Invoice, Weighment Slip, Lab Report, Gate Pass, Photo, Certificate, Contract, Other

**Test Results:**
- ✅ Backend API tested with curl (upload, list, delete)
- ✅ Frontend component renders correctly
- ✅ Demo page fully functional with all features
- ✅ File upload/download/delete working end-to-end

### Session Date: Feb 22-23, 2026

#### Amendment A3: Client Linking & Provisioning ✅ (COMPLETED & TESTED)

**Backend APIs (All Tested via Curl):**
1. ✅ `POST /clients/{id}/link` - Generate API key and link client
2. ✅ `POST /clients/{id}/push-branding` - Push branding config to client ERP
3. ✅ `POST /clients/{id}/users` - Provision users in client ERP
4. ✅ `GET /api/public-config` - Client ERP endpoint for fetching branding

**Test Results:**
- Client linking: Successfully linked with API key hash stored
- Branding push: Config saved to both PostgreSQL and MongoDB
- User provisioning: User created in both super admin DB and client ERP
- Public config: Returns dynamic branding from MongoDB

**UI Components (Built & Deployed):**
- `ClientDetail.jsx` - Tabbed UI with Features, Link & Branding, Users
- `UsersTab.jsx` - User provisioning interface
- `LinkBrandingTab.jsx` - Connection status and branding configuration
- `BrandingContext.js` - Client-side dynamic branding

#### Previous Implementations
- P0 Bug Fix: Feature Toggle UI ✅
- Phase 6: Announcement System ✅
- Phase 7: Impersonation Flow ✅

## Test Credentials

### Super Admin Portal
- **URL**: https://erp-docs-hub.preview.emergentagent.com/super-admin/
- **Email**: superadmin@prawnrp.com
- **Password**: admin123

### Client ERP
- **Provisioned User**: john@aquapremium.com (temp password shown during provisioning)

## Prioritized Backlog

### P1 (High Priority)
- Amendment A2 Phases 8-10: Activity logs, usage snapshots, billing integration

### P2 (Medium Priority)
- Refactor monolithic `server.py` file into modular structure
- Add health checks to supervisor configurations

### P3 (Low Priority/Future)
- Original ERP features: universal attachments, full wage & billing UI
- PDF/Excel reports
- Audit trail interface

## Key Files Reference

### Super Admin API
- `/app/super-admin-api/main.py` - A3 endpoints (link, push-branding, users)

### Client ERP Backend
- `/app/backend/server.py`:
  - `/api/public-config` - Public branding endpoint
  - `/internal/saas-hook/*` - Internal push endpoints

### Client ERP Frontend
- `/app/frontend/src/context/BrandingContext.js` - Dynamic branding
- `/app/frontend/src/pages/Login.js` - Branded login page

## Database Schema

### PostgreSQL (saas_control_db)
- `clients` - With A3 fields (api_key_hash, webhook_url, link_status, branding)
- `provisioned_users` - Users created via super admin

### MongoDB (Client ERP - test_database)
- `tenant_config` - Branding config (key-value format)
- `users` - Users including those provisioned by super admin

## Known Issues
- Environment services need manual restart after session changes
- Super-admin-frontend must be rebuilt and copied to `/app/frontend/public/super-admin/`

## Build Commands
```bash
# Super Admin Frontend
cd /app/super-admin-frontend && yarn build
cp -r dist /app/frontend/public/super-admin
sudo supervisorctl restart frontend
```
