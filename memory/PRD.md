# Prawn/Aquaculture Export ERP - Product Requirements Document

## Original Problem Statement
Build a full-stack, production-ready Prawn/Aquaculture Export ERP web application with a Super Admin Portal (Amendment A2) for multi-tenant SaaS management.

## Architecture
- **Super Admin Portal**: React frontend + FastAPI backend + PostgreSQL (`saas_control_db`)
- **Client ERP**: React frontend + FastAPI backend + MongoDB (multi-tenant with `tenant_id`)

## What's Been Implemented

### Session Date: Feb 22, 2026

#### P0 Bug Fix: Feature Toggle UI ✅
- Fixed bulk feature toggle not persisting correctly
- Root cause: Updates went to MongoDB but reads from PostgreSQL
- Solution: Updated `bulk-features` endpoint to write to both databases

#### Phase 6: Announcement System ✅
- Super Admin can create/manage announcements (info/warning/critical types)
- Target all clients or specific ones
- Client ERP shows banners with dismiss functionality

#### Phase 7: Impersonation Flow ✅
- Super Admin can log in as any client admin
- Purple banner in client ERP shows impersonation status
- One-click end impersonation

#### Amendment A3: Client Linking & Provisioning ✅ (Completed)
- **Client Detail Page**: New tabbed UI with Features, Link & Branding, and Users tabs
- **Link & Branding Tab**: 
  - Connection status display (linked/not linked)
  - API key generation and linking functionality
  - Branding configuration (company name, colors, logos)
- **Users Tab**:
  - User provisioning interface
  - Create, edit, deactivate users in client ERP
  - Role assignment
  - Requires client to be linked first
- **Client-side Branding**:
  - `/api/public-config` endpoint for fetching branding
  - BrandingContext.js for dynamic runtime branding
  - Login page and Layout updated to use dynamic branding
- **Backend Endpoints**:
  - Internal `/internal/saas-hook/*` endpoints on client ERP
  - Orchestration endpoints on Super Admin API

## Test Credentials

### Super Admin Portal
- **URL**: https://prawn-erp-saas.preview.emergentagent.com/super-admin/
- **Email**: superadmin@prawnrp.com
- **Password**: admin123

### Client ERP
- See `/app/TEST_CREDENTIALS.md`

## Prioritized Backlog

### P1 (High Priority)
- Amendment A2 Phases 8-10: Activity logs, usage snapshots, billing integration
- Test the full A3 flow end-to-end (linking → branding push → user provisioning)

### P2 (Medium Priority)
- Refactor monolithic `server.py` file into modular structure
- Add health checks to supervisor configurations

### P3 (Low Priority/Future)
- Original ERP features: universal attachments, full wage & billing UI
- PDF/Excel reports
- Audit trail interface

## Key Files Reference

### Super Admin Frontend
- `/app/super-admin-frontend/src/pages/ClientDetail.jsx` - Main client management page with tabs
- `/app/super-admin-frontend/src/components/LinkBrandingTab.jsx` - Linking and branding configuration
- `/app/super-admin-frontend/src/components/UsersTab.jsx` - User provisioning UI
- `/app/super-admin-frontend/src/pages/Dashboard.jsx` - Client list with Impersonate button
- `/app/super-admin-frontend/src/api/auth.js` - API functions for A3 features

### Super Admin API
- `/app/super-admin-api/main.py` - Backend with A3 orchestration endpoints (lines ~988-1557)

### Client ERP Backend
- `/app/backend/server.py` - Main ERP backend
  - `/api/public-config` endpoint (line ~1262)
  - `/internal/saas-hook/*` endpoints (lines ~2890+)

### Client ERP Frontend
- `/app/frontend/src/context/BrandingContext.js` - Dynamic branding context
- `/app/frontend/src/context/AuthContext.js` - Auth with impersonation support
- `/app/frontend/src/components/Layout.js` - Uses branding context
- `/app/frontend/src/pages/Login.js` - Dynamic login page branding

## Database Schema

### PostgreSQL (saas_control_db)
- `clients` - Client records with A3 fields (api_key_hash, webhook_url, link_status, branding)
- `provisioned_users` - Users created in client ERPs by super admin
- `super_admins`, `subscription_plans`, `feature_registry`, `announcements`, etc.

### MongoDB (Client ERP)
- `tenant_config` - Stores branding config pushed from super admin (key-value format)
- All other collections are multi-tenant filtered by `tenant_id`

## Known Issues
- Environment services (PostgreSQL/Redis) need to be restarted manually after session changes
- Super-admin-frontend production build must be copied to `/app/frontend/public/super-admin/` for CDN serving

## Build Notes
- Super Admin Frontend: `cd /app/super-admin-frontend && yarn build`
- After build, copy to: `cp -r dist /app/frontend/public/super-admin`
- Restart frontend: `sudo supervisorctl restart frontend`
