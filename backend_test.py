#!/usr/bin/env python3
"""
Backend Testing Suite for Garment Manufacturing App - Quick Action Endpoints
Tests the Scan Lot feature Quick Action endpoints for outsourcing and ironing workflow
"""

import requests
import json
from datetime import datetime, timezone
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://garmentpro-2.preview.emergentagent.com/api"

class QuickActionTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.created_resources = []  # Track created resources for cleanup
        self.auth_token = None
        
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

    def login(self):
        """Login with admin credentials"""
        try:
            login_data = {
                "username": "admin",
                "password": "admin"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", json=login_data)
            
            if response.status_code != 200:
                self.log_result("Login", False, 
                              f"Failed to login. Status: {response.status_code}", 
                              response.text)
                return False
                
            data = response.json()
            self.auth_token = data.get('token')
            
            if not self.auth_token:
                self.log_result("Login", False, "No token received in login response", data)
                return False
            
            self.log_result("Login", True, f"Successfully logged in as admin")
            return True
            
        except Exception as e:
            self.log_result("Login", False, f"Exception occurred: {str(e)}")
            return False

    def get_headers(self):
        """Get headers with auth token"""
        if not self.auth_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_token}"}

    def test_send_outsourcing(self):
        """Test POST /api/scan/send-outsourcing - Send lot to outsourcing"""
        try:
            # Test data as specified in the review
            outsourcing_data = {
                "lot_number": "cut 002",
                "unit_name": "Satish Printing House",
                "operation_type": "Embroidery",
                "rate_per_pcs": 5.0
            }
            
            response = requests.post(
                f"{self.base_url}/scan/send-outsourcing",
                json=outsourcing_data,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Send to Outsourcing", False, 
                              f"Failed to send to outsourcing. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            result = response.json()
            
            # Validate response message
            if result.get('message') != "Sent to outsourcing successfully":
                self.log_result("Send to Outsourcing", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False, None
            
            # Verify outsourcing order was created
            orders_response = requests.get(f"{self.base_url}/outsourcing-orders", headers=self.get_headers())
            if orders_response.status_code == 200:
                orders = orders_response.json()
                matching_order = next((order for order in orders if order.get('cutting_lot_number') == 'cut 002'), None)
                
                if not matching_order:
                    self.log_result("Send to Outsourcing", False, 
                                  "Outsourcing order not found after creation")
                    return False, None
                
                self.created_resources.append(('outsourcing_order', matching_order.get('id')))
            
            self.log_result("Send to Outsourcing", True, 
                          f"Successfully sent lot 'cut 002' to outsourcing. DC: {result.get('dc_number', 'N/A')}")
            return True, result.get('dc_number')
            
        except Exception as e:
            self.log_result("Send to Outsourcing", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_receive_outsourcing(self):
        """Test POST /api/scan/receive-outsourcing - Receive lot from outsourcing"""
        try:
            # First, find a pending outsourcing order
            orders_response = requests.get(f"{self.base_url}/outsourcing-orders", headers=self.get_headers())
            if orders_response.status_code != 200:
                self.log_result("Receive from Outsourcing", False, 
                              "Failed to get outsourcing orders")
                return False, None
            
            orders = orders_response.json()
            pending_order = next((order for order in orders if order.get('status') != 'Received'), None)
            
            if not pending_order:
                self.log_result("Receive from Outsourcing", False, 
                              "No pending outsourcing orders found for testing")
                return False, None
            
            lot_number = pending_order.get('cutting_lot_number')
            
            # Test data for receiving
            receive_data = {
                "lot_number": lot_number,
                "received_distribution": {"S": 10, "M": 10, "L": 10},
                "mistake_distribution": {"S": 0, "M": 0, "L": 0}
            }
            
            response = requests.post(
                f"{self.base_url}/scan/receive-outsourcing",
                json=receive_data,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Receive from Outsourcing", False, 
                              f"Failed to receive from outsourcing. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            result = response.json()
            
            # Validate response
            if "Receipt recorded successfully" not in result.get('message', ''):
                self.log_result("Receive from Outsourcing", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False, None
            
            # Verify receipt was created
            receipts_response = requests.get(f"{self.base_url}/outsourcing-receipts", headers=self.get_headers())
            if receipts_response.status_code == 200:
                receipts = receipts_response.json()
                matching_receipt = next((receipt for receipt in receipts if receipt.get('dc_number') == pending_order.get('dc_number')), None)
                
                if matching_receipt:
                    self.created_resources.append(('outsourcing_receipt', matching_receipt.get('id')))
            
            self.log_result("Receive from Outsourcing", True, 
                          f"Successfully received lot '{lot_number}' from outsourcing. Received: {result.get('received', 0)} pieces")
            return True, lot_number
            
        except Exception as e:
            self.log_result("Receive from Outsourcing", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_create_ironing(self, lot_from_outsourcing):
        """Test POST /api/scan/create-ironing - Create ironing order"""
        try:
            # Test data for creating ironing order
            ironing_data = {
                "lot_number": lot_from_outsourcing,
                "unit_name": "Satish Printing House",
                "master_pack_ratio": {"S": 2, "M": 3, "L": 2},
                "rate_per_pcs": 3.0
            }
            
            response = requests.post(
                f"{self.base_url}/scan/create-ironing",
                json=ironing_data,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Create Ironing Order", False, 
                              f"Failed to create ironing order. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            result = response.json()
            
            # Validate response
            if "Ironing order created successfully" not in result.get('message', ''):
                self.log_result("Create Ironing Order", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False, None
            
            # Verify ironing order was created
            orders_response = requests.get(f"{self.base_url}/ironing-orders", headers=self.get_headers())
            if orders_response.status_code == 200:
                orders = orders_response.json()
                matching_order = next((order for order in orders if order.get('cutting_lot_number') == lot_from_outsourcing), None)
                
                if not matching_order:
                    self.log_result("Create Ironing Order", False, 
                                  "Ironing order not found after creation")
                    return False, None
                
                self.created_resources.append(('ironing_order', matching_order.get('id')))
            
            self.log_result("Create Ironing Order", True, 
                          f"Successfully created ironing order for lot '{lot_from_outsourcing}'. DC: {result.get('dc_number', 'N/A')}")
            return True, result.get('dc_number')
            
        except Exception as e:
            self.log_result("Create Ironing Order", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_receive_ironing(self):
        """Test POST /api/scan/receive-ironing - Receive lot from ironing and auto-create stock"""
        try:
            # First, find a pending ironing order
            orders_response = requests.get(f"{self.base_url}/ironing-orders", headers=self.get_headers())
            if orders_response.status_code != 200:
                self.log_result("Receive from Ironing", False, 
                              "Failed to get ironing orders")
                return False, None
            
            orders = orders_response.json()
            pending_order = next((order for order in orders if order.get('status') != 'Received'), None)
            
            if not pending_order:
                self.log_result("Receive from Ironing", False, 
                              "No pending ironing orders found for testing")
                return False, None
            
            lot_number = pending_order.get('cutting_lot_number')
            
            # Test data for receiving
            receive_data = {
                "lot_number": lot_number,
                "received_distribution": {"S": 10, "M": 10, "L": 10},
                "mistake_distribution": {}
            }
            
            response = requests.post(
                f"{self.base_url}/scan/receive-ironing",
                json=receive_data,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Receive from Ironing", False, 
                              f"Failed to receive from ironing. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            result = response.json()
            
            # Validate response
            if "Stock created!" not in result.get('message', ''):
                self.log_result("Receive from Ironing", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False, None
            
            # Validate stock_code in response
            if not result.get('stock_code'):
                self.log_result("Receive from Ironing", False, 
                              "No stock_code in response")
                return False, None
            
            # Verify receipt was created
            receipts_response = requests.get(f"{self.base_url}/ironing-receipts", headers=self.get_headers())
            if receipts_response.status_code == 200:
                receipts = receipts_response.json()
                matching_receipt = next((receipt for receipt in receipts if receipt.get('dc_number') == pending_order.get('dc_number')), None)
                
                if matching_receipt:
                    self.created_resources.append(('ironing_receipt', matching_receipt.get('id')))
            
            # Verify stock entry was created
            stock_response = requests.get(f"{self.base_url}/stock", headers=self.get_headers())
            if stock_response.status_code == 200:
                stock_entries = stock_response.json()
                matching_stock = next((stock for stock in stock_entries if stock.get('stock_code') == result.get('stock_code')), None)
                
                if not matching_stock:
                    self.log_result("Receive from Ironing", False, 
                                  f"Stock entry {result.get('stock_code')} not found after creation")
                    return False, None
                
                self.created_resources.append(('stock', matching_stock.get('id')))
            
            self.log_result("Receive from Ironing", True, 
                          f"Successfully received lot '{lot_number}' from ironing. Stock code: {result.get('stock_code')}")
            return True, result.get('stock_code')
            
        except Exception as e:
            self.log_result("Receive from Ironing", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_reject_return(self, return_id):
        """Test PUT /api/returns/{id}/process?action=reject - Reject a return"""
        try:
            response = requests.put(
                f"{self.base_url}/returns/{return_id}/process?action=reject",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Reject Return", False, 
                              f"Failed to reject return. Status: {response.status_code}", 
                              response.text)
                return False
                
            result = response.json()
            
            # Validate response
            if result.get('message') != "Return rejected":
                self.log_result("Reject Return", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False
            
            # Verify the return was updated
            get_response = requests.get(f"{self.base_url}/returns", headers=self.get_headers())
            if get_response.status_code == 200:
                returns = get_response.json()
                updated_return = next((r for r in returns if r.get('id') == return_id), None)
                
                if updated_return:
                    if updated_return.get('status') != 'Rejected':
                        self.log_result("Reject Return", False, 
                                      f"Return status not updated. Expected 'Rejected', got '{updated_return.get('status')}'")
                        return False
            
            self.log_result("Reject Return", True, 
                          f"Successfully rejected return {return_id}. Status changed to 'Rejected'")
            return True
            
        except Exception as e:
            self.log_result("Reject Return", False, f"Exception occurred: {str(e)}")
            return False

    def test_delete_return(self, return_id):
        """Test DELETE /api/returns/{id} - Delete a return (admin only)"""
        try:
            response = requests.delete(
                f"{self.base_url}/returns/{return_id}",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Delete Return", False, 
                              f"Failed to delete return. Status: {response.status_code}", 
                              response.text)
                return False
                
            result = response.json()
            
            # Validate response
            if result.get('message') != "Return deleted":
                self.log_result("Delete Return", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False
            
            # Verify the return was deleted
            get_response = requests.get(f"{self.base_url}/returns", headers=self.get_headers())
            if get_response.status_code == 200:
                returns = get_response.json()
                deleted_return = next((r for r in returns if r.get('id') == return_id), None)
                
                if deleted_return:
                    self.log_result("Delete Return", False, 
                                  "Return still exists after deletion")
                    return False
            
            self.log_result("Delete Return", True, 
                          f"Successfully deleted return {return_id}")
            return True
            
        except Exception as e:
            self.log_result("Delete Return", False, f"Exception occurred: {str(e)}")
            return False

    def test_validation_already_processed(self, return_id):
        """Test validation: Try processing an already-processed return"""
        try:
            response = requests.put(
                f"{self.base_url}/returns/{return_id}/process?action=accept",
                headers=self.get_headers()
            )
            
            # Should fail with 400 status
            if response.status_code != 400:
                self.log_result("Validation - Already Processed", False, 
                              f"Expected 400 status, got {response.status_code}", 
                              response.text)
                return False
            
            result = response.json()
            
            # Check error message
            if "already been processed" not in result.get('detail', ''):
                self.log_result("Validation - Already Processed", False, 
                              f"Unexpected error message: {result.get('detail')}")
                return False
            
            self.log_result("Validation - Already Processed", True, 
                          "Correctly prevented processing already-processed return")
            return True
            
        except Exception as e:
            self.log_result("Validation - Already Processed", False, f"Exception occurred: {str(e)}")
            return False

    def test_validation_invalid_action(self):
        """Test validation: Try invalid action parameter"""
        try:
            # Create a test return first
            return_data = {
                "source_type": "dispatch",
                "source_id": "test-validation-123",
                "return_date": "2025-12-20T00:00:00Z",
                "quantity": 5,
                "reason": "Test validation",
                "notes": "For validation testing"
            }
            
            create_response = requests.post(
                f"{self.base_url}/returns",
                json=return_data,
                headers=self.get_headers()
            )
            
            if create_response.status_code != 200:
                self.log_result("Validation - Invalid Action", False, 
                              "Failed to create test return for validation")
                return False
            
            return_id = create_response.json()['id']
            self.created_resources.append(('return', return_id))
            
            # Try invalid action
            response = requests.put(
                f"{self.base_url}/returns/{return_id}/process?action=invalid",
                headers=self.get_headers()
            )
            
            # Should fail with 400 status
            if response.status_code != 400:
                self.log_result("Validation - Invalid Action", False, 
                              f"Expected 400 status, got {response.status_code}", 
                              response.text)
                return False
            
            result = response.json()
            
            # Check error message
            if "accept" not in result.get('detail', '') or "reject" not in result.get('detail', ''):
                self.log_result("Validation - Invalid Action", False, 
                              f"Unexpected error message: {result.get('detail')}")
                return False
            
            self.log_result("Validation - Invalid Action", True, 
                          "Correctly rejected invalid action parameter")
            return True
            
        except Exception as e:
            self.log_result("Validation - Invalid Action", False, f"Exception occurred: {str(e)}")
            return False

    def test_authentication_required(self):
        """Test that all endpoints require authentication"""
        try:
            # Test without auth headers
            endpoints_to_test = [
                ("POST", "/returns", {"source_type": "dispatch", "source_id": "test", "return_date": "2025-12-20T00:00:00Z", "quantity": 1, "reason": "test"}),
                ("GET", "/returns", None),
            ]
            
            all_passed = True
            
            for method, endpoint, data in endpoints_to_test:
                if method == "POST":
                    response = requests.post(f"{self.base_url}{endpoint}", json=data)
                else:
                    response = requests.get(f"{self.base_url}{endpoint}")
                
                # Accept both 401 (Unauthorized) and 403 (Forbidden) as valid auth errors
                if response.status_code not in [401, 403]:
                    self.log_result("Authentication Required", False, 
                                  f"{method} {endpoint} should require auth but got status {response.status_code}")
                    all_passed = False
                    break
            
            if all_passed:
                self.log_result("Authentication Required", True, 
                              "All endpoints correctly require authentication")
            
            return all_passed
            
        except Exception as e:
            self.log_result("Authentication Required", False, f"Exception occurred: {str(e)}")
            return False

    def run_comprehensive_tests(self):
        """Run all returns management tests"""
        print("🧪 Starting Returns Management Feature Tests")
        print("=" * 60)
        
        # Test 1: Login
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Test 2: Authentication required
        self.test_authentication_required()
        
        # Test 3: Create first return
        success, return_id_1 = self.test_create_return()
        if not success:
            print("❌ Cannot proceed without creating return")
            return False
        
        # Test 4: Get all returns
        success, test_return = self.test_get_returns()
        if not success:
            print("❌ Cannot proceed without getting returns")
            return False
        
        # Test 5: Accept the first return
        success = self.test_accept_return(return_id_1)
        if not success:
            print("❌ Accept return test failed")
            return False
        
        # Test 6: Create second return for reject testing
        success, return_id_2 = self.test_create_second_return()
        if not success:
            print("❌ Cannot create second return")
            return False
        
        # Test 7: Reject the second return
        success = self.test_reject_return(return_id_2)
        if not success:
            print("❌ Reject return test failed")
            return False
        
        # Test 8: Validation - try to process already processed return
        self.test_validation_already_processed(return_id_1)
        
        # Test 9: Validation - invalid action parameter
        self.test_validation_invalid_action()
        
        # Test 10: Delete return (admin only)
        success = self.test_delete_return(return_id_2)
        if not success:
            print("❌ Delete return test failed")
            return False
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
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
    print("🏭 Garment Manufacturing App - Returns Management Feature Tests")
    print(f"🌐 Testing against: {BACKEND_URL}")
    print()
    
    tester = ReturnsManagementTester()
    success = tester.run_comprehensive_tests()
    
    if success:
        print("\n🎉 All tests passed! Returns Management feature is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()