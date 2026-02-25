# Prawn/Aquaculture Export ERP - Product Requirements Document

## Original Problem Statement
Build a full-stack, production-ready Prawn/Aquaculture Export ERP web application with a Super Admin Portal (Amendment A2) for multi-tenant SaaS management.

## Architecture
- **Super Admin Portal**: React frontend + FastAPI backend + PostgreSQL (`saas_control_db`)
- **Client ERP**: React frontend + FastAPI backend + MongoDB (multi-tenant with `tenant_id`)

## What's Been Implemented

### Session Date: Feb 25, 2026

#### Amendment A4 - Purchase Invoice Module (Patch Features) ✅ COMPLETED & TESTED

**Feature Overview:**
Complete Purchase Invoice module with enhanced patch features for farmer mobile tracking, quick preview, bulk export, and manual audit recording.

**Backend Implementation:**
1. ✅ **Purchase Invoice CRUD** - Full create, read, update, delete operations
2. ✅ **Approval Workflow** - draft -> approved -> pushed status flow
3. ✅ **Push to Procurement** - Creates procurement lot from approved invoice
4. ✅ **Manual Audit Toggle** (`PATCH /api/purchase-invoices/{id}/manual-audit`) - Toggle is_manually_recorded flag with timestamp and user tracking
5. ✅ **Metrics Dashboard** (`GET /api/purchase-invoices/metrics`) - Real database queries returning:
   - Total invoice count and value
   - Breakdown by payment status (pending, partial, paid)
   - Top farmers by outstanding balance
6. ✅ **PDF Generation** (`GET /api/purchase-invoices/{id}/pdf`) - Downloadable PDF with Indian formatting
7. ✅ **farmer_mobile field** - Added to PurchaseInvoice and PurchaseInvoiceCreate models
8. ✅ **Species Enum Fix** - Added field_validator to ProcurementLot model to normalize species case variations

**Frontend Implementation:**
1. ✅ **Purchase Invoices List Page** (`/purchase-invoices`):
   - Metrics dashboard with 5 stat cards (Total, Value, Pending, Partial, Paid)
   - Quick filter buttons (Today, This Week, This Month)
   - Advanced filters (date range, payment status, invoice status, search)
   - Invoice table with all columns including Mobile and Audit Book
   - Manual audit toggle buttons (Pending/Recorded)
   - Action buttons: Preview, Edit, Approve, Delete, Push, Download PDF
   
2. ✅ **Quick Preview Panel** - Slide-over panel showing:
   - Invoice header with status badges
   - Farmer details section
   - Line items table
   - Summary section (subtotal, TDS, rounded off, grand total)
   - Balance due with red/green color coding
   - Action buttons (Edit, Download PDF)
   
3. ✅ **Bulk Export**:
   - CSV export button - Downloads all filtered invoices as CSV
   - Excel export button - Downloads as XLS with styled HTML table
   
4. ✅ **Create/Edit Invoice Form** (`/purchase-invoices/create` and `/purchase-invoices/edit/:id`):
   - Farmer Mobile field added (type=tel)
   - All existing fields preserved
   - Line items with dynamic add/remove
   - Auto-calculation of totals with TDS

**Test Results (Feb 25, 2026):**
- Backend: 88% pass rate (15/17 tests)
- Frontend: 100% - All features working
- All 8 A4 Patch features verified working

### Previous Sessions

#### Session Date: Feb 23, 2026
- Enhanced Worker Wages Management ✅
- Universal Attachments System ✅

#### Session Date: Feb 22-23, 2026
- Amendment A3: Client Linking & Provisioning ✅
- Feature Toggle UI ✅
- Announcement System ✅
- Impersonation Flow ✅

## Test Credentials

### Super Admin Portal
- **URL**: https://aqua-purchase-module.preview.emergentagent.com/super-admin/
- **Email**: superadmin@prawnrp.com
- **Password**: admin123

### Client ERP
- **URL**: https://aqua-purchase-module.preview.emergentagent.com/
- **Email**: john@aquapremium.com
- **Password**: Admin123!

## Prioritized Backlog

### P0 (Critical - Completed)
- ✅ Amendment A4 Purchase Invoice Module with Patch features

### P1 (High Priority - Upcoming)
- Integrate `purchase_invoice_no` into Production and Cold Storage UI
- Amendment A2 Phases 8-10: Activity logs, usage snapshots, billing integration

### P2 (Medium Priority)
- Refactor monolithic `server.py` file into modular structure (routers, models, services)
- Add health checks to supervisor configurations

### P3 (Low Priority/Future)
- PDF/Excel reports for other modules
- Advanced audit trail analytics
- Multi-language support

## Key Files Reference

### Purchase Invoice Module
- `/app/backend/server.py` - Lines 650-750 (models), Lines 2509-3046 (API endpoints)
- `/app/frontend/src/pages/PurchaseInvoices.js` - List page with preview, export, toggle
- `/app/frontend/src/pages/PurchaseInvoiceForm.js` - Create/Edit form

### Client ERP Backend
- `/app/backend/server.py` - All API endpoints

### Client ERP Frontend
- `/app/frontend/src/pages/` - All page components
- `/app/frontend/src/components/` - Reusable components

## Database Schema

### MongoDB (Client ERP)
- `purchase_invoices`: { id, invoice_no, invoice_date, farmer_name, farmer_mobile, farmer_location, etc. }
- `purchase_invoice_lines`: { id, invoice_id, line_no, variety, count_value, quantity_kg, rate, amount }
- `procurement_lots`: { id, lot_number, species, etc. } - with species field_validator
- `tenant_config`: Key-value branding config

## Known Issues
- Old invoices don't have farmer_mobile field (null) - expected for legacy data
- Environment services need manual restart after session changes

## Build Commands
```bash
# Super Admin Frontend
cd /app/super-admin-frontend && yarn build
cp -r dist /app/frontend/public/super-admin
sudo supervisorctl restart frontend
```
