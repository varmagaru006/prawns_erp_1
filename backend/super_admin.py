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

# Router - matches the API spec from the guide
super_admin_router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"

# Database reference (set during app startup)
db: AsyncIOMotorDatabase = None

def set_database(database: AsyncIOMotorDatabase):
    """Set the database reference"""
    global db
    db = database

# ══════════════════════════════════════════════════════════════════════════════
# Pydantic Models
# ══════════════════════════════════════════════════════════════════════════════

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
    
    # Step 3: Feature Flags (modules)
    feature_flags: Dict[str, bool] = Field(default_factory=lambda: {
        "procurement": True,
        "preprocessing": True,
        "coldStorage": True,
        "production": True,
        "qualityControl": True,
        "sales": True,
        "accounts": True,
        "wastageDashboard": False,
        "yieldBenchmarks": False,
        "marketRates": False,
        "purchaseInvoiceDashboard": True,
        "partyLedger": True,
        "admin": True
    })

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

async def get_current_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and ensure user is super_admin"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user or user.get("role") != "super_admin":
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
async def super_admin_login(credentials: dict):
    """
    Super Admin login endpoint.
    Accepts email/password and returns JWT if the user has super_admin role.
    """
    email = credentials.get("email", "")
    password = credentials.get("password", "")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or user.get("role") != "super_admin":
        raise HTTPException(status_code=401, detail="Invalid credentials or insufficient permissions")

    if not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Generate JWT token (same as main auth system)
    token_data = {
        "sub": user["email"],
        "tenant_id": user.get("tenant_id"),
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

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
    No authentication required.
    """
    # First try tenants collection
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "feature_flags": 1})
    if tenant and tenant.get("feature_flags"):
        return tenant["feature_flags"]
    
    # Fallback to feature_flags collection
    flags = await db.feature_flags.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "feature_code": 1, "is_enabled": 1}
    ).to_list(100)
    
    if flags:
        return {f["feature_code"]: f["is_enabled"] for f in flags}
    
    # Default: all features enabled for legacy/unknown tenants
    return {
        "procurement": True,
        "preprocessing": True,
        "coldStorage": True,
        "production": True,
        "qualityControl": True,
        "sales": True,
        "accounts": True,
        "wastageDashboard": True,
        "yieldBenchmarks": True,
        "marketRates": True,
        "purchaseInvoiceDashboard": True,
        "partyLedger": True,
        "admin": True
    }

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
