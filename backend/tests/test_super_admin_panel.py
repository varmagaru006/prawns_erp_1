"""
Test Super Admin Panel - Loading Fix Verification
Tests that the Super Admin Panel APIs work correctly:
1. Super admin login via /api/auth/login
2. Tenants list and metrics load
3. Feature flag management
4. Client user cannot access super admin endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

SUPER_ADMIN_EMAIL = "superadmin@prawnrp.com"
SUPER_ADMIN_PASSWORD = "admin123"
CLIENT_EMAIL = "john@aquapremium.com"
CLIENT_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def super_admin_token():
    """Get super admin token via /api/auth/login"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Super admin login failed: {response.text}"
    data = response.json()
    assert data.get("user", {}).get("role") == "super_admin", "User role should be super_admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def client_token():
    """Get client user token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}
    )
    assert response.status_code == 200, f"Client login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def first_tenant_id(super_admin_token):
    """Get first tenant ID for testing"""
    response = requests.get(
        f"{BASE_URL}/api/super-admin/tenants",
        headers={"Authorization": f"Bearer {super_admin_token}"}
    )
    assert response.status_code == 200
    tenants = response.json()
    assert len(tenants) > 0, "At least one tenant should exist"
    return tenants[0]["id"]


# ============================================================================
# Super Admin Authentication Tests
# ============================================================================

class TestSuperAdminAuth:
    """Test super admin authentication via main auth endpoint"""

    def test_super_admin_login_via_main_auth(self):
        """Super admin can login via /api/auth/login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data, "Should return access_token"
        assert data.get("user", {}).get("role") == "super_admin", "Role must be super_admin"
        print("SUCCESS: Super admin login returns access_token with role super_admin")

    def test_super_admin_wrong_password(self):
        """Super admin login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print(f"SUCCESS: Wrong password returns {response.status_code}")


# ============================================================================
# Panel Data Loading Tests (Core bug fix verification)
# ============================================================================

class TestPanelDataLoading:
    """Tests that panel data loads correctly (verifying try/finally fix)"""

    def test_tenants_list_loads(self, super_admin_token):
        """GET /api/super-admin/tenants returns list"""
        response = requests.get(
            f"{BASE_URL}/api/super-admin/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        tenants = response.json()
        assert isinstance(tenants, list), "Should return a list"
        assert len(tenants) >= 2, f"Expected >=2 tenants, got {len(tenants)}"
        # Verify tenant structure
        tenant = tenants[0]
        assert "id" in tenant
        assert "name" in tenant
        assert "plan" in tenant
        assert "is_active" in tenant
        assert "user_count" in tenant
        print(f"SUCCESS: Got {len(tenants)} tenants with proper structure")

    def test_metrics_load(self, super_admin_token):
        """GET /api/super-admin/metrics returns correct data"""
        response = requests.get(
            f"{BASE_URL}/api/super-admin/metrics",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_tenants" in data
        assert "active_tenants" in data
        assert "total_users" in data
        assert "users_by_plan" in data
        assert isinstance(data["total_tenants"], int)
        assert isinstance(data["active_tenants"], int)
        assert data["total_tenants"] >= 2
        assert data["active_tenants"] >= 2
        print(f"SUCCESS: Metrics - {data['total_tenants']} tenants, {data['active_tenants']} active, {data['total_users']} users")

    def test_both_endpoints_work_for_promise_all(self, super_admin_token):
        """Both tenants and metrics can be called simultaneously (simulates Promise.all)"""
        import concurrent.futures
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        def get_tenants():
            return requests.get(f"{BASE_URL}/api/super-admin/tenants", headers=headers)
        
        def get_metrics():
            return requests.get(f"{BASE_URL}/api/super-admin/metrics", headers=headers)
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_tenants = executor.submit(get_tenants)
            future_metrics = executor.submit(get_metrics)
            
            tenants_resp = future_tenants.result()
            metrics_resp = future_metrics.result()
        
        assert tenants_resp.status_code == 200
        assert metrics_resp.status_code == 200
        print("SUCCESS: Promise.all equivalent - both endpoints return 200 simultaneously")


# ============================================================================
# Feature Flag Management Tests
# ============================================================================

class TestFeatureFlagManagement:
    """Test feature flag toggle functionality"""

    def test_get_tenant_features(self, super_admin_token, first_tenant_id):
        """GET /api/super-admin/tenants/{id}/features returns feature flags"""
        response = requests.get(
            f"{BASE_URL}/api/super-admin/tenants/{first_tenant_id}/features",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        features = response.json()
        assert isinstance(features, dict), "Features should be a dict"
        # Should have all required feature keys
        required_keys = ["procurement", "preprocessing", "coldStorage", "production", "accounts"]
        for key in required_keys:
            assert key in features, f"Missing feature key: {key}"
        print(f"SUCCESS: Got {len(features)} feature flags for tenant {first_tenant_id}")

    def test_update_tenant_features(self, super_admin_token, first_tenant_id):
        """PUT /api/super-admin/tenants/{id}/features updates feature flags"""
        # First get current state
        current_resp = requests.get(
            f"{BASE_URL}/api/super-admin/tenants/{first_tenant_id}/features",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        current_flags = current_resp.json()
        
        # Toggle wastageDashboard
        new_state = not current_flags.get("wastageDashboard", False)
        new_flags = dict(current_flags)
        new_flags["wastageDashboard"] = new_state
        
        update_resp = requests.put(
            f"{BASE_URL}/api/super-admin/tenants/{first_tenant_id}/features",
            headers={"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"},
            json={"feature_flags": new_flags}
        )
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data.get("status") == "success"
        print(f"SUCCESS: Feature update returned status: {data.get('status')}")
        
        # Verify persistence
        verify_resp = requests.get(
            f"{BASE_URL}/api/super-admin/tenants/{first_tenant_id}/features",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        verified_flags = verify_resp.json()
        assert verified_flags.get("wastageDashboard") == new_state, "Feature flag change should persist"
        print(f"SUCCESS: wastageDashboard toggled to {new_state} and persisted")
        
        # Restore original state
        original_flags = dict(current_flags)
        requests.put(
            f"{BASE_URL}/api/super-admin/tenants/{first_tenant_id}/features",
            headers={"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"},
            json={"feature_flags": original_flags}
        )


# ============================================================================
# Access Control Tests
# ============================================================================

class TestAccessControl:
    """Test that client users cannot access super admin endpoints"""

    def test_client_cannot_access_tenants(self, client_token):
        """Client user gets 403 when accessing super admin tenants"""
        response = requests.get(
            f"{BASE_URL}/api/super-admin/tenants",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 403
        data = response.json()
        assert "super admin" in data.get("detail", "").lower(), "Should mention super admin access requirement"
        print(f"SUCCESS: Client user gets 403 - {data.get('detail')}")

    def test_client_cannot_access_metrics(self, client_token):
        """Client user gets 403 when accessing super admin metrics"""
        response = requests.get(
            f"{BASE_URL}/api/super-admin/metrics",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 403
        print(f"SUCCESS: Client user blocked from metrics with 403")

    def test_unauthenticated_cannot_access_tenants(self):
        """Unauthenticated request gets 403 or 401"""
        response = requests.get(f"{BASE_URL}/api/super-admin/tenants")
        assert response.status_code in [401, 403, 422]
        print(f"SUCCESS: Unauthenticated request blocked with {response.status_code}")

    def test_client_role_is_not_super_admin(self, client_token):
        """Verify client user has non-super_admin role"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") != "super_admin", "Client user should not have super_admin role"
        print(f"SUCCESS: Client user role is '{data.get('role')}' (not super_admin)")


# ============================================================================
# Tenant Creation Tests
# ============================================================================

class TestTenantCreation:
    """Test the 4-step wizard backend endpoint"""

    def test_create_tenant_via_wizard(self, super_admin_token):
        """POST /api/super-admin/tenants creates a tenant with all wizard data"""
        unique_slug = f"test_tenant_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": "TEST Coastal Seafoods",
            "slug": unique_slug,
            "plan": "starter",
            "gst_number": "22AAAAA0000A1Z5",
            "owner_name": "TEST Owner",
            "owner_email": f"test_owner_{uuid.uuid4().hex[:8]}@test.com",
            "owner_password": "TestPass123!",
            "feature_flags": {
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
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/super-admin/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"},
            json=payload
        )
        assert response.status_code == 200, f"Tenant creation failed: {response.text}"
        data = response.json()
        assert data.get("status") == "success"
        assert "tenant" in data
        assert data["tenant"]["name"] == payload["name"]
        assert data["tenant"]["slug"] == unique_slug
        print(f"SUCCESS: Created tenant {unique_slug} with admin user")
        
        # Verify it appears in tenant list
        list_resp = requests.get(
            f"{BASE_URL}/api/super-admin/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        tenants = list_resp.json()
        tenant_ids = [t["id"] for t in tenants]
        assert unique_slug in tenant_ids, "New tenant should appear in list"
        print(f"SUCCESS: Tenant {unique_slug} appears in tenant list")
        
        # Store for cleanup
        return unique_slug

    def test_duplicate_slug_rejected(self, super_admin_token, first_tenant_id):
        """Creating tenant with existing slug returns 400"""
        payload = {
            "name": "Duplicate Company",
            "slug": first_tenant_id,  # Use existing slug
            "plan": "starter",
            "owner_name": "Test Owner",
            "owner_email": f"test_dup_{uuid.uuid4().hex[:8]}@test.com",
            "owner_password": "TestPass123!",
            "feature_flags": {}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/super-admin/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"},
            json=payload
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"SUCCESS: Duplicate slug rejected with 400")
