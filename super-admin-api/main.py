"""
Super Admin API - Main Application
Manages all tenants, feature flags, subscriptions, and announcements
Uses PostgreSQL (saas_control_db) for all data
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import databases
import sqlalchemy
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import redis
import json

load_dotenv()

# Database connections
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost/saas_control_db")
database = databases.Database(DATABASE_URL)

# MongoDB for syncing feature flags to client databases
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "prawn_erp")
mongo_client = AsyncIOMotorClient(MONGO_URL)
mongo_db = mongo_client[MONGO_DB_NAME]

# Redis for cache invalidation
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/1"), decode_responses=True)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "super-admin-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# FastAPI app
app = FastAPI(title="Prawn ERP - Super Admin API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════════════════════════════════════════
# Models
# ══════════════════════════════════════════════════════════════════════════════

class SuperAdminLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ClientCreate(BaseModel):
    tenant_id: str
    business_name: str
    contact_person: Optional[str] = None
    contact_email: EmailStr
    plan_id: str
    subscription_status: str = "trial"
    trial_days: int = 30
    max_users: Optional[int] = None
    max_lots_per_month: Optional[int] = None
    storage_limit_gb: Optional[int] = None

class ClientUpdate(BaseModel):
    tenant_id: Optional[str] = None
    business_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    plan_id: Optional[str] = None
    subscription_status: Optional[str] = None
    max_users: Optional[int] = None
    max_lots_per_month: Optional[int] = None
    storage_limit_gb: Optional[int] = None
    is_active: Optional[bool] = None

class ClientSummary(BaseModel):
    id: str
    tenant_id: str
    business_name: str
    plan_name: Optional[str]
    subscription_status: str
    subscription_to: Optional[str]
    is_active: bool

class FeatureToggle(BaseModel):
    feature_code: str
    is_enabled: bool

class FeatureToggleRequest(BaseModel):
    tenant_id: str
    feature_code: str
    is_enabled: bool
    is_override: bool = False
    override_reason: Optional[str] = None
    override_until: Optional[str] = None

# ══════════════════════════════════════════════════════════════════════════════
# Database Startup/Shutdown
# ══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    await database.connect()
    print("✅ Connected to PostgreSQL (saas_control_db)")

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()
    print("✅ Disconnected from PostgreSQL")

# ══════════════════════════════════════════════════════════════════════════════
# Auth Functions
# ══════════════════════════════════════════════════════════════════════════════

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    query = "SELECT * FROM super_admins WHERE email = :email AND is_active = true"
    admin = await database.fetch_one(query=query, values={"email": email})
    
    if admin is None:
        raise HTTPException(status_code=401, detail="Super admin not found")
    
    return dict(admin)

# ══════════════════════════════════════════════════════════════════════════════
# Routes
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/auth/login", response_model=Token)
async def login(credentials: SuperAdminLogin):
    """Super Admin Login"""
    query = "SELECT * FROM super_admins WHERE email = :email AND is_active = true"
    admin = await database.fetch_one(query=query, values={"email": credentials.email})
    
    if not admin or not pwd_context.verify(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update last login
    update_query = "UPDATE super_admins SET last_login_at = NOW() WHERE id = :id"
    await database.execute(query=update_query, values={"id": admin["id"]})
    
    access_token = create_access_token({"sub": admin["email"]})
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me")
async def get_me(current_admin = Depends(get_current_super_admin)):
    """Get current super admin info"""
    return {
        "id": str(current_admin["id"]),
        "name": current_admin["name"],
        "email": current_admin["email"],
        "last_login_at": str(current_admin["last_login_at"]) if current_admin["last_login_at"] else None
    }

@app.get("/clients", response_model=List[ClientSummary])
async def get_clients(current_admin = Depends(get_current_super_admin)):
    """Get all clients"""
    query = """
        SELECT 
            c.id::text,
            c.tenant_id,
            c.business_name,
            sp.plan_name,
            c.subscription_status,
            c.subscription_to::text,
            c.is_active
        FROM clients c
        LEFT JOIN subscription_plans sp ON c.plan_id = sp.id
        ORDER BY c.created_at DESC
    """
    clients = await database.fetch_all(query=query)
    return clients


@app.post("/clients")
async def create_client(client_data: ClientCreate, current_admin = Depends(get_current_super_admin)):
    """Create a new client/tenant"""
    # Check if tenant_id already exists
    check_query = "SELECT id FROM clients WHERE tenant_id = :tenant_id"
    existing = await database.fetch_one(query=check_query, values={"tenant_id": client_data.tenant_id})
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Tenant ID '{client_data.tenant_id}' already exists")
    
    # Check if plan exists
    plan_query = "SELECT id FROM subscription_plans WHERE id::text = :plan_id"
    plan = await database.fetch_one(query=plan_query, values={"plan_id": client_data.plan_id})
    
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan_id")
    
    # Calculate trial end date
    trial_ends_at = datetime.utcnow() + timedelta(days=client_data.trial_days)
    
    # Insert new client
    from uuid import UUID
    insert_query = """
        INSERT INTO clients (
            tenant_id, business_name, contact_person, contact_email,
            plan_id, subscription_status, trial_ends_at,
            is_active, onboarded_at
        ) VALUES (
            :tenant_id, :business_name, :contact_person, :contact_email,
            :plan_id, :subscription_status, :trial_ends_at,
            true, NOW()
        )
        RETURNING id::text, tenant_id, business_name, contact_email, subscription_status, onboarded_at::text
    """
    
    new_client = await database.fetch_one(
        query=insert_query,
        values={
            "tenant_id": client_data.tenant_id,
            "business_name": client_data.business_name,
            "contact_person": client_data.contact_person,
            "contact_email": client_data.contact_email,
            "plan_id": UUID(client_data.plan_id),
            "subscription_status": client_data.subscription_status,
            "trial_ends_at": trial_ends_at
        }
    )
    
    return {
        "message": "Client created successfully",
        "client": dict(new_client)
    }

@app.put("/clients/{client_id}")
async def update_client(client_id: str, client_data: ClientUpdate, current_admin = Depends(get_current_super_admin)):
    """Update client details including tenant_id"""
    # Check if client exists
    check_query = "SELECT id, tenant_id FROM clients WHERE id::text = :client_id"
    existing_client = await database.fetch_one(query=check_query, values={"client_id": client_id})
    
    if not existing_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # If updating tenant_id, check it doesn't conflict
    if client_data.tenant_id and client_data.tenant_id != existing_client["tenant_id"]:
        conflict_query = "SELECT id FROM clients WHERE tenant_id = :tenant_id AND id::text != :client_id"
        conflict = await database.fetch_one(
            query=conflict_query, 
            values={"tenant_id": client_data.tenant_id, "client_id": client_id}
        )
        if conflict:
            raise HTTPException(status_code=400, detail=f"Tenant ID '{client_data.tenant_id}' already exists")
    
    # Build update query dynamically
    update_fields = []
    values = {"client_id": client_id}
    
    if client_data.tenant_id is not None:
        update_fields.append("tenant_id = :tenant_id")
        values["tenant_id"] = client_data.tenant_id
    if client_data.business_name is not None:
        update_fields.append("business_name = :business_name")
        values["business_name"] = client_data.business_name
    if client_data.contact_person is not None:
        update_fields.append("contact_person = :contact_person")
        values["contact_person"] = client_data.contact_person
    if client_data.contact_email is not None:
        update_fields.append("contact_email = :contact_email")
        values["contact_email"] = client_data.contact_email
    if client_data.plan_id is not None:
        update_fields.append("plan_id = :plan_id::uuid")
        values["plan_id"] = client_data.plan_id
    if client_data.subscription_status is not None:
        update_fields.append("subscription_status = :subscription_status")
        values["subscription_status"] = client_data.subscription_status
    if client_data.max_users is not None:
        update_fields.append("max_users = :max_users")
        values["max_users"] = client_data.max_users
    if client_data.max_lots_per_month is not None:
        update_fields.append("max_lots_per_month = :max_lots_per_month")
        values["max_lots_per_month"] = client_data.max_lots_per_month
    if client_data.storage_limit_gb is not None:
        update_fields.append("storage_limit_gb = :storage_limit_gb")
        values["storage_limit_gb"] = client_data.storage_limit_gb
    if client_data.is_active is not None:
        update_fields.append("is_active = :is_active")
        values["is_active"] = client_data.is_active
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_query = f"""
        UPDATE clients 
        SET {', '.join(update_fields)}
        WHERE id::text = :client_id
        RETURNING id, tenant_id, business_name, contact_email, subscription_status
    """
    
    updated_client = await database.fetch_one(query=update_query, values=values)
    
    return {
        "message": "Client updated successfully",
        "client": dict(updated_client)
    }

@app.get("/subscription-plans")
async def get_subscription_plans(current_admin = Depends(get_current_super_admin)):
    """Get all available subscription plans"""
    query = """
        SELECT 
            id::text as id,
            plan_code,
            plan_name,
            description,
            price_inr_monthly as price_monthly,
            price_inr_annual as price_yearly,
            max_users,
            max_lots_per_month,
            storage_limit_gb,
            is_active
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY price_inr_monthly
    """
    plans = await database.fetch_all(query=query)
    return [dict(plan) for plan in plans]

@app.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Delete a client (soft delete by setting is_active = false)"""
    query = """
        UPDATE clients 
        SET is_active = false, suspended_at = NOW()
        WHERE id::text = :client_id
        RETURNING id::text, tenant_id, business_name
    """
    
    deleted_client = await database.fetch_one(query=query, values={"client_id": client_id})
    
    if not deleted_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {
        "message": "Client suspended successfully",
        "client": dict(deleted_client)
    }

@app.post("/clients/{client_id}/activate")
async def activate_client(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Activate a suspended client"""
    query = """
        UPDATE clients 
        SET is_active = true, suspended_at = NULL
        WHERE id::text = :client_id
        RETURNING id::text, tenant_id, business_name, is_active
    """
    
    activated_client = await database.fetch_one(query=query, values={"client_id": client_id})
    
    if not activated_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {
        "message": "Client activated successfully",
        "client": dict(activated_client)
    }

@app.post("/clients/{client_id}/bulk-features")
async def bulk_toggle_features(client_id: str, data: dict, current_admin = Depends(get_current_super_admin)):
    """Bulk enable/disable features for a client"""
    # Get client info
    client_query = "SELECT id, tenant_id FROM clients WHERE id::text = :client_id"
    client = await database.fetch_one(query=client_query, values={"client_id": client_id})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    tenant_id = client["tenant_id"]
    client_uuid = client["id"]
    feature_codes = data.get("feature_codes", [])
    is_enabled = data.get("is_enabled", True)
    
    updated_count = 0
    for feature_code in feature_codes:
        # Upsert feature flag in PostgreSQL
        upsert_query = """
            INSERT INTO client_feature_flags (
                client_id, feature_code, is_enabled, is_override,
                enabled_by, enabled_at
            ) VALUES (
                :client_id, :feature_code, :is_enabled, false,
                :enabled_by, NOW()
            )
            ON CONFLICT (client_id, feature_code)
            DO UPDATE SET
                is_enabled = :is_enabled,
                enabled_by = :enabled_by,
                enabled_at = NOW()
        """
        
        await database.execute(
            query=upsert_query,
            values={
                "client_id": client_uuid,
                "feature_code": feature_code,
                "is_enabled": is_enabled,
                "enabled_by": current_admin["id"]
            }
        )
        
        # Also sync to MongoDB for client ERP
        await mongo_db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": feature_code},
            {
                "$set": {
                    "tenant_id": tenant_id,
                    "feature_code": feature_code,
                    "is_enabled": is_enabled,
                    "synced_at": datetime.utcnow().isoformat()
                }
            },
            upsert=True
        )
        
        updated_count += 1
    
    # Invalidate Redis cache
    try:
        redis_client.delete(f"flags:{tenant_id}")
    except:
        pass  # Redis might not be running
    
    return {
        "message": f"Bulk update successful: {updated_count} features updated",
        "tenant_id": tenant_id,
        "updated_count": updated_count,
        "cache_invalidated": True
    }

    """Get all available subscription plans"""
    query = """
        SELECT 
            id::text as id,
            plan_code,
            plan_name,
            description,
            price_inr_monthly as price_monthly,
            price_inr_annual as price_yearly,
            max_users,
            max_lots_per_month,
            storage_limit_gb,
            is_active
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY price_inr_monthly
    """
    plans = await database.fetch_all(query=query)
    return [dict(plan) for plan in plans]


@app.get("/clients/{client_id}")
async def get_client_detail(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Get detailed client information"""
    query = """
        SELECT 
            c.*,
            sp.plan_name,
            sp.plan_code,
            sp.price_inr_monthly,
            sp.max_users,
            sp.max_lots_per_month,
            sp.storage_limit_gb
        FROM clients c
        LEFT JOIN subscription_plans sp ON c.plan_id = sp.id
        WHERE c.id::text = :client_id
    """
    client = await database.fetch_one(query=query, values={"client_id": client_id})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return dict(client)

@app.get("/clients/{client_id}/features")
async def get_client_features(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Get all feature flags for a client"""
    # Get client to find tenant_id
    client_query = "SELECT tenant_id FROM clients WHERE id::text = :client_id"
    client = await database.fetch_one(query=client_query, values={"client_id": client_id})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    tenant_id = client["tenant_id"]
    
    # Get all features from registry
    registry_query = """
        SELECT 
            feature_code,
            feature_name,
            description,
            module,
            category,
            parent_feature_code,
            is_available_on,
            is_beta,
            default_enabled,
            sort_order
        FROM feature_registry
        WHERE is_active = true
        ORDER BY sort_order, module, feature_code
    """
    all_features = await database.fetch_all(query=registry_query)
    
    # Get current flags for this client
    flags_query = """
        SELECT feature_code, is_enabled, is_override, override_until
        FROM client_feature_flags
        WHERE client_id::text = :client_id
    """
    current_flags = await database.fetch_all(query=flags_query, values={"client_id": client_id})
    flags_dict = {flag["feature_code"]: dict(flag) for flag in current_flags}
    
    # Combine registry with current flags
    result = []
    for feature in all_features:
        feature_dict = dict(feature)
        flag = flags_dict.get(feature["feature_code"], {})
        feature_dict["is_enabled"] = flag.get("is_enabled", False)
        feature_dict["is_override"] = flag.get("is_override", False)
        feature_dict["override_until"] = str(flag["override_until"]) if flag.get("override_until") else None
        result.append(feature_dict)
    
    return result

@app.post("/clients/{client_id}/features/toggle")
async def toggle_feature(
    client_id: str,
    request: FeatureToggleRequest,
    current_admin = Depends(get_current_super_admin)
):
    """Toggle a feature for a client"""
    # Get client
    client_query = "SELECT id, tenant_id FROM clients WHERE id::text = :client_id"
    client = await database.fetch_one(query=client_query, values={"client_id": client_id})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    tenant_id = client["tenant_id"]
    
    # Upsert feature flag in PostgreSQL
    upsert_query = """
        INSERT INTO client_feature_flags (
            client_id, feature_code, is_enabled, is_override, override_reason, override_until,
            enabled_by, enabled_at
        ) VALUES (
            :client_id, :feature_code, :is_enabled, :is_override, :override_reason, :override_until,
            :enabled_by, NOW()
        )
        ON CONFLICT (client_id, feature_code)
        DO UPDATE SET
            is_enabled = :is_enabled,
            is_override = :is_override,
            override_reason = :override_reason,
            override_until = :override_until,
            enabled_by = :enabled_by,
            enabled_at = NOW()
    """
    
    await database.execute(
        query=upsert_query,
        values={
            "client_id": client["id"],
            "feature_code": request.feature_code,
            "is_enabled": request.is_enabled,
            "is_override": request.is_override,
            "override_reason": request.override_reason,
            "override_until": request.override_until,
            "enabled_by": current_admin["id"]
        }
    )
    
    # Sync to MongoDB (client's database)
    await mongo_db.feature_flags.update_one(
        {"tenant_id": tenant_id, "feature_code": request.feature_code},
        {
            "$set": {
                "tenant_id": tenant_id,
                "feature_code": request.feature_code,
                "is_enabled": request.is_enabled,
                "synced_at": datetime.utcnow().isoformat()
            }
        },
        upsert=True
    )
    
    # Invalidate Redis cache
    redis_client.delete(f"flags:{tenant_id}")
    redis_client.delete(f"feature:{tenant_id}:{request.feature_code}")
    
    # Log the change
    log_query = """
        INSERT INTO feature_change_log (
            client_id, feature_code, changed_by, action, new_state, reason, changed_at
        ) VALUES (
            :client_id, :feature_code, :changed_by, :action, :new_state, :reason, NOW()
        )
    """
    
    await database.execute(
        query=log_query,
        values={
            "client_id": client["id"],
            "feature_code": request.feature_code,
            "changed_by": current_admin["id"],
            "action": "enabled" if request.is_enabled else "disabled",
            "new_state": request.is_enabled,
            "reason": request.override_reason
        }
    )
    
    return {
        "success": True,
        "message": f"Feature {request.feature_code} {'enabled' if request.is_enabled else 'disabled'} for {tenant_id}",
        "cache_invalidated": True
    }

@app.get("/feature-registry")
async def get_feature_registry(current_admin = Depends(get_current_super_admin)):
    """Get complete feature registry"""
    query = """
        SELECT * FROM feature_registry
        WHERE is_active = true
        ORDER BY sort_order, module, feature_code
    """
    features = await database.fetch_all(query=query)
    return features

# ══════════════════════════════════════════════════════════════════════════════
# Announcement Management
# ══════════════════════════════════════════════════════════════════════════════

class AnnouncementCreate(BaseModel):
    title: str
    body: str
    announcement_type: str = "info"  # info, warning, critical
    target_all: bool = True
    target_client_ids: Optional[List[str]] = None
    show_from: Optional[str] = None  # ISO datetime string
    show_until: Optional[str] = None  # ISO datetime string

class AnnouncementResponse(BaseModel):
    id: str
    title: str
    body: str
    announcement_type: str
    target_all: bool
    show_from: str
    show_until: Optional[str]
    created_by: Optional[str]
    created_at: str

@app.get("/announcements")
async def get_announcements(current_admin = Depends(get_current_super_admin)):
    """Get all announcements"""
    query = """
        SELECT 
            a.id::text,
            a.title,
            a.body,
            a.announcement_type,
            a.target_all,
            a.show_from::text,
            a.show_until::text,
            a.created_by::text,
            a.created_at::text,
            sa.name as created_by_name
        FROM announcements a
        LEFT JOIN super_admins sa ON a.created_by = sa.id
        ORDER BY a.created_at DESC
    """
    announcements = await database.fetch_all(query=query)
    
    result = []
    for ann in announcements:
        ann_dict = dict(ann)
        # Get target clients if not targeting all
        if not ann_dict["target_all"]:
            targets_query = """
                SELECT c.id::text, c.business_name, c.tenant_id
                FROM announcement_targets at
                JOIN clients c ON at.client_id = c.id
                WHERE at.announcement_id::text = :announcement_id
            """
            targets = await database.fetch_all(
                query=targets_query, 
                values={"announcement_id": ann_dict["id"]}
            )
            ann_dict["target_clients"] = [dict(t) for t in targets]
        else:
            ann_dict["target_clients"] = []
        result.append(ann_dict)
    
    return result

@app.post("/announcements")
async def create_announcement(
    announcement: AnnouncementCreate, 
    current_admin = Depends(get_current_super_admin)
):
    """Create a new announcement"""
    from datetime import datetime, timezone
    
    # Parse dates
    show_from = datetime.fromisoformat(announcement.show_from.replace('Z', '+00:00')) if announcement.show_from else datetime.now(timezone.utc)
    show_until = datetime.fromisoformat(announcement.show_until.replace('Z', '+00:00')) if announcement.show_until else None
    
    # Insert announcement
    insert_query = """
        INSERT INTO announcements (
            title, body, announcement_type, target_all, show_from, show_until, created_by
        ) VALUES (
            :title, :body, :announcement_type, :target_all, :show_from, :show_until, :created_by
        )
        RETURNING id::text, title, body, announcement_type, target_all, show_from::text, show_until::text, created_at::text
    """
    
    new_announcement = await database.fetch_one(
        query=insert_query,
        values={
            "title": announcement.title,
            "body": announcement.body,
            "announcement_type": announcement.announcement_type,
            "target_all": announcement.target_all,
            "show_from": show_from,
            "show_until": show_until,
            "created_by": current_admin["id"]
        }
    )
    
    announcement_id = new_announcement["id"]
    
    # Add target clients if not targeting all
    if not announcement.target_all and announcement.target_client_ids:
        for client_id in announcement.target_client_ids:
            target_query = """
                INSERT INTO announcement_targets (announcement_id, client_id)
                VALUES (:announcement_id::uuid, :client_id::uuid)
            """
            await database.execute(
                query=target_query,
                values={"announcement_id": announcement_id, "client_id": client_id}
            )
    
    # Sync to MongoDB for client ERP access
    await sync_announcement_to_mongodb(announcement_id, announcement, show_from, show_until)
    
    return {
        "message": "Announcement created successfully",
        "announcement": dict(new_announcement)
    }

async def sync_announcement_to_mongodb(announcement_id: str, announcement: AnnouncementCreate, show_from, show_until):
    """Sync announcement to MongoDB for client ERP access"""
    ann_doc = {
        "announcement_id": announcement_id,
        "title": announcement.title,
        "body": announcement.body,
        "announcement_type": announcement.announcement_type,
        "target_all": announcement.target_all,
        "target_tenant_ids": [],
        "show_from": show_from.isoformat() if show_from else None,
        "show_until": show_until.isoformat() if show_until else None,
        "synced_at": datetime.utcnow().isoformat()
    }
    
    # If targeting specific clients, get their tenant_ids
    if not announcement.target_all and announcement.target_client_ids:
        for client_id in announcement.target_client_ids:
            client_query = "SELECT tenant_id FROM clients WHERE id::text = :client_id"
            client = await database.fetch_one(query=client_query, values={"client_id": client_id})
            if client:
                ann_doc["target_tenant_ids"].append(client["tenant_id"])
    
    await mongo_db.active_announcements.update_one(
        {"announcement_id": announcement_id},
        {"$set": ann_doc},
        upsert=True
    )

@app.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, current_admin = Depends(get_current_super_admin)):
    """Delete an announcement"""
    # Delete from PostgreSQL (cascade will handle targets)
    delete_query = """
        DELETE FROM announcements 
        WHERE id::text = :announcement_id
        RETURNING id::text, title
    """
    deleted = await database.fetch_one(query=delete_query, values={"announcement_id": announcement_id})
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    # Delete from MongoDB
    await mongo_db.active_announcements.delete_one({"announcement_id": announcement_id})
    
    return {"message": "Announcement deleted successfully", "announcement": dict(deleted)}

# ══════════════════════════════════════════════════════════════════════════════
# Impersonation Management
# ══════════════════════════════════════════════════════════════════════════════

class ImpersonationRequest(BaseModel):
    reason: Optional[str] = None
    duration_mins: int = 60  # Default 1 hour

@app.post("/clients/{client_id}/impersonate")
async def start_impersonation(
    client_id: str,
    request: ImpersonationRequest,
    current_admin = Depends(get_current_super_admin)
):
    """Generate an impersonation token for a client's admin"""
    # Get client info
    client_query = """
        SELECT c.id, c.tenant_id, c.business_name, c.client_admin_email, c.is_active
        FROM clients c
        WHERE c.id::text = :client_id
    """
    client = await database.fetch_one(query=client_query, values={"client_id": client_id})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if not client["is_active"]:
        raise HTTPException(status_code=400, detail="Cannot impersonate suspended client")
    
    # Create impersonation session record
    import uuid as uuid_module
    session_id = str(uuid_module.uuid4())
    
    session_query = """
        INSERT INTO impersonation_sessions (
            id, super_admin_id, client_id, client_user_id, duration_mins, reason
        ) VALUES (
            :session_id, :admin_id, :cid, :user_id, :dur, :rsn
        )
        RETURNING id::text, started_at::text
    """
    await database.execute(
        query=session_query,
        values={
            "session_id": session_id,
            "admin_id": current_admin["id"],
            "cid": client_id,
            "user_id": client["client_admin_email"],
            "dur": request.duration_mins,
            "rsn": request.reason
        }
    )
    
    # Fetch the created session
    session = {"id": session_id, "started_at": datetime.utcnow().isoformat()}
    
    # Generate impersonation token with special claims
    expires = datetime.utcnow() + timedelta(minutes=request.duration_mins)
    impersonation_payload = {
        "sub": client["client_admin_email"],
        "type": "impersonation",
        "tenant_id": client["tenant_id"],
        "client_id": client_id,
        "session_id": session["id"],
        "impersonator": current_admin["email"],
        "impersonator_name": current_admin["name"],
        "exp": expires
    }
    
    impersonation_token = jwt.encode(impersonation_payload, SECRET_KEY, algorithm=ALGORITHM)
    
    # Store in MongoDB for client ERP to validate
    await mongo_db.impersonation_tokens.update_one(
        {"session_id": session["id"]},
        {
            "$set": {
                "session_id": session["id"],
                "token": impersonation_token,
                "tenant_id": client["tenant_id"],
                "client_admin_email": client["client_admin_email"],
                "impersonator": current_admin["email"],
                "impersonator_name": current_admin["name"],
                "expires_at": expires.isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
        },
        upsert=True
    )
    
    return {
        "message": "Impersonation session started",
        "session_id": session["id"],
        "token": impersonation_token,
        "expires_at": expires.isoformat(),
        "client": {
            "id": str(client["id"]),
            "tenant_id": client["tenant_id"],
            "business_name": client["business_name"],
            "admin_email": client["client_admin_email"]
        }
    }

@app.post("/impersonation/{session_id}/end")
async def end_impersonation(
    session_id: str,
    current_admin = Depends(get_current_super_admin)
):
    """End an active impersonation session"""
    # Update session record
    update_query = """
        UPDATE impersonation_sessions
        SET ended_at = NOW()
        WHERE id::text = :session_id AND super_admin_id::text = :admin_id
        RETURNING id::text, started_at::text, ended_at::text
    """
    session = await database.fetch_one(
        query=update_query,
        values={"session_id": session_id, "admin_id": current_admin["id"]}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or unauthorized")
    
    # Remove from MongoDB
    await mongo_db.impersonation_tokens.delete_one({"session_id": session_id})
    
    return {"message": "Impersonation session ended", "session": dict(session)}

@app.get("/impersonation/active")
async def get_active_impersonations(current_admin = Depends(get_current_super_admin)):
    """Get all active impersonation sessions for the current admin"""
    query = """
        SELECT 
            i.id::text,
            i.client_id::text,
            c.business_name,
            c.tenant_id,
            i.client_user_id,
            i.started_at::text,
            i.duration_mins,
            i.reason
        FROM impersonation_sessions i
        JOIN clients c ON i.client_id = c.id
        WHERE i.super_admin_id::text = :admin_id
        AND i.ended_at IS NULL
        AND i.started_at + (i.duration_mins || ' minutes')::interval > NOW()
        ORDER BY i.started_at DESC
    """
    sessions = await database.fetch_all(query=query, values={"admin_id": current_admin["id"]})
    return [dict(s) for s in sessions]

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected" if database.is_connected else "disconnected",
        "redis": "connected" if redis_client.ping() else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
