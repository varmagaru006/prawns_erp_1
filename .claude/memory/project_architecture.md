---
name: Architecture and Multi-Tenancy
description: How multi-tenancy, feature flags, and the Super Admin system work
type: project
originSessionId: e27094f3-98a1-478e-a642-7676a8b4e3ff
---
**Multi-Tenancy implementation:**
- `TenantAwareDatabase` in `backend/services/multi_tenant.py` wraps Motor collection access
- Tenant ID extracted from `X-Tenant-ID` request header by `tenant_middleware`
- `ENABLE_MULTI_DB_ROUTING=true` → each tenant gets its own MongoDB DB
- `ENABLE_MULTI_DB_ROUTING=false` (default/dev) → all tenants share one DB with tenant field filtering

**Feature Flags:**
- 20 flags total, per-tenant toggleable from Super Admin portal
- Source of truth: `backend/feature_registry.py`
- Loaded/cached by `FeatureFlagService` in multi_tenant.py
- Redis optional for cache invalidation across instances
- Frontend reads flags via `FeatureFlagContext` which polls `/api/config`
- Super Admin DB: `prawn_erp_super_admin` (separate from client DB)

**Two separate portals:**
1. Client ERP: `frontend/` → talks to `backend/` on port 8000
2. Super Admin: `super-admin-frontend/` → talks to `super-admin-api/` on port 8001
   - Super Admin can also push feature flag changes to client ERP via internal API call

**Authentication:**
- JWT (8-hour expiry), bcrypt passwords
- 10 roles: super_admin, admin, owner, procurement_manager, production_supervisor, cold_storage_incharge, qc_officer, sales_manager, accounts_manager, worker, risk_reviewer
- Role enforcement: `require_role()` FastAPI dependency in server.py
- Frontend: `config/moduleConfig.js` maps roles to allowed modules

**Why:** Client wanted SaaS capability to add multiple prawn export company clients, each with their own data isolation and feature set.

**How to apply:** When adding new modules, add: (1) feature flag to feature_registry.py, (2) role check to backend endpoint, (3) module entry in frontend/src/config/moduleConfig.js, (4) toggle in Super Admin feature list.
