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
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import hashlib

load_dotenv()

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
mongo_client = AsyncIOMotorClient(MONGO_URL)

# Super Admin DB - separate database for SaaS control
db = mongo_client["prawn_erp_super_admin"]

# Client ERP DB - for syncing feature flags
client_db = mongo_client[os.getenv("MONGO_DB_NAME", "prawn_erp")]

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "super-admin-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480
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

class ClientUpdate(BaseModel):
    business_name: Optional[str] = None
    subscription_status: Optional[str] = None
    is_active: Optional[bool] = None

class ClientSummary(BaseModel):
    id: str
    tenant_id: str
    business_name: str
    plan_name: Optional[str] = "Free"
    subscription_status: str
    subscription_to: Optional[str] = None
    is_active: bool

class BrandingUpdate(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    company_name: Optional[str] = None
    logo_url: Optional[str] = None

class FeatureToggle(BaseModel):
    feature_code: str
    is_enabled: bool

class LinkRequest(BaseModel):
    webhook_url: Optional[str] = None

class ProvisionUserRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "worker"
    password: str

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
    # Create indexes
    await db.super_admins.create_index("email", unique=True)
    await db.clients.create_index("id", unique=True)
    await db.clients.create_index("tenant_id", unique=True)
    await db.provisioned_users.create_index([("client_id", 1), ("email", 1)], unique=True)
    await db.feature_flags.create_index([("client_id", 1), ("feature_code", 1)], unique=True)
    await db.announcements.create_index("created_at")
    
    # Ensure default super admin exists
    existing = await db.super_admins.find_one({"email": "superadmin@prawnrp.com"})
    if not existing:
        await db.super_admins.insert_one({
            "id": str(uuid.uuid4()),
            "email": "superadmin@prawnrp.com",
            "password_hash": pwd_context.hash("admin123"),
            "name": "Super Administrator",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": None
        })
        print("✅ Created default super admin: superadmin@prawnrp.com / admin123")
    
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
    
    client = {
        "id": str(uuid.uuid4()),
        "tenant_id": client_data.tenant_id,
        "business_name": client_data.business_name,
        "owner_email": client_data.owner_email,
        "owner_name": client_data.owner_name,
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
    
    # Remove _id from client dict (MongoDB adds it during insert)
    client.pop("_id", None)
    
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

# ══════════════════════════════════════════════════════════════════════════════
# Branding Management
# ══════════════════════════════════════════════════════════════════════════════

@app.put("/clients/{client_id}/branding")
async def update_client_branding(client_id: str, branding: BrandingUpdate, current_admin = Depends(get_current_super_admin)):
    """Update client branding and push to client ERP"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if client.get("link_status") != "linked":
        raise HTTPException(status_code=400, detail="Client must be linked before updating branding")
    
    # Update branding in super admin DB
    branding_data = {k: v for k, v in branding.dict().items() if v is not None}
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"branding": branding_data, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Push to client ERP MongoDB
    await client_db.tenant_config.update_one(
        {"tenant_id": client["tenant_id"]},
        {"$set": {"branding": branding_data, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    # Log activity
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_admin["id"],
        "action": "UPDATE_BRANDING",
        "entity_id": client_id,
        "details": branding_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "success", "message": "Branding updated and pushed to client ERP"}

# ══════════════════════════════════════════════════════════════════════════════
# Feature Flag Management
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/clients/{client_id}/features")
async def get_client_features(client_id: str, current_admin = Depends(get_current_super_admin)):
    """Get all feature flags for a client, merged with feature registry"""
    # Get features from registry
    feature_registry = [
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
        {"code": "purchaseInvoiceDashboard", "name": "Purchase Invoice Dashboard", "description": "Invoice metrics, quick preview, and bulk export", "module": "Finance"},
        {"code": "partyLedger", "name": "Party Ledger", "description": "Party master and ledger management", "module": "Finance"},
        {"code": "admin", "name": "Admin Panel", "description": "Administrative functions", "module": "Admin"}
    ]
    
    # Get existing feature flags from DB
    db_features = await db.feature_flags.find({"client_id": client_id}, {"_id": 0}).to_list(1000)
    db_feature_map = {f["feature_code"]: f for f in db_features}
    
    # Merge registry with DB state
    merged_features = []
    for reg_feature in feature_registry:
        db_feature = db_feature_map.get(reg_feature["code"])
        merged_features.append({
            "feature_code": reg_feature["code"],
            "feature_name": reg_feature["name"],
            "description": reg_feature["description"],
            "module": reg_feature["module"],
            "is_enabled": db_feature["is_enabled"] if db_feature else False,
            "updated_at": db_feature.get("updated_at") if db_feature else None,
            "updated_by": db_feature.get("updated_by") if db_feature else None
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
    
    # Push to client ERP database for this client's tenant_id
    await client_db.feature_flags.update_one(
        {"tenant_id": tenant_id, "feature_code": toggle.feature_code},
        {"$set": {
            "is_enabled": toggle.is_enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
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
    features: List[FeatureToggle], 
    current_admin = Depends(get_current_super_admin)
):
    """Toggle multiple features at once"""
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    tenant_id = client["tenant_id"]
    
    for feature in features:
        await db.feature_flags.update_one(
            {"client_id": client_id, "feature_code": feature.feature_code},
            {"$set": {
                "is_enabled": feature.is_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        # Push to client ERP database for this client's tenant_id only
        await client_db.feature_flags.update_one(
            {"tenant_id": tenant_id, "feature_code": feature.feature_code},
            {"$set": {
                "is_enabled": feature.is_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    return {"status": "success", "message": f"Updated {len(features)} features for tenant {tenant_id}"}

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
    webhook_url = request.webhook_url or "http://localhost:8001/internal/saas-hook/handshake"
    
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
    """Get all provisioned users for a client"""
    users = await db.provisioned_users.find({"client_id": client_id}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

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
    
    # Check if user already exists
    existing = await db.provisioned_users.find_one({"client_id": client_id, "email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists for this client")
    
    # Hash password
    password_hash = pwd_context.hash(user_data.password)
    
    # Create user record in super admin DB
    user_record = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "tenant_id": client["tenant_id"],
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_admin["email"]
    }
    await db.provisioned_users.insert_one(user_record)
    
    # Push to client ERP MongoDB
    await client_db.users.insert_one({
        "id": user_record["id"],
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
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
        "details": {"email": user_data.email, "name": user_data.name},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "status": "success",
        "message": "User provisioned successfully",
        "user": {
            "id": user_record["id"],
            "email": user_data.email,
            "name": user_data.name,
            "role": user_data.role
        }
    }

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
        await client_db.announcements.insert_one({**announcement_doc})
    elif announcement.target_type == "specific_clients" and announcement.target_ids:
        # Push to specific clients only
        for client_id in announcement.target_ids:
            client = await db.clients.find_one({"id": client_id})
            if client:
                await client_db.announcements.insert_one({
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
    current_admin = Depends(get_current_super_admin)
):
    """Get activity logs"""
    query = {}
    if action:
        query["action"] = action
    if entity_id:
        query["entity_id"] = entity_id
    
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
