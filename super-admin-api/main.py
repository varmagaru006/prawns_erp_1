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
