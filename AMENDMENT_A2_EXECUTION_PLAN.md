# 🦐 Amendment A2 - Full Implementation Execution Plan

## User Requirements Confirmed:
✅ **Database**: Migrate to PostgreSQL  
✅ **Scope**: Full A2 (all 10 steps)  
✅ **Current Deployment**: Becomes cli_001 (first tenant)  
✅ **Custom Feature**: Configurable lot number prefix per tenant  
✅ **Infrastructure**: Shared (single deployment, schema-per-tenant)  
✅ **Start**: Immediate

---

## Implementation Phases

### PHASE 1: PostgreSQL Foundation + Migration (8-10 hours)
**Goal**: Set up PostgreSQL, migrate existing MongoDB data to cli_001 schema

**Steps**:
1.1. Install PostgreSQL in environment
1.2. Create `saas_control_db` database
1.3. Create all 11 control tables (super_admins, clients, subscription_plans, etc.)
1.4. Seed data:
     - 4 subscription plans
     - 50+ feature registry entries
     - 1 super admin account (your credentials)
     - 1 client record for cli_001 (existing deployment)
1.5. Create PostgreSQL schema `client_001` for cli_001
1.6. Migrate all MongoDB collections to PostgreSQL tables in client_001 schema
1.7. Update backend models from MongoDB/Pydantic to PostgreSQL/SQLAlchemy
1.8. Add tenant_id to all models
1.9. Update all queries to use PostgreSQL
1.10. Test existing ERP functionality
1.11. Add lot_number_prefix to clients table + implementation

**Deliverable**: Existing ERP works on PostgreSQL as tenant cli_001

---

### PHASE 2: Feature Flag Infrastructure (6-8 hours)
**Goal**: Build feature flag system with Redis cache

**Steps**:
2.1. Install Redis in environment
2.2. Create FeatureFlagService class
2.3. Add feature_flags table to client schema
2.4. Build flag sync mechanism
2.5. Create frontend FeatureFlagContext
2.6. Add backend middleware for flag checks
2.7. Add conditional rendering to all nav items
2.8. Add route guards to all pages

**Deliverable**: Feature flags working for cli_001

---

### PHASE 3: Super Admin Portal - Core (10-12 hours)
**Goal**: Build standalone admin portal with essential features

**Steps**:
3.1. Create new React app: /super-admin-portal
3.2. Create backend: /super-admin-api (FastAPI)
3.3. Build SA-0: Login page
3.4. Build SA-1: Client Overview Dashboard
3.5. Build SA-2: Client Detail Page
     - Tab 1: Overview
     - Tab 2: Features (MOST IMPORTANT)
     - Tab 3: Subscription
     - Tab 4: Activity (placeholder)
     - Tab 5: Announcements
     - Tab 6: Impersonate (placeholder)

**Deliverable**: Super Admin can view and manage cli_001 features

---

### PHASE 4: Client Onboarding Wizard (4-6 hours)
**Steps**:
4.1. Build SA-3: 6-step onboarding wizard
4.2. Database provisioning logic
4.3. Apply Plan Defaults logic
4.4. Welcome email generation

**Deliverable**: Can onboard cli_002, cli_003

---

### PHASE 5: Announcements System (3-4 hours)
**Steps**:
5.1. Build SA-4: Global announcements page
5.2. Build announcement banner in client ERP
5.3. Build dismiss logic

**Deliverable**: Can send announcements to clients

---

### PHASE 6: Advanced Features (4-5 hours)
**Steps**:
6.1. Complete SA-2 Tab 3: Subscription management
6.2. Complete SA-2 Tab 4: Activity charts
6.3. Build SA-5: Feature Registry admin page
6.4. Build daily cron job for activity snapshots

**Deliverable**: Full super admin portal functional

---

### PHASE 7: Impersonation (4-5 hours)
**Steps**:
7.1. Build SA-2 Tab 6: Impersonate screen
7.2. Impersonation token generation
7.3. Client ERP impersonation validation
7.4. Persistent banner in client ERP
7.5. Build SA-6: Impersonation log

**Deliverable**: Super admin can debug as client

---

### PHASE 8: Testing & Refinement (6-8 hours)
**Steps**:
8.1. Create 2-3 test tenants
8.2. Test feature flag toggling
8.3. Test data isolation
8.4. Test onboarding flow
8.5. Fix bugs

**Deliverable**: Stable multi-tenant system

---

### PHASE 9: Security & Performance (3-4 hours)
**Steps**:
9.1. Add rate limiting
9.2. Add brute-force protection
9.3. Optimize Redis caching
9.4. Add monitoring/logging

**Deliverable**: Production-ready security

---

### PHASE 10: Documentation & Handoff (2-3 hours)
**Steps**:
10.1. Admin portal user guide
10.2. Feature flag documentation
10.3. Onboarding checklist
10.4. Troubleshooting guide

**Deliverable**: Complete documentation

---

## Total Estimated Time: 50-60 hours

## Current Status: STARTING PHASE 1

**Next Action**: Set up PostgreSQL and create saas_control_db
