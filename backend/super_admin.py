"""
Super Admin Module for Prawn ERP
Provides centralized tenant management, feature flags, and platform metrics.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext
import jwt
import uuid
import os
import re

try:
    from feature_registry import get_default_flags, merge_flags_with_registry, registry_as_list
except ImportError:
    from backend.feature_registry import get_default_flags, merge_flags_with_registry, registry_as_list

# Router - matches the API spec from the guide
super_admin_router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
ALGORITHM = "HS256"


def _jwt_signing_key() -> str:
    """Match server.py: primary signing key."""
    return SECRET_KEY


def _jwt_decode_keys():
    """Match server.py _decode_jwt_with_known_keys ordering for verifying portal tokens."""
    keys = [SECRET_KEY, JWT_SECRET_KEY]
    return [k for k in keys if k]


def _decode_super_admin_jwt(token: str) -> dict:
    last_err = None
    for key in _jwt_decode_keys():
        try:
            return jwt.decode(token, key, algorithms=[ALGORITHM])
        except jwt.InvalidTokenError as e:
            last_err = e
    raise last_err or jwt.InvalidTokenError("Invalid token")

# Database reference (set during app startup)
db: AsyncIOMotorDatabase = None
# Raw Motor client + DB names for cross-database user lookup (super_admin may live only in platform DB)
_motor_client = None
_erp_database_name: Optional[str] = None
_super_admin_database_name: Optional[str] = None
# Feature flag service for cache invalidation (set at startup)
_feature_service = None

def set_database(database: AsyncIOMotorDatabase):
    """Set the database reference"""
    global db
    db = database


def configure_super_admin_storage(motor_client, erp_database: str, super_admin_database: str):
    """
    Super-admin user documents may exist in `prawn_erp_super_admin.users` while the ERP app
    primarily queries `prawn_erp.users`. Store raw client + names so login/session can fall back.
    """
    global _motor_client, _erp_database_name, _super_admin_database_name
    _motor_client = motor_client
    _erp_database_name = erp_database
    _super_admin_database_name = super_admin_database


def set_feature_service(service):
    """Set the feature flag service so we can invalidate cache when features are updated"""
    global _feature_service
    _feature_service = service

# ══════════════════════════════════════════════════════════════════════════════
# Pydantic Models
# ══════════════════════════════════════════════════════════════════════════════

class SuperAdminLogin(BaseModel):
    """JSON body for POST /api/super-admin/auth/login (must not use bare `dict` — FastAPI would not bind the body)."""
    email: EmailStr
    password: str


class SuperAdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class TenantCreate(BaseModel):
    """4-Step Wizard - All fields combined"""
    # Step 1: Company Info
    name: str = Field(..., description="Company name")
    slug: str = Field(..., description="Unique tenant slug/ID")
    plan: str = Field(default="starter", description="Subscription plan")
    gst_number: Optional[str] = None
    
    # Step 2: Owner Info
    owner_name: str = Field(..., description="Admin user name")
    owner_email: EmailStr = Field(..., description="Admin user email")
    owner_password: str = Field(..., description="Admin user password")
    
    # Step 3: Feature Flags (modules) - from shared registry
    feature_flags: Dict[str, bool] = Field(default_factory=get_default_flags)

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: Optional[bool] = None

class FeatureFlagsUpdate(BaseModel):
    feature_flags: Dict[str, bool]

class TenantUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "worker"

# ══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ══════════════════════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def _find_super_admin_user_by_email(email_raw: str) -> Optional[dict]:
    """Resolve super_admin user from primary ERP DB or dedicated super-admin DB."""
    if not email_raw or not str(email_raw).strip():
        return None
    email_key = str(email_raw).strip().lower()
    regex_q = {"email": {"$regex": f"^{re.escape(str(email_raw).strip())}$", "$options": "i"}}

    async def _one(coll) -> Optional[dict]:
        u = await coll.find_one({"email": email_key, "role": "super_admin"}, {"_id": 0})
        if u:
            return u
        u = await coll.find_one({**regex_q, "role": "super_admin"}, {"_id": 0})
        return u

    # Prefer module `db` (same as rest of super_admin routes)
    if db is not None:
        u = await _one(db.users)
        if u:
            return u
    if _motor_client and _erp_database_name and _super_admin_database_name:
        u = await _one(_motor_client[_erp_database_name].users)
        if u:
            return u
        u = await _one(_motor_client[_super_admin_database_name].users)
        if u:
            return u
    return None


async def lookup_user_doc_cross_db(email_key: str) -> Optional[dict]:
    """
    Find a user document when TenantAware routing missed (e.g. super_admin only in platform DB).
    Used by main ERP /auth/login and /auth/me.
    """
    if not _motor_client or not _erp_database_name or not _super_admin_database_name:
        return None
    e = (email_key or "").strip().lower()
    if not e:
        return None
    regex_q = {"email": {"$regex": f"^{re.escape((email_key or '').strip())}$", "$options": "i"}}
    for name in (_erp_database_name, _super_admin_database_name):
        coll = _motor_client[name].users
        u = await coll.find_one({"email": e}, {"_id": 0})
        if u:
            return u
        u = await coll.find_one(regex_q, {"_id": 0})
        if u:
            return u
    return None


async def get_current_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and ensure user is super_admin"""
    try:
        token = credentials.credentials
        payload = _decode_super_admin_jwt(token)
        email = payload.get("sub")
        
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await _find_super_admin_user_by_email(email)
        if not user or str(user.get("role", "")).strip().lower() != "super_admin":
            raise HTTPException(status_code=403, detail="Super admin access required")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ══════════════════════════════════════════════════════════════════════════════
# Super Admin Authentication
# ══════════════════════════════════════════════════════════════════════════════

@super_admin_router.post("/auth/login")
async def super_admin_login(credentials: SuperAdminLogin):
    """
    Super Admin login endpoint.
    Accepts email/password and returns JWT if the user has super_admin role.
    """
    email = str(credentials.email).strip()
    password = credentials.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    user = await _find_super_admin_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials or insufficient permissions")

    stored = user.get("password") or user.get("password_hash") or ""
    if not stored or not verify_password(password, stored):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Generate JWT token (same as main auth system)
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    token_data = {
        "sub": user["email"],
        "tenant_id": user.get("tenant_id"),
        "exp": int(exp.timestamp()),
    }
    access_token = jwt.encode(token_data, _jwt_signing_key(), algorithm=ALGORITHM)

    user_response = {k: v for k, v in user.items() if k != "password"}
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }


# ══════════════════════════════════════════════════════════════════════════════
# Bootstrap Super Admin (One-time setup)
# ══════════════════════════════════════════════════════════════════════════════

@super_admin_router.get("/auth/me")
async def super_admin_me(current_admin = Depends(get_current_super_admin)):
    """Get current super admin profile - for old frontend compatibility"""
    user_response = {k: v for k, v in current_admin.items() if k != "password"}
    return user_response



async def create_super_admin(data: SuperAdminCreate):
    """
    Bootstrap the first super admin user.
    This endpoint auto-disables after the first super_admin exists.
    """
    # Check if super admin already exists
    existing = await db.users.find_one({"role": "super_admin"})
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Super admin already exists. Use login instead."
        )
    
    # Create super admin user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password": hash_password(data.password),
        "role": "super_admin",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    user_doc.pop("password", None)
    
    return {
        "status": "success",
        "message": "Super admin created successfully",
        "user": user_doc
    }

# ══════════════════════════════════════════════════════════════════════════════
# Tenant Management (CRUD)
# ══════════════════════════════════════════════════════════════════════════════

@super_admin_router.get("/tenants")
async def list_tenants(current_admin = Depends(get_current_super_admin)):
    """List all tenants"""
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with user count
    for tenant in tenants:
        user_count = await db.users.count_documents({"tenant_id": tenant["id"]})
        tenant["user_count"] = user_count
    
    return tenants

@super_admin_router.post("/tenants")
async def create_tenant(data: TenantCreate, current_admin = Depends(get_current_super_admin)):
    """
    4-Step Wizard: Create tenant + admin user in one call
    Step 1: Company info (name, slug, plan, gst)
    Step 2: Owner info (name, email, password)
    Step 3: Feature flags (modules)
    Step 4: Review & Create
    """
    # Check if tenant slug already exists
    existing = await db.tenants.find_one({"$or": [{"id": data.slug}, {"slug": data.slug}]})
    if existing:
        raise HTTPException(status_code=400, detail=f"Tenant with slug '{data.slug}' already exists")
    
    # Check if owner email already exists
    existing_user = await db.users.find_one({"email": data.owner_email})
    if existing_user:
        raise HTTPException(status_code=400, detail=f"User with email '{data.owner_email}' already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    tenant_id = data.slug  # Use slug as ID for simplicity
    
    # Create tenant document
    tenant_doc = {
        "id": tenant_id,
        "name": data.name,
        "slug": data.slug,
        "plan": data.plan,
        "gst_number": data.gst_number,
        "feature_flags": data.feature_flags,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": current_admin["email"]
    }
    
    await db.tenants.insert_one(tenant_doc)
    tenant_doc.pop("_id", None)
    
    # Create admin user for the tenant
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.owner_email,
        "name": data.owner_name,
        "password": hash_password(data.owner_password),
        "role": "admin",
        "tenant_id": tenant_id,
        "is_active": True,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    user_doc.pop("password", None)
    
    # Create feature flags in feature_flags collection for the tenant
    for feature_code, is_enabled in data.feature_flags.items():
        await db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": feature_code},
            {"$set": {
                "is_enabled": is_enabled,
                "updated_at": now
            }},
            upsert=True
        )
    
    return {
        "status": "success",
        "message": f"Tenant '{data.name}' created successfully with admin user",
        "tenant": tenant_doc,
        "admin_user": user_doc
    }

@super_admin_router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, current_admin = Depends(get_current_super_admin)):
    """Get tenant details"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get user count
    user_count = await db.users.count_documents({"tenant_id": tenant_id})
    tenant["user_count"] = user_count
    
    return tenant

@super_admin_router.patch("/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, data: TenantUpdate, current_admin = Depends(get_current_super_admin)):
    """Update tenant info"""
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    
    return {"status": "success", "message": "Tenant updated"}

# ══════════════════════════════════════════════════════════════════════════════
# Feature Flags Management
# ══════════════════════════════════════════════════════════════════════════════

@super_admin_router.get("/tenants/{tenant_id}/features")
async def get_tenant_features(tenant_id: str, current_admin = Depends(get_current_super_admin)):
    """Get feature flags for a tenant"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "feature_flags": 1})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return tenant.get("feature_flags", {})

@super_admin_router.put("/tenants/{tenant_id}/features")
async def update_tenant_features(
    tenant_id: str, 
    data: FeatureFlagsUpdate, 
    current_admin = Depends(get_current_super_admin)
):
    """Update feature flags for a tenant"""
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update in tenants collection
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {
            "feature_flags": data.feature_flags,
            "updated_at": now
        }}
    )
    
    # Also update in feature_flags collection for backward compatibility
    for feature_code, is_enabled in data.feature_flags.items():
        await db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": feature_code},
            {"$set": {
                "is_enabled": is_enabled,
                "updated_at": now
            }},
            upsert=True
        )
    # Invalidate feature-flag cache so client portal gets new flags on next /auth/me
    if _feature_service:
        try:
            _feature_service.invalidate_cache(tenant_id)
        except Exception:
            pass
    return {"status": "success", "message": "Feature flags updated"}

# ══════════════════════════════════════════════════════════════════════════════
# Tenant Users Management
# ══════════════════════════════════════════════════════════════════════════════

@super_admin_router.get("/tenants/{tenant_id}/users")
async def list_tenant_users(tenant_id: str, current_admin = Depends(get_current_super_admin)):
    """List users for a tenant"""
    users = await db.users.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    return users

@super_admin_router.post("/tenants/{tenant_id}/users")
async def create_tenant_user(
    tenant_id: str, 
    data: TenantUserCreate, 
    current_admin = Depends(get_current_super_admin)
):
    """Add a user to a tenant"""
    # Check tenant exists
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password": hash_password(data.password),
        "role": data.role,
        "tenant_id": tenant_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    user_doc.pop("password", None)
    
    return {"status": "success", "user": user_doc}

# ══════════════════════════════════════════════════════════════════════════════
# Platform Metrics
# ══════════════════════════════════════════════════════════════════════════════

@super_admin_router.get("/metrics")
async def get_platform_metrics(current_admin = Depends(get_current_super_admin)):
    """Get platform-wide metrics"""
    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"is_active": True})
    total_users = await db.users.count_documents({"role": {"$ne": "super_admin"}})
    
    # Get users by plan
    pipeline = [
        {"$lookup": {
            "from": "tenants",
            "localField": "tenant_id",
            "foreignField": "id",
            "as": "tenant"
        }},
        {"$unwind": {"path": "$tenant", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$tenant.plan",
            "count": {"$sum": 1}
        }}
    ]
    users_by_plan = await db.users.aggregate(pipeline).to_list(100)
    
    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "total_users": total_users,
        "users_by_plan": {item["_id"] or "legacy": item["count"] for item in users_by_plan}
    }

# ══════════════════════════════════════════════════════════════════════════════
# Public Endpoint: Get Tenant Features (for client app)
# ══════════════════════════════════════════════════════════════════════════════

@super_admin_router.get("/tenant-features/{tenant_id}", tags=["Public"])
async def get_tenant_features_public(tenant_id: str):
    """
    Get feature flags for a tenant (used by client app).
    Returns full set from registry; DB values override defaults.
    """
    raw: Dict[str, bool] = {}
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "feature_flags": 1})
    if tenant and tenant.get("feature_flags"):
        raw = tenant["feature_flags"]
    else:
        flags = await db.feature_flags.find(
            {"tenant_id": tenant_id},
            {"_id": 0, "feature_code": 1, "is_enabled": 1}
        ).to_list(100)
        if flags:
            raw = {f["feature_code"]: f["is_enabled"] for f in flags}
    return merge_flags_with_registry(raw)

# ══════════════════════════════════════════════════════════════════════════════
# Legacy Compatibility Endpoints (for old super-admin-frontend)
# These map the old API structure to the new backend
# ══════════════════════════════════════════════════════════════════════════════

SUBSCRIPTION_PLANS = [
    {"id": "starter", "name": "Starter", "price": 0, "max_users": 5, "features": ["procurement", "sales"]},
    {"id": "professional", "name": "Professional", "price": 49, "max_users": 20, "features": ["procurement", "sales", "preprocessing", "coldStorage", "accounts"]},
    {"id": "enterprise", "name": "Enterprise", "price": 99, "max_users": -1, "features": ["*"]},
]

# Use shared feature registry (backend/feature_registry.py)
FEATURE_REGISTRY = registry_as_list()


def _tenant_to_client(tenant: dict) -> dict:
    """Convert tenant doc to client format expected by old frontend"""
    return {
        "id": tenant.get("id"),
        "tenant_id": tenant.get("id"),
        "name": tenant.get("name"),
        "business_name": tenant.get("name"),
        "plan": tenant.get("plan", "starter"),
        "contact_name": tenant.get("contact_name", ""),
        "contact_email": tenant.get("contact_email", ""),
        "is_active": tenant.get("is_active", True),
        "feature_flags": tenant.get("feature_flags", {}),
        "user_count": tenant.get("user_count", 0),
        "created_at": tenant.get("created_at", ""),
        "updated_at": tenant.get("updated_at", ""),
    }


@super_admin_router.get("/clients")
async def legacy_list_clients(current_admin = Depends(get_current_super_admin)):
    """Legacy: List all clients (maps to tenants)"""
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    clients = []
    for t in tenants:
        user_count = await db.users.count_documents({"tenant_id": t["id"], "role": {"$ne": "super_admin"}})
        t["user_count"] = user_count
        clients.append(_tenant_to_client(t))
    return clients


@super_admin_router.get("/clients/{client_id}")
async def legacy_get_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Legacy: Get a specific client"""
    tenant = await db.tenants.find_one({"id": client_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Client not found")
    user_count = await db.users.count_documents({"tenant_id": client_id, "role": {"$ne": "super_admin"}})
    tenant["user_count"] = user_count
    return _tenant_to_client(tenant)


@super_admin_router.post("/clients")
async def legacy_create_client(data: dict, current_admin = Depends(get_current_super_admin)):
    """Legacy: Create a new client (maps to create tenant)"""
    tenant_id = data.get("tenant_id") or data.get("id") or f"cli_{str(uuid.uuid4())[:8]}"
    name = data.get("name") or data.get("business_name", "")
    plan = data.get("plan", "starter")
    contact_name = data.get("contact_name") or data.get("admin_name", "Admin")
    contact_email = data.get("contact_email") or data.get("admin_email", "")
    admin_password = data.get("admin_password", "Admin123!")
    feature_flags = data.get("feature_flags", get_default_flags())

    if not name or not contact_email:
        raise HTTPException(status_code=400, detail="name and contact_email are required")

    existing = await db.tenants.find_one({"id": tenant_id})
    if existing:
        raise HTTPException(status_code=400, detail="Tenant ID already exists")

    now = datetime.now(timezone.utc).isoformat()
    tenant_doc = {
        "id": tenant_id, "name": name, "slug": tenant_id,
        "plan": plan, "contact_name": contact_name, "contact_email": contact_email,
        "is_active": True, "feature_flags": feature_flags,
        "created_at": now, "updated_at": now,
        "created_by": current_admin.get("email")
    }
    await db.tenants.insert_one(tenant_doc)
    tenant_doc.pop("_id", None)

    # Create admin user
    user_doc = {
        "id": str(uuid.uuid4()), "email": contact_email, "name": contact_name,
        "password": hash_password(admin_password), "role": "admin",
        "tenant_id": tenant_id, "is_active": True, "created_at": now
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    user_doc.pop("password", None)

    return {"status": "success", "client": _tenant_to_client(tenant_doc), "admin_user": user_doc}


@super_admin_router.put("/clients/{client_id}")
async def legacy_update_client(client_id: str, data: dict, current_admin = Depends(get_current_super_admin)):
    """Legacy: Update a client"""
    tenant = await db.tenants.find_one({"id": client_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Client not found")
    update = {k: v for k, v in data.items() if v is not None and k not in ["id", "_id"]}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tenants.update_one({"id": client_id}, {"$set": update})
    updated = await db.tenants.find_one({"id": client_id}, {"_id": 0})
    return _tenant_to_client(updated)


@super_admin_router.delete("/clients/{client_id}")
async def legacy_delete_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Legacy: Suspend/deactivate a client"""
    await db.tenants.update_one(
        {"id": client_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success", "message": "Client suspended"}


@super_admin_router.post("/clients/{client_id}/activate")
async def legacy_activate_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Legacy: Activate a client"""
    await db.tenants.update_one(
        {"id": client_id},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success", "message": "Client activated"}


@super_admin_router.get("/clients/{client_id}/features")
async def legacy_get_client_features(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Legacy: Get feature flags for a client"""
    tenant = await db.tenants.find_one({"id": client_id}, {"_id": 0, "feature_flags": 1})
    if not tenant:
        raise HTTPException(status_code=404, detail="Client not found")
    flags = tenant.get("feature_flags", {})
    return [{"feature_code": k, "is_enabled": v} for k, v in flags.items()]


@super_admin_router.post("/clients/{client_id}/features/toggle")
async def legacy_toggle_feature(client_id: str, data: dict, current_admin = Depends(get_current_super_admin)):
    """Legacy: Toggle a single feature flag"""
    feature_code = data.get("feature_code")
    is_enabled = data.get("is_enabled")
    if not feature_code or is_enabled is None:
        raise HTTPException(status_code=400, detail="feature_code and is_enabled required")
    now = datetime.now(timezone.utc).isoformat()
    await db.tenants.update_one(
        {"id": client_id},
        {"$set": {f"feature_flags.{feature_code}": is_enabled, "updated_at": now}}
    )
    await db.feature_flags.update_one(
        {"tenant_id": client_id, "feature_code": feature_code},
        {"$set": {"is_enabled": is_enabled, "updated_at": now}},
        upsert=True
    )
    return {"status": "success", "feature_code": feature_code, "is_enabled": is_enabled}


@super_admin_router.post("/clients/{client_id}/bulk-features")
async def legacy_bulk_features(client_id: str, data: dict, current_admin = Depends(get_current_super_admin)):
    """Legacy: Bulk update feature flags"""
    features = data.get("features", {})
    now = datetime.now(timezone.utc).isoformat()
    for code, enabled in features.items():
        await db.tenants.update_one(
            {"id": client_id},
            {"$set": {f"feature_flags.{code}": enabled, "updated_at": now}}
        )
    return {"status": "success", "message": "Features updated"}


@super_admin_router.get("/subscription-plans")
async def legacy_get_plans(current_admin = Depends(get_current_super_admin)):
    """Legacy: Get available subscription plans"""
    return SUBSCRIPTION_PLANS


@super_admin_router.get("/feature-registry")
async def legacy_get_feature_registry(current_admin = Depends(get_current_super_admin)):
    """Legacy: Get feature registry"""
    return FEATURE_REGISTRY


@super_admin_router.get("/announcements")
async def legacy_get_announcements(current_admin = Depends(get_current_super_admin)):
    """Legacy: Get announcements"""
    announcements = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return announcements


@super_admin_router.post("/announcements")
async def legacy_create_announcement(data: dict, current_admin = Depends(get_current_super_admin)):
    """Legacy: Create an announcement"""
    doc = {
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "message": data.get("message", ""),
        "type": data.get("type", "info"),
        "created_by": current_admin.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    await db.announcements.insert_one(doc)
    doc.pop("_id", None)
    return doc


@super_admin_router.delete("/announcements/{announcement_id}")
async def legacy_delete_announcement(announcement_id: str, current_admin = Depends(get_current_super_admin)):
    """Legacy: Delete an announcement"""
    await db.announcements.delete_one({"id": announcement_id})
    return {"status": "success"}


@super_admin_router.post("/clients/{client_id}/impersonate")
async def legacy_impersonate_client(client_id: str, data: dict, current_admin = Depends(get_current_super_admin)):
    """Legacy: Start impersonation session for a client"""
    tenant = await db.tenants.find_one({"id": client_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Client not found")
    admin_user = await db.users.find_one(
        {"tenant_id": client_id, "role": "admin"},
        {"_id": 0, "password": 0}
    )
    if not admin_user:
        raise HTTPException(status_code=404, detail="No admin user found for this client")

    duration_mins = data.get("duration_mins", 60)
    exp = datetime.now(timezone.utc) + timedelta(minutes=duration_mins)
    token_data = {
        "sub": admin_user["email"],
        "tenant_id": client_id,
        "is_impersonation": True,
        "impersonator": current_admin.get("email"),
        "exp": int(exp.timestamp()),
    }
    impersonation_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    session_id = str(uuid.uuid4())

    return {
        "session_id": session_id,
        "token": impersonation_token,
        "user": admin_user,
        "tenant": _tenant_to_client(tenant),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=duration_mins)).isoformat()
    }


@super_admin_router.post("/impersonation/{session_id}/end")
async def legacy_end_impersonation(session_id: str, current_admin = Depends(get_current_super_admin)):
    """Legacy: End impersonation session"""
    return {"status": "success", "message": "Impersonation ended"}


@super_admin_router.get("/impersonation/active")
async def legacy_get_active_impersonations(current_admin = Depends(get_current_super_admin)):
    """Legacy: Get active impersonation sessions"""
    return []


# ══════════════════════════════════════════════════════════════════════════════
# Database Indexes (call on startup)
# ══════════════════════════════════════════════════════════════════════════════

async def create_indexes():
    """Create necessary indexes for performance"""
    # Tenants indexes
    await db.tenants.create_index("id", unique=True)
    await db.tenants.create_index("slug", unique=True)
    
    # Users indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("tenant_id")
    
    # Feature flags indexes
    await db.feature_flags.create_index([("tenant_id", 1), ("feature_code", 1)], unique=True)
