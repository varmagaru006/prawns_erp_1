# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack SaaS ERP system for prawn seafood export businesses. Multi-tenant architecture with a main client ERP and a separate Super Admin portal for tenant management.

**Stack:**
- Backend: FastAPI (Python 3.11), MongoDB (Motor async), JWT auth, ReportLab for PDFs
- Frontend: React 19, React Router 7, Shadcn/UI + Radix UI, Tailwind CSS 3, Craco build
- Super Admin API: FastAPI (Python), separate MongoDB DB (`prawn_erp_super_admin`)
- Super Admin Frontend: React 19 + Vite, TailwindCSS
- Infra: Docker Compose (5 services), deployable on Render / Railway / Fly.io

---

## Commands

### Docker (primary dev workflow)
```bash
# Full stack — build and start all 5 services
docker compose up --build -d

# Start only new/changed services without rebuilding everything
docker compose up -d

# Rebuild a specific service after code change
docker compose build super-admin-api && docker compose up -d super-admin-api

# View logs
docker logs prawns_erp_super_admin_api -f
docker logs prawns_erp_backend -f

# Stop everything
docker compose down
```

### Local (no Docker)
```bash
# Start full stack (MongoDB + Backend + Super Admin API + Super Admin Frontend + Frontend)
./run_all.sh
```

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run server
uvicorn server:app --reload --port 8000

# Tests
python -m pytest tests/ -v
python -m pytest tests/test_party_ledger_a5.py -v   # single test file
python backend_test.py                               # API smoke tests
```

### Super Admin API
```bash
# Shares the backend venv; run from repo root
cd super-admin-api
../backend/.venv/bin/python -m uvicorn main:app --reload --port 8002

# Tests
python test_super_admin_api.py
```

### Frontend (Client ERP)
```bash
cd frontend
yarn install
yarn start          # dev server on :3000
yarn build          # production build
```

### Super Admin Frontend
```bash
cd super-admin-frontend
npm install         # uses npm, not yarn
npm run dev         # dev server on :3001
npm run build       # production build
```

---

## Ports & URLs

| Service | Port | URL |
|---------|------|-----|
| Client ERP (frontend) | 3000 | `http://localhost:3000` |
| Super Admin Portal | 3001 | `http://localhost:3001/super-admin/login` |
| Backend API | 8000 | `http://localhost:8000` |
| Super Admin API | 8002 | `http://localhost:8002` |
| MongoDB (Docker) | 27018 | `mongodb://...@localhost:27018` |
| MongoDB (local) | 27017 | `mongodb://...@localhost:27017` |

**Default credentials:**
- Client ERP: `admin@prawnexport.com` / `admin123`
- Super Admin: `superadmin@prawnrp.com` / `admin123`

---

## Architecture

### Backend: Intentional Monolith
All 120+ endpoints, Pydantic models, and business logic live in `backend/server.py` (~9700 lines). **Do not split into separate files** unless explicitly asked.

### Multi-Tenancy & Database Routing
- `TenantAwareDatabase` wrapper (`backend/services/multi_tenant.py`) auto-routes all collection access to the correct tenant DB
- Tenant ID is extracted from: JWT `tenant_id` claim → `X-Tenant-ID` header → query param → falls back to `"cli_001"`
- `ENABLE_MULTI_DB_ROUTING=true` (default in Docker): each tenant gets `prawn_erp_<tenant_id>` as its own MongoDB database. `cli_001` and `default` always stay in the shared `prawn_erp` DB for backward compatibility
- `ENABLE_MULTI_DB_ROUTING=false`: all tenants share `prawn_erp`, isolated by `tenant_id` field on every document
- **Never access Motor collections directly** — always go through `TenantAwareDatabase` or the db wrapper

### Super Admin ↔ Client ERP Sync
- Super Admin API (`super-admin-api/main.py`) writes feature flags to `prawn_erp_super_admin.feature_flags` AND to the client's own DB
- After toggling, it HTTP POSTs to client ERP's `/internal/saas-hook/features` to hot-reload flags
- The `internal_router` in `backend/server.py` (line ~9221) handles these pushes: `/internal/saas-hook/handshake`, `/features`, `/branding`, `/users`

### Client Provisioning Flow
1. `POST /clients` → creates client record + auto-bootstraps: creates indexes, seeds tenant_config, seeds feature flags, creates default admin user in the client's isolated DB. Returns one-time `admin_password`.
2. `POST /clients/{id}/link` → generates API key, calls `/internal/saas-hook/handshake` on the client ERP to establish connection
3. `POST /clients/{id}/push-features` → syncs current feature flag state to client ERP
4. `POST /clients/{id}/bootstrap` → re-run provisioning (safe to repeat; won't overwrite existing admin)

### Frontend State Management
- No Redux — React Context only: `AuthContext`, `FeatureFlagContext`, `BrandingContext`
- Feature visibility: `FeatureFlagContext` (from `/api/config`) + role checks in `frontend/src/config/moduleConfig.js`
- API base URL from `REACT_APP_BACKEND_URL` env var (empty string in Docker → nginx proxy to `backend:8000`)

### Super Admin Frontend Serving
- Vite `base: '/super-admin/'` — all assets have that path prefix
- In Docker: built as static files, served by nginx on port 3001 at `/super-admin/`
- nginx config: `super-admin-frontend/nginx.conf` — handles SPA fallback routing
- 401 redirect uses absolute path `/super-admin/login` (not relative `/login`)

### MongoDB User Permissions
- `prawn_erp_user` has `readWriteAnyDatabase` role so it can create new per-tenant databases
- Configured in `docker/mongo-init.js` (only runs on first container start)
- To change permissions on a running container: `docker exec prawns_erp_mongo mongosh --username admin --password mongo_admin_local --authenticationDatabase admin`

---

## Environment Variables

**backend/.env**
```
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017
DB_NAME=prawn_erp
SECRET_KEY=dev-secret-key-change-me
ENABLE_MULTI_DB_ROUTING=true
SUPER_ADMIN_DB_NAME=prawn_erp_super_admin
CORS_ORIGINS=http://localhost:3000
```

**super-admin-api/.env**
```
MONGO_URL=mongodb://prawn_erp_user:prawn_erp_dev_password@localhost:27017
MONGO_DB_NAME=prawn_erp
SECRET_KEY=super-admin-secret-key-change-in-production
ENABLE_MULTI_DB_ROUTING=true
```

**super-admin-frontend/.env**
```
VITE_API_URL=http://localhost:8002
```

**frontend/.env**
```
REACT_APP_BACKEND_URL=http://localhost:8000
WDS_SOCKET_PORT=3000
```

---

## Key Domain Models

### Auto-Calculations (preserve exactly)
- **Procurement**: `net_weight = gross_weight - ice_weight - box_weight`, `total_amount = net_weight * rate`, `balance = total_amount - advance_paid`
- **Pre-Processing**: `waste_weight = input_weight - output_weight`, `yield_pct = (output_weight / input_weight) * 100`
- **Production**: `conversion_rate = (finished_weight / input_weight) * 100`
- **Party Ledger**: FY-wise opening balances auto-carried forward

### Enums (`backend/models/enums.py`)
- `UserRole`: admin, owner, procurement_manager, production_supervisor, cold_storage_incharge, qc_officer, sales_manager, accounts_manager, worker, super_admin, risk_reviewer
- `Species`: Vannamei, Black Tiger, Sea Tiger
- `FreshnessGrade`: A, B, C, Rejected
- `ProcessType`: heading, peeling, deveining, iqf, blanching, grading
- `ProductForm`: HOSO, HLSO, PTO, PD, PDTO, Butterfly, Ring Cut, Cooked
- `QCStatus`: pending, approved, rejected, hold

### Feature Flags (20 per tenant — `backend/feature_registry.py`)
Enabled by default: `dashboard`, `procurement`, `agents`, `preprocessing`, `production`, `qualityControl`, `coldStorage`, `finishedGoods`, `sales`, `accounts`, `purchaseInvoiceDashboard`, `parties`, `partyLedger`, `risk_comments_v2`, `admin`, `notifications`

Disabled by default: `wastageDashboard`, `yieldBenchmarks`, `marketRates`, `superAdmin`

---

## API Conventions

- Base URL: `/api/...` (Super Admin API has no `/api` prefix)
- Auth: `Authorization: Bearer <jwt>` (8-hour expiry)
- Multi-tenant: `X-Tenant-ID` header or JWT claim
- PDF endpoints: `application/pdf` with `Content-Disposition: attachment`
- Super Admin internal hooks: `/internal/saas-hook/` (protected by API key, not JWT)

---

## Important Rules

1. **Never split server.py** — all backend logic stays in the single monolith
2. **Pydantic models** for all request/response bodies — no raw dicts in endpoints
3. **Async everywhere** — all DB calls use `await`, all endpoints are `async def`
4. **Role checks** — use the existing `require_role()` dependency pattern
5. **All DB queries through TenantAwareDatabase** — never raw Motor collection access
6. **Feature flags** — add new flags to `feature_registry.py` first, then reference in code
7. **Frontend pages** use `.js` extension — Super Admin frontend uses `.jsx` (Vite)
8. **Super-admin-frontend uses `npm`** — main frontend uses `yarn`. Do not mix
9. **No TypeScript** — project is plain JavaScript/Python throughout
10. **Yield alert threshold default: 75%** — configurable via Yield Benchmarks feature
