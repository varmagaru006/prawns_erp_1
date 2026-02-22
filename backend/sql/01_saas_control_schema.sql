-- ═══════════════════════════════════════════════════════════════════════════
-- PRAWN ERP - Amendment A2: SaaS Control Database Schema
-- Database: saas_control_db
-- Purpose: Manages all clients, subscriptions, feature flags, and super admin
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── SUPER ADMIN USERS ─────────────────────────────────────────────────────
CREATE TABLE super_admins (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(200) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── SUBSCRIPTION PLANS ────────────────────────────────────────────────────
CREATE TABLE subscription_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_code       VARCHAR(30) UNIQUE NOT NULL,
  plan_name       VARCHAR(100) NOT NULL,
  description     TEXT,
  price_inr_monthly  NUMERIC(10,2),
  price_inr_annual   NUMERIC(10,2),
  max_users          INTEGER,
  max_lots_per_month INTEGER,
  storage_limit_gb   NUMERIC(6,2),
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENTS ───────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         VARCHAR(30) UNIQUE NOT NULL,
  
  -- Identity
  business_name     VARCHAR(200) NOT NULL,
  contact_person    VARCHAR(150),
  contact_email     VARCHAR(200),
  contact_phone     VARCHAR(20),
  address           TEXT,
  city              VARCHAR(80),
  state             VARCHAR(80),
  country           VARCHAR(60) DEFAULT 'India',
  gst_number        VARCHAR(20),
  
  -- Lot Number Configuration (CUSTOM FEATURE)
  lot_number_prefix VARCHAR(10) DEFAULT 'PRW',
  
  -- Access
  client_url        VARCHAR(300),
  client_admin_email VARCHAR(200),
  
  -- Subscription
  plan_id           UUID REFERENCES subscription_plans(id),
  subscription_status VARCHAR(20) DEFAULT 'trial',
  trial_ends_at     DATE,
  subscription_from DATE,
  subscription_to   DATE,
  billing_cycle     VARCHAR(20) DEFAULT 'monthly',
  
  -- Deployment
  deployment_type   VARCHAR(20) DEFAULT 'shared',
  db_schema_name    VARCHAR(50),
  timezone          VARCHAR(50) DEFAULT 'Asia/Kolkata',
  currency          VARCHAR(5)  DEFAULT 'INR',
  
  -- Status
  is_active         BOOLEAN DEFAULT TRUE,
  onboarded_at      TIMESTAMPTZ,
  suspended_at      TIMESTAMPTZ,
  suspension_reason TEXT,
  
  notes             TEXT,
  created_by        UUID REFERENCES super_admins(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_status ON clients(subscription_status);
CREATE INDEX idx_clients_plan ON clients(plan_id);
CREATE INDEX idx_clients_tenant ON clients(tenant_id);

-- ── FEATURE REGISTRY ──────────────────────────────────────────────────────
CREATE TABLE feature_registry (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_code    VARCHAR(80) UNIQUE NOT NULL,
  feature_name    VARCHAR(150) NOT NULL,
  description     TEXT,
  module          VARCHAR(40) NOT NULL,
  category        VARCHAR(40) DEFAULT 'feature',
  parent_feature_code VARCHAR(80),
  is_available_on  TEXT[],
  is_beta         BOOLEAN DEFAULT FALSE,
  default_enabled BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_code ON feature_registry(feature_code);
CREATE INDEX idx_feature_module ON feature_registry(module);

-- ── CLIENT FEATURE FLAGS ───────────────────────────────────────────────────
CREATE TABLE client_feature_flags (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) NOT NULL,
  feature_code    VARCHAR(80) NOT NULL,
  is_enabled      BOOLEAN DEFAULT FALSE,
  is_override     BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  override_until  DATE,
  enabled_by      UUID REFERENCES super_admins(id),
  enabled_at      TIMESTAMPTZ,
  disabled_by     UUID REFERENCES super_admins(id),
  disabled_at     TIMESTAMPTZ,
  UNIQUE (client_id, feature_code)
);

CREATE INDEX idx_flags_client ON client_feature_flags(client_id);
CREATE INDEX idx_flags_feature ON client_feature_flags(feature_code);
CREATE INDEX idx_flags_enabled ON client_feature_flags(client_id, is_enabled);

-- ── CLIENT ACTIVITY SNAPSHOTS ────────────────────────────────────────────
CREATE TABLE client_activity_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) NOT NULL,
  snapshot_date   DATE NOT NULL,
  active_users    INTEGER DEFAULT 0,
  lots_created    INTEGER DEFAULT 0,
  batches_created INTEGER DEFAULT 0,
  cold_storage_kg NUMERIC(12,3) DEFAULT 0,
  db_size_mb      NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, snapshot_date)
);

CREATE INDEX idx_snapshots_client ON client_activity_snapshots(client_id, snapshot_date);

-- ── FEATURE CHANGE LOG ────────────────────────────────────────────────────
CREATE TABLE feature_change_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) NOT NULL,
  feature_code    VARCHAR(80) NOT NULL,
  changed_by      UUID REFERENCES super_admins(id) NOT NULL,
  action          VARCHAR(20) NOT NULL,
  previous_state  BOOLEAN,
  new_state       BOOLEAN,
  reason          TEXT,
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_change_log_client ON feature_change_log(client_id);
CREATE INDEX idx_change_log_date ON feature_change_log(changed_at);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────
CREATE TABLE announcements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(300) NOT NULL,
  body            TEXT NOT NULL,
  announcement_type VARCHAR(20) DEFAULT 'info',
  target_all      BOOLEAN DEFAULT FALSE,
  show_from       TIMESTAMPTZ NOT NULL,
  show_until      TIMESTAMPTZ,
  created_by      UUID REFERENCES super_admins(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcement_targets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id)
);

CREATE TABLE announcement_dismissals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id),
  client_id       UUID REFERENCES clients(id),
  dismissed_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (announcement_id, client_id)
);

-- ── IMPERSONATION SESSIONS ────────────────────────────────────────────────
CREATE TABLE impersonation_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  super_admin_id  UUID REFERENCES super_admins(id) NOT NULL,
  client_id       UUID REFERENCES clients(id) NOT NULL,
  client_user_id  VARCHAR(100),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_mins   INTEGER,
  ip_address      INET,
  reason          TEXT
);

CREATE INDEX idx_impersonation_client ON impersonation_sessions(client_id);
CREATE INDEX idx_impersonation_admin ON impersonation_sessions(super_admin_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Schema creation complete
-- ═══════════════════════════════════════════════════════════════════════════
