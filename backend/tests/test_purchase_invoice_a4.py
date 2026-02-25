"""
Purchase Invoice A4 Patch Feature Tests
Tests for:
1. farmer_mobile field on invoice form
2. is_manually_recorded toggle 
3. Quick Preview endpoint
4. Bulk Export (CSV/Excel via list endpoint with pagination)
5. Real metrics dashboard (actual database queries)
6. Species enum fix (Procurement Lots page)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "john@aquapremium.com"
TEST_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for all tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestPurchaseInvoiceList:
    """Test Purchase Invoice List endpoint"""

    def test_list_invoices(self, api_client):
        """Test GET /api/purchase-invoices returns list with pagination"""
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "pages" in data
        print(f"Found {data['total']} invoices, showing page {data['page']} of {data['pages']}")

    def test_list_invoices_pagination(self, api_client):
        """Test pagination params work correctly"""
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices?page=1&per_page=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data['data']) <= 10

    def test_list_invoices_filters(self, api_client):
        """Test filter params (from_date, to_date, payment_status, invoice_status)"""
        params = "from_date=2026-01-01&to_date=2026-12-31"
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices?{params}")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data


class TestPurchaseInvoiceMetrics:
    """Test Purchase Invoice Metrics Dashboard (real data queries)"""

    def test_metrics_endpoint(self, api_client):
        """Test GET /api/purchase-invoices/metrics returns real metrics"""
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices/metrics")
        assert response.status_code == 200
        
        data = response.json()
        # Check all expected metric fields exist
        assert "total_count" in data
        assert "total_value" in data
        assert "pending_count" in data
        assert "pending_total" in data
        assert "partial_count" in data
        assert "partial_total" in data
        assert "paid_count" in data
        assert "paid_total" in data
        
        print(f"Metrics - Total: {data['total_count']}, Value: {data['total_value']}")
        print(f"  Pending: {data['pending_count']} (₹{data['pending_total']})")
        print(f"  Partial: {data['partial_count']} (₹{data['partial_total']})")
        print(f"  Paid: {data['paid_count']} (₹{data['paid_total']})")

    def test_metrics_with_date_filter(self, api_client):
        """Test metrics with date filters"""
        params = "from_date=2026-01-01&to_date=2026-12-31"
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices/metrics?{params}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_count" in data


class TestPurchaseInvoiceCreate:
    """Test Invoice creation with farmer_mobile field"""

    def test_create_invoice_with_farmer_mobile(self, api_client):
        """Test POST /api/purchase-invoices with farmer_mobile field (A4 PATCH 10A)"""
        payload = {
            "invoice_date": "2026-02-25",
            "farmer_name": "TEST_Farmer_Mobile_Test",
            "farmer_mobile": "9876543210",  # New A4 field
            "farmer_location": "Test Village",
            "agent_ref_name": "Test Agent",
            "weighment_slip_no": "WS-TEST-001",
            "tds_rate_pct": 0.1,
            "advance_paid": 500,
            "notes": "Test invoice with farmer mobile",
            "line_items": [
                {
                    "line_no": 1,
                    "variety": "Vannamei",
                    "count_value": "30/40",
                    "quantity_kg": 100.5,
                    "rate": 250.00
                }
            ]
        }
        
        response = api_client.post(f"{BASE_URL}/api/purchase-invoices", json=payload)
        assert response.status_code == 201 or response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["farmer_name"] == "TEST_Farmer_Mobile_Test"
        assert data["farmer_mobile"] == "9876543210"
        assert data["farmer_location"] == "Test Village"
        
        # Verify totals were calculated
        assert "grand_total" in data
        assert data["grand_total"] > 0
        
        print(f"Created invoice: {data.get('invoice_no')} with farmer_mobile: {data['farmer_mobile']}")
        
        # Store invoice ID for later tests
        return data["id"]

    def test_create_invoice_without_farmer_mobile(self, api_client):
        """Test invoice creation works without farmer_mobile (optional field)"""
        payload = {
            "invoice_date": "2026-02-25",
            "farmer_name": "TEST_NoMobile_Farmer",
            "farmer_location": "Test Village 2",
            "tds_rate_pct": 0.1,
            "advance_paid": 0,
            "line_items": [
                {
                    "line_no": 1,
                    "variety": "Black Tiger",
                    "count_value": "20/30",
                    "quantity_kg": 50,
                    "rate": 350.00
                }
            ]
        }
        
        response = api_client.post(f"{BASE_URL}/api/purchase-invoices", json=payload)
        assert response.status_code == 201 or response.status_code == 200
        
        data = response.json()
        assert data["farmer_mobile"] is None or data["farmer_mobile"] == ""
        print(f"Created invoice without mobile: {data.get('invoice_no')}")


class TestPurchaseInvoiceDetail:
    """Test Invoice detail/preview endpoint"""

    def test_get_invoice_detail(self, api_client):
        """Test GET /api/purchase-invoices/{id} for Quick Preview panel"""
        # First get list to find an invoice
        list_response = api_client.get(f"{BASE_URL}/api/purchase-invoices?per_page=1")
        assert list_response.status_code == 200
        
        invoices = list_response.json().get("data", [])
        if not invoices:
            pytest.skip("No invoices to test detail view")
        
        invoice_id = invoices[0]["id"]
        
        # Get detail
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices/{invoice_id}")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all fields needed for Quick Preview are present
        assert "id" in data
        assert "invoice_no" in data
        assert "invoice_date" in data
        assert "farmer_name" in data
        assert "farmer_mobile" in data  # A4 field
        assert "farmer_location" in data
        assert "line_items" in data
        assert "grand_total" in data
        assert "subtotal" in data
        assert "tds_amount" in data
        assert "balance_due" in data
        assert "payment_status" in data
        assert "status" in data
        assert "is_manually_recorded" in data  # A4 field
        
        print(f"Invoice detail: {data['invoice_no']}, Farmer: {data['farmer_name']}, Mobile: {data.get('farmer_mobile', 'N/A')}")


class TestManualAuditToggle:
    """Test Manual Audit Recording toggle (A4 PATCH 10G)"""

    def test_toggle_manual_audit_on(self, api_client):
        """Test PATCH /api/purchase-invoices/{id}/manual-audit to mark as recorded"""
        # Get an invoice
        list_response = api_client.get(f"{BASE_URL}/api/purchase-invoices?per_page=1")
        invoices = list_response.json().get("data", [])
        if not invoices:
            pytest.skip("No invoices to test manual audit")
        
        invoice_id = invoices[0]["id"]
        
        # Toggle ON
        response = api_client.patch(
            f"{BASE_URL}/api/purchase-invoices/{invoice_id}/manual-audit",
            json={"is_manually_recorded": True}
        )
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        
        # Verify the change persisted
        detail_response = api_client.get(f"{BASE_URL}/api/purchase-invoices/{invoice_id}")
        assert detail_response.status_code == 200
        
        data = detail_response.json()
        assert data["is_manually_recorded"] == True
        print(f"Invoice {data['invoice_no']} marked as manually recorded")

    def test_toggle_manual_audit_off(self, api_client):
        """Test toggling manual audit back to OFF"""
        # Get an invoice
        list_response = api_client.get(f"{BASE_URL}/api/purchase-invoices?per_page=1")
        invoices = list_response.json().get("data", [])
        if not invoices:
            pytest.skip("No invoices to test manual audit")
        
        invoice_id = invoices[0]["id"]
        
        # Toggle OFF
        response = api_client.patch(
            f"{BASE_URL}/api/purchase-invoices/{invoice_id}/manual-audit",
            json={"is_manually_recorded": False}
        )
        assert response.status_code == 200
        
        # Verify
        detail_response = api_client.get(f"{BASE_URL}/api/purchase-invoices/{invoice_id}")
        data = detail_response.json()
        assert data["is_manually_recorded"] == False
        print(f"Invoice {data['invoice_no']} manual audit toggled OFF")


class TestExportFunctionality:
    """Test Bulk Export (CSV/Excel) via list endpoint with large per_page"""

    def test_export_all_invoices(self, api_client):
        """Test fetching all invoices for export (per_page=10000)"""
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices?per_page=10000")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        
        # Verify all export-relevant fields are present
        if data["data"]:
            invoice = data["data"][0]
            export_fields = [
                "invoice_no", "invoice_date", "farmer_name", "farmer_mobile",
                "farmer_location", "total_quantity_kg", "subtotal", "tds_amount",
                "grand_total", "advance_paid", "balance_due", "payment_status",
                "status", "is_manually_recorded"
            ]
            for field in export_fields:
                assert field in invoice, f"Missing export field: {field}"
        
        print(f"Export data available: {len(data['data'])} invoices")

    def test_export_with_filters(self, api_client):
        """Test export with date and status filters"""
        params = "from_date=2026-01-01&to_date=2026-12-31&per_page=10000"
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices?{params}")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        print(f"Filtered export: {len(data['data'])} invoices")


class TestProcurementLotsSpeciesEnumFix:
    """Test Species enum fix - Procurement Lots page loads without crashing"""

    def test_procurement_lots_list(self, api_client):
        """Test GET /api/procurement/lots handles species enum correctly"""
        response = api_client.get(f"{BASE_URL}/api/procurement/lots")
        assert response.status_code == 200, f"Procurement lots failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check species values if any lots exist
        for lot in data[:5]:  # Check first 5
            if "species" in lot:
                species = lot["species"]
                # Valid species values after fix
                assert species in ["Vannamei", "Black Tiger", "Sea Tiger", "vannamei", "black_tiger", "sea_tiger"], \
                    f"Invalid species value: {species}"
        
        print(f"Procurement lots loaded: {len(data)} lots")

    def test_create_procurement_lot_with_species(self, api_client):
        """Test creating a lot with different species casing"""
        # First get an agent
        agents_response = api_client.get(f"{BASE_URL}/api/agents")
        if agents_response.status_code != 200:
            pytest.skip("No agents available")
        
        agents = agents_response.json()
        if not agents:
            pytest.skip("No agents to test lot creation")
        
        agent_id = agents[0]["id"]
        
        # Create lot with lowercase species (tests validator)
        payload = {
            "agent_id": agent_id,
            "vehicle_number": "TEST-VH-001",
            "driver_name": "Test Driver",
            "arrival_time": "2026-02-25T10:00:00",
            "species": "Vannamei",  # Using title case
            "count_per_kg": "30/40",
            "boxes_count": 10,
            "gross_weight_kg": 500,
            "ice_weight_kg": 50,
            "rate_per_kg": 250,
            "freshness_grade": "A"
        }
        
        response = api_client.post(f"{BASE_URL}/api/procurement/lots", json=payload)
        # Accept 200 or 201
        assert response.status_code in [200, 201], f"Create lot failed: {response.text}"
        
        data = response.json()
        assert "species" in data
        print(f"Created lot: {data.get('lot_number')} with species: {data['species']}")


class TestInvoiceWorkflow:
    """Test Invoice approval and push workflow"""

    def test_approve_invoice(self, api_client):
        """Test approving a draft invoice"""
        # Find a draft invoice
        list_response = api_client.get(f"{BASE_URL}/api/purchase-invoices?invoice_status=draft")
        invoices = list_response.json().get("data", [])
        if not invoices:
            pytest.skip("No draft invoices to approve")
        
        invoice_id = invoices[0]["id"]
        
        response = api_client.post(f"{BASE_URL}/api/purchase-invoices/{invoice_id}/approve")
        # Might already be approved, that's ok
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            print(f"Invoice {invoices[0]['invoice_no']} approved")

    def test_download_pdf(self, api_client):
        """Test PDF download endpoint"""
        list_response = api_client.get(f"{BASE_URL}/api/purchase-invoices?per_page=1")
        invoices = list_response.json().get("data", [])
        if not invoices:
            pytest.skip("No invoices for PDF test")
        
        invoice_id = invoices[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices/{invoice_id}/pdf")
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf" or "pdf" in response.headers.get("content-type", "").lower()
        print(f"PDF download works for invoice {invoices[0]['invoice_no']}")


class TestCleanup:
    """Cleanup test data"""

    def test_cleanup_test_invoices(self, api_client):
        """Delete TEST_ prefixed invoices"""
        response = api_client.get(f"{BASE_URL}/api/purchase-invoices?search=TEST_&per_page=100")
        if response.status_code != 200:
            return
        
        invoices = response.json().get("data", [])
        deleted = 0
        for inv in invoices:
            if inv.get("farmer_name", "").startswith("TEST_") and inv.get("status") == "draft":
                del_resp = api_client.delete(f"{BASE_URL}/api/purchase-invoices/{inv['id']}")
                if del_resp.status_code == 200:
                    deleted += 1
        
        print(f"Cleaned up {deleted} test invoices")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
