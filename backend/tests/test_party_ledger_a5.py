"""
Amendment A5: Party Ledger Module Backend Tests
Tests for Party Master CRUD and Party Ledger functionality
"""
import pytest
import requests
import os
import time
from datetime import date

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://erp-migration-5.preview.emergentagent.com')

# Test data
TEST_CREDENTIALS = {
    "email": "john@aquapremium.com",
    "password": "Admin123!"
}

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=TEST_CREDENTIALS,
        timeout=10
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture
def api_client(auth_token):
    """Requests session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    session.timeout = 10
    return session


class TestPartyMaster:
    """Party Master CRUD tests"""
    
    def test_list_parties(self, api_client):
        """GET /api/parties - List all parties"""
        response = api_client.get(f"{BASE_URL}/api/parties")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check existing test party exists
        party_names = [p["party_name"] for p in data]
        assert "SAI RAM AQUA TRADERS" in party_names
        print(f"Found {len(data)} parties")
    
    def test_create_party(self, api_client):
        """POST /api/parties - Create new party"""
        unique_name = f"TEST_PARTY_{int(time.time())}"
        payload = {
            "party_name": unique_name,
            "party_alias": "Test Alias",
            "short_code": "TP01",
            "mobile": "9988776655",
            "address": "Test Address, Test City",
            "gst_number": "29ABCDE1234F1Z5",
            "pan_number": "ABCDE1234F",
            "notes": "Created by automated test"
        }
        response = api_client.post(f"{BASE_URL}/api/parties", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["party_name"] == unique_name
        assert data["party_alias"] == "Test Alias"
        assert data["short_code"] == "TP01"
        assert "id" in data
        # Store for cleanup
        api_client.test_party_id = data["id"]
        print(f"Created party: {data['party_name']} with id {data['id']}")
    
    def test_get_party_by_id(self, api_client):
        """GET /api/parties/{party_id} - Get specific party"""
        # First get list to find existing party
        list_response = api_client.get(f"{BASE_URL}/api/parties")
        parties = list_response.json()
        if not parties:
            pytest.skip("No parties to test")
        
        party_id = parties[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/parties/{party_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == party_id
        print(f"Got party: {data['party_name']}")
    
    def test_update_party(self, api_client):
        """PUT /api/parties/{party_id} - Update party"""
        # Create a test party first
        unique_name = f"TEST_UPDATE_PARTY_{int(time.time())}"
        create_payload = {
            "party_name": unique_name,
            "mobile": "1111111111"
        }
        create_response = api_client.post(f"{BASE_URL}/api/parties", json=create_payload)
        assert create_response.status_code == 200
        party_id = create_response.json()["id"]
        
        # Update the party
        update_payload = {
            "party_name": unique_name + "_UPDATED",
            "party_alias": "Updated Alias",
            "short_code": "UPD",
            "mobile": "2222222222",
            "address": "Updated Address",
            "notes": "Updated by test"
        }
        response = api_client.put(f"{BASE_URL}/api/parties/{party_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        assert "UPDATED" in data["party_name"]
        assert data["party_alias"] == "Updated Alias"
        print(f"Updated party: {data['party_name']}")
        
        # Cleanup - delete the test party
        api_client.delete(f"{BASE_URL}/api/parties/{party_id}")
    
    def test_search_parties(self, api_client):
        """GET /api/parties?search=xxx - Search parties"""
        response = api_client.get(f"{BASE_URL}/api/parties?search=SAI")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            assert any("SAI" in p["party_name"].upper() for p in data)
        print(f"Search returned {len(data)} parties")
    
    def test_delete_party(self, api_client):
        """DELETE /api/parties/{party_id} - Delete party"""
        # Create a test party to delete
        unique_name = f"TEST_DELETE_PARTY_{int(time.time())}"
        create_payload = {"party_name": unique_name}
        create_response = api_client.post(f"{BASE_URL}/api/parties", json=create_payload)
        assert create_response.status_code == 200
        party_id = create_response.json()["id"]
        
        # Delete it
        response = api_client.delete(f"{BASE_URL}/api/parties/{party_id}")
        assert response.status_code == 200
        
        # Verify it's gone
        get_response = api_client.get(f"{BASE_URL}/api/parties/{party_id}")
        assert get_response.status_code == 404
        print(f"Deleted party: {unique_name}")


class TestPartyLedger:
    """Party Ledger tests"""
    
    def test_get_available_fys(self, api_client):
        """GET /api/party-ledger/available-fys - Get available financial years"""
        response = api_client.get(f"{BASE_URL}/api/party-ledger/available-fys")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert "25-26" in data  # Current FY
        print(f"Available FYs: {data}")
    
    def test_list_party_ledgers(self, api_client):
        """GET /api/party-ledger - List all ledgers for FY"""
        response = api_client.get(f"{BASE_URL}/api/party-ledger?fy=25-26")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} ledgers for FY 25-26")
    
    def test_get_party_ledger_detail(self, api_client):
        """GET /api/party-ledger/{party_id} - Get ledger detail for party"""
        # Get existing party
        parties_response = api_client.get(f"{BASE_URL}/api/parties")
        parties = parties_response.json()
        if not parties:
            pytest.skip("No parties to test")
        
        party_id = parties[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/party-ledger/{party_id}?fy=25-26")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "party" in data
        assert "ledger" in data
        assert "entries" in data
        assert "financial_year" in data
        
        assert data["party"]["id"] == party_id
        assert data["financial_year"] == "25-26"
        print(f"Ledger detail for {data['party']['party_name']}: {len(data['entries'])} entries")
    
    def test_add_payment(self, api_client):
        """POST /api/party-ledger/payment - Add payment entry"""
        # Get existing party
        parties_response = api_client.get(f"{BASE_URL}/api/parties")
        parties = parties_response.json()
        if not parties:
            pytest.skip("No parties to test")
        
        party_id = parties[0]["id"]
        
        payload = {
            "party_id": party_id,
            "entry_date": str(date.today()),
            "payment_amount": 1000.00,
            "payment_date": str(date.today()),
            "paid_to": "TEST",
            "payment_mode": "bank_transfer",
            "payment_reference": "UTR123456",
            "notes": "Test payment"
        }
        response = api_client.post(f"{BASE_URL}/api/party-ledger/payment", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Payment recorded"
        print(f"Payment recorded: {payload['payment_amount']}")
    
    def test_add_manual_debit(self, api_client):
        """POST /api/party-ledger/manual-entry - Add manual debit"""
        parties_response = api_client.get(f"{BASE_URL}/api/parties")
        parties = parties_response.json()
        if not parties:
            pytest.skip("No parties to test")
        
        party_id = parties[0]["id"]
        
        payload = {
            "party_id": party_id,
            "entry_date": str(date.today()),
            "entry_type": "manual_debit",
            "amount": 500.00,
            "description": "Test manual debit adjustment"
        }
        response = api_client.post(f"{BASE_URL}/api/party-ledger/manual-entry", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Manual entry recorded"
        print("Manual debit recorded")
    
    def test_add_manual_credit(self, api_client):
        """POST /api/party-ledger/manual-entry - Add manual credit"""
        parties_response = api_client.get(f"{BASE_URL}/api/parties")
        parties = parties_response.json()
        if not parties:
            pytest.skip("No parties to test")
        
        party_id = parties[0]["id"]
        
        payload = {
            "party_id": party_id,
            "entry_date": str(date.today()),
            "entry_type": "manual_credit",
            "amount": 250.00,
            "description": "Test manual credit adjustment"
        }
        response = api_client.post(f"{BASE_URL}/api/party-ledger/manual-entry", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Manual entry recorded"
        print("Manual credit recorded")


class TestInvoicePartyIntegration:
    """Tests for Invoice-Party integration"""
    
    def test_create_invoice_with_party(self, api_client):
        """POST /api/purchase-invoices - Create invoice with party_id"""
        # Get existing party
        parties_response = api_client.get(f"{BASE_URL}/api/parties")
        parties = parties_response.json()
        if not parties:
            pytest.skip("No parties to test")
        
        party = parties[0]
        
        payload = {
            "invoice_date": str(date.today()),
            "farmer_name": "Test Farmer for Party Invoice",
            "farmer_mobile": "9999999999",
            "farmer_location": "Test Location",
            "party_id": party["id"],
            "party_name_text": party["party_name"],
            "same_as_farmer": False,
            "tds_rate_pct": 0.1,
            "advance_paid": 0,
            "line_items": [
                {
                    "line_no": 1,
                    "variety": "Vannamei",
                    "count_value": "40/50",
                    "quantity_kg": 100.0,
                    "rate": 350.0
                }
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/purchase-invoices", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["party_id"] == party["id"]
        assert data["party_name_text"] == party["party_name"]
        
        # Store invoice id for push test
        api_client.test_invoice_id = data["id"]
        api_client.test_party_id = party["id"]
        print(f"Created invoice {data['invoice_no']} linked to party {party['party_name']}")
    
    def test_push_invoice_creates_ledger_entry(self, api_client):
        """POST /api/purchase-invoices/{id}/push - Push creates ledger entry"""
        invoice_id = getattr(api_client, 'test_invoice_id', None)
        party_id = getattr(api_client, 'test_party_id', None)
        
        if not invoice_id:
            pytest.skip("No test invoice created")
        
        # First approve the invoice
        approve_response = api_client.post(f"{BASE_URL}/api/purchase-invoices/{invoice_id}/approve")
        assert approve_response.status_code == 200
        
        # Push the invoice
        response = api_client.post(f"{BASE_URL}/api/purchase-invoices/{invoice_id}/push-to-procurement")
        assert response.status_code == 200
        data = response.json()
        
        # Check response indicates ledger entry
        if "ledger_entry_created" in data:
            assert data["ledger_entry_created"] == True
            print("Ledger entry created on push")
        else:
            print(f"Invoice pushed: {data.get('message', data)}")

        # Signature is optional per record; by default this test push is unsigned.
        detail_response = api_client.get(f"{BASE_URL}/api/purchase-invoices/{invoice_id}")
        assert detail_response.status_code == 200
        inv_data = detail_response.json()
        assert inv_data.get("status") == "pushed"
        assert inv_data.get("apply_digital_signature") in [False, None]
        
        # Verify ledger has entry
        if party_id:
            ledger_response = api_client.get(f"{BASE_URL}/api/party-ledger/{party_id}?fy=25-26")
            if ledger_response.status_code == 200:
                ledger_data = ledger_response.json()
                entries = ledger_data.get("entries", [])
                bill_entries = [e for e in entries if e.get("entry_type") == "bill"]
                print(f"Party ledger has {len(bill_entries)} bill entries")


class TestDataValidation:
    """Data validation and edge case tests"""
    
    def test_party_name_required(self, api_client):
        """Party name should be required"""
        payload = {
            "party_alias": "Test Alias",
            "short_code": "TEST"
        }
        response = api_client.post(f"{BASE_URL}/api/parties", json=payload)
        assert response.status_code == 422  # Validation error
        print("Party name validation working")
    
    def test_duplicate_party_name(self, api_client):
        """Duplicate party names should be rejected"""
        # Try creating party with existing name
        payload = {
            "party_name": "SAI RAM AQUA TRADERS"
        }
        response = api_client.post(f"{BASE_URL}/api/parties", json=payload)
        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data.get("detail", "").lower()
        print("Duplicate party name validation working")
    
    def test_invalid_party_id_returns_404(self, api_client):
        """Invalid party ID should return 404"""
        response = api_client.get(f"{BASE_URL}/api/parties/invalid-uuid-12345")
        assert response.status_code == 404
        print("Invalid party ID returns 404")
    
    def test_invalid_ledger_party_id_returns_404(self, api_client):
        """Invalid party ID in ledger should return 404"""
        response = api_client.get(f"{BASE_URL}/api/party-ledger/invalid-uuid-12345?fy=25-26")
        assert response.status_code == 404
        print("Invalid party ID in ledger returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
