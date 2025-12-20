#!/usr/bin/env python3
"""
Backend Testing Suite for Garment Manufacturing App - Returns Management Feature
Tests the complete Returns Management system with accept/reject functionality
"""

import requests
import json
from datetime import datetime, timezone
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://garmentpro-2.preview.emergentagent.com/api"

class ReturnsManagementTester:
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

    def test_create_return(self):
        """Test POST /api/returns - Create a new return record"""
        try:
            return_data = {
                "source_type": "dispatch",
                "source_id": "test-dispatch-123",
                "return_date": "2025-12-20T00:00:00Z",
                "quantity": 15,
                "reason": "Defective",
                "notes": "Test return for testing"
            }
            
            response = requests.post(
                f"{self.base_url}/returns",
                json=return_data,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Create Return", False, 
                              f"Failed to create return. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            result = response.json()
            
            # Validate response structure
            if not result.get('id'):
                self.log_result("Create Return", False, 
                              "No return ID in response", result)
                return False, None
            
            if result.get('message') != "Return recorded":
                self.log_result("Create Return", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False, None
            
            self.created_resources.append(('return', result['id']))
            
            self.log_result("Create Return", True, 
                          f"Successfully created return {result['id']} for {return_data['quantity']} pieces")
            return True, result['id']
            
        except Exception as e:
            self.log_result("Create Return", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_get_returns(self):
        """Test GET /api/returns - Fetch all returns"""
        try:
            response = requests.get(f"{self.base_url}/returns", headers=self.get_headers())
            
            if response.status_code != 200:
                self.log_result("Get Returns", False, 
                              f"Failed to get returns. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            returns = response.json()
            
            if not isinstance(returns, list):
                self.log_result("Get Returns", False, 
                              "Response is not a list", returns)
                return False, None
            
            # Find our test return
            test_returns = [r for r in returns if r.get('source_id') == 'test-dispatch-123']
            
            if not test_returns:
                self.log_result("Get Returns", False, 
                              "Test return not found in returns list")
                return False, None
            
            test_return = test_returns[0]
            
            # Validate return structure
            required_fields = ['id', 'source_type', 'source_id', 'quantity', 'reason', 'status', 'created_at']
            for field in required_fields:
                if field not in test_return:
                    self.log_result("Get Returns", False, 
                                  f"Missing required field: {field}")
                    return False, None
            
            # Validate initial status is "Pending"
            if test_return.get('status') != 'Pending':
                self.log_result("Get Returns", False, 
                              f"Expected status 'Pending', got '{test_return.get('status')}'")
                return False, None
            
            self.log_result("Get Returns", True, 
                          f"Successfully retrieved {len(returns)} returns. Test return found with status: {test_return.get('status')}")
            return True, test_return
            
        except Exception as e:
            self.log_result("Get Returns", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_accept_return(self, return_id):
        """Test PUT /api/returns/{id}/process?action=accept - Accept a return"""
        try:
            response = requests.put(
                f"{self.base_url}/returns/{return_id}/process?action=accept",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Accept Return", False, 
                              f"Failed to accept return. Status: {response.status_code}", 
                              response.text)
                return False
                
            result = response.json()
            
            # Validate response
            if result.get('message') != "Return accepted":
                self.log_result("Accept Return", False, 
                              f"Unexpected message: {result.get('message')}", result)
                return False
            
            # Verify the return was updated
            get_response = requests.get(f"{self.base_url}/returns", headers=self.get_headers())
            if get_response.status_code == 200:
                returns = get_response.json()
                updated_return = next((r for r in returns if r.get('id') == return_id), None)
                
                if updated_return:
                    if updated_return.get('status') != 'Accepted':
                        self.log_result("Accept Return", False, 
                                      f"Return status not updated. Expected 'Accepted', got '{updated_return.get('status')}'")
                        return False
                    
                    if not updated_return.get('processed_by'):
                        self.log_result("Accept Return", False, 
                                      "processed_by field not populated")
                        return False
                    
                    if not updated_return.get('processed_at'):
                        self.log_result("Accept Return", False, 
                                      "processed_at field not populated")
                        return False
            
            self.log_result("Accept Return", True, 
                          f"Successfully accepted return {return_id}. Status changed to 'Accepted'")
            return True
            
        except Exception as e:
            self.log_result("Accept Return", False, f"Exception occurred: {str(e)}")
            return False

    def test_create_second_return(self):
        """Create a second return for reject testing"""
        try:
            return_data = {
                "source_type": "dispatch",
                "source_id": "test-dispatch-456",
                "return_date": "2025-12-20T00:00:00Z",
                "quantity": 8,
                "reason": "Wrong Size",
                "notes": "Second test return for reject testing"
            }
            
            response = requests.post(
                f"{self.base_url}/returns",
                json=return_data,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Create Second Return", False, 
                              f"Failed to create second return. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            result = response.json()
            
            if not result.get('id'):
                self.log_result("Create Second Return", False, 
                              "No return ID in response", result)
                return False, None
            
            self.created_resources.append(('return', result['id']))
            
            self.log_result("Create Second Return", True, 
                          f"Successfully created second return {result['id']} for reject testing")
            return True, result['id']
            
        except Exception as e:
            self.log_result("Create Second Return", False, f"Exception occurred: {str(e)}")
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