# Prawn/Aquaculture Export ERP - Product Requirements Document

## Original Problem Statement
Build a full-stack, production-ready Prawn/Aquaculture Export ERP web application with a Super Admin Portal (Amendment A2) for multi-tenant SaaS management.

## Architecture
- **Super Admin Portal**: React frontend + FastAPI backend + PostgreSQL (`saas_control_db`)
- **Client ERP**: React frontend + FastAPI backend + MongoDB (multi-tenant with `tenant_id`)

## What's Been Implemented

### Session Date: Feb 25, 2026

#### Feature: Purchase Invoice Dashboard Toggle (Super Admin Control) ✅ COMPLETED

**Feature Overview:**
Added ability for Super Admin to enable/disable the Purchase Invoice Dashboard features per client. When disabled, clients see a basic invoice list without metrics, quick preview, or bulk export capabilities.

**Implementation:**
1. ✅ **Super Admin Feature Registry** - Added `purchaseInvoiceDashboard` to feature registry with module "Finance"
2. ✅ **Feature Flag API** - Merged registry with DB state for complete feature list
3. ✅ **Client ERP Feature Check** - PurchaseInvoices.js conditionally shows:
   - Metrics Dashboard (5 stat cards)
   - CSV/Excel export buttons
   - Quick Preview eye icon
   - Warning banner when disabled
4. ✅ **FeatureFlagContext Enhancement** - Added token change detection (polling + custom events) to refresh features after login

**Files Modified:**
- `/app/super-admin-api/main.py` - Feature registry and get_client_features endpoint
- `/app/frontend/src/pages/PurchaseInvoices.js` - Conditional rendering based on feature flag
- `/app/frontend/src/context/FeatureFlagContext.js` - Token change detection
- `/app/frontend/src/context/AuthContext.js` - tokenChanged event dispatch

---

#### Amendment A4 - Purchase Invoice Module (Patch Features) ✅ COMPLETED

**Feature Overview:**
Complete Purchase Invoice module with enhanced patch features for farmer mobile tracking, quick preview, bulk export, and manual audit recording.

**Backend Implementation:**
1. ✅ **Purchase Invoice CRUD** - Full create, read, update, delete operations
2. ✅ **Approval Workflow** - draft -> approved -> pushed status flow
3. ✅ **Push to Procurement** - Creates procurement lot from approved invoice
4. ✅ **Manual Audit Toggle** (`PATCH /api/purchase-invoices/{id}/manual-audit`)
5. ✅ **Metrics Dashboard** (`GET /api/purchase-invoices/metrics`) - Real database queries
6. ✅ **PDF Generation** (`GET /api/purchase-invoices/{id}/pdf`)
7. ✅ **farmer_mobile field** - Added to models
8. ✅ **Species Enum Fix** - field_validator for case normalization

**Frontend Implementation:**
1. ✅ **Purchase Invoices List Page** with metrics, filters, and actions
2. ✅ **Quick Preview Panel** - Slide-over with invoice details
3. ✅ **Bulk Export** - CSV and Excel export
4. ✅ **Create/Edit Invoice Form** with farmer_mobile field

## Test Credentials

### Super Admin Portal
- **URL**: https://aqua-purchase-module.preview.emergentagent.com/super-admin/
- **Email**: superadmin@prawnrp.com
- **Password**: admin123

### Client ERP
- **URL**: https://aqua-purchase-module.preview.emergentagent.com/
- **Email**: john@aquapremium.com
- **Password**: Admin123!

## Feature Flags

### purchaseInvoiceDashboard
- **Description**: Invoice metrics, quick preview, and bulk export
- **Module**: Finance
- **Controls**: Metrics dashboard, CSV/Excel export, Quick Preview panel
- **When Disabled**: Shows warning banner, hides advanced features

## Prioritized Backlog

### P0 (Critical - Completed)
- ✅ Amendment A4 Purchase Invoice Module with Patch features
- ✅ Purchase Invoice Dashboard feature toggle from Super Admin

### P1 (High Priority - Upcoming)
- Integrate `purchase_invoice_no` into Production and Cold Storage UI
- Amendment A2 Phases 8-10 (Activity logs, usage snapshots, billing)

### P2 (Medium Priority)
- Refactor monolithic `server.py` into modular FastAPI structure

## Key Files Reference

### Feature Toggle System
- `/app/super-admin-api/main.py` - Feature registry (line ~780)
- `/app/frontend/src/context/FeatureFlagContext.js` - Feature loading with token detection
- `/app/frontend/src/pages/PurchaseInvoices.js` - Conditional rendering

### Purchase Invoice Module
- `/app/backend/server.py` - API endpoints
- `/app/frontend/src/pages/PurchaseInvoices.js` - List page
- `/app/frontend/src/pages/PurchaseInvoiceForm.js` - Create/Edit form

## Database

### Feature Flags Collection (test_database)
- `feature_flags`: { tenant_id, feature_code, is_enabled, synced_at }
- Example: `{ tenant_id: "cli_001", feature_code: "purchaseInvoiceDashboard", is_enabled: true }`
