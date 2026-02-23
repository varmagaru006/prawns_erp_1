"""
Multi-Tenant Service Layer
Handles tenant context and feature flag resolution with Redis caching
"""
from typing import Optional, Dict
from fastapi import HTTPException, Request
from jose import jwt, JWTError
import os
import redis
import json

# Redis connection
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

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
    try:
        SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        
        # For now, all users belong to cli_001
        # In production, this would be stored in the user record
        tenant_id = payload.get("tenant_id", "cli_001")
        lot_prefix = payload.get("lot_prefix", "PRW")
        
        return tenant_id, lot_prefix
    except JWTError:
        return "cli_001", "PRW"  # Default tenant


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
        Uses Redis cache with 60-second TTL
        """
        cache_key = f"feature:{tenant_id}:{feature_code}"
        
        # Check Redis cache
        cached = redis_client.get(cache_key)
        if cached is not None:
            return cached == "1"
        
        # Query MongoDB
        flag = await self.db.feature_flags.find_one({
            "tenant_id": tenant_id,
            "feature_code": feature_code
        }, {"_id": 0})
        
        is_enabled = flag.get("is_enabled", False) if flag else False
        
        # Cache in Redis
        redis_client.setex(cache_key, self.cache_ttl, "1" if is_enabled else "0")
        
        return is_enabled
    
    async def get_all_flags(self, tenant_id: str) -> Dict[str, bool]:
        """
        Get all feature flags for a tenant as a flat dictionary
        Uses Redis cache for entire flags object
        """
        cache_key = f"flags:{tenant_id}"
        
        # Check Redis cache
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except:
            pass  # Redis unavailable, skip cache
        
        # Query MongoDB
        flags = await self.db.feature_flags.find(
            {"tenant_id": tenant_id},
            {"_id": 0, "feature_code": 1, "is_enabled": 1}
        ).to_list(1000)
        
        flags_dict = {flag["feature_code"]: flag["is_enabled"] for flag in flags}
        
        # Cache in Redis
        try:
            redis_client.setex(cache_key, self.cache_ttl, json.dumps(flags_dict))
        except:
            pass  # Redis unavailable, skip caching
        
        return flags_dict
    
    def invalidate_cache(self, tenant_id: str, feature_code: Optional[str] = None):
        """Invalidate Redis cache when features are toggled"""
        try:
            if feature_code:
                cache_key = f"feature:{tenant_id}:{feature_code}"
                redis_client.delete(cache_key)
            
            # Always invalidate the full flags cache
            redis_client.delete(f"flags:{tenant_id}")
        except:
            pass  # Redis unavailable, skip cache invalidation


# Middleware to inject tenant context
async def tenant_middleware(request: Request, call_next):
    """
    Middleware to extract tenant_id from JWT and set context
    """
    # Try to get token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        tenant_id, lot_prefix = get_tenant_from_token(token)
        tenant_context.set_tenant(tenant_id, lot_prefix)
    else:
        # Default to cli_001 for non-authenticated requests
        tenant_context.set_tenant("cli_001", "PRW")
    
    response = await call_next(request)
    return response
