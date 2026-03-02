"""
Test Super Admin API - Create Clients, Toggle Features
Tests the Super Admin portal functionality for managing clients and features
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials
SUPER_ADMIN_EMAIL = "superadmin@prawnrp.com"
SUPER_ADMIN_PASSWORD = "admin123"
CLIENT_EMAIL = "john@aquapremium.com"
CLIENT_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def super_admin_token():
    """Get Super Admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/super-admin/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Super Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def client_token():
    """Get Client ERP authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}
    )
    assert response.status_code == 200, f"Client login failed: {response.text}"
    return response.json()["access_token"]


# ============================================================================
# Super Admin Auth Tests
# ============================================================================

class TestSuperAdminAuth:
    """Test Super Admin authentication endpoints"""

    def test_super_admin_login_success(self):
        """Test Super Admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/super-admin/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        print(f"SUCCESS: Super Admin login returned access token")

    def test_super_admin_login_invalid_credentials(self):
        """Test Super Admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/super-admin/auth/login",
            json={"email": "wrong@email.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print(f"SUCCESS: Super Admin login rejected invalid credentials")


# ============================================================================
# Super Admin Client Management Tests
# ============================================================================

class TestSuperAdminClients:
    """Test Super Admin client management endpoints"""

    def test_get_clients_list(self, super_admin_token):
        """Test GET /api/super-admin/clients returns client list"""
        response = requests.get(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} clients")

    def test_create_client_success(self, super_admin_token):
        """Test POST /api/super-admin/clients creates new client"""
        unique_id = str(uuid.uuid4())[:8]
        client_data = {
            "tenant_id": f"test_tenant_{unique_id}",
            "business_name": f"Test Business {unique_id}",
            "owner_email": f"owner_{unique_id}@test.com",
            "owner_name": "Test Owner",
            "plan_id": "free",
            "subscription_months": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json=client_data
        )
        assert response.status_code == 201, f"Create client failed: {response.text}"
        
        data = response.json()
        assert "client" in data
        assert "api_key" in data
        assert data["client"]["tenant_id"] == client_data["tenant_id"]
        assert data["client"]["business_name"] == client_data["business_name"]
        assert data["client"]["is_active"] == True
        assert "id" in data["client"]
        
        # Verify client ID is present and not MongoDB _id
        assert data["client"]["id"] is not None
        assert "_id" not in data["client"]
        
        print(f"SUCCESS: Created client with ID: {data['client']['id']}")
        return data["client"]["id"]

    def test_create_client_duplicate_tenant_id_fails(self, super_admin_token):
        """Test POST /api/super-admin/clients fails for duplicate tenant_id"""
        # First create a client
        unique_id = str(uuid.uuid4())[:8]
        client_data = {
            "tenant_id": f"test_duplicate_{unique_id}",
            "business_name": "Test Duplicate",
            "owner_email": f"dup_{unique_id}@test.com",
            "owner_name": "Test Owner",
            "plan_id": "free",
            "subscription_months": 1
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json=client_data
        )
        assert response1.status_code == 201
        
        # Try to create again with same tenant_id
        response2 = requests.post(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json=client_data
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json().get("detail", "").lower()
        print(f"SUCCESS: Duplicate tenant_id rejected correctly")

    def test_get_client_detail(self, super_admin_token):
        """Test GET /api/super-admin/clients/{client_id} returns client details"""
        # First get list of clients
        response = requests.get(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        clients = response.json()
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        
        detail_response = requests.get(
            f"{BASE_URL}/api/super-admin/clients/{client_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert detail_response.status_code == 200
        data = detail_response.json()
        assert data["id"] == client_id
        print(f"SUCCESS: Got client detail for {data['business_name']}")


# ============================================================================
# Super Admin Feature Toggle Tests
# ============================================================================

class TestSuperAdminFeatures:
    """Test Super Admin feature flag management"""

    def test_get_client_features(self, super_admin_token):
        """Test GET /api/super-admin/clients/{client_id}/features returns features"""
        # Get first client
        response = requests.get(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        clients = response.json()
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        
        features_response = requests.get(
            f"{BASE_URL}/api/super-admin/clients/{client_id}/features",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert features_response.status_code == 200
        features = features_response.json()
        assert isinstance(features, list)
        
        # Check partyLedger is in feature registry
        feature_codes = [f["feature_code"] for f in features]
        assert "partyLedger" in feature_codes
        print(f"SUCCESS: Got {len(features)} features including partyLedger")

    def test_toggle_feature_enable(self, super_admin_token):
        """Test POST /api/super-admin/clients/{client_id}/features/toggle enables feature"""
        # Get first client
        response = requests.get(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        clients = response.json()
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        
        # Toggle partyLedger feature to enabled
        toggle_response = requests.post(
            f"{BASE_URL}/api/super-admin/clients/{client_id}/features/toggle",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"feature_code": "partyLedger", "is_enabled": True}
        )
        assert toggle_response.status_code == 200
        data = toggle_response.json()
        assert data["status"] == "success"
        assert "enabled" in data["message"].lower()
        print(f"SUCCESS: Feature partyLedger enabled")

    def test_toggle_feature_disable(self, super_admin_token):
        """Test POST /api/super-admin/clients/{client_id}/features/toggle disables feature"""
        # Get first client
        response = requests.get(
            f"{BASE_URL}/api/super-admin/clients",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        clients = response.json()
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        
        # Toggle partyLedger feature to disabled
        toggle_response = requests.post(
            f"{BASE_URL}/api/super-admin/clients/{client_id}/features/toggle",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"feature_code": "partyLedger", "is_enabled": False}
        )
        assert toggle_response.status_code == 200
        data = toggle_response.json()
        assert data["status"] == "success"
        assert "disabled" in data["message"].lower()
        print(f"SUCCESS: Feature partyLedger disabled")
        
        # Re-enable for other tests
        requests.post(
            f"{BASE_URL}/api/super-admin/clients/{client_id}/features/toggle",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"feature_code": "partyLedger", "is_enabled": True}
        )


# ============================================================================
# Client ERP Auth/Me Tests
# ============================================================================

class TestClientERPAuth:
    """Test Client ERP authentication and /me endpoint"""

    def test_client_erp_login_success(self):
        """Test Client ERP login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == CLIENT_EMAIL
        print(f"SUCCESS: Client ERP login for {data['user']['name']}")

    def test_client_erp_me_has_party_ledger_feature(self, client_token):
        """Test GET /api/auth/me returns partyLedger feature as true"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check features object exists
        assert "features" in data
        features = data["features"]
        
        # Check partyLedger is present and true
        assert "partyLedger" in features, f"partyLedger not in features: {features.keys()}"
        assert features["partyLedger"] == True, f"partyLedger is {features['partyLedger']}"
        print(f"SUCCESS: /api/auth/me returns partyLedger=True")


# ============================================================================
# Parties API Tests (for Party Ledger navigation)
# ============================================================================

class TestPartiesAPI:
    """Test Parties API for Party Master functionality"""

    def test_list_parties(self, client_token):
        """Test GET /api/parties returns list"""
        response = requests.get(
            f"{BASE_URL}/api/parties",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} parties")

    def test_create_party(self, client_token):
        """Test POST /api/parties creates new party"""
        unique_id = str(uuid.uuid4())[:8]
        party_data = {
            "party_name": f"TEST_Party_{unique_id}",
            "party_alias": "Test Alias",
            "short_code": f"TP{unique_id[:4]}",
            "mobile": "9876543210"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parties",
            headers={"Authorization": f"Bearer {client_token}"},
            json=party_data
        )
        assert response.status_code in [200, 201], f"Create party failed: {response.text}"
        data = response.json()
        assert data["party_name"] == party_data["party_name"]
        print(f"SUCCESS: Created party {data['party_name']}")
        return data["id"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
