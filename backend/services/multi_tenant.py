"""
Multi-Tenant Service Layer
Handles tenant context and feature flag resolution with Redis caching
"""
from typing import Optional, Dict
from fastapi import HTTPException, Request
import jwt
import os
import redis
import json

try:
    from feature_registry import merge_flags_with_registry
except ImportError:
    try:
        from backend.feature_registry import merge_flags_with_registry
    except ImportError:
        def merge_flags_with_registry(db_flags: dict) -> dict:
            return dict(db_flags)  # no registry available, return as-is

# Redis connection (optional - if Redis is down, cache is skipped and app still works)
try:
    redis_client = redis.Redis(
        host=os.environ.get("REDIS_HOST", "localhost"),
        port=int(os.environ.get("REDIS_PORT", "6379")),
        db=0,
        decode_responses=True,
        socket_connect_timeout=2,
    )
except Exception:
    redis_client = None

class TenantContext:
    """Manages tenant context for the current request"""
    
    def __init__(self):
        self.tenant_id: Optional[str] = None
        self.lot_number_prefix: str = "PRW"
    
    def set_tenant(self, tenant_id: str, lot_prefix: str = "PRW"):
        self.tenant_id = tenant_id
        self.lot_number_prefix = lot_prefix
    
    def get_tenant(self) -> str:
        if not self.tenant_id:
            raise HTTPException(status_code=401, detail="No tenant context")
        return self.tenant_id


# Global tenant context (will be set per request via middleware)
tenant_context = TenantContext()


def get_tenant_from_token(token: str) -> tuple[str, str]:
    """
    Extract tenant_id from JWT token
    Returns: (tenant_id, lot_number_prefix)
    """
    keys = [
        os.environ.get("SECRET_KEY", "your-secret-key-change-in-production"),
        os.environ.get("JWT_SECRET_KEY"),
    ]
    for key in keys:
        if not key:
            continue
        try:
            # Use PyJWT — same library as server.py token creation.
            payload = jwt.decode(token, key, algorithms=["HS256"])
            tenant_id = payload.get("tenant_id", "cli_001")
            lot_prefix = payload.get("lot_prefix", "PRW")
            return tenant_id, lot_prefix
        except jwt.PyJWTError:
            continue
    return "cli_001", "PRW"


class FeatureFlagService:
    """
    Feature flag resolution service with Redis caching
    Checks if a feature is enabled for the current tenant
    """
    
    def __init__(self, db):
        self.db = db
        self.cache_ttl = 60  # 60 seconds TTL
    
    async def is_enabled(self, tenant_id: str, feature_code: str) -> bool:
        """
        Check if a feature is enabled for a tenant
        Uses Redis cache with 60-second TTL (skipped if Redis unavailable)
        """
        cache_key = f"feature:{tenant_id}:{feature_code}"
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached is not None:
                    return cached == "1"
            except Exception:
                pass
        flag = await self.db.feature_flags.find_one({
            "tenant_id": tenant_id,
            "feature_code": feature_code
        }, {"_id": 0})
        is_enabled = flag.get("is_enabled", False) if flag else False
        if redis_client:
            try:
                redis_client.setex(cache_key, self.cache_ttl, "1" if is_enabled else "0")
            except Exception:
                pass
        return is_enabled
    
    async def get_all_flags(self, tenant_id: str) -> Dict[str, bool]:
        """
        Get all feature flags for a tenant as a flat dictionary
        Uses Redis cache for entire flags object
        """
        cache_key = f"flags:{tenant_id}"
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass
        # Query MongoDB
        flags = await self.db.feature_flags.find(
            {"tenant_id": tenant_id},
            {"_id": 0, "feature_code": 1, "is_enabled": 1}
        ).to_list(1000)
        
        flags_dict = {flag["feature_code"]: flag["is_enabled"] for flag in flags}
        # Merge with registry so client always gets full set (unknown codes default off)
        flags_dict = merge_flags_with_registry(flags_dict)
        
        if redis_client:
            try:
                redis_client.setex(cache_key, self.cache_ttl, json.dumps(flags_dict))
            except Exception:
                pass
        return flags_dict
    
    def invalidate_cache(self, tenant_id: str, feature_code: Optional[str] = None):
        """Invalidate Redis cache when features are toggled"""
        if not redis_client:
            return
        try:
            if feature_code:
                redis_client.delete(f"feature:{tenant_id}:{feature_code}")
            redis_client.delete(f"flags:{tenant_id}")
        except Exception:
            pass


# Middleware to inject tenant context
async def tenant_middleware(request: Request, call_next):
    """
    Middleware to extract tenant_id from JWT and set context
    """
    # Try to get token from Authorization header (scheme is case-insensitive per RFC 7235)
    auth_header = (request.headers.get("Authorization") or "").strip()
    parts = auth_header.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1]
        tenant_id, lot_prefix = get_tenant_from_token(token)
        tenant_context.set_tenant(tenant_id, lot_prefix)
    else:
        # Allow pre-auth tenant routing from header/query (useful for login on tenant-specific URLs).
        hinted_tenant = (
            request.headers.get("X-Tenant-ID")
            or request.query_params.get("tenant_id")
            or "cli_001"
        )
        tenant_context.set_tenant(hinted_tenant, "PRW")
    
    response = await call_next(request)
    return response
