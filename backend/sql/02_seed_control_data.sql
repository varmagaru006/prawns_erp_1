-- ═══════════════════════════════════════════════════════════════════════════
-- PRAWN ERP - Amendment A2: Seed Data for SaaS Control Database
-- ═══════════════════════════════════════════════════════════════════════════

-- ── SEED: Subscription Plans ──────────────────────────────────────────────
INSERT INTO subscription_plans (plan_code, plan_name, description, price_inr_monthly, price_inr_annual, max_users, max_lots_per_month, storage_limit_gb) VALUES
('basic',        'Basic',        'Essential features for small processors',        4999,   59988,  5,    200,  5),
('professional', 'Professional', 'Advanced analytics and wastage tracking',       12999,  155988, 20,   1000, 25),
('enterprise',   'Enterprise',   'Full feature set with unlimited capacity',      29999,  359988, NULL, NULL, NULL),
('custom',       'Custom',       'Tailored plan for specific requirements',       NULL,   NULL,   NULL, NULL, NULL);

-- ── SEED: Super Admin (Password: admin123 - CHANGE IN PRODUCTION!) ────────
-- Password hash generated with: bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt(12))
INSERT INTO super_admins (name, email, password_hash) VALUES
('Super Administrator', 'superadmin@prawnrp.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewhJE3TJZjhZYNi2');

-- ── SEED: Complete Feature Registry ───────────────────────────────────────
-- MODULE LEVEL
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('procurement',    'Procurement Module',    'Full procurement lot management',    'procurement',     'module', NULL, NULL, TRUE,  10),
('preprocessing',  'Pre-Processing Module', 'Heading, peeling, deveining',       'preprocessing',   'module', NULL, NULL, TRUE,  20),
('production',     'Production Module',     'IQF, cooking, value-added',         'production',      'module', NULL, NULL, TRUE,  30),
('cold_storage',   'Cold Storage Module',   'Chamber/rack/slot inventory',       'cold_storage',    'module', NULL, NULL, TRUE,  40),
('qc',             'QC Module',             'Quality inspections per stage',     'qc',              'module', NULL, NULL, TRUE,  50),
('sales',          'Sales & Dispatch',      'Orders, shipments, payments',       'sales',           'module', NULL, NULL, TRUE,  60),
('wages',          'Wage & Billing',        'Worker wages, TDS, contractor',     'wages',           'module', NULL, NULL, FALSE, 70),
('wastage',        'Wastage Engine',        'Stage-wise loss + revenue calc',    'wastage',         'module', NULL, ARRAY['professional','enterprise','custom'], FALSE, 80),
('traceability',   'Full Lot Traceability', 'End-to-end lot journey tracker',    'traceability',    'module', NULL, ARRAY['professional','enterprise','custom'], FALSE, 90),
('reports',        'Reports & Exports',     'PDF and Excel exports',             'reports',         'module', NULL, NULL, TRUE,  100);

-- PROCUREMENT SUB-FEATURES
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('procurement.quality_inspection',   'Quality Inspection',   '9-parameter sensory scoring',  'procurement', 'feature', 'procurement', NULL, TRUE,  11),
('procurement.size_verification',    'Size Verification',    'Sample count vs claimed size', 'procurement', 'feature', 'procurement', NULL, TRUE,  12),
('procurement.pricing_analytics',    'Pricing Analytics',    'Price vs market, margin calc', 'procurement', 'feature', 'procurement', ARRAY['professional','enterprise','custom'], FALSE, 13),
('procurement.expected_projections', 'Expected Projections', 'Yield forecast at intake',     'procurement', 'feature', 'procurement', ARRAY['professional','enterprise','custom'], FALSE, 14),
('procurement.edit_approval',        'Edit Approval',        'Lock lots, request changes',   'procurement', 'feature', 'procurement', ARRAY['professional','enterprise','custom'], FALSE, 15),
('procurement.farm_master',          'Farm Master',          'Manage farm/vessel records',   'procurement', 'feature', 'procurement', NULL, TRUE,  16);

-- PRE-PROCESSING SUB-FEATURES  
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('preprocessing.byproducts',      'Byproduct Tracking',  'Track head/shell sales',     'preprocessing', 'feature', 'preprocessing', NULL, TRUE,  21),
('preprocessing.worker_tracking', 'Worker Tracking',     'Kg processed per worker',    'preprocessing', 'feature', 'preprocessing', ARRAY['professional','enterprise','custom'], FALSE, 22),
('preprocessing.yield_alerts',    'Yield Alerts',        'Auto-notify on yield breach','preprocessing', 'feature', 'preprocessing', ARRAY['professional','enterprise','custom'], FALSE, 23);

-- PRODUCTION SUB-FEATURES
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('production.value_added',     'Value-Added Products', 'Breaded, rings, formed items', 'production', 'feature', 'production', NULL, FALSE, 31),
('production.bom',             'Bill of Materials',    'Recipe management',            'production', 'feature', 'production.value_added', ARRAY['professional','enterprise','custom'], FALSE, 32),
('production.glazing_tracking','Glazing Tracking',     'Declared vs actual glaze',     'production', 'feature', 'production', NULL, TRUE,  33);

-- COLD STORAGE SUB-FEATURES
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('cold_storage.slot_map',            'Visual Slot Map',     'Chamber/rack/slot grid view',  'cold_storage', 'feature', 'cold_storage', NULL, TRUE, 41),
('cold_storage.temperature_log',     'Temperature Logging', 'Manual temp entry per chamber','cold_storage', 'feature', 'cold_storage', NULL, TRUE, 42),
('cold_storage.fifo_alerts',         'FIFO Alerts',         'Alert when older stock skipped','cold_storage','feature', 'cold_storage', NULL, TRUE, 43),
('cold_storage.monthly_weight_check','Monthly Weight Check','Track drip loss in storage',   'cold_storage', 'feature', 'cold_storage', ARRAY['professional','enterprise','custom'], FALSE, 44);

-- QC SUB-FEATURES
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('qc.lab_report',          'Lab Report Reference', 'Link lab cert to QC record',      'qc', 'feature', 'qc', NULL, TRUE, 51),
('qc.per_stage_templates', 'Per-Stage Templates',  'Different JSONB params per stage','qc', 'feature', 'qc', ARRAY['professional','enterprise','custom'], FALSE, 52);

-- WASTAGE ENGINE SUB-FEATURES
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('wastage.revenue_loss_engine',     'Revenue Loss Calculator', 'Wastage kg × rate = ₹ loss',   'wastage', 'feature', 'wastage', ARRAY['professional','enterprise','custom'], FALSE, 81),
('wastage.yield_benchmarks_admin',  'Yield Benchmarks Admin',  'Admin-configurable thresholds','wastage', 'feature', 'wastage', ARRAY['professional','enterprise','custom'], FALSE, 82),
('wastage.waterfall_view',          'Wastage Waterfall View',  'Per-lot stage-by-stage chart', 'wastage', 'feature', 'wastage', ARRAY['professional','enterprise','custom'], FALSE, 83),
('wastage.worst_batch_leaderboard', 'Worst Batch Leaderboard', 'Top loss batches dashboard',   'wastage', 'feature', 'wastage', ARRAY['enterprise','custom'], FALSE, 84);

-- TRACEABILITY
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('traceability.lot_journey_tracker', 'Lot Journey Tracker', 'Full stage timeline per lot',    'traceability', 'feature', 'traceability', ARRAY['professional','enterprise','custom'], FALSE, 91),
('traceability.carton_label_pdf',    'Carton Label PDF',    'Print labels with lot code',     'traceability', 'feature', 'traceability', NULL, TRUE, 92);

-- SALES SUB-FEATURES
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('sales.multi_line_orders',  'Multi-Line Orders',  'Multiple SKUs per order',      'sales', 'feature', 'sales', NULL, TRUE, 61),
('sales.shipment_tracking',  'Shipment Tracking',  'Container, BL, vessel details','sales', 'feature', 'sales', NULL, TRUE, 62),
('sales.export_documents',   'Export Documents',   'Invoice, packing list PDFs',   'sales', 'feature', 'sales', ARRAY['professional','enterprise','custom'], FALSE, 63);

-- REPORTS
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('reports.lot_trace_report',    'Lot Trace Report',    'Full journey PDF per lot',  'reports', 'feature', 'reports', ARRAY['professional','enterprise','custom'], FALSE, 101),
('reports.wastage_summary',     'Wastage Summary',     'Monthly loss analysis',     'reports', 'feature', 'reports', ARRAY['professional','enterprise','custom'], FALSE, 102),
('reports.agent_performance',   'Agent Performance',   'Quality/yield by agent',    'reports', 'feature', 'reports', ARRAY['professional','enterprise','custom'], FALSE, 103),
('reports.excel_export',        'Excel Export',        'Download reports as .xlsx', 'reports', 'feature', 'reports', ARRAY['professional','enterprise','custom'], FALSE, 104);

-- ADMIN / SYSTEM
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('admin.user_management', 'User Management',    'Create/edit users and roles', 'admin', 'feature', NULL, NULL, TRUE, 110),
('admin.audit_log',       'Audit Log',          'Full action history',         'admin', 'feature', NULL, ARRAY['professional','enterprise','custom'], FALSE, 111),
('admin.notifications',   'Notification System','In-app alerts and bell',      'admin', 'feature', NULL, NULL, TRUE, 112);

-- ROLE-BASED ACCESS
INSERT INTO feature_registry (feature_code, feature_name, description, module, category, parent_feature_code, is_available_on, default_enabled, sort_order) VALUES
('access.procurement_edit_approval', 'Procurement Edit Approval', 'Role-gated edit requests', 'procurement', 'feature', 'procurement.edit_approval', ARRAY['professional','enterprise','custom'], FALSE, 150),
('access.role_gated_views',          'Role-Gated Views',          'Restrict analytics by role','admin',       'feature', NULL, ARRAY['professional','enterprise','custom'], FALSE, 151);

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed data complete: 4 plans + 1 super admin + 50+ features
-- ═══════════════════════════════════════════════════════════════════════════
