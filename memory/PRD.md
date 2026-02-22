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
- **Super Admin API** (`/app/super-admin-api/main.py`):
  - `POST /clients/{id}/impersonate` - Generate impersonation token
  - `POST /impersonation/{session_id}/end` - End session
  - `GET /impersonation/active` - List active sessions
  
- **Super Admin Frontend**:
  - "Impersonate" button on client list
  - Opens client ERP in new tab with impersonation token
  
- **Client ERP Backend**:
  - Modified auth to handle impersonation tokens
  - User model includes impersonation fields
  - `/api/auth/impersonation/validate` endpoint
  
- **Client ERP Frontend**:
  - Purple banner showing "You are impersonating this account"
  - "End Impersonation" button
  - Auto-login via URL parameter `?impersonation_token=...`

## Test Credentials

### Super Admin Portal
- **URL**: https://prawn-erp-saas.preview.emergentagent.com/super-admin/
- **Email**: superadmin@prawnrp.com
- **Password**: admin123

### Client ERP
- See `/app/TEST_CREDENTIALS.md`

## Prioritized Backlog

### P1 (High Priority)
- Phases 8-10 of Amendment A2 (activity logs, usage snapshots, billing)

### P2 (Medium Priority)
- Refactor monolithic `server.py` file

### P3 (Low Priority/Future)
- Original ERP features: universal attachments, full wage & billing UI
- PDF/Excel reports
- Audit trail interface

## Key Files Reference
- `/app/super-admin-frontend/src/pages/Dashboard.jsx` - Client list with Impersonate button
- `/app/super-admin-frontend/src/pages/Announcements.jsx` - Announcement management
- `/app/super-admin-api/main.py` - Super Admin backend (impersonation at line ~840)
- `/app/backend/server.py` - Main ERP backend (auth at line ~850)
- `/app/frontend/src/context/AuthContext.js` - Handles impersonation token login
- `/app/frontend/src/components/Layout.js` - Impersonation banner
