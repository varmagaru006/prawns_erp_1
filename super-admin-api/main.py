"""
Super Admin API - MongoDB Version
Complete migration from PostgreSQL to MongoDB
All 31 endpoints migrated to MongoDB
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
from dotenv import load_dotenv, dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import OperationFailure
import uuid
import hashlib

load_dotenv()

# Reuse backend Mongo TLS helper (certifi CA bundle for Atlas on macOS)
import sys
from pathlib import Path as _Path

_backend_dir = _Path(__file__).resolve().parent.parent / "backend"
if _backend_dir.is_dir() and str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))
from mongo_utils import motor_client_kwargs  # noqa: E402

# ══════════════════════════════════════════════════════════════════════════════
# Feature registry (keep in sync with backend/feature_registry.py)
# ══════════════════════════════════════════════════════════════════════════════
FEATURE_REGISTRY = [
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
    {"code": "wastageDashboard", "name": "Wastage Dashboard", "description": "Yield tracking and revenue loss monitoring", "module": "Analytics", "default_enabled": False},
    {"code": "yieldBenchmarks", "name": "Yield Benchmarks", "description": "Configure wastage thresholds", "module": "Analytics", "default_enabled": False},
    {"code": "marketRates", "name": "Market Rates", "description": "Configure pricing for revenue calculations", "module": "Analytics", "default_enabled": False},
    {"code": "admin", "name": "Admin Panel", "description": "Company settings, audit trail, attachments", "module": "Admin", "default_enabled": True},
    {"code": "notifications", "name": "Notifications", "description": "System notifications", "module": "Core", "default_enabled": True},
    {"code": "superAdmin", "name": "Super Admin", "description": "Platform-wide tenant and feature management", "module": "Admin", "default_enabled": False},
]


def _get_default_flags() -> Dict[str, bool]:
    return {f["code"]: f["default_enabled"] for f in FEATURE_REGISTRY}


def _merge_flags_with_registry(db_flags: Dict[str, bool]) -> Dict[str, bool]:
    merged = dict(_get_default_flags())
    for code, enabled in db_flags.items():
        if code in merged:
            merged[code] = bool(enabled)
    return merged


# Redis (optional): invalidate client ERP's feature-flag cache when we toggle so changes apply immediately
def _invalidate_client_flags_cache(tenant_id: str) -> None:
    """Invalidate the client ERP's Redis cache for this tenant so toggled features apply immediately."""
    try:
        import redis
        r = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            db=0,
            decode_responses=True,
        )
        r.delete(f"flags:{tenant_id}")
        # Also delete per-feature keys if they exist (pattern: feature:{tenant_id}:*)
        for key in r.scan_iter(match=f"feature:{tenant_id}:*", count=100):
            r.delete(key)
    except Exception:
        pass  # Redis optional; client will see change after cache TTL (e.g. 60s)

# Default client ERP URL for push (when client has no webhook_url)
CLIENT_ERP_URL = os.getenv("CLIENT_ERP_URL", "http://localhost:8000")

async def _push_features_to_client_erp(tenant_id: str, client: dict) -> None:
    """
    Push current feature flags to the client ERP via HTTP so it updates its DB and invalidates its Redis.
    Sends full merged set (registry + DB) so client always has every feature code.
    """
    try:
        import httpx
        target_db = _get_client_erp_db(client)
        cursor = target_db.feature_flags.find({"tenant_id": tenant_id}, {"_id": 0, "feature_code": 1, "is_enabled": 1})
        db_flags = {doc["feature_code"]: doc["is_enabled"] for doc in await cursor.to_list(length=1000)}
        features = _merge_flags_with_registry(db_flags)
        base_url = (
            (client.get("client_api_url") or "").rstrip("/")
            or (client.get("webhook_url") or "").split("/internal")[0].rstrip("/")
            or CLIENT_ERP_URL
        )
        push_url = f"{base_url}/internal/saas-hook/features"
        async with httpx.AsyncClient(timeout=10.0) as http:
            await http.post(push_url, json={"tenant_id": tenant_id, "features": features})
    except Exception:
        pass  # Don't fail the toggle if push fails (e.g. client ERP not running)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
mongo_client = AsyncIOMotorClient(MONGO_URL, **motor_client_kwargs(MONGO_URL))

# Super Admin DB - separate database for SaaS control
db = mongo_client["prawn_erp_super_admin"]

# Client ERP DB - for syncing feature flags
client_db = mongo_client[os.getenv("MONGO_DB_NAME", "prawn_erp")]
ENABLE_MULTI_DB_ROUTING = os.getenv("ENABLE_MULTI_DB_ROUTING", "false").lower() in ("1", "true", "yes", "on")


def _default_client_db_name(tenant_id: str) -> str:
    safe = "".join(ch for ch in tenant_id if ch.isalnum() or ch in ("_", "-")).strip() or "client"
    return f"prawn_erp_{safe}"


def _get_client_erp_db(client_doc: dict):
    if not ENABLE_MULTI_DB_ROUTING:
        # Backward-compatible mode: keep all tenant data in one shared DB.
        return client_db
    db_name = (
        client_doc.get("client_db_name")
        or _default_client_db_name(client_doc.get("tenant_id", "client"))
    )
    return mongo_client[db_name]

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "super-admin-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480
_backend_env_secret = dotenv_values(str(_backend_dir / ".env")).get("SECRET_KEY") if _backend_dir.is_dir() else None
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# FastAPI app
app = FastAPI(title="Prawn ERP - Super Admin API (MongoDB)")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════════════════════════════════════════
# Pydantic Models
# ══════════════════════════════════════════════════════════════════════════════

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class SuperAdminLogin(BaseModel):
    email: EmailStr
    password: str

class ClientCreate(BaseModel):
    tenant_id: str
    business_name: str
    owner_email: EmailStr
    owner_name: str
    plan_id: Optional[str] = "free"
    subscription_months: int = 1
    client_ui_url: Optional[str] = None
    client_api_url: Optional[str] = None
    client_db_name: Optional[str] = None

class ClientUpdate(BaseModel):
    tenant_id: Optional[str] = None
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    subscription_status: Optional[str] = None
    is_active: Optional[bool] = None
    client_ui_url: Optional[str] = None
    client_api_url: Optional[str] = None
    client_db_name: Optional[str] = None

class ClientSummary(BaseModel):
    id: str
    tenant_id: str
    business_name: str
    plan_name: Optional[str] = "Free"
    subscription_status: str
    subscription_to: Optional[str] = None
    is_active: bool
    client_ui_url: Optional[str] = None
    client_api_url: Optional[str] = None
    client_db_name: Optional[str] = None

class BrandingUpdate(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    company_name: Optional[str] = None
    sidebar_label: Optional[str] = None
    login_bg_color: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None

class FeatureToggle(BaseModel):
    feature_code: str
    is_enabled: bool

class BulkFeaturesUpdate(BaseModel):
    """Format sent by Super Admin frontend: list of codes + one is_enabled for all."""
    feature_codes: List[str]
    is_enabled: bool

class LinkRequest(BaseModel):
    webhook_url: Optional[str] = None

class ProvisionUserRequest(BaseModel):
    email: EmailStr
    # Frontend sends `full_name`; keep `name` for backward compatibility.
    name: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "worker"
    # Frontend does not send password; generate temporary password when missing.
    password: Optional[str] = None


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    new_password: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = None  # if None, auto-generate


class TenantBootstrapRequest(BaseModel):
    admin_email: Optional[EmailStr] = None
    admin_name: Optional[str] = None
    admin_password: Optional[str] = None

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    severity: str = "info"  # info, warning, critical
    target_type: str = "all"  # all, specific_clients
    target_ids: List[str] = []
    start_date: Optional[str] = None
    end_date: Optional[str] = None

# ══════════════════════════════════════════════════════════════════════════════
# Startup / Shutdown
# ══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    try:
        # Create indexes
        await db.super_admins.create_index("email", unique=True)
        await db.clients.create_index("id", unique=True)
        await db.clients.create_index("tenant_id", unique=True)
        await db.provisioned_users.create_index([("client_id", 1), ("email", 1)], unique=True)
        await db.feature_flags.create_index([("client_id", 1), ("feature_code", 1)], unique=True)
        await db.announcements.create_index("created_at")
    except OperationFailure as e:
        if "authentication" in str(e).lower() or "unauthorized" in str(e).lower():
            raise RuntimeError(
                "MongoDB requires authentication. Either:\n"
                "  1. Set MONGO_URL in .env with credentials, e.g.:\n"
                "     MONGO_URL=mongodb://username:password@localhost:27017\n"
                "  2. Or run MongoDB without auth for local dev (default for Homebrew)."
            ) from e
        raise

    # Ensure default super admin exists and password is verifiable by this process (fixes bcrypt mismatch)
    default_email = "superadmin@prawnrp.com"
    default_password = "admin123"
    fresh_hash = pwd_context.hash(default_password)
    existing = await db.super_admins.find_one({"email": default_email})
    if not existing:
        await db.super_admins.insert_one({
            "id": str(uuid.uuid4()),
            "email": default_email,
            "password_hash": fresh_hash,
            "name": "Super Administrator",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": None
        })
        print("✅ Created default super admin: superadmin@prawnrp.com / admin123")
    else:
        await db.super_admins.update_one(
            {"email": default_email},
            {"$set": {"password_hash": fresh_hash, "is_active": True}}
        )
        print("✅ Reset default super admin password: superadmin@prawnrp.com / admin123")
    
    # Ensure default subscription plans exist
    plans_count = await db.subscription_plans.count_documents({})
    if plans_count == 0:
        default_plans = [
            {"id": str(uuid.uuid4()), "plan_name": "Free", "price_monthly": 0, "max_users": 5, "features": ["basic"]},
            {"id": str(uuid.uuid4()), "plan_name": "Professional", "price_monthly": 999, "max_users": 20, "features": ["basic", "advanced"]},
            {"id": str(uuid.uuid4()), "plan_name": "Enterprise", "price_monthly": 2999, "max_users": -1, "features": ["all"]},
        ]
        await db.subscription_plans.insert_many(default_plans)
        print("✅ Created default subscription plans")
    
    # Seed default client (tenant_id cli_001) so portal shows an existing client
    existing_client = await db.clients.find_one({"tenant_id": "cli_001"})
    if not existing_client:
        subscription_to = datetime.now(timezone.utc) + timedelta(days=365)
        free_plan = await db.subscription_plans.find_one({"plan_name": "Free"}, {"id": 1})
        plan_id = free_plan["id"] if free_plan else None
        default_client = {
            "id": str(uuid.uuid4()),
            "tenant_id": "cli_001",
            "business_name": "Prawn Export Company",
            "owner_email": "admin@prawnexport.com",
            "owner_name": "Admin User",
            "client_ui_url": "http://localhost:3000",
            "client_api_url": CLIENT_ERP_URL,
            "client_db_name": _default_client_db_name("cli_001"),
            "plan_id": plan_id,
            "subscription_status": "active",
            "subscription_to": subscription_to.isoformat(),
            "is_active": True,
            "api_key_hash": hash_api_key("placeholder"),
            "link_status": "pending",
            "branding": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.clients.insert_one(default_client)
        print("✅ Created default client: Prawn Export Company (tenant_id: cli_001)")
    
    print("✅ MongoDB Super Admin API started")

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
    print("✅ MongoDB connection closed")

# ══════════════════════════════════════════════════════════════════════════════
# Auth Utilities
# ══════════════════════════════════════════════════════════════════════════════

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    admin = await db.super_admins.find_one({"email": email, "is_active": True}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Super admin not found")
    
    return admin

def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()

# ══════════════════════════════════════════════════════════════════════════════
# Auth Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/auth/login", response_model=Token)
async def login(credentials: SuperAdminLogin):
    """Super Admin Login"""
    admin = await db.super_admins.find_one({"email": credentials.email, "is_active": True}, {"_id": 0})
    
    if not admin or not pwd_context.verify(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update last login
    await db.super_admins.update_one(
        {"email": credentials.email},
        {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    access_token = create_access_token({"sub": admin["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me")
async def get_me(current_admin = Depends(get_current_super_admin)):
    """Get current super admin info"""
    return {
        "id": current_admin["id"],
        "name": current_admin["name"],
        "email": current_admin["email"],
        "last_login_at": current_admin.get("last_login_at")
    }

# ══════════════════════════════════════════════════════════════════════════════
# Client Management Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/clients", response_model=List[ClientSummary])
async def get_clients(current_admin = Depends(get_current_super_admin)):
    """Get all clients"""
    clients = await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with plan names
    for client in clients:
        if client.get("plan_id"):
            plan = await db.subscription_plans.find_one({"id": client["plan_id"]}, {"_id": 0})
            client["plan_name"] = plan["plan_name"] if plan else "Unknown"
        else:
            client["plan_name"] = "Free"
    
    return clients

@app.post("/clients", status_code=201)
async def create_client(client_data: ClientCreate, current_admin = Depends(get_current_super_admin)):
    """Create a new client"""
    # Check if tenant_id already exists
    existing = await db.clients.find_one({"tenant_id": client_data.tenant_id})
    if existing:
        raise HTTPException(status_code=400, detail="Tenant ID already exists")
    
    # Generate API key for linking
    api_key = f"pk_{uuid.uuid4().hex}"
    api_key_hash = hash_api_key(api_key)
    
    # Calculate subscription end date
    subscription_to = datetime.now(timezone.utc) + timedelta(days=30 * client_data.subscription_months)
    target_db_name = client_data.client_db_name or _default_client_db_name(client_data.tenant_id)
    
    client = {
        "id": str(uuid.uuid4()),
        "tenant_id": client_data.tenant_id,
        "business_name": client_data.business_name,
        "owner_email": client_data.owner_email,
        "owner_name": client_data.owner_name,
        "client_ui_url": (client_data.client_ui_url or "").strip() or "http://localhost:3000",
        "client_api_url": (client_data.client_api_url or "").strip() or CLIENT_ERP_URL,
        "client_db_name": target_db_name,
        "plan_id": client_data.plan_id,
        "subscription_status": "active",
        "subscription_to": subscription_to.isoformat(),
        "is_active": True,
        "api_key_hash": api_key_hash,
        "link_status": "pending",
        "branding": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.clients.insert_one(client)
    client.pop("_id", None)

    # Seed feature flags (registry defaults) so client ERP and Super Admin UI have full set
    tenant_id = client_data.tenant_id
    target_db = _get_client_erp_db(client)
    now_ts = datetime.now(timezone.utc).isoformat()
    for code, is_enabled in _get_default_flags().items():
        await db.feature_flags.update_one(
            {"client_id": client["id"], "feature_code": code},
            {"$set": {"is_enabled": is_enabled, "updated_at": now_ts}},
            upsert=True,
        )
        await target_db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": code},
            {"$set": {"is_enabled": is_enabled, "updated_at": now_ts}},
            upsert=True,
        )
    
    # Log activity
    activity_log = {
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "admin_email": current_admin["email"],
        "action": "CREATE_CLIENT",
        "entity_type": "client",
        "entity_id": client["id"],
        "details": {"business_name": client_data.business_name},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(activity_log)
    
    return {
        "client": client,
        "api_key": api_key  # Return once for client to save
    }

@app.get("/clients/{client_id}")
async def get_client_detail(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Get client details"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get plan details
    if client.get("plan_id"):
        plan = await db.subscription_plans.find_one({"id": client["plan_id"]}, {"_id": 0})
        client["plan_details"] = plan
    
    # Get provisioned users count
    users_count = await db.provisioned_users.count_documents({"client_id": client_id})
    client["provisioned_users_count"] = users_count
    
    return client

@app.put("/clients/{client_id}")
async def update_client(client_id: str, updates: ClientUpdate, current_admin = Depends(get_current_super_admin)):
    """Update client details"""
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.clients.update_one({"id": client_id}, {"$set": update_data})
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "UPDATE_CLIENT",
        "entity_id": client_id,
        "details": update_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "success", "message": "Client updated"}

@app.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Delete a client (soft delete)"""
    result = await db.clients.update_one(
        {"id": client_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "DELETE_CLIENT",
        "entity_id": client_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "success", "message": "Client deactivated"}

@app.post("/clients/{client_id}/activate")
async def activate_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Activate/reactivate a client"""
    result = await db.clients.update_one(
        {"id": client_id},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {"status": "success", "message": "Client activated"}


@app.post("/clients/{client_id}/launch")
async def launch_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Return launch URL and tenant/db details for a client."""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    ui_url = (client.get("client_ui_url") or "").strip() or "http://localhost:3000"
    return {
        "status": "success",
        "launch_url": ui_url,
        "tenant_id": client.get("tenant_id"),
        "client_db_name": client.get("client_db_name") or _default_client_db_name(client.get("tenant_id", "client")),
    }


@app.get("/clients/{client_id}/health")
async def client_health(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Compatibility endpoint used by super-admin frontend."""
    client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")
    tenant_id = client_doc.get("tenant_id")
    target_db = _get_client_erp_db(client_doc)
    users_count = await target_db.users.count_documents({"tenant_id": tenant_id})
    return {
        "status": "ok",
        "client_id": client_id,
        "tenant_id": tenant_id,
        "client_db_name": client_doc.get("client_db_name") or _default_client_db_name(tenant_id or "client"),
        "link_status": client_doc.get("link_status"),
        "users_count": users_count,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }

# ══════════════════════════════════════════════════════════════════════════════
# Branding Management
# ══════════════════════════════════════════════════════════════════════════════

@app.put("/clients/{client_id}/branding")
async def update_client_branding(client_id: str, branding: BrandingUpdate, current_admin = Depends(get_current_super_admin)):
    """Update client branding and push to client ERP"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Update branding in super admin DB
    branding_data = {k: v for k, v in branding.dict().items() if v is not None}
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"branding": branding_data, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    pushed_to_erp = False
    if client.get("link_status") == "linked":
        target_db = _get_client_erp_db(client)
        # Push to client ERP MongoDB only if linked.
        await target_db.tenant_config.update_one(
            {"tenant_id": client["tenant_id"]},
            {"$set": {"branding": branding_data, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        pushed_to_erp = True
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "UPDATE_BRANDING",
        "entity_id": client_id,
        "details": branding_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    if pushed_to_erp:
        return {"status": "success", "message": "Branding updated and pushed to client ERP"}
    return {"status": "success", "message": "Branding saved. Link client to push to ERP."}


@app.post("/clients/{client_id}/push-branding")
async def push_branding_now(
    client_id: str,
    branding: BrandingUpdate,
    current_admin = Depends(get_current_super_admin)
):
    """Compatibility endpoint used by super-admin frontend."""
    return await update_client_branding(client_id, branding, current_admin)

# ══════════════════════════════════════════════════════════════════════════════
# Feature Flag Management
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/clients/{client_id}/features")
async def get_client_features(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Get all feature flags for a client, merged with feature registry (full list for Super Admin UI)."""
    db_features = await db.feature_flags.find({"client_id": client_id}, {"_id": 0}).to_list(1000)
    db_feature_map = {f["feature_code"]: f for f in db_features}
    defaults = _get_default_flags()
    merged_features = []
    for reg in FEATURE_REGISTRY:
        code = reg["code"]
        db_f = db_feature_map.get(code)
        merged_features.append({
            "feature_code": code,
            "feature_name": reg["name"],
            "description": reg["description"],
            "module": reg["module"],
            "is_enabled": db_f["is_enabled"] if db_f else defaults.get(code, False),
            "updated_at": db_f.get("updated_at") if db_f else None,
            "updated_by": db_f.get("updated_by") if db_f else None,
        })
    return merged_features

@app.post("/clients/{client_id}/features/toggle")
async def toggle_feature(client_id: str, toggle: FeatureToggle, current_admin = Depends(get_current_super_admin)):
    """Toggle a feature flag for a client"""
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    tenant_id = client["tenant_id"]
    
    # Upsert feature flag in super admin DB
    await db.feature_flags.update_one(
        {"client_id": client_id, "feature_code": toggle.feature_code},
        {"$set": {
            "is_enabled": toggle.is_enabled,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_admin["email"]
        }},
        upsert=True
    )
    
    target_db = _get_client_erp_db(client)
    # Push to client ERP database for this client's tenant_id
    await target_db.feature_flags.update_one(
        {"tenant_id": tenant_id, "feature_code": toggle.feature_code},
        {"$set": {
            "is_enabled": toggle.is_enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Invalidate client ERP's Redis cache so the toggle applies immediately
    _invalidate_client_flags_cache(tenant_id)
    # Push to client ERP via HTTP so it updates DB and invalidates its own Redis
    await _push_features_to_client_erp(tenant_id, client)
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "TOGGLE_FEATURE",
        "entity_id": client_id,
        "details": {"feature_code": toggle.feature_code, "is_enabled": toggle.is_enabled, "tenant_id": tenant_id},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "success", "message": f"Feature {toggle.feature_code} {'enabled' if toggle.is_enabled else 'disabled'}"}

@app.post("/clients/{client_id}/bulk-features")
async def bulk_toggle_features(
    client_id: str,
    body: BulkFeaturesUpdate,
    current_admin = Depends(get_current_super_admin)
):
    """Toggle multiple features at once. Accepts { feature_codes: string[], is_enabled: bool }."""
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    tenant_id = client["tenant_id"]
    features = [FeatureToggle(feature_code=code, is_enabled=body.is_enabled) for code in body.feature_codes]
    
    for feature in features:
        await db.feature_flags.update_one(
            {"client_id": client_id, "feature_code": feature.feature_code},
            {"$set": {
                "is_enabled": feature.is_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        target_db = _get_client_erp_db(client)
        # Push to client ERP database for this client's tenant_id only
        await target_db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": feature.feature_code},
            {"$set": {
                "is_enabled": feature.is_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    # Invalidate client ERP's Redis cache so toggles apply immediately
    _invalidate_client_flags_cache(tenant_id)
    # Push to client ERP via HTTP so it updates DB and invalidates its own Redis
    await _push_features_to_client_erp(tenant_id, client)
    
    return {"status": "success", "message": f"Updated {len(features)} features for tenant {tenant_id}"}


@app.post("/clients/{client_id}/push-features")
async def push_features_now(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Compatibility endpoint used by super-admin frontend."""
    client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")
    tenant_id = client_doc.get("tenant_id")
    await _push_features_to_client_erp(tenant_id, client_doc)
    return {"status": "success", "message": "Features pushed", "tenant_id": tenant_id}

# ══════════════════════════════════════════════════════════════════════════════
# Client Linking
# ══════════════════════════════════════════════════════════════════════════════

class LinkRequest(BaseModel):
    webhook_url: Optional[str] = None

@app.post("/clients/{client_id}/link")
async def link_client(client_id: str, request: LinkRequest, current_admin = Depends(get_current_super_admin)):
    """Link client ERP by calling its handshake endpoint"""
    import httpx
    
    # Get client info
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check if already linked
    if client.get("link_status") == "linked":
        return {
            "status": "success",
            "message": "Client already linked",
            "link_status": "linked"
        }
    
    # Generate a new API key for linking (since we can't retrieve the old one)
    api_key = f"pk_{uuid.uuid4().hex}"
    api_key_hash = hash_api_key(api_key)
    
    # Get plan details
    plan_code = "free"
    if client.get("plan_id"):
        plan = await db.subscription_plans.find_one({"id": client["plan_id"]}, {"_id": 0})
        plan_code = plan.get("plan_name", "free").lower() if plan else "free"
    
    # Determine webhook URL
    api_base = (client.get("client_api_url") or CLIENT_ERP_URL).rstrip("/")
    webhook_url = request.webhook_url or f"{api_base}/internal/saas-hook/handshake"
    
    # Update client with new API key hash, webhook URL and set status to 'linking'
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {
            "api_key_hash": api_key_hash,
            "webhook_url": webhook_url,
            "link_status": "linking",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Prepare handshake payload
    handshake_payload = {
        "client_id": client_id,
        "tenant_id": client["tenant_id"],
        "api_key_hash": api_key_hash,
        "branding": client.get("branding", {}),
        "plan": plan_code
    }
    
    # Call client ERP handshake endpoint
    try:
        async with httpx.AsyncClient() as http_client:
            # Call the internal handshake endpoint on client ERP
            response = await http_client.post(
                webhook_url,
                json=handshake_payload,
                headers={"X-SAAS-API-Key": api_key},
                timeout=30.0
            )
            
            if response.status_code == 200:
                # Update link status to 'linked'
                await db.clients.update_one(
                    {"id": client_id},
                    {"$set": {
                        "link_status": "linked",
                        "linked_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Log activity
                await db.activity_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "admin_id": current_admin["id"],
                    "action": "LINK_CLIENT",
                    "entity_id": client_id,
                    "details": {"tenant_id": client["tenant_id"]},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                return {
                    "status": "success",
                    "message": "Client linked successfully",
                    "link_status": "linked",
                    "api_key": api_key  # Return the new API key for reference
                }
            else:
                # Link failed, update status back to pending
                await db.clients.update_one(
                    {"id": client_id},
                    {"$set": {
                        "link_status": "pending",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to link client: {response.text}"
                )
    
    except httpx.HTTPError as e:
        # Link failed, update status back to pending
        await db.clients.update_one(
            {"id": client_id},
            {"$set": {
                "link_status": "pending",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=f"Failed to connect to client ERP: {str(e)}")

# ══════════════════════════════════════════════════════════════════════════════
# User Provisioning
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/clients/{client_id}/users")
async def get_provisioned_users(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Get all client users (from client ERP DB), enriched with provisioning metadata."""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    target_db = _get_client_erp_db(client)
    tenant_id = client.get("tenant_id")

    # Pull all users from client ERP DB for this tenant.
    users = await target_db.users.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "password_hash": 0, "password": 0}
    ).to_list(5000)

    # Pull provisioning records from super-admin DB and index by user id / email.
    provisioned = await db.provisioned_users.find(
        {"client_id": client_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(5000)
    by_user_id = {u.get("id"): u for u in provisioned if u.get("id")}
    by_email = {str(u.get("email") or "").lower(): u for u in provisioned if u.get("email")}

    normalized = []
    for user in users:
        email = str(user.get("email") or "").lower()
        pmeta = by_user_id.get(user.get("id")) or by_email.get(email) or {}
        normalized.append({
            "user_id": user.get("id"),
            "id": user.get("id"),
            "email": user.get("email"),
            "full_name": user.get("name") or user.get("full_name"),
            "name": user.get("name") or user.get("full_name"),
            "role": user.get("role"),
            "is_active": bool(user.get("is_active", True)),
            "provisioned_at": pmeta.get("created_at") or user.get("created_at"),
            "push_status": pmeta.get("push_status", "success"),
            "source": "provisioned" if pmeta else "client_db",
        })

    normalized.sort(key=lambda u: (not u.get("is_active", True), (u.get("email") or "").lower()))
    return normalized

@app.post("/clients/{client_id}/users")
async def provision_user(
    client_id: str, 
    user_data: ProvisionUserRequest, 
    current_admin = Depends(get_current_super_admin)
):
    """Provision a new user for client ERP"""
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if client.get("link_status") != "linked":
        raise HTTPException(status_code=400, detail="Client must be linked before provisioning users")
    
    display_name = (user_data.name or user_data.full_name or "").strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="name/full_name is required")
    normalized_email = str(user_data.email).strip().lower()

    # Generate temporary password when not explicitly provided.
    chosen_password = (user_data.password or "").strip()
    temp_password = chosen_password or f"Tmp@{uuid.uuid4().hex[:8]}"

    # Check if user already exists
    existing = await db.provisioned_users.find_one({"client_id": client_id, "email": normalized_email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists for this client")
    
    # Hash password
    password_hash = pwd_context.hash(temp_password)
    
    # Create user record in super admin DB
    user_record = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "tenant_id": client["tenant_id"],
        "email": normalized_email,
        "name": display_name,
        "role": user_data.role,
        "password_hash": password_hash,
        "is_active": True,
        "push_status": "success",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_admin["email"]
    }
    await db.provisioned_users.insert_one(user_record)
    
    target_db = _get_client_erp_db(client)
    # Push to client ERP MongoDB
    await target_db.users.insert_one({
        "id": user_record["id"],
        "email": normalized_email,
        "name": display_name,
        "role": user_data.role,
        "tenant_id": client["tenant_id"],
        "password_hash": password_hash,
        "phone": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provisioned_by_super_admin": True
    })
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "PROVISION_USER",
        "entity_id": client_id,
        "details": {"email": normalized_email, "name": display_name},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "status": "success",
        "message": "User provisioned successfully",
        "user_id": user_record["id"],
        "temp_password": temp_password,
        "user": {
            "id": user_record["id"],
            "email": normalized_email,
            "name": display_name,
            "role": user_data.role
        }
    }


@app.patch("/clients/{client_id}/users/{user_id}")
async def update_client_user(
    client_id: str,
    user_id: str,
    updates: UpdateUserRequest,
    current_admin = Depends(get_current_super_admin)
):
    """Update client-side persona user: role, active/inactive, and/or reset password."""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    target_db = _get_client_erp_db(client)
    user_doc = await target_db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    set_data: Dict[str, Any] = {"updated_at": now_iso}
    reset_temp_password = None

    if updates.role is not None:
        set_data["role"] = updates.role
    if updates.is_active is not None:
        set_data["is_active"] = bool(updates.is_active)
    if updates.new_password is not None:
        reset_temp_password = updates.new_password.strip() or f"Tmp@{uuid.uuid4().hex[:8]}"
        set_data["password_hash"] = pwd_context.hash(reset_temp_password)
        set_data["password_changed_at"] = now_iso

    await target_db.users.update_one({"id": user_id}, {"$set": set_data})

    # Mirror selected fields to provisioned_users; upsert for legacy tenant-only users.
    mirror_set: Dict[str, Any] = {
        "tenant_id": client["tenant_id"],
        "email": user_doc.get("email"),
        "updated_at": now_iso,
    }
    if updates.role is not None:
        mirror_set["role"] = updates.role
    if updates.is_active is not None:
        mirror_set["is_active"] = bool(updates.is_active)
    if updates.new_password is not None:
        mirror_set["password_hash"] = set_data["password_hash"]
    await db.provisioned_users.update_one(
        {"client_id": client_id, "id": user_id},
        {"$set": mirror_set},
        upsert=True,
    )

    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "UPDATE_CLIENT_USER",
        "entity_id": client_id,
        "details": {"user_id": user_id, "email": user_doc.get("email"), "fields": list(set_data.keys()), "force_logout": bool(updates.new_password is not None)},
        "timestamp": now_iso
    })

    return {
        "status": "success",
        "message": "User updated successfully",
        "user_id": user_id,
        "temp_password": reset_temp_password,
    }


@app.delete("/clients/{client_id}/users/{user_id}")
async def deactivate_client_user(
    client_id: str,
    user_id: str,
    current_admin = Depends(get_current_super_admin)
):
    """Deactivate a client user (soft disable)."""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    target_db = _get_client_erp_db(client)
    result = await target_db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    await db.provisioned_users.update_one(
        {"client_id": client_id, "id": user_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "UPDATE_CLIENT_USER",
        "entity_id": client_id,
        "details": {"user_id": user_id, "fields": ["is_active"], "is_active": False},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "success", "message": "User deactivated"}


@app.patch("/clients/{client_id}/users/{user_id}/reset-password")
async def reset_user_password(
    client_id: str,
    user_id: str,
    req: ResetPasswordRequest,
    current_admin = Depends(get_current_super_admin),
):
    """Reset client user password and return one-time plain password."""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    tenant_db = _get_client_erp_db(client)

    # Prefer super-admin record, but support legacy users that only exist in tenant DB.
    user = await db.provisioned_users.find_one({"client_id": client_id, "id": user_id}, {"_id": 0})
    tenant_user = await tenant_db.users.find_one({"id": user_id}, {"_id": 0})
    if not user and not tenant_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Generate or use provided password
    new_pw = (req.new_password or "").strip() or f"Temp@{uuid.uuid4().hex[:8]}"
    pw_hash = pwd_context.hash(new_pw)
    now_iso = datetime.now(timezone.utc).isoformat()

    # 3. Update super admin DB
    await db.provisioned_users.update_one(
        {"client_id": client_id, "id": user_id},
        {"$set": {"password_hash": pw_hash, "updated_at": now_iso}}
    )

    # 4. Dual-write -> tenant DB
    tenant_update = await tenant_db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": pw_hash, "password_changed_at": now_iso, "updated_at": now_iso}}
    )
    if tenant_update.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # Mirror to super-admin DB when record exists; upsert for tenant-only legacy users.
    effective_email = (user or tenant_user or {}).get("email")
    await db.provisioned_users.update_one(
        {"client_id": client_id, "id": user_id},
        {"$set": {
            "tenant_id": client["tenant_id"],
            "email": effective_email,
            "password_hash": pw_hash,
            "updated_at": now_iso,
        }},
        upsert=True,
    )

    # 5. Log
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "RESET_PASSWORD",
        "entity_id": client_id,
        "details": {"user_id": user_id, "email": effective_email},
        "timestamp": now_iso,
    })

    return {"status": "success", "email": effective_email, "new_password": new_pw}


@app.patch("/clients/{client_id}/users/{user_id}/toggle-active")
async def toggle_user_active(
    client_id: str,
    user_id: str,
    current_admin = Depends(get_current_super_admin),
):
    """Disable/Enable user with dual-write."""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    tenant_db = _get_client_erp_db(client)
    user = await db.provisioned_users.find_one({"client_id": client_id, "id": user_id}, {"_id": 0})
    tenant_user = await tenant_db.users.find_one({"id": user_id}, {"_id": 0})
    if not user and not tenant_user:
        raise HTTPException(status_code=404, detail="User not found")

    current_is_active = bool((user or tenant_user or {}).get("is_active", True))
    new_state = not current_is_active
    now_iso = datetime.now(timezone.utc).isoformat()

    # Update super admin DB
    effective_email = (user or tenant_user or {}).get("email")
    await db.provisioned_users.update_one(
        {"client_id": client_id, "id": user_id},
        {"$set": {
            "tenant_id": client["tenant_id"],
            "email": effective_email,
            "is_active": new_state,
            "updated_at": now_iso,
        }},
        upsert=True,
    )

    # Dual-write -> tenant DB
    tenant_update = await tenant_db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": new_state, "updated_at": now_iso}}
    )
    if tenant_update.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # Log
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "ENABLE_USER" if new_state else "DISABLE_USER",
        "entity_id": client_id,
        "details": {"user_id": user_id, "email": effective_email, "is_active": new_state},
        "timestamp": now_iso,
    })

    return {
        "status": "success",
        "is_active": new_state,
        "message": f"User {'enabled' if new_state else 'disabled'} successfully",
    }


@app.post("/clients/{client_id}/bootstrap")
async def bootstrap_tenant(
    client_id: str,
    payload: TenantBootstrapRequest = TenantBootstrapRequest(),
    current_admin = Depends(get_current_super_admin)
):
    """
    Initialize tenant database: indexes, base config, feature flags, and default admin user.
    Idempotent: safe to run multiple times.
    """
    client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    tenant_id = client_doc["tenant_id"]
    target_db = _get_client_erp_db(client_doc)
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1) Core indexes
    await target_db.users.create_index("id", unique=True)
    await target_db.users.create_index("email")
    await target_db.users.create_index([("tenant_id", 1), ("email", 1)])
    await target_db.feature_flags.create_index([("tenant_id", 1), ("feature_code", 1)], unique=True)
    await target_db.tenant_config.create_index("key", unique=True)
    await target_db.purchase_invoices.create_index("id", unique=True)
    await target_db.procurement_lots.create_index("id", unique=True)

    # 2) Seed tenant config basics
    await target_db.tenant_config.update_one(
        {"key": "tenant_id"},
        {"$set": {"key": "tenant_id", "value": tenant_id}},
        upsert=True,
    )
    await target_db.tenant_config.update_one(
        {"key": "company_name"},
        {"$set": {"key": "company_name", "value": client_doc.get("business_name") or tenant_id}},
        upsert=True,
    )

    # 3) Seed/refresh default feature flags for this tenant in tenant DB
    for code, is_enabled in _get_default_flags().items():
        await target_db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": code},
            {"$set": {"is_enabled": is_enabled, "updated_at": now_iso}},
            upsert=True,
        )

    # 4) Ensure at least one admin user exists
    existing_admin = await target_db.users.find_one(
        {"tenant_id": tenant_id, "role": "admin", "is_active": True},
        {"_id": 0},
    )
    created_admin = None
    if not existing_admin:
        admin_email = (payload.admin_email or client_doc.get("owner_email") or f"admin@{tenant_id}.local").lower()
        admin_name = payload.admin_name or client_doc.get("owner_name") or "Tenant Admin"
        admin_password = payload.admin_password or "admin123"
        created_admin = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": admin_name,
            "role": "admin",
            "tenant_id": tenant_id,
            "password_hash": pwd_context.hash(admin_password),
            "phone": None,
            "is_active": True,
            "created_at": now_iso,
            "provisioned_by_super_admin": True,
        }
        await target_db.users.insert_one(created_admin)

    # 5) Mark client as linked-ready and log action
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"link_status": "linked", "updated_at": now_iso, "linked_at": client_doc.get("linked_at") or now_iso}},
    )
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "admin_email": current_admin["email"],
        "action": "BOOTSTRAP_TENANT",
        "entity_type": "client",
        "entity_id": client_id,
        "details": {
            "tenant_id": tenant_id,
            "client_db_name": client_doc.get("client_db_name") or _default_client_db_name(tenant_id),
            "admin_created": bool(created_admin),
            "admin_email": created_admin.get("email") if created_admin else None,
        },
        "timestamp": now_iso,
    })

    return {
        "status": "success",
        "message": "Tenant bootstrap completed",
        "tenant_id": tenant_id,
        "client_db_name": client_doc.get("client_db_name") or _default_client_db_name(tenant_id),
        "admin_created": bool(created_admin),
        "admin_email": created_admin.get("email") if created_admin else existing_admin.get("email"),
    }

# ══════════════════════════════════════════════════════════════════════════════
# Impersonation
# ══════════════════════════════════════════════════════════════════════════════

class ImpersonationRequest(BaseModel):
    reason: str = ""
    duration_mins: int = 60

@app.post("/clients/{client_id}/impersonate")
async def impersonate_client(
    client_id: str, 
    request: ImpersonationRequest,
    current_admin = Depends(get_current_super_admin)
):
    """
    Generate an impersonation token for a client.
    This token can be used to login as the client's admin user.
    """
    # Get client info
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if not client.get("is_active", True):
        raise HTTPException(status_code=400, detail="Cannot impersonate suspended client")
    
    tenant_id = client["tenant_id"]
    
    # Find the admin user for this client in the client ERP database
    target_db = _get_client_erp_db(client)
    admin_user = await target_db.users.find_one(
        {"tenant_id": tenant_id, "role": "admin", "is_active": True},
        {"_id": 0}
    )
    
    if not admin_user:
        # If no admin user found, try to find any active user
        admin_user = await target_db.users.find_one(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0}
        )
    
    if not admin_user:
        raise HTTPException(
            status_code=404, 
            detail=f"No active user found for tenant {tenant_id}. Please create a user first."
        )
    
    # Generate impersonation session
    session_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=request.duration_mins)
    
    # Create impersonation token (JWT with special claims)
    token_data = {
        "sub": admin_user["email"],
        "tenant_id": tenant_id,
        "session_id": session_id,
        "is_impersonation": True,
        "impersonator": current_admin["email"],
        "impersonator_name": current_admin.get("name", "Super Admin"),
        "exp": expires_at
    }
    
    # Sign with client-ERP JWT key (must match backend API verification key).
    client_jwt_secret = (
        os.getenv("CLIENT_ERP_JWT_SECRET")
        or os.getenv("BACKEND_SECRET_KEY")
        or _backend_env_secret
        or os.getenv("JWT_SECRET_KEY")
        or "your-secret-key-change-in-production"
    )
    token = jwt.encode(token_data, client_jwt_secret, algorithm="HS256")
    
    # Store impersonation session
    session_doc = {
        "id": session_id,
        "client_id": client_id,
        "tenant_id": tenant_id,
        "admin_id": current_admin["id"],
        "admin_email": current_admin["email"],
        "target_user_email": admin_user["email"],
        "reason": request.reason,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "ended_at": None,
        "is_active": True
    }
    await db.impersonation_sessions.insert_one(session_doc)
    session_doc.pop("_id", None)
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "IMPERSONATE_START",
        "entity_id": client_id,
        "details": {
            "tenant_id": tenant_id,
            "target_user": admin_user["email"],
            "reason": request.reason,
            "session_id": session_id
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "status": "success",
        "token": token,
        "session_id": session_id,
        "expires_at": expires_at.isoformat(),
        "target_user": {
            "email": admin_user["email"],
            "name": admin_user.get("name", ""),
            "role": admin_user.get("role", "admin")
        },
        "client": {
            "id": client_id,
            "business_name": client["business_name"],
            "tenant_id": tenant_id
        }
    }

@app.post("/impersonation/{session_id}/end")
async def end_impersonation(session_id: str, current_admin = Depends(get_current_super_admin)):
    """End an active impersonation session"""
    session = await db.impersonation_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.get("is_active"):
        return {"status": "success", "message": "Session already ended"}
    
    # End the session
    await db.impersonation_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "is_active": False,
            "ended_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "IMPERSONATE_END",
        "entity_id": session["client_id"],
        "details": {"session_id": session_id},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "success", "message": "Impersonation session ended"}

@app.get("/impersonation/active")
async def get_active_impersonations(current_admin = Depends(get_current_super_admin)):
    """Get all active impersonation sessions"""
    sessions = await db.impersonation_sessions.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)
    return sessions

# ══════════════════════════════════════════════════════════════════════════════
# Subscription Plans
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/subscription-plans")
async def get_subscription_plans(current_admin = Depends(get_current_super_admin)):
    """Get all subscription plans"""
    plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(100)
    return plans

# ══════════════════════════════════════════════════════════════════════════════
# Announcements
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/announcements")
async def get_announcements(
    active_only: bool = True,
    current_admin = Depends(get_current_super_admin)
):
    """Get all announcements"""
    query = {}
    if active_only:
        now = datetime.now(timezone.utc).isoformat()
        query = {
            "$or": [
                {"end_date": {"$gte": now}},
                {"end_date": None}
            ]
        }
    
    announcements = await db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return announcements

@app.post("/announcements")
async def create_announcement(
    announcement: AnnouncementCreate,
    current_admin = Depends(get_current_super_admin)
):
    """Create a new announcement"""
    announcement_doc = {
        "id": str(uuid.uuid4()),
        **announcement.dict(),
        "created_by": current_admin["email"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.announcements.insert_one(announcement_doc)
    
    # Remove _id that MongoDB adds
    announcement_doc.pop("_id", None)
    
    # Push to client ERPs based on target
    if announcement.target_type == "all":
        clients = await db.clients.find({"is_active": True}, {"_id": 0}).to_list(1000)
        for client in clients:
            target_db = _get_client_erp_db(client)
            await target_db.announcements.insert_one({
                **announcement_doc,
                "tenant_id": client.get("tenant_id"),
            })
    elif announcement.target_type == "specific_clients" and announcement.target_ids:
        # Push to specific clients only
        for client_id in announcement.target_ids:
            client = await db.clients.find_one({"id": client_id})
            if client:
                target_db = _get_client_erp_db(client)
                await target_db.announcements.insert_one({
                    **announcement_doc,
                    "tenant_id": client["tenant_id"]
                })
    
    return {"status": "success", "announcement_id": announcement_doc["id"]}

# ══════════════════════════════════════════════════════════════════════════════
# Activity Logs
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/activity-logs")
async def get_activity_logs(
    limit: int = 100,
    skip: int = 0,
    action: Optional[str] = None,
    entity_id: Optional[str] = None,
    from_ts: Optional[str] = None,
    to_ts: Optional[str] = None,
    current_admin = Depends(get_current_super_admin)
):
    """Get activity logs"""
    query = {}
    if action:
        query["action"] = action
    if entity_id:
        query["entity_id"] = entity_id
    if from_ts or to_ts:
        query["timestamp"] = {}
        if from_ts:
            query["timestamp"]["$gte"] = from_ts
        if to_ts:
            query["timestamp"]["$lte"] = to_ts
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.activity_logs.count_documents(query)
    
    return {"logs": logs, "total": total, "limit": limit, "skip": skip}

# ══════════════════════════════════════════════════════════════════════════════
# Feature Registry (Available Features)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/feature-registry")
async def get_feature_registry(current_admin = Depends(get_current_super_admin)):
    """Get list of available features"""
    # This would typically come from a registry or config
    features = [
        {"code": "procurement", "name": "Procurement Module", "description": "Manage prawn procurement", "module": "Procurement"},
        {"code": "preprocessing", "name": "Pre-Processing", "description": "Processing operations", "module": "Processing"},
        {"code": "coldStorage", "name": "Cold Storage", "description": "Cold storage management", "module": "Storage"},
        {"code": "production", "name": "Production", "description": "Production tracking", "module": "Production"},
        {"code": "qualityControl", "name": "Quality Control", "description": "Quality checks", "module": "Quality"},
        {"code": "sales", "name": "Sales & Dispatch", "description": "Sales and dispatch", "module": "Sales"},
        {"code": "accounts", "name": "Accounts & Billing", "description": "Financial management", "module": "Finance"},
        {"code": "wastageDashboard", "name": "Wastage Dashboard", "description": "Track wastage", "module": "Analytics"},
        {"code": "yieldBenchmarks", "name": "Yield Benchmarks", "description": "Yield tracking", "module": "Analytics"},
        {"code": "marketRates", "name": "Market Rates", "description": "Market price tracking", "module": "Analytics"},
        {"code": "purchaseInvoiceDashboard", "name": "Purchase Invoice Dashboard", "description": "Purchase invoice management with metrics, quick preview, and bulk export", "module": "Finance"},
        {"code": "partyLedger", "name": "Party Ledger", "description": "Party master and ledger management", "module": "Finance"},
        {"code": "admin", "name": "Admin Panel", "description": "Administrative functions", "module": "Admin"}
    ]
    return features

# ══════════════════════════════════════════════════════════════════════════════
# Health Check
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "database": "MongoDB", "version": "2.0"}

# ══════════════════════════════════════════════════════════════════════════════
# Stats & Analytics
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/stats")
async def get_stats(current_admin = Depends(get_current_super_admin)):
    """Get super admin dashboard stats"""
    total_clients = await db.clients.count_documents({})
    active_clients = await db.clients.count_documents({"is_active": True})
    total_users = await db.provisioned_users.count_documents({})
    
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "inactive_clients": total_clients - active_clients,
        "total_provisioned_users": total_users
    }
