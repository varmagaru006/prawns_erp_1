import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any

class PrawnERPTester:
    def __init__(self, base_url="https://aqua-purchase-module.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {
            'agents': [],
            'lots': [], 
            'batches': [],
            'orders': [],
            'finished_goods': []
        }
        print(f"Testing ERP system at: {base_url}")

    def get_headers(self, auth_required=True):
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = self.get_headers(auth_required)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"   ✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            return False, {}

    # Authentication Tests
    def test_register(self):
        """Test user registration"""
        test_user_data = {
            "email": f"test_user_{datetime.now().strftime('%H%M%S')}@prawnexport.com",
            "password": "TestPass123!",
            "name": "Test User",
            "role": "worker",
            "phone": "9876543210"
        }
        success, response = self.run_test(
            "User Registration", "POST", "auth/register", 200, 
            test_user_data, auth_required=False
        )
        if success:
            print(f"   📝 Registered user: {response.get('email')}")
        return success, test_user_data

    def test_login(self, credentials=None):
        """Test login with existing or provided credentials"""
        if not credentials:
            # Use the sample admin user mentioned in the context
            credentials = {
                "email": "admin@prawnexport.com",
                "password": "admin123"
            }
        
        success, response = self.run_test(
            "User Login", "POST", "auth/login", 200, 
            credentials, auth_required=False
        )
        
        if success and response.get('access_token'):
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   🔑 Token acquired for user: {response['user']['email']}")
            print(f"   👤 User role: {response['user']['role']}")
            return True
        return False

    def test_get_me(self):
        """Test getting current user info"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)[0]

    # Agent Tests
    def test_create_agent(self):
        """Test creating a new agent"""
        agent_data = {
            "agent_code": f"AG{datetime.now().strftime('%H%M%S')}",
            "name": "Test Agent Kumar",
            "phone": "9876543210",
            "gst": "27AAAAA0000A1Z5",
            "pan": "AAAPL1234C",
            "commission_pct": 2.5,
            "bank_name": "HDFC Bank",
            "account_number": "50100123456789",
            "ifsc": "HDFC0001234"
        }
        success, response = self.run_test(
            "Create Agent", "POST", "agents", 200, agent_data
        )
        if success and response.get('id'):
            self.created_ids['agents'].append(response['id'])
            print(f"   👨‍💼 Created agent: {response.get('name')} ({response.get('agent_code')})")
        return success, response

    def test_get_agents(self):
        """Test getting all agents"""
        return self.run_test("Get Agents", "GET", "agents", 200)

    def test_get_agent_by_id(self, agent_id):
        """Test getting agent by ID"""
        return self.run_test("Get Agent by ID", "GET", f"agents/{agent_id}", 200)

    # Procurement Tests
    def test_create_procurement_lot(self, agent_id):
        """Test creating procurement lot"""
        lot_data = {
            "agent_id": agent_id,
            "vehicle_number": "KA01AB1234",
            "driver_name": "Ravi Kumar",
            "arrival_time": datetime.now(timezone.utc).isoformat(),
            "species": "Vannamei",
            "count_per_kg": "30/40",
            "boxes_count": 50,
            "gross_weight_kg": 1500.0,
            "ice_weight_kg": 200.0,
            "rate_per_kg": 450.0,
            "advance_paid": 200000.0,
            "ice_ratio_pct": 13.33,
            "freshness_grade": "A",
            "is_rejected": False,
            "notes": "Premium quality prawns"
        }
        success, response = self.run_test(
            "Create Procurement Lot", "POST", "procurement/lots", 200, lot_data
        )
        if success and response.get('id'):
            self.created_ids['lots'].append(response['id'])
            print(f"   📦 Created lot: {response.get('lot_number')}")
            print(f"   💰 Total amount: ₹{response.get('total_amount')}")
            print(f"   ⚖️ Net weight: {response.get('net_weight_kg')} KG")
        return success, response

    def test_get_procurement_lots(self):
        """Test getting all procurement lots"""
        return self.run_test("Get Procurement Lots", "GET", "procurement/lots", 200)

    def test_download_receipt(self, lot_id):
        """Test PDF receipt generation"""
        success, _ = self.run_test("Download Receipt", "GET", f"procurement/lots/{lot_id}/receipt", 200)
        return success

    # Preprocessing Tests  
    def test_create_preprocessing_batch(self, lot_id):
        """Test creating preprocessing batch"""
        batch_data = {
            "procurement_lot_id": lot_id,
            "process_type": "heading",
            "input_weight_kg": 1300.0,
            "output_weight_kg": 1100.0,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": (datetime.now(timezone.utc)).isoformat(),
            "workers": [
                {
                    "worker_code": "W001", 
                    "name": "Raj Kumar",
                    "kg_processed": 550.0,
                    "hours_worked": 8.0
                },
                {
                    "worker_code": "W002",
                    "name": "Sita Devi", 
                    "kg_processed": 550.0,
                    "hours_worked": 8.0
                }
            ],
            "supervisor": "Prakash Singh",
            "notes": "Standard heading process"
        }
        success, response = self.run_test(
            "Create Preprocessing Batch", "POST", "preprocessing/batches", 200, batch_data
        )
        if success and response.get('id'):
            self.created_ids['batches'].append(response['id'])
            print(f"   🔄 Created batch: {response.get('batch_number')}")
            print(f"   📊 Yield: {response.get('yield_pct'):.2f}%")
            if response.get('yield_alert'):
                print(f"   ⚠️ Yield alert triggered")
        return success, response

    def test_get_preprocessing_batches(self):
        """Test getting all preprocessing batches"""
        return self.run_test("Get Preprocessing Batches", "GET", "preprocessing/batches", 200)

    # Production Tests
    def test_create_production_order(self, batch_ids):
        """Test creating production order"""
        order_data = {
            "preprocessing_batch_ids": batch_ids,
            "product_form": "HLSO",
            "target_size_count": "30/40",
            "glazing_pct": 10.0,
            "block_weight_kg": 10.0,
            "no_of_blocks": 100,
            "input_weight_kg": 1100.0,
            "output_weight_kg": 1050.0,
            "notes": "Export quality production"
        }
        success, response = self.run_test(
            "Create Production Order", "POST", "production/orders", 200, order_data
        )
        if success and response.get('id'):
            self.created_ids['orders'].append(response['id'])
            print(f"   🏭 Created order: {response.get('order_number')}")
            print(f"   📈 Conversion rate: {response.get('conversion_rate_pct'):.2f}%")
        return success, response

    def test_get_production_orders(self):
        """Test getting all production orders"""
        return self.run_test("Get Production Orders", "GET", "production/orders", 200)

    # Finished Goods Tests
    def test_create_finished_good(self, order_id):
        """Test creating finished good"""
        fg_data = {
            "production_order_id": order_id,
            "product_form": "HLSO",
            "size_count": "30/40",
            "weight_kg": 1050.0,
            "storage_location": "Cold Room A-1",
            "temperature_c": -18.5,
            "expiry_date": "2026-08-21"
        }
        success, response = self.run_test(
            "Create Finished Good", "POST", "finished-goods", 200, fg_data
        )
        if success and response.get('id'):
            self.created_ids['finished_goods'].append(response['id'])
            print(f"   📋 Created FG: {response.get('fg_code')}")
        return success, response

    def test_get_finished_goods(self):
        """Test getting all finished goods"""
        return self.run_test("Get Finished Goods", "GET", "finished-goods", 200)

    # Dashboard Tests
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)
        if success:
            print(f"   📊 Procurement lots: {response.get('total_procurement_lots', 0)}")
            print(f"   ⚖️ Total weight: {response.get('total_weight_procured_kg', 0):.2f} KG")
            print(f"   💰 Total value: ₹{response.get('total_procurement_value', 0):,.2f}")
            print(f"   📦 FG inventory: {response.get('finished_goods_inventory_kg', 0):.2f} KG")
        return success

    # Notification Tests
    def test_create_notification(self):
        """Test creating notification"""
        notif_data = {
            "title": "Test Notification",
            "message": "This is a test notification for system validation",
            "module": "system",
            "target_roles": ["admin", "worker"]
        }
        return self.run_test("Create Notification", "POST", "notifications", 200, notif_data)

    def test_get_notifications(self):
        """Test getting notifications"""
        return self.run_test("Get Notifications", "GET", "notifications", 200)

    def run_comprehensive_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Prawn ERP System API Testing")
        print("=" * 60)
        
        # Test authentication first
        print("\n📋 AUTHENTICATION TESTS")
        print("-" * 30)
        
        # Try login with existing admin user
        if not self.test_login():
            print("❌ Login with existing admin failed, trying registration...")
            # If login fails, try registration
            reg_success, user_data = self.test_register()
            if reg_success:
                # Login with newly registered user
                login_creds = {
                    "email": user_data["email"],
                    "password": user_data["password"]
                }
                if not self.test_login(login_creds):
                    print("❌ Critical: Cannot authenticate user")
                    return False
            else:
                print("❌ Critical: Cannot register or login user")
                return False
                
        # Test protected endpoint
        self.test_get_me()

        # Test Agents Module
        print("\n👨‍💼 AGENTS TESTS")
        print("-" * 30)
        agent_success, agent_data = self.test_create_agent()
        self.test_get_agents()
        
        agent_id = None
        if agent_success and agent_data.get('id'):
            agent_id = agent_data['id']
            self.test_get_agent_by_id(agent_id)
        else:
            # Try to get existing agents
            success, agents_response = self.test_get_agents()
            if success and isinstance(agents_response, list) and len(agents_response) > 0:
                agent_id = agents_response[0].get('id')
                print(f"   📝 Using existing agent ID: {agent_id}")

        if not agent_id:
            print("❌ Critical: No agent available for testing")
            return False

        # Test Procurement Module
        print("\n📦 PROCUREMENT TESTS")
        print("-" * 30)
        lot_success, lot_data = self.test_create_procurement_lot(agent_id)
        self.test_get_procurement_lots()
        
        lot_id = None
        if lot_success and lot_data.get('id'):
            lot_id = lot_data['id']
            self.test_download_receipt(lot_id)
        else:
            # Try to get existing lots
            success, lots_response = self.test_get_procurement_lots()
            if success and isinstance(lots_response, list) and len(lots_response) > 0:
                lot_id = lots_response[0].get('id')
                print(f"   📝 Using existing lot ID: {lot_id}")

        # Test Preprocessing Module
        print("\n🔄 PREPROCESSING TESTS")
        print("-" * 30)
        batch_success, batch_data = self.test_create_preprocessing_batch(lot_id) if lot_id else (False, {})
        self.test_get_preprocessing_batches()
        
        batch_id = None
        if batch_success and batch_data.get('id'):
            batch_id = batch_data['id']
        else:
            # Try to get existing batches
            success, batches_response = self.test_get_preprocessing_batches()
            if success and isinstance(batches_response, list) and len(batches_response) > 0:
                batch_id = batches_response[0].get('id')
                print(f"   📝 Using existing batch ID: {batch_id}")

        # Test Production Module
        print("\n🏭 PRODUCTION TESTS")
        print("-" * 30)
        order_success, order_data = (False, {})
        if batch_id:
            order_success, order_data = self.test_create_production_order([batch_id])
        self.test_get_production_orders()
        
        order_id = None
        if order_success and order_data.get('id'):
            order_id = order_data['id']
        else:
            # Try to get existing orders
            success, orders_response = self.test_get_production_orders()
            if success and isinstance(orders_response, list) and len(orders_response) > 0:
                order_id = orders_response[0].get('id')
                print(f"   📝 Using existing order ID: {order_id}")

        # Test Finished Goods Module
        print("\n📋 FINISHED GOODS TESTS")
        print("-" * 30)
        if order_id:
            self.test_create_finished_good(order_id)
        self.test_get_finished_goods()

        # Test Dashboard
        print("\n📊 DASHBOARD TESTS")
        print("-" * 30)
        self.test_dashboard_stats()

        # Test Notifications
        print("\n🔔 NOTIFICATION TESTS")
        print("-" * 30)
        self.test_create_notification()
        self.test_get_notifications()

        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"✨ Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.created_ids['agents']:
            print(f"👨‍💼 Created agents: {len(self.created_ids['agents'])}")
        if self.created_ids['lots']:
            print(f"📦 Created lots: {len(self.created_ids['lots'])}")
        if self.created_ids['batches']:
            print(f"🔄 Created batches: {len(self.created_ids['batches'])}")
        if self.created_ids['orders']:
            print(f"🏭 Created orders: {len(self.created_ids['orders'])}")
        if self.created_ids['finished_goods']:
            print(f"📋 Created finished goods: {len(self.created_ids['finished_goods'])}")
            
        return self.tests_passed >= (self.tests_run * 0.8)  # 80% pass rate

def main():
    tester = PrawnERPTester()
    success = tester.run_comprehensive_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())