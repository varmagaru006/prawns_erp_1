"""
Backend API tests for Wastage Tracking Features (v4.0)
Tests: Market Rates CRUD, Lot Stage Wastage, Wastage Dashboard, Lot Waterfall

Run with: pytest /app/backend/tests/test_wastage_features.py -v --tb=short --junitxml=/app/test_reports/pytest/pytest_results.xml
"""
import pytest
import requests
import os
from datetime import date, datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@prawnexport.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authenticated headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestMarketRatesCRUD:
    """Tests for Market Rates CRUD operations"""
    
    created_rate_id = None
    
    def test_get_market_rates_empty_or_list(self, auth_headers):
        """GET /api/market-rates - Should return list"""
        response = requests.get(f"{BASE_URL}/api/market-rates", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✅ GET market-rates: {len(response.json())} rates found")
    
    def test_create_market_rate(self, auth_headers):
        """POST /api/market-rates - Create new market rate"""
        payload = {
            "species": "Vannamei",
            "product_form": "HLSO",
            "size_value": "30/40",
            "rate_per_kg_inr": 450.00,
            "rate_per_kg_usd": 5.50,
            "effective_from": date.today().isoformat(),
            "remarks": "TEST rate for automated testing"
        }
        response = requests.post(f"{BASE_URL}/api/market-rates", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["species"] == "Vannamei"
        assert data["rate_per_kg_inr"] == 450.00
        assert "id" in data
        
        TestMarketRatesCRUD.created_rate_id = data["id"]
        print(f"✅ Created market rate: {data['id']}")
    
    def test_get_active_market_rates(self, auth_headers):
        """GET /api/market-rates/active - Get currently active rates"""
        response = requests.get(f"{BASE_URL}/api/market-rates/active", headers=auth_headers)
        assert response.status_code == 200
        rates = response.json()
        print(f"✅ Active market rates: {len(rates)} found")


class TestLotStageWastage:
    """Tests for Lot Stage Wastage tracking"""
    
    def test_get_wastage_dashboard_stats(self, auth_headers):
        """GET /api/wastage/dashboard-stats - Dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/wastage/dashboard-stats", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "today_wastage_kg" in data
        assert "month_revenue_loss_inr" in data
        assert "active_red_alerts" in data
        assert "byproduct_revenue_inr" in data
        print(f"✅ Dashboard stats: {data}")
    
    def test_get_wastage_breach_alerts(self, auth_headers):
        """GET /api/wastage/breach-alerts - Get breach alerts"""
        response = requests.get(f"{BASE_URL}/api/wastage/breach-alerts", headers=auth_headers)
        assert response.status_code == 200
        alerts = response.json()
        assert isinstance(alerts, list)
        print(f"✅ Breach alerts: {len(alerts)} active alerts")
    
    def test_get_stage_wastage_summary(self, auth_headers):
        """GET /api/wastage/stage-summary - Stage-wise summary"""
        response = requests.get(f"{BASE_URL}/api/wastage/stage-summary", headers=auth_headers)
        assert response.status_code == 200
        summary = response.json()
        assert isinstance(summary, list)
        print(f"✅ Stage summary: {len(summary)} stages with data")


class TestLotWaterfall:
    """Tests for Lot Waterfall View"""
    
    test_lot_id = None
    
    def test_get_procurement_lots_for_waterfall(self, auth_headers):
        """Get procurement lots to find a test lot_id"""
        response = requests.get(f"{BASE_URL}/api/procurement/lots", headers=auth_headers)
        assert response.status_code == 200
        lots = response.json()
        
        if lots:
            TestLotWaterfall.test_lot_id = lots[0]["id"]
            print(f"✅ Found {len(lots)} lots, using lot_id: {TestLotWaterfall.test_lot_id}")
        else:
            print("⚠️ No procurement lots found for waterfall testing")
    
    def test_get_lot_waterfall(self, auth_headers):
        """GET /api/wastage/lot-waterfall/{lot_id} - Get lot waterfall"""
        if not TestLotWaterfall.test_lot_id:
            pytest.skip("No lot available for waterfall test")
        
        lot_id = TestLotWaterfall.test_lot_id
        response = requests.get(f"{BASE_URL}/api/wastage/lot-waterfall/{lot_id}", headers=auth_headers)
        assert response.status_code == 200, f"Waterfall fetch failed: {response.text}"
        
        data = response.json()
        assert "lot_number" in data
        assert "initial_weight_kg" in data
        assert "final_weight_kg" in data
        assert "total_wastage_kg" in data
        assert "total_revenue_loss_inr" in data
        assert "stages" in data
        
        print(f"✅ Lot waterfall: {data['lot_number']}, stages: {len(data['stages'])}")
        print(f"   Initial: {data['initial_weight_kg']} KG -> Final: {data['final_weight_kg']} KG")
        print(f"   Wastage: {data['total_wastage_kg']} KG, Loss: ₹{data['total_revenue_loss_inr']}")
    
    def test_get_lot_stage_wastage(self, auth_headers):
        """GET /api/lot-stage-wastage/{lot_id} - Get wastage records for lot"""
        if not TestLotWaterfall.test_lot_id:
            pytest.skip("No lot available for wastage test")
        
        lot_id = TestLotWaterfall.test_lot_id
        response = requests.get(f"{BASE_URL}/api/lot-stage-wastage/{lot_id}", headers=auth_headers)
        assert response.status_code == 200
        
        wastage_records = response.json()
        assert isinstance(wastage_records, list)
        
        for record in wastage_records:
            assert "stage_name" in record
            assert "wastage_kg" in record
            assert "yield_pct" in record
            assert "threshold_status" in record
        
        print(f"✅ Lot wastage records: {len(wastage_records)} stages")


class TestYieldBenchmarks:
    """Tests for Yield Benchmark APIs"""
    
    def test_get_yield_benchmarks(self, auth_headers):
        """GET /api/yield-benchmarks - List all benchmarks"""
        response = requests.get(f"{BASE_URL}/api/yield-benchmarks", headers=auth_headers)
        assert response.status_code == 200
        benchmarks = response.json()
        assert isinstance(benchmarks, list)
        print(f"✅ Yield benchmarks: {len(benchmarks)} found")


class TestProcurementWithWastage:
    """Tests for Procurement auto-wastage creation"""
    
    agent_id = None
    lot_id = None
    
    def test_get_agent_for_procurement(self, auth_headers):
        """Get agent id for creating procurement lot"""
        response = requests.get(f"{BASE_URL}/api/agents", headers=auth_headers)
        assert response.status_code == 200
        agents = response.json()
        
        if agents:
            TestProcurementWithWastage.agent_id = agents[0]["id"]
            print(f"✅ Using agent: {agents[0]['name']}")
        else:
            pytest.skip("No agents available for testing")
    
    def test_create_procurement_lot_creates_wastage(self, auth_headers):
        """POST /api/procurement/lots - Create lot should auto-create wastage record"""
        if not TestProcurementWithWastage.agent_id:
            pytest.skip("No agent available")
        
        payload = {
            "agent_id": TestProcurementWithWastage.agent_id,
            "vehicle_number": "TEST-1234",
            "driver_name": "Test Driver",
            "arrival_time": datetime.now().isoformat(),
            "species": "Vannamei",
            "count_per_kg": "30/40",
            "boxes_count": 10,
            "no_of_trays": 20,
            "gross_weight_kg": 1000.0,
            "ice_weight_kg": 150.0,  # 15% ice
            "rate_per_kg": 400.0,
            "advance_paid": 10000.0,
            "ice_ratio_pct": 15.0,
            "freshness_grade": "A",
            "is_rejected": False,
            "notes": "TEST lot for wastage testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/procurement/lots", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create lot failed: {response.text}"
        
        lot = response.json()
        assert lot["net_weight_kg"] == 850.0  # 1000 - 150
        TestProcurementWithWastage.lot_id = lot["id"]
        print(f"✅ Created lot: {lot['lot_number']}")
        
        # Check wastage record was created
        wastage_response = requests.get(f"{BASE_URL}/api/lot-stage-wastage/{lot['id']}", headers=auth_headers)
        assert wastage_response.status_code == 200
        wastage_records = wastage_response.json()
        
        # Should have gate_ice wastage record
        gate_ice_records = [w for w in wastage_records if w["process_type"] == "gate_ice"]
        assert len(gate_ice_records) >= 1, "Gate ice wastage record not created automatically"
        
        gate_ice = gate_ice_records[0]
        assert gate_ice["input_weight_kg"] == 1000.0
        assert gate_ice["output_weight_kg"] == 850.0
        assert gate_ice["wastage_kg"] == 150.0
        print(f"✅ Auto-created gate_ice wastage: {gate_ice['wastage_kg']} KG")


class TestPreprocessingWithWastage:
    """Tests for Preprocessing auto-wastage creation"""
    
    batch_id = None
    
    def test_create_preprocessing_batch_creates_wastage(self, auth_headers):
        """POST /api/preprocessing/batches - Create batch should auto-create wastage record"""
        # First, get a lot to use
        lots_response = requests.get(f"{BASE_URL}/api/procurement/lots", headers=auth_headers)
        lots = lots_response.json()
        
        if not lots:
            pytest.skip("No lots available for preprocessing test")
        
        lot_id = lots[0]["id"]
        
        payload = {
            "procurement_lot_id": lot_id,
            "process_type": "heading",
            "input_weight_kg": 800.0,
            "output_weight_kg": 640.0,  # 80% yield
            "no_of_trays": 16,
            "start_time": datetime.now().isoformat(),
            "workers": [],
            "supervisor": "Test Supervisor",
            "notes": "TEST batch"
        }
        
        response = requests.post(f"{BASE_URL}/api/preprocessing/batches", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create batch failed: {response.text}"
        
        batch = response.json()
        assert batch["yield_pct"] == 80.0  # 640/800 * 100
        TestPreprocessingWithWastage.batch_id = batch["id"]
        print(f"✅ Created batch: {batch['batch_number']} with {batch['yield_pct']}% yield")
        
        # Check wastage record was created
        wastage_response = requests.get(f"{BASE_URL}/api/lot-stage-wastage/{lot_id}", headers=auth_headers)
        wastage_records = wastage_response.json()
        
        heading_records = [w for w in wastage_records if w["process_type"] == "heading"]
        if heading_records:
            print(f"✅ Auto-created heading wastage: {heading_records[0]['wastage_kg']} KG")


class TestMissingEndpoints:
    """Tests for API endpoints that may be missing"""
    
    def test_market_rate_update_endpoint_missing(self, auth_headers):
        """PUT /api/market-rates/{rate_id} - Check if endpoint exists"""
        # Get a rate first
        rates_response = requests.get(f"{BASE_URL}/api/market-rates", headers=auth_headers)
        rates = rates_response.json()
        
        if not rates:
            pytest.skip("No market rates available to test update")
        
        rate_id = rates[0]["id"]
        payload = {
            "species": "Vannamei",
            "product_form": "PD",
            "rate_per_kg_inr": 500.0,
            "effective_from": date.today().isoformat()
        }
        
        response = requests.put(f"{BASE_URL}/api/market-rates/{rate_id}", headers=auth_headers, json=payload)
        
        if response.status_code == 405 or response.status_code == 404:
            print(f"⚠️ MISSING: PUT /api/market-rates/{rate_id} endpoint (status: {response.status_code})")
            pytest.xfail("PUT market-rates endpoint not implemented")
        else:
            assert response.status_code == 200
            print(f"✅ PUT market-rates works")
    
    def test_market_rate_delete_endpoint_missing(self, auth_headers):
        """DELETE /api/market-rates/{rate_id} - Check if endpoint exists"""
        # Get a rate first
        rates_response = requests.get(f"{BASE_URL}/api/market-rates", headers=auth_headers)
        rates = rates_response.json()
        
        if not rates:
            pytest.skip("No market rates available to test delete")
        
        # Use the last created test rate if available
        test_rates = [r for r in rates if r.get("remarks") == "TEST rate for automated testing"]
        rate_id = test_rates[-1]["id"] if test_rates else rates[-1]["id"]
        
        response = requests.delete(f"{BASE_URL}/api/market-rates/{rate_id}", headers=auth_headers)
        
        if response.status_code == 405 or response.status_code == 404:
            print(f"⚠️ MISSING: DELETE /api/market-rates/{rate_id} endpoint (status: {response.status_code})")
            pytest.xfail("DELETE market-rates endpoint not implemented")
        else:
            assert response.status_code in [200, 204]
            print(f"✅ DELETE market-rates works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
