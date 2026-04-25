"""
Shared feature flag registry for multi-tenant Prawn ERP.
Single source of truth for all toggleable features; used by client ERP and super admin.
Keep in sync with frontend moduleConfig / nav (Layout) feature codes.
"""
from typing import Dict, List, Any

# All feature codes that can be toggled per tenant. Defaults used when creating new tenants.
FEATURE_REGISTRY: List[Dict[str, Any]] = [
    {"code": "dashboard", "name": "Dashboard", "description": "Main dashboard and analytics", "module": "Core", "default_enabled": True},
    {"code": "procurement", "name": "Procurement", "description": "Incoming prawn lots management", "module": "Procurement", "default_enabled": True},
    {"code": "agents", "name": "Agents & Vendors", "description": "Vendor and agent management", "module": "Procurement", "default_enabled": True},
    {"code": "preprocessing", "name": "Pre-Processing", "description": "Batch processing and yield tracking", "module": "Processing", "default_enabled": True},
    {"code": "production", "name": "Production", "description": "Production orders and conversion", "module": "Production", "default_enabled": True},
    {"code": "qualityControl", "name": "Quality Control", "description": "QC inspections and quality assurance", "module": "Quality", "default_enabled": True},
    {"code": "coldStorage", "name": "Cold Storage", "description": "Inventory and temperature monitoring", "module": "Storage", "default_enabled": True},
    {"code": "finishedGoods", "name": "Finished Goods", "description": "Ready inventory for dispatch", "module": "Storage", "default_enabled": True},
    {"code": "sales", "name": "Sales & Dispatch", "description": "Buyer management and orders", "module": "Sales", "default_enabled": True},
    {"code": "accounts", "name": "Accounts", "description": "Wage bills and payments", "module": "Finance", "default_enabled": True},
    {"code": "purchaseInvoiceDashboard", "name": "Purchase Invoice Dashboard", "description": "Invoice metrics, quick preview, and bulk export", "module": "Finance", "default_enabled": True},
    {"code": "parties", "name": "Party Master", "description": "Party/vendor master data and management", "module": "Finance", "default_enabled": True},
    {"code": "partyLedger", "name": "Party Ledger", "description": "Party ledger and FY-wise accounts", "module": "Finance", "default_enabled": True},
    {"code": "risk_comments_v2", "name": "Risk Comments V2", "description": "Entity risk commentary, alerts, and area insights", "module": "Risk", "default_enabled": True},
    {"code": "wastageDashboard", "name": "Wastage Dashboard", "description": "Yield tracking and revenue loss monitoring", "module": "Analytics", "default_enabled": False},
    {"code": "yieldBenchmarks", "name": "Yield Benchmarks", "description": "Configure wastage thresholds", "module": "Analytics", "default_enabled": False},
    {"code": "marketRates", "name": "Market Rates", "description": "Configure pricing for revenue calculations", "module": "Analytics", "default_enabled": False},
    {"code": "admin", "name": "Admin Panel", "description": "Company settings, audit trail, attachments", "module": "Admin", "default_enabled": True},
    {"code": "notifications", "name": "Notifications", "description": "System notifications", "module": "Core", "default_enabled": True},
    {"code": "superAdmin", "name": "Super Admin", "description": "Platform-wide tenant and feature management", "module": "Admin", "default_enabled": False},
]


def get_all_feature_codes() -> List[str]:
    return [f["code"] for f in FEATURE_REGISTRY]


def get_default_flags() -> Dict[str, bool]:
    """Default feature flags for new tenants."""
    return {f["code"]: f["default_enabled"] for f in FEATURE_REGISTRY}


def merge_flags_with_registry(db_flags: Dict[str, bool]) -> Dict[str, bool]:
    """
    Merge DB flags with registry. Every registry code is present; value from DB or default.
    Ensures client always receives a complete set for all known features.
    """
    defaults = get_default_flags()
    merged = dict(defaults)
    for code, enabled in db_flags.items():
        if code in merged:
            merged[code] = bool(enabled)
    return merged


def registry_as_list() -> List[Dict[str, Any]]:
    """Registry entries for super admin UI (code, name, description, module)."""
    return [{"code": f["code"], "name": f["name"], "description": f["description"], "module": f["module"]} for f in FEATURE_REGISTRY]
