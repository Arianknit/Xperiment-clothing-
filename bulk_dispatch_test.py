#!/usr/bin/env python3
"""
Backend Testing Suite for Garment Manufacturing App - Bulk Dispatch Feature
Tests the new Bulk Dispatch functionality including creating, verifying, printing, and deleting bulk dispatches
"""

import requests
import json
from datetime import datetime, timezone
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://arian-textiles.preview.emergentagent.com/api"

class BulkDispatchTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.created_resources = []  # Track created resources for cleanup
        self.auth_token = None
        self.available_stocks = []
        self.created_dispatch_id = None
        
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

    def test_get_available_stocks(self):
        """Get available stocks to use in dispatch"""
        try:
            response = requests.get(f"{self.base_url}/stock", headers=self.get_headers())
            
            if response.status_code != 200:
                self.log_result("Get Available Stocks", False, 
                              f"Failed to get stocks. Status: {response.status_code}", 
                              response.text)
                return False
                
            stocks = response.json()
            
            if not isinstance(stocks, list):
                self.log_result("Get Available Stocks", False, 
                              "Response is not a list", stocks)
                return False
            
            # Filter stocks with available quantity > 0
            available_stocks = [
                stock for stock in stocks 
                if stock.get('available_quantity', 0) > 0 and stock.get('is_active', True)
            ]
            
            if len(available_stocks) < 2:
                self.log_result("Get Available Stocks", False, 
                              f"Need at least 2 stocks with available quantity > 0. Found: {len(available_stocks)}")
                return False
            
            self.available_stocks = available_stocks[:2]  # Use first 2 stocks for testing
            
            stock_info = []
            for stock in self.available_stocks:
                stock_info.append(f"{stock.get('stock_code', 'N/A')} ({stock.get('available_quantity', 0)} pcs)")
            
            self.log_result("Get Available Stocks", True, 
                          f"Found {len(available_stocks)} available stocks. Using: {', '.join(stock_info)}")
            return True
            
        except Exception as e:
            self.log_result("Get Available Stocks", False, f"Exception occurred: {str(e)}")
            return False

    def test_create_bulk_dispatch(self):
        """Create a bulk dispatch with multiple items"""
        try:
            if len(self.available_stocks) < 2:
                self.log_result("Create Bulk Dispatch", False, "Not enough available stocks")
                return False
            
            # Prepare dispatch items
            items = []
            for i, stock in enumerate(self.available_stocks):
                # Use different quantities for each stock
                master_packs = 1 if i == 0 else 2
                loose_pcs = {"M": 5, "L": 3} if i == 0 else {"XL": 2}
                
                items.append({
                    "stock_id": stock['id'],
                    "master_packs": master_packs,
                    "loose_pcs": loose_pcs
                })
            
            dispatch_data = {
                "dispatch_date": "2025-12-20T00:00:00Z",
                "customer_name": "Test Customer ABC",
                "bora_number": "BORA-TEST-001",
                "notes": "Test bulk dispatch",
                "remarks": "Handle with care",
                "items": items
            }
            
            response = requests.post(
                f"{self.base_url}/bulk-dispatches",
                json=dispatch_data,
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Create Bulk Dispatch", False, 
                              f"Failed to create bulk dispatch. Status: {response.status_code}", 
                              response.text)
                return False
                
            dispatch = response.json()
            
            # Validate dispatch structure - API returns different format
            required_fields = ['id', 'dispatch_number', 'total_items', 'grand_total_quantity']
            for field in required_fields:
                if field not in dispatch:
                    self.log_result("Create Bulk Dispatch", False, 
                                  f"Missing required field: {field}")
                    return False
            
            # Validate dispatch number format (DSP-XXXXXXXX)
            dispatch_number = dispatch.get('dispatch_number', '')
            if not dispatch_number.startswith('DSP-'):
                self.log_result("Create Bulk Dispatch", False, 
                              f"Invalid dispatch number format: {dispatch_number}")
                return False
            
            # Validate item count
            if dispatch['total_items'] != len(items):
                self.log_result("Create Bulk Dispatch", False, 
                              f"Item count mismatch. Expected: {len(items)}, Got: {dispatch['total_items']}")
                return False
            
            self.created_dispatch_id = dispatch['id']
            self.created_resources.append(('bulk_dispatch', dispatch['id']))
            
            self.log_result("Create Bulk Dispatch", True, 
                          f"Successfully created bulk dispatch {dispatch_number} with {dispatch['total_items']} items, "
                          f"total quantity: {dispatch['grand_total_quantity']} pcs")
            return True
            
        except Exception as e:
            self.log_result("Create Bulk Dispatch", False, f"Exception occurred: {str(e)}")
            return False

    def test_verify_dispatch_created(self):
        """Verify dispatch was created and appears in dispatch list"""
        try:
            response = requests.get(f"{self.base_url}/bulk-dispatches", headers=self.get_headers())
            
            if response.status_code != 200:
                self.log_result("Verify Dispatch Created", False, 
                              f"Failed to get bulk dispatches. Status: {response.status_code}", 
                              response.text)
                return False
                
            dispatches = response.json()
            
            if not isinstance(dispatches, list):
                self.log_result("Verify Dispatch Created", False, 
                              "Response is not a list", dispatches)
                return False
            
            # Find our created dispatch
            created_dispatch = None
            for dispatch in dispatches:
                if dispatch.get('id') == self.created_dispatch_id:
                    created_dispatch = dispatch
                    break
            
            if not created_dispatch:
                self.log_result("Verify Dispatch Created", False, 
                              f"Created dispatch {self.created_dispatch_id} not found in dispatch list")
                return False
            
            # Validate dispatch details
            if created_dispatch.get('customer_name') != "Test Customer ABC":
                self.log_result("Verify Dispatch Created", False, 
                              f"Customer name mismatch. Expected: 'Test Customer ABC', Got: {created_dispatch.get('customer_name')}")
                return False
            
            if created_dispatch.get('bora_number') != "BORA-TEST-001":
                self.log_result("Verify Dispatch Created", False, 
                              f"Bora number mismatch. Expected: 'BORA-TEST-001', Got: {created_dispatch.get('bora_number')}")
                return False
            
            self.log_result("Verify Dispatch Created", True, 
                          f"Dispatch verified successfully. Found in list with correct details.")
            return True
            
        except Exception as e:
            self.log_result("Verify Dispatch Created", False, f"Exception occurred: {str(e)}")
            return False

    def test_verify_stock_quantities_reduced(self):
        """Verify stock quantities were reduced after dispatch"""
        try:
            response = requests.get(f"{self.base_url}/stock", headers=self.get_headers())
            
            if response.status_code != 200:
                self.log_result("Verify Stock Quantities Reduced", False, 
                              f"Failed to get stocks. Status: {response.status_code}", 
                              response.text)
                return False
                
            current_stocks = response.json()
            
            if not isinstance(current_stocks, list):
                self.log_result("Verify Stock Quantities Reduced", False, 
                              "Response is not a list", current_stocks)
                return False
            
            # Check if stock quantities were reduced
            reductions_verified = 0
            for original_stock in self.available_stocks:
                stock_id = original_stock['id']
                original_qty = original_stock['available_quantity']
                
                # Find current stock
                current_stock = None
                for stock in current_stocks:
                    if stock['id'] == stock_id:
                        current_stock = stock
                        break
                
                if not current_stock:
                    self.log_result("Verify Stock Quantities Reduced", False, 
                                  f"Stock {stock_id} not found in current stocks")
                    return False
                
                current_qty = current_stock['available_quantity']
                
                if current_qty >= original_qty:
                    self.log_result("Verify Stock Quantities Reduced", False, 
                                  f"Stock {stock_id} quantity not reduced. Original: {original_qty}, Current: {current_qty}")
                    return False
                
                reductions_verified += 1
            
            self.log_result("Verify Stock Quantities Reduced", True, 
                          f"Stock quantities verified reduced for {reductions_verified} items")
            return True
            
        except Exception as e:
            self.log_result("Verify Stock Quantities Reduced", False, f"Exception occurred: {str(e)}")
            return False

    def test_print_dispatch_sheet(self):
        """Test print endpoint returns valid HTML dispatch sheet"""
        try:
            if not self.created_dispatch_id:
                self.log_result("Test Print Dispatch Sheet", False, "No dispatch ID available")
                return False
            
            response = requests.get(
                f"{self.base_url}/bulk-dispatches/{self.created_dispatch_id}/print",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Test Print Dispatch Sheet", False, 
                              f"Failed to get print sheet. Status: {response.status_code}", 
                              response.text)
                return False
            
            # Check if response is HTML
            content_type = response.headers.get('content-type', '')
            if 'text/html' not in content_type:
                self.log_result("Test Print Dispatch Sheet", False, 
                              f"Expected HTML content, got: {content_type}")
                return False
            
            html_content = response.text
            
            # Validate HTML contains expected elements
            required_elements = [
                'Test Customer ABC',  # Customer name
                'BORA-TEST-001',     # Bora number
                'DSP-',              # Dispatch number prefix
                'Dispatch Sheet',    # Title
                'Arian Knit Fab'     # Company name
            ]
            
            missing_elements = []
            for element in required_elements:
                if element not in html_content:
                    missing_elements.append(element)
            
            if missing_elements:
                self.log_result("Test Print Dispatch Sheet", False, 
                              f"Missing elements in HTML: {missing_elements}")
                return False
            
            self.log_result("Test Print Dispatch Sheet", True, 
                          f"Print sheet generated successfully. HTML size: {len(html_content)} characters")
            return True
            
        except Exception as e:
            self.log_result("Test Print Dispatch Sheet", False, f"Exception occurred: {str(e)}")
            return False

    def test_delete_dispatch_restores_stock(self):
        """Test delete dispatch restores stock quantities"""
        try:
            if not self.created_dispatch_id:
                self.log_result("Test Delete Dispatch", False, "No dispatch ID available")
                return False
            
            # Get stock quantities before delete
            response = requests.get(f"{self.base_url}/stock", headers=self.get_headers())
            if response.status_code != 200:
                self.log_result("Test Delete Dispatch", False, "Failed to get stocks before delete")
                return False
            
            stocks_before_delete = response.json()
            
            # Delete the dispatch
            response = requests.delete(
                f"{self.base_url}/bulk-dispatches/{self.created_dispatch_id}",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Test Delete Dispatch", False, 
                              f"Failed to delete dispatch. Status: {response.status_code}", 
                              response.text)
                return False
            
            # Get stock quantities after delete
            response = requests.get(f"{self.base_url}/stock", headers=self.get_headers())
            if response.status_code != 200:
                self.log_result("Test Delete Dispatch", False, "Failed to get stocks after delete")
                return False
            
            stocks_after_delete = response.json()
            
            # Verify stock quantities were restored
            restorations_verified = 0
            for original_stock in self.available_stocks:
                stock_id = original_stock['id']
                original_qty = original_stock['available_quantity']
                
                # Find stock after delete
                restored_stock = None
                for stock in stocks_after_delete:
                    if stock['id'] == stock_id:
                        restored_stock = stock
                        break
                
                if not restored_stock:
                    self.log_result("Test Delete Dispatch", False, 
                                  f"Stock {stock_id} not found after delete")
                    return False
                
                restored_qty = restored_stock['available_quantity']
                
                # Stock should be restored to original or higher quantity
                if restored_qty < original_qty:
                    self.log_result("Test Delete Dispatch", False, 
                                  f"Stock {stock_id} not properly restored. Original: {original_qty}, After delete: {restored_qty}")
                    return False
                
                restorations_verified += 1
            
            # Verify dispatch is deleted
            response = requests.get(f"{self.base_url}/bulk-dispatches", headers=self.get_headers())
            if response.status_code == 200:
                dispatches = response.json()
                for dispatch in dispatches:
                    if dispatch.get('id') == self.created_dispatch_id:
                        self.log_result("Test Delete Dispatch", False, 
                                      "Dispatch still exists after delete")
                        return False
            
            self.log_result("Test Delete Dispatch", True, 
                          f"Dispatch deleted successfully and stock quantities restored for {restorations_verified} items")
            return True
            
        except Exception as e:
            self.log_result("Test Delete Dispatch", False, f"Exception occurred: {str(e)}")
            return False

    def run_comprehensive_tests(self):
        """Run all bulk dispatch tests"""
        print("🧪 Starting Bulk Dispatch Feature Tests")
        print("=" * 60)
        
        # Test 1: Login
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Test 2: Get available stocks
        if not self.test_get_available_stocks():
            print("❌ Cannot proceed without available stocks")
            return False
        
        # Test 3: Create bulk dispatch
        if not self.test_create_bulk_dispatch():
            print("❌ Cannot proceed without creating dispatch")
            return False
        
        # Test 4: Verify dispatch was created
        if not self.test_verify_dispatch_created():
            print("❌ Dispatch verification failed")
            return False
        
        # Test 5: Verify stock quantities were reduced
        if not self.test_verify_stock_quantities_reduced():
            print("❌ Stock quantity verification failed")
            return False
        
        # Test 6: Test print endpoint
        if not self.test_print_dispatch_sheet():
            print("❌ Print functionality failed")
            return False
        
        # Test 7: Test delete (restores stock)
        if not self.test_delete_dispatch_restores_stock():
            print("❌ Delete and restore functionality failed")
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
    print("🏭 Garment Manufacturing App - Bulk Dispatch Feature Tests")
    print(f"🌐 Testing against: {BACKEND_URL}")
    print()
    
    tester = BulkDispatchTester()
    success = tester.run_comprehensive_tests()
    
    if success:
        print("\n🎉 All tests passed! Bulk Dispatch feature is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()