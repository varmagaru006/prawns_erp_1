# 🦐 Amendment A2: Super Admin Portal - Implementation Plan

## Executive Summary

**What**: Transform single-tenant Prawn ERP into multi-tenant SaaS with Super Admin control plane  
**Scope**: 11 new database tables, standalone admin portal, feature flag system, client management  
**Estimated Effort**: 20-30 hours of development  
**Risk**: HIGH - Major architectural change requiring careful planning

---

## Current Architecture vs Target Architecture

### Current (Single-Tenant)
```
Single MongoDB Database
  └── Collections: users, procurement_lots, batches, etc.
  └── Single client only
  └── No feature flags
  └── Direct deployment
```

### Target (Multi-Tenant SaaS)
```
Control Database (PostgreSQL)
  ├── super_admins
  ├── clients (tenant registry)
  ├── subscription_plans
  ├── feature_registry (50+ features)
  ├── client_feature_flags
  └── activity_snapshots, announcements, etc.

Client Databases (MongoDB - one per tenant OR schemas)
  ├── Tenant A: cli_001 (Blue Ocean Processing)
  ├── Tenant B: cli_002 (Sea Pearl Foods)
  └── Tenant C: cli_003 (Neptune Seafood)

Super Admin Portal (React - separate app)
  └── URL: https://superadmin.yourerpname.com
  └── Manages all clients, features, subscriptions
```

---

## Critical Decisions Required Before Implementation

### Decision 1: Database Strategy

**Option A: MongoDB Multi-Tenancy (Recommended)**
- **Control DB**: PostgreSQL for saas_control_db
- **Client Data**: MongoDB with tenant_id field in every collection
- **Pros**: 
  * Minimal changes to existing codebase
  * MongoDB already working perfectly
  * Easier migration path
- **Cons**: 
  * Less strict isolation than separate DBs
  * Need to add tenant_id to all queries

**Option B: Full PostgreSQL Migration**
- **Control DB**: PostgreSQL for saas_control_db
- **Client Data**: PostgreSQL with schema-per-tenant
- **Pros**: 
  * Follows Amendment A2 spec exactly
  * Better for enterprise clients
- **Cons**: 
  * Complete rewrite of all backend models
  * Migration of existing MongoDB data
  * High risk of breaking changes

**Recommendation**: **Option A** - Keep MongoDB, add tenant isolation

---

### Decision 2: Deployment Architecture

**Option A: Shared Infrastructure**
- Single Kubernetes deployment serves all clients
- Tenant ID in JWT determines which data to show
- Feature flags checked on every request
- **Pros**: Cost-effective, easier to manage
- **Cons**: One client's traffic spike affects others

**Option B: Dedicated Deployments**
- Each client gets their own Kubernetes pod
- Super Admin Portal manages fleet of deployments
- **Pros**: True isolation, better for enterprise
- **Cons**: Complex orchestration, higher cost

**Recommendation**: **Option A** initially, Option B for enterprise tier

---

### Decision 3: Feature Flag Storage

**Option A: Centralized (API calls to saas_control_db)**
- Client ERP calls Super Admin API for feature flags on every request
- **Pros**: Always up-to-date, single source of truth
- **Cons**: Extra latency, dependency on control plane

**Option B: Local Cache + Sync**
- Feature flags synced to each client's MongoDB
- Redis cache with 60-second TTL
- **Pros**: Fast reads, no dependency on control plane
- **Cons**: Up to 60-second delay for flag changes

**Recommendation**: **Option B** with Redis cache

---

## Phased Implementation Plan

### Phase A2-1: Foundation (8-10 hours)

**Goal**: Set up multi-tenant infrastructure without breaking existing app

**Tasks**:
1. Set up PostgreSQL database `saas_control_db`
2. Create all 11 control tables (super_admins, clients, subscription_plans, etc.)
3. Seed initial data:
   - Your super admin account
   - 4 subscription plans (Basic, Pro, Enterprise, Custom)
   - Complete feature registry (50+ features from Amendment spec)
4. Add `tenant_id` field to all existing MongoDB collections
5. Migrate existing data to first tenant: `cli_001`
6. Update backend to accept tenant_id from JWT
7. Create middleware: `get_current_tenant()`

**Deliverable**: Existing ERP works with tenant_id = "cli_001"

**Testing**: All existing features work unchanged

---

### Phase A2-2: Feature Flag System (6-8 hours)

**Goal**: Build the feature flag infrastructure

**Tasks**:
1. Install Redis in the environment
2. Create `FeatureFlagService` class:
   - `is_feature_enabled(tenant_id, feature_code)`
   - Redis cache with 60-second TTL
   - Parent feature checking logic
3. Add `feature_flags` collection to MongoDB (local cache per client)
4. Create sync endpoint: `POST /internal/sync-flags/{tenant_id}`
5. Build frontend `FeatureFlagContext`:
   - Fetch `/api/me/features` on login
   - Provider wraps entire app
   - Hook: `const { isEnabled } = useFeatureFlags()`
6. Add feature flag checks to:
   - All backend API routes (middleware)
   - All frontend nav items (conditional rendering)
   - All frontend pages (route guards)

**Deliverable**: Feature flags working for tenant cli_001

**Testing**: Toggle a feature flag, verify it hides/shows within 60 seconds

---

### Phase A2-3: Super Admin Portal - Core (10-12 hours)

**Goal**: Build standalone admin portal with essential features

**Tasks**:
1. Create new React app: `/super-admin-portal`
2. Separate backend API at `/super-admin-api` (FastAPI)
3. Build screens:
   - **SA-0**: Login page (separate auth from client ERP)
   - **SA-1**: Client Overview Dashboard
     * Fleet summary cards
     * Client list table
     * Status indicators
   - **SA-2**: Client Detail Page
     * Tab 1: Overview (contact, subscription, deployment)
     * Tab 2: Features (THE MOST IMPORTANT)
       - Full feature toggle grid
       - Plan badges, parent/child relationships
       - Override functionality
       - Save changes → sync to client DB
4. Build backend endpoints:
   - `POST /super-admin/auth/login`
   - `GET /super-admin/clients`
   - `GET /super-admin/clients/:id`
   - `PUT /super-admin/clients/:id/features`
   - `POST /super-admin/clients/:id/sync-flags`

**Deliverable**: Super Admin can view clients and toggle features

**Testing**: 
- Login to super admin portal
- See cli_001 in client list
- Toggle "wastage" module off for cli_001
- Verify wastage disappears from client ERP within 60 seconds

---

### Phase A2-4: Client Onboarding (4-6 hours)

**Goal**: Ability to onboard new clients via wizard

**Tasks**:
1. Build **SA-3**: Onboard New Client wizard (6 steps)
2. Create database provisioning logic:
   - For MongoDB: Create collections, add indexes, seed initial data
   - For PostgreSQL (future): Run migrations in new schema
3. Build "Apply Plan Defaults" logic:
   - Basic plan → enable 20 features
   - Professional → enable 40 features
   - Enterprise → enable all features
4. Generate welcome email with temporary password
5. Create tenant-specific JWT secret

**Deliverable**: Can create cli_002, cli_003 via wizard

**Testing**: 
- Onboard a test client "Test Seafood Co."
- Assign Professional plan
- Apply plan defaults
- Login to their ERP, verify only Pro features enabled

---

### Phase A2-5: Advanced Features (6-8 hours)

**Goal**: Complete the Super Admin Portal

**Tasks**:
1. Build **SA-2 Tab 3**: Subscription management
2. Build **SA-2 Tab 4**: Activity charts (requires daily cron)
3. Build **SA-2 Tab 5**: Announcements per client
4. Build **SA-4**: Global announcements
5. Build **SA-5**: Feature Registry admin page
6. Build announcement banner in client ERP
7. Build announcement dismissal logic
8. Create daily cron job:
   - Query each client's DB for metrics
   - Write to `client_activity_snapshots`

**Deliverable**: Full super admin portal complete

**Testing**: Send announcement to cli_001, verify banner appears in their ERP

---

### Phase A2-6: Impersonation (Optional - 4-5 hours)

**Goal**: Allow super admin to debug by logging in as client

**Tasks**:
1. Build **SA-2 Tab 6**: Impersonate screen
2. Create impersonation token generation
3. Add impersonation validation to client ERP
4. Show persistent banner in client ERP during impersonation
5. Log all impersonation sessions to `impersonation_sessions`

**Deliverable**: Super admin can debug client issues live

**Testing**: Impersonate cli_001 admin, see banner in their ERP

---

## Database Migration Strategy

### For Existing Data (cli_001)

```bash
# Add tenant_id to all existing MongoDB collections
db.users.updateMany({}, { $set: { tenant_id: "cli_001" } })
db.procurement_lots.updateMany({}, { $set: { tenant_id: "cli_001" } })
db.preprocessing_batches.updateMany({}, { $set: { tenant_id: "cli_001" } })
db.production_orders.updateMany({}, { $set: { tenant_id: "cli_001" } })
db.qc_inspections.updateMany({}, { $set: { tenant_id: "cli_001" } })
# ... repeat for all 30+ collections

# Create indexes for tenant_id
db.users.createIndex({ tenant_id: 1 })
db.procurement_lots.createIndex({ tenant_id: 1 })
# ... repeat for all collections

# Insert first client into PostgreSQL saas_control_db
INSERT INTO clients (
  tenant_id, business_name, plan_id, subscription_status, 
  db_schema_name, is_active, onboarded_at
) VALUES (
  'cli_001', 'Existing Client', {enterprise_plan_id}, 'active',
  'client_001', true, NOW()
);

# Populate feature flags for cli_001 (all features enabled)
INSERT INTO client_feature_flags (client_id, feature_code, is_enabled)
SELECT 
  '{cli_001_id}', 
  feature_code, 
  true 
FROM feature_registry 
WHERE is_active = true;
```

---

## Risk Mitigation

### High-Risk Changes

1. **Adding tenant_id to all queries**
   - **Risk**: Forgetting tenant_id in a query could leak data between clients
   - **Mitigation**: 
     * Create middleware that auto-injects tenant_id
     * Code review every query
     * Integration tests with 2+ tenants

2. **Feature flag caching**
   - **Risk**: Cache not invalidating, flags not updating
   - **Mitigation**: 
     * Short TTL (60 seconds)
     * Manual cache flush endpoint for debugging
     * Monitoring/logging on flag changes

3. **Breaking existing deployment**
   - **Risk**: Multi-tenant changes break single-tenant ERP
   - **Mitigation**: 
     * Keep existing ERP working as cli_001
     * Feature flag to enable/disable multi-tenancy
     * Rollback plan with database backup

---

## Testing Strategy

### Unit Tests
- Feature flag resolution logic
- Tenant isolation in queries
- Plan defaults application

### Integration Tests
- Create 2 test clients
- Toggle features for client A, verify B unaffected
- Verify data isolation (client A cannot see client B's data)

### E2E Tests
- Full onboarding flow
- Feature flag change propagation
- Impersonation session

---

## Rollout Plan

### Soft Launch (Weeks 1-2)
- Deploy multi-tenant infrastructure
- Migrate existing client to cli_001
- Create 1-2 test clients
- Dogfood the super admin portal internally

### Limited Beta (Weeks 3-4)
- Onboard 3-5 pilot clients
- Monitor for data leaks, performance issues
- Gather feedback on feature flag granularity

### General Availability (Week 5+)
- Open for new client onboarding
- Marketing push
- Scale monitoring and support

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| A2-1: Foundation | 8-10 hours | 10 hours |
| A2-2: Feature Flags | 6-8 hours | 18 hours |
| A2-3: Super Admin Core | 10-12 hours | 30 hours |
| A2-4: Onboarding | 4-6 hours | 36 hours |
| A2-5: Advanced Features | 6-8 hours | 44 hours |
| A2-6: Impersonation | 4-5 hours | 49 hours |
| **Testing & Refinement** | 8-10 hours | **~60 hours total** |

**Realistic estimate**: 50-60 hours of focused development work

---

## Open Questions for User

Before starting Amendment A2, please confirm:

1. **Database Choice**: MongoDB multi-tenant OR migrate to PostgreSQL?
2. **Priority**: Full Amendment A2 OR MVP (Phases A2-1 to A2-3 only)?
3. **Timeline**: Should this be a separate multi-week project?
4. **Deployment**: Single shared infra OR plan for dedicated deployments?
5. **Existing Client**: Should current deployment become "cli_001"?

---

## Next Steps

**Option 1: Start A2 Now (Full Commit)**
- Clear your calendar for 1-2 weeks
- I'll begin with Phase A2-1 (Foundation)
- We'll work through all 6 phases systematically

**Option 2: MVP First (Phases A2-1 to A2-3)**
- Focus on core functionality: tenancy + feature flags + basic admin portal
- ~25 hours of work
- Get feedback before building advanced features

**Option 3: Defer to Separate Project**
- Schedule Amendment A2 for a dedicated engagement
- Focus current session on verifying existing features
- Plan detailed requirements gathering for A2

**Which option would you like to pursue?**
