"""
Super Admin Portal API Tests
Tests for feature flag management and client operations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-docs-hub.preview.emergentagent.com').rstrip('/')
SUPER_ADMIN_URL = f"{BASE_URL}/api/super-admin"

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@prawnrp.com"
SUPER_ADMIN_PASSWORD = "admin123"

# Test client ID (cli_ui_test)
TEST_CLIENT_ID = "0f54ec40-eb9e-4fea-ab13-b0183e938ff5"


class TestSuperAdminAuth:
    """Super Admin Authentication tests"""
    
    def test_login_success(self):
        """Test successful super admin login"""
        response = requests.post(
            f"{SUPER_ADMIN_URL}/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data["token_type"] == "bearer"
        print(f"✅ Login successful, token received")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{SUPER_ADMIN_URL}/auth/login",
            json={"email": "wrong@email.com", "password": "wrongpass"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✅ Invalid credentials correctly rejected")
    
    def test_get_me(self, auth_token):
        """Test get current admin info"""
        response = requests.get(
            f"{SUPER_ADMIN_URL}/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert "email" in data
        assert data["email"] == SUPER_ADMIN_EMAIL
        print(f"✅ Get me successful: {data['name']}")


class TestClientManagement:
    """Client management API tests"""
    
    def test_get_clients(self, auth_token):
        """Test getting all clients"""
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get clients failed: {response.text}"
        clients = response.json()
        assert isinstance(clients, list), "Response should be a list"
        assert len(clients) > 0, "Should have at least one client"
        print(f"✅ Found {len(clients)} clients")
        
        # Verify expected client exists
        client_ids = [c["id"] for c in clients]
        assert TEST_CLIENT_ID in client_ids, f"Test client {TEST_CLIENT_ID} not found"
        print(f"✅ Test client (cli_ui_test) found")
    
    def test_get_client_detail(self, auth_token):
        """Test getting client detail"""
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get client detail failed: {response.text}"
        data = response.json()
        assert data["tenant_id"] == "cli_ui_test"
        assert data["business_name"] == "UI Flow Test"
        print(f"✅ Client detail: {data['business_name']} ({data['tenant_id']})")


class TestFeatureManagement:
    """Feature toggle API tests - THE MAIN BUG FIX BEING TESTED"""
    
    def test_get_client_features(self, auth_token):
        """Test getting features for a client"""
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get features failed: {response.text}"
        features = response.json()
        assert isinstance(features, list), "Features should be a list"
        assert len(features) > 0, "Should have features"
        
        # Check feature structure
        feature = features[0]
        assert "feature_code" in feature
        assert "feature_name" in feature
        assert "is_enabled" in feature
        assert "module" in feature
        
        enabled_count = len([f for f in features if f["is_enabled"]])
        print(f"✅ Found {len(features)} features, {enabled_count} enabled")
        return features
    
    def test_toggle_single_feature(self, auth_token):
        """Test toggling a single feature"""
        # Get current features
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        features = response.json()
        
        # Find a feature to toggle
        test_feature = features[0]
        original_state = test_feature["is_enabled"]
        new_state = not original_state
        
        # Toggle the feature
        toggle_response = requests.post(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features/toggle",
            json={
                "tenant_id": "cli_ui_test",
                "feature_code": test_feature["feature_code"],
                "is_enabled": new_state,
                "is_override": False
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        
        # Verify the change persisted
        verify_response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_features = verify_response.json()
        toggled_feature = next(f for f in verify_features if f["feature_code"] == test_feature["feature_code"])
        assert toggled_feature["is_enabled"] == new_state, "Feature state didn't persist!"
        
        print(f"✅ Single toggle works: {test_feature['feature_code']} -> {new_state}")
        
        # Restore original state
        requests.post(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features/toggle",
            json={
                "tenant_id": "cli_ui_test",
                "feature_code": test_feature["feature_code"],
                "is_enabled": original_state,
                "is_override": False
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"✅ Restored original state: {test_feature['feature_code']} -> {original_state}")
    
    def test_bulk_disable_features(self, auth_token):
        """Test bulk disable - THE KEY BUG FIX TEST"""
        # Get current features
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        features = response.json()
        
        # Get enabled features from one module to test bulk operation
        procurement_features = [f for f in features if f["module"] == "procurement"]
        enabled_features = [f["feature_code"] for f in procurement_features if f["is_enabled"]]
        
        if len(enabled_features) == 0:
            print("⚠️ No enabled procurement features to test bulk disable")
            return
        
        # Record original state
        original_enabled = set(enabled_features)
        
        # Bulk disable
        bulk_response = requests.post(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
            json={
                "feature_codes": enabled_features,
                "is_enabled": False
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert bulk_response.status_code == 200, f"Bulk disable failed: {bulk_response.text}"
        print(f"✅ Bulk disable API call successful for {len(enabled_features)} features")
        
        # Verify the changes persisted (THIS WAS THE BUG - reads came from PostgreSQL but writes went to MongoDB)
        verify_response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_features = verify_response.json()
        
        # Check all disabled features are actually disabled
        for feature_code in enabled_features:
            feature = next(f for f in verify_features if f["feature_code"] == feature_code)
            assert feature["is_enabled"] == False, f"Feature {feature_code} should be disabled but is still enabled!"
        
        print(f"✅ BULK DISABLE PERSISTENCE VERIFIED - all {len(enabled_features)} features are disabled after read")
        
        # Restore original state
        if len(original_enabled) > 0:
            requests.post(
                f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
                json={
                    "feature_codes": list(original_enabled),
                    "is_enabled": True
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            print(f"✅ Restored original enabled state for {len(original_enabled)} features")
    
    def test_bulk_enable_features(self, auth_token):
        """Test bulk enable - Verify enable all functionality"""
        # Get current features
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        features = response.json()
        
        # Get disabled features from one module
        qc_features = [f for f in features if f["module"] == "qc"]
        disabled_features = [f["feature_code"] for f in qc_features if not f["is_enabled"]]
        
        if len(disabled_features) == 0:
            print("⚠️ No disabled QC features to test bulk enable")
            return
        
        # Record original state
        original_disabled = set(disabled_features)
        
        # Bulk enable
        bulk_response = requests.post(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
            json={
                "feature_codes": disabled_features,
                "is_enabled": True
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert bulk_response.status_code == 200, f"Bulk enable failed: {bulk_response.text}"
        print(f"✅ Bulk enable API call successful for {len(disabled_features)} features")
        
        # Verify persistence
        verify_response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_features = verify_response.json()
        
        for feature_code in disabled_features:
            feature = next(f for f in verify_features if f["feature_code"] == feature_code)
            assert feature["is_enabled"] == True, f"Feature {feature_code} should be enabled but is still disabled!"
        
        print(f"✅ BULK ENABLE PERSISTENCE VERIFIED - all {len(disabled_features)} features are enabled after read")
        
        # Restore if needed
        if len(original_disabled) > 0:
            requests.post(
                f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
                json={
                    "feature_codes": list(original_disabled),
                    "is_enabled": False
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
    
    def test_enable_all_features(self, auth_token):
        """Test enabling ALL features for a client"""
        # Get all features
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        features = response.json()
        
        # Get all disabled features
        all_disabled = [f["feature_code"] for f in features if not f["is_enabled"]]
        
        if len(all_disabled) > 0:
            # Enable all
            bulk_response = requests.post(
                f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
                json={
                    "feature_codes": all_disabled,
                    "is_enabled": True
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert bulk_response.status_code == 200
            print(f"✅ Enabled {len(all_disabled)} disabled features")
        
        # Verify all are enabled
        verify_response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_features = verify_response.json()
        enabled_count = len([f for f in verify_features if f["is_enabled"]])
        total_count = len(verify_features)
        
        assert enabled_count == total_count, f"Not all features enabled: {enabled_count}/{total_count}"
        print(f"✅ All {total_count} features are now enabled")


class TestModuleLevelToggle:
    """Test module-level feature toggling"""
    
    def test_toggle_module_features(self, auth_token):
        """Test enabling/disabling all features in a module"""
        # Get features
        response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        features = response.json()
        
        # Get all preprocessing features
        module_name = "preprocessing"
        module_features = [f for f in features if f["module"] == module_name]
        
        if len(module_features) == 0:
            pytest.skip(f"No features in {module_name} module")
        
        # Record original states
        original_states = {f["feature_code"]: f["is_enabled"] for f in module_features}
        all_codes = list(original_states.keys())
        
        # Disable all module features
        bulk_response = requests.post(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
            json={"feature_codes": all_codes, "is_enabled": False},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert bulk_response.status_code == 200
        
        # Verify all disabled
        verify_response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_features = verify_response.json()
        module_verify = [f for f in verify_features if f["module"] == module_name]
        
        all_disabled = all(not f["is_enabled"] for f in module_verify)
        assert all_disabled, "Not all module features are disabled"
        print(f"✅ All {len(module_features)} {module_name} features disabled successfully")
        
        # Re-enable all
        bulk_response = requests.post(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
            json={"feature_codes": all_codes, "is_enabled": True},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert bulk_response.status_code == 200
        
        # Verify all enabled
        verify_response = requests.get(
            f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/features",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_features = verify_response.json()
        module_verify = [f for f in verify_features if f["module"] == module_name]
        
        all_enabled = all(f["is_enabled"] for f in module_verify)
        assert all_enabled, "Not all module features are enabled"
        print(f"✅ All {len(module_features)} {module_name} features enabled successfully")
        
        # Restore original states
        to_disable = [code for code, enabled in original_states.items() if not enabled]
        if to_disable:
            requests.post(
                f"{SUPER_ADMIN_URL}/clients/{TEST_CLIENT_ID}/bulk-features",
                json={"feature_codes": to_disable, "is_enabled": False},
                headers={"Authorization": f"Bearer {auth_token}"}
            )


# Fixtures
@pytest.fixture
def auth_token():
    """Get authentication token for super admin"""
    response = requests.post(
        f"{SUPER_ADMIN_URL}/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip("Could not authenticate")
    return response.json()["access_token"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
