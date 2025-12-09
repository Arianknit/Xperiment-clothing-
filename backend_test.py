#!/usr/bin/env python3
"""
Backend Testing Suite for Garment Manufacturing App - Ironing Unit Feature
Tests all ironing-related endpoints and dashboard integration
"""

import requests
import json
from datetime import datetime, timezone
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://garment-tracker-20.preview.emergentagent.com/api"

class IroningUnitTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.created_resources = []  # Track created resources for cleanup
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
        if response_data:
            result['response_data'] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   {message}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def test_dashboard_stats(self):
        """Test dashboard stats include ironing data"""
        try:
            response = requests.get(f"{self.base_url}/dashboard/stats")
            
            if response.status_code != 200:
                self.log_result("Dashboard Stats", False, 
                              f"Failed to get dashboard stats. Status: {response.status_code}", 
                              response.text)
                return False
                
            data = response.json()
            
            # Check if ironing-related fields are present
            expected_fields = [
                'total_ironing_orders', 'total_ironing_cost', 
                'total_ironing_shortage_debit', 'comprehensive_total'
            ]
            
            missing_fields = []
            for field in expected_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result("Dashboard Stats", False, 
                              f"Missing ironing fields in dashboard: {missing_fields}", data)
                return False
            
            self.log_result("Dashboard Stats", True, 
                          f"Dashboard includes ironing data. Total ironing orders: {data.get('total_ironing_orders', 0)}, "
                          f"Total ironing cost: ₹{data.get('total_ironing_cost', 0)}")
            return True
            
        except Exception as e:
            self.log_result("Dashboard Stats", False, f"Exception occurred: {str(e)}")
            return False

    def test_get_ironing_orders(self):
        """Test getting all ironing orders"""
        try:
            response = requests.get(f"{self.base_url}/ironing-orders")
            
            if response.status_code != 200:
                self.log_result("Get Ironing Orders", False, 
                              f"Failed to get ironing orders. Status: {response.status_code}", 
                              response.text)
                return False, []
                
            orders = response.json()
            
            if not isinstance(orders, list):
                self.log_result("Get Ironing Orders", False, 
                              "Response is not a list", orders)
                return False, []
            
            self.log_result("Get Ironing Orders", True, 
                          f"Successfully retrieved {len(orders)} ironing orders")
            return True, orders
            
        except Exception as e:
            self.log_result("Get Ironing Orders", False, f"Exception occurred: {str(e)}")
            return False, []

    def test_get_ironing_receipts(self):
        """Test getting all ironing receipts"""
        try:
            response = requests.get(f"{self.base_url}/ironing-receipts")
            
            if response.status_code != 200:
                self.log_result("Get Ironing Receipts", False, 
                              f"Failed to get ironing receipts. Status: {response.status_code}", 
                              response.text)
                return False, []
                
            receipts = response.json()
            
            if not isinstance(receipts, list):
                self.log_result("Get Ironing Receipts", False, 
                              "Response is not a list", receipts)
                return False, []
            
            self.log_result("Get Ironing Receipts", True, 
                          f"Successfully retrieved {len(receipts)} ironing receipts")
            return True, receipts
            
        except Exception as e:
            self.log_result("Get Ironing Receipts", False, f"Exception occurred: {str(e)}")
            return False, []

    def test_get_specific_ironing_order(self, order_id):
        """Test getting a specific ironing order"""
        try:
            response = requests.get(f"{self.base_url}/ironing-orders/{order_id}")
            
            if response.status_code == 404:
                self.log_result("Get Specific Ironing Order", False, 
                              f"Ironing order {order_id} not found")
                return False, None
            elif response.status_code != 200:
                self.log_result("Get Specific Ironing Order", False, 
                              f"Failed to get ironing order. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            order = response.json()
            
            # Validate required fields
            required_fields = ['id', 'dc_number', 'unit_name', 'size_distribution', 
                             'total_amount', 'payment_status', 'status']
            missing_fields = [field for field in required_fields if field not in order]
            
            if missing_fields:
                self.log_result("Get Specific Ironing Order", False, 
                              f"Missing required fields: {missing_fields}", order)
                return False, None
            
            self.log_result("Get Specific Ironing Order", True, 
                          f"Successfully retrieved ironing order {order_id}. "
                          f"DC: {order['dc_number']}, Status: {order['status']}")
            return True, order
            
        except Exception as e:
            self.log_result("Get Specific Ironing Order", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_add_payment_to_ironing_order(self, order_id, payment_amount=100.0):
        """Test adding payment to an ironing order"""
        try:
            payment_data = {
                "amount": payment_amount,
                "payment_date": datetime.now(timezone.utc).isoformat(),
                "payment_method": "Cash",
                "notes": "Test payment for ironing"
            }
            
            response = requests.post(
                f"{self.base_url}/ironing-orders/{order_id}/payment",
                json=payment_data
            )
            
            if response.status_code == 404:
                self.log_result("Add Payment to Ironing Order", False, 
                              f"Ironing order {order_id} not found for payment")
                return False
            elif response.status_code != 200:
                self.log_result("Add Payment to Ironing Order", False, 
                              f"Failed to add payment. Status: {response.status_code}", 
                              response.text)
                return False
                
            result = response.json()
            
            if 'message' not in result or 'balance' not in result:
                self.log_result("Add Payment to Ironing Order", False, 
                              "Invalid payment response format", result)
                return False
            
            self.log_result("Add Payment to Ironing Order", True, 
                          f"Payment of ₹{payment_amount} added successfully. "
                          f"Remaining balance: ₹{result['balance']}")
            return True
            
        except Exception as e:
            self.log_result("Add Payment to Ironing Order", False, f"Exception occurred: {str(e)}")
            return False

    def test_generate_ironing_dc(self, order_id):
        """Test generating DC for an ironing order"""
        try:
            response = requests.get(f"{self.base_url}/ironing-orders/{order_id}/dc")
            
            if response.status_code == 404:
                self.log_result("Generate Ironing DC", False, 
                              f"Ironing order {order_id} not found for DC generation")
                return False
            elif response.status_code != 200:
                self.log_result("Generate Ironing DC", False, 
                              f"Failed to generate DC. Status: {response.status_code}", 
                              response.text)
                return False
                
            # Check if response is HTML
            content_type = response.headers.get('content-type', '')
            if 'text/html' not in content_type:
                self.log_result("Generate Ironing DC", False, 
                              f"Expected HTML response, got: {content_type}")
                return False
            
            html_content = response.text
            
            # Basic validation of HTML content
            if 'IRONING DELIVERY CHALLAN' not in html_content:
                self.log_result("Generate Ironing DC", False, 
                              "DC HTML does not contain expected title")
                return False
            
            self.log_result("Generate Ironing DC", True, 
                          f"DC generated successfully for order {order_id}. "
                          f"HTML content length: {len(html_content)} characters")
            return True
            
        except Exception as e:
            self.log_result("Generate Ironing DC", False, f"Exception occurred: {str(e)}")
            return False

    def test_delete_ironing_order(self, order_id):
        """Test deleting an ironing order"""
        try:
            response = requests.delete(f"{self.base_url}/ironing-orders/{order_id}")
            
            if response.status_code == 404:
                self.log_result("Delete Ironing Order", False, 
                              f"Ironing order {order_id} not found for deletion")
                return False
            elif response.status_code != 200:
                self.log_result("Delete Ironing Order", False, 
                              f"Failed to delete ironing order. Status: {response.status_code}", 
                              response.text)
                return False
                
            result = response.json()
            
            if 'message' not in result:
                self.log_result("Delete Ironing Order", False, 
                              "Invalid delete response format", result)
                return False
            
            self.log_result("Delete Ironing Order", True, 
                          f"Ironing order {order_id} deleted successfully")
            return True
            
        except Exception as e:
            self.log_result("Delete Ironing Order", False, f"Exception occurred: {str(e)}")
            return False

    def run_comprehensive_tests(self):
        """Run all ironing unit tests"""
        print("🧪 Starting Ironing Unit Feature Tests")
        print("=" * 50)
        
        # Test 1: Dashboard Stats
        self.test_dashboard_stats()
        
        # Test 2: Get all ironing orders
        success, orders = self.test_get_ironing_orders()
        
        # Test 3: Get all ironing receipts
        self.test_get_ironing_receipts()
        
        # If we have existing orders, test specific operations
        if success and orders:
            # Use the first order for detailed testing
            test_order = orders[0]
            order_id = test_order['id']
            
            # Test 4: Get specific ironing order
            self.test_get_specific_ironing_order(order_id)
            
            # Test 5: Add payment to ironing order
            self.test_add_payment_to_ironing_order(order_id, 50.0)
            
            # Test 6: Generate DC for ironing order
            self.test_generate_ironing_dc(order_id)
            
            # Note: We won't test deletion on existing orders to preserve data
            print("ℹ️  Skipping deletion test to preserve existing data")
        else:
            print("⚠️  No existing ironing orders found. Skipping order-specific tests.")
            print("   This is expected if no ironing orders have been created yet.")
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['message']}")
        
        return failed_tests == 0

def main():
    """Main test execution"""
    print("🏭 Garment Manufacturing App - Ironing Unit Backend Tests")
    print(f"🌐 Testing against: {BACKEND_URL}")
    print()
    
    tester = IroningUnitTester()
    success = tester.run_comprehensive_tests()
    
    if success:
        print("\n🎉 All tests passed! Ironing unit feature is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()