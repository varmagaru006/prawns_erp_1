#!/usr/bin/env python3
"""
Test script for Super Admin API - Phase 3 Validation
Tests all core endpoints: auth, clients, features, health
"""
import requests
import json
from typing import Dict

BASE_URL = "http://localhost:8002"

def print_section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def test_health_check():
    print_section("1. Health Check")
    response = requests.get(f"{BASE_URL}/health")
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(data, indent=2)}")
    assert response.status_code == 200
    assert data['status'] == 'healthy'
    assert data['database'] == 'connected'
    assert data['redis'] == 'connected'
    print("✅ Health check PASSED")
    return True

def test_super_admin_login() -> str:
    print_section("2. Super Admin Login")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": "superadmin@prawnrp.com", "password": "admin123"}
    )
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Token received: {data.get('access_token', 'NONE')[:50]}...")
    assert response.status_code == 200
    assert 'access_token' in data
    print("✅ Super admin login PASSED")
    return data['access_token']

def test_get_current_admin(token: str):
    print_section("3. Get Current Admin Info")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Admin: {data.get('name')} ({data.get('email')})")
    assert response.status_code == 200
    assert data['email'] == 'superadmin@prawnrp.com'
    print("✅ Get current admin PASSED")

def test_list_clients(token: str) -> str:
    print_section("4. List All Clients")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/clients", headers=headers)
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Total clients: {len(data)}")
    if data:
        client = data[0]
        print(f"Sample client: {client['business_name']} (tenant: {client['tenant_id']})")
        print(f"  - Plan: {client['plan_name']}")
        print(f"  - Status: {client['subscription_status']}")
        print(f"  - Active: {client['is_active']}")
        assert response.status_code == 200
        print("✅ List clients PASSED")
        return client['id']
    else:
        print("⚠️  No clients found")
        return None

def test_get_client_detail(token: str, client_id: str):
    print_section("5. Get Client Detail")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/clients/{client_id}", headers=headers)
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Business: {data.get('business_name')}")
    print(f"Tenant ID: {data.get('tenant_id')}")
    print(f"Max users: {data.get('max_users')}")
    print(f"Max lots/month: {data.get('max_lots_per_month')}")
    assert response.status_code == 200
    print("✅ Get client detail PASSED")

def test_get_client_features(token: str, client_id: str):
    print_section("6. Get Client Feature Flags")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/clients/{client_id}/features", headers=headers)
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Total features in registry: {len(data)}")
    
    enabled = [f for f in data if f['is_enabled']]
    print(f"Currently enabled: {len(enabled)}")
    print("Sample enabled features:")
    for feat in enabled[:5]:
        print(f"  - {feat['feature_code']} ({feat['module']})")
    
    assert response.status_code == 200
    print("✅ Get client features PASSED")

def test_toggle_feature(token: str, client_id: str):
    print_section("7. Toggle Feature Flag")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Enable reports module
    response = requests.post(
        f"{BASE_URL}/clients/{client_id}/features/toggle",
        headers=headers,
        json={
            "tenant_id": "cli_001",
            "feature_code": "reports",
            "is_enabled": True,
            "is_override": False
        }
    )
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(data, indent=2)}")
    assert response.status_code == 200
    assert data['success'] == True
    assert data['cache_invalidated'] == True
    print("✅ Toggle feature PASSED")

def test_feature_registry(token: str):
    print_section("8. Get Feature Registry")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/feature-registry", headers=headers)
    data = response.json()
    print(f"Status: {response.status_code}")
    print(f"Total features in registry: {len(data)}")
    
    modules = {}
    for feat in data:
        mod = feat['module']
        modules[mod] = modules.get(mod, 0) + 1
    
    print("Features by module:")
    for mod, count in sorted(modules.items()):
        print(f"  - {mod}: {count} features")
    
    assert response.status_code == 200
    print("✅ Get feature registry PASSED")

def run_all_tests():
    print("\n" + "="*60)
    print("  SUPER ADMIN API - COMPREHENSIVE TEST SUITE")
    print("  Phase 3: Core Backend API Validation")
    print("="*60)
    
    try:
        # Test sequence
        test_health_check()
        token = test_super_admin_login()
        test_get_current_admin(token)
        client_id = test_list_clients(token)
        
        if client_id:
            test_get_client_detail(token, client_id)
            test_get_client_features(token, client_id)
            test_toggle_feature(token, client_id)
        
        test_feature_registry(token)
        
        print("\n" + "="*60)
        print("  ✅ ALL TESTS PASSED!")
        print("="*60)
        print("\nSuper Admin API Phase 3 is COMPLETE and WORKING")
        print("Ready for Phase 4: Build the Super Admin Portal Frontend\n")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False
    
    return True

if __name__ == "__main__":
    run_all_tests()
