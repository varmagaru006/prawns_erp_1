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
- Fixed BrowserRouter basename for proper SPA routing
- Resolved CDN caching issue by copying build to main frontend's public folder

#### Phase 6: Announcement System ✅
- **Super Admin API** (`/app/super-admin-api/main.py`):
  - `GET /announcements` - List all announcements
  - `POST /announcements` - Create announcement
  - `DELETE /announcements/{id}` - Delete announcement
  - Syncs to MongoDB for client access

- **Super Admin Frontend** (`/app/super-admin-frontend/src/pages/Announcements.jsx`):
  - Announcements management page
  - Create announcement modal with title, message, type (info/warning/critical)
  - Target all clients or specific clients
  - Schedule show_from and show_until dates

- **Client ERP Backend** (`/app/backend/server.py`):
  - `GET /api/announcements/active` - Fetch active announcements for tenant
  - `POST /api/announcements/{id}/dismiss` - Dismiss announcement

- **Client ERP Frontend** (`/app/frontend/src/components/AnnouncementBanner.js`):
  - Banner component integrated into Layout
  - Displays active announcements with dismiss functionality
  - Color-coded by type (blue=info, yellow=warning, red=critical)

## Test Credentials

### Super Admin Portal
- **URL**: https://aqua-admin-dashboard.preview.emergentagent.com/super-admin/
- **Email**: superadmin@prawnrp.com
- **Password**: admin123

### Client ERP
- See `/app/TEST_CREDENTIALS.md`

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- **Phase 7**: Impersonation Flow (super admin generates temp token to login as client admin)

### P2 (Medium Priority)
- Phases 8-10 of Amendment A2 (activity logs, usage snapshots)
- Refactor monolithic `server.py` file

### P3 (Low Priority/Future)
- Original ERP features: universal attachments, full wage & billing UI
- PDF/Excel reports
- Audit trail interface

## Key Files Reference
- `/app/super-admin-frontend/src/pages/Announcements.jsx` - Announcement management UI
- `/app/super-admin-frontend/src/pages/ClientDetail.jsx` - Feature flag management
- `/app/super-admin-api/main.py` - Super Admin backend
- `/app/backend/server.py` - Main ERP backend with proxy routes
- `/app/frontend/src/components/AnnouncementBanner.js` - Client-side banner

## Database Schema
- **PostgreSQL** (`saas_control_db`): clients, subscription_plans, feature_registry, client_feature_flags, super_admins, announcements, announcement_targets
- **MongoDB** (`test_database`): All collections have `tenant_id` field, plus `active_announcements`, `announcement_dismissals`
