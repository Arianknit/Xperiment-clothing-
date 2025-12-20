#!/usr/bin/env python3
"""
Backend Testing Suite for Reports Functionality - Arian Knit Fab Production Pro
Tests the new Stock, Dispatch, and Catalogue reports with HTML and CSV formats
"""

import requests
import json
from datetime import datetime, timezone
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://arian-production.preview.emergentagent.com/api"

class ReportsTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
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

    def test_stock_report_html(self):
        """Test Stock Report HTML format"""
        try:
            # Test basic HTML format
            response = requests.get(
                f"{self.base_url}/reports/stock?format=html",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Stock Report HTML", False, 
                              f"Failed to get stock report HTML. Status: {response.status_code}", 
                              response.text)
                return False
            
            html_content = response.text
            
            # Validate HTML content contains expected elements
            required_elements = [
                "Stock Report",
                "Total Stock",
                "Available",
                "Dispatched", 
                "Low Stock"
            ]
            
            missing_elements = []
            for element in required_elements:
                if element not in html_content:
                    missing_elements.append(element)
            
            if missing_elements:
                self.log_result("Stock Report HTML", False, 
                              f"Missing required elements in HTML: {missing_elements}")
                return False
            
            # Check if it's valid HTML
            if not html_content.strip().startswith('<!DOCTYPE html>') and not html_content.strip().startswith('<html'):
                self.log_result("Stock Report HTML", False, 
                              "Response is not valid HTML format")
                return False
            
            self.log_result("Stock Report HTML", True, 
                          f"Stock report HTML generated successfully. Size: {len(html_content)} characters")
            return True
            
        except Exception as e:
            self.log_result("Stock Report HTML", False, f"Exception occurred: {str(e)}")
            return False

    def test_stock_report_html_with_filters(self):
        """Test Stock Report HTML with filters"""
        try:
            # Test with low stock threshold
            response = requests.get(
                f"{self.base_url}/reports/stock?format=html&low_stock_threshold=50",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Stock Report HTML with Threshold", False, 
                              f"Failed to get stock report with threshold. Status: {response.status_code}", 
                              response.text)
                return False
            
            # Test with category filter
            response = requests.get(
                f"{self.base_url}/reports/stock?format=html&category=Mens",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Stock Report HTML with Category", False, 
                              f"Failed to get stock report with category filter. Status: {response.status_code}", 
                              response.text)
                return False
            
            html_content = response.text
            
            # Validate filtered content
            if "Stock Report" not in html_content:
                self.log_result("Stock Report HTML with Filters", False, 
                              "Filtered HTML does not contain Stock Report title")
                return False
            
            self.log_result("Stock Report HTML with Filters", True, 
                          "Stock report HTML with filters working correctly")
            return True
            
        except Exception as e:
            self.log_result("Stock Report HTML with Filters", False, f"Exception occurred: {str(e)}")
            return False

    def test_stock_report_csv(self):
        """Test Stock Report CSV format"""
        try:
            response = requests.get(
                f"{self.base_url}/reports/stock?format=csv",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Stock Report CSV", False, 
                              f"Failed to get stock report CSV. Status: {response.status_code}", 
                              response.text)
                return False
            
            csv_content = response.text
            
            # Validate CSV format
            lines = csv_content.strip().split('\n')
            if len(lines) < 1:
                self.log_result("Stock Report CSV", False, 
                              "CSV content is empty")
                return False
            
            # Check for CSV headers
            header_line = lines[0]
            expected_headers = ["Stock Code", "Lot Number", "Category", "Style", "Color", "Total Qty", "Available"]
            
            missing_headers = []
            for header in expected_headers:
                if header not in header_line:
                    missing_headers.append(header)
            
            if missing_headers:
                self.log_result("Stock Report CSV", False, 
                              f"Missing CSV headers: {missing_headers}")
                return False
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'text/csv' not in content_type and 'application/csv' not in content_type:
                self.log_result("Stock Report CSV", False, 
                              f"Incorrect content type: {content_type}")
                return False
            
            self.log_result("Stock Report CSV", True, 
                          f"Stock report CSV generated successfully. Lines: {len(lines)}")
            return True
            
        except Exception as e:
            self.log_result("Stock Report CSV", False, f"Exception occurred: {str(e)}")
            return False

    def test_dispatch_report_html(self):
        """Test Dispatch Report HTML format"""
        try:
            response = requests.get(
                f"{self.base_url}/reports/dispatch?format=html",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Dispatch Report HTML", False, 
                              f"Failed to get dispatch report HTML. Status: {response.status_code}", 
                              response.text)
                return False
            
            html_content = response.text
            
            # Validate HTML content contains expected elements
            required_elements = [
                "Dispatch Report",
                "Total Dispatches",
                "Total Items",
                "Total Quantity",
                "Customer-wise Summary",
                "Dispatch Details"
            ]
            
            missing_elements = []
            for element in required_elements:
                if element not in html_content:
                    missing_elements.append(element)
            
            if missing_elements:
                self.log_result("Dispatch Report HTML", False, 
                              f"Missing required elements in HTML: {missing_elements}")
                return False
            
            self.log_result("Dispatch Report HTML", True, 
                          f"Dispatch report HTML generated successfully. Size: {len(html_content)} characters")
            return True
            
        except Exception as e:
            self.log_result("Dispatch Report HTML", False, f"Exception occurred: {str(e)}")
            return False

    def test_dispatch_report_html_with_filters(self):
        """Test Dispatch Report HTML with date and customer filters"""
        try:
            # Test with date filters
            response = requests.get(
                f"{self.base_url}/reports/dispatch?format=html&start_date=2025-12-01&end_date=2025-12-31",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Dispatch Report HTML with Date Filters", False, 
                              f"Failed to get dispatch report with date filters. Status: {response.status_code}", 
                              response.text)
                return False
            
            # Test with customer filter
            response = requests.get(
                f"{self.base_url}/reports/dispatch?format=html&customer_name=Test",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Dispatch Report HTML with Customer Filter", False, 
                              f"Failed to get dispatch report with customer filter. Status: {response.status_code}", 
                              response.text)
                return False
            
            html_content = response.text
            
            if "Dispatch Report" not in html_content:
                self.log_result("Dispatch Report HTML with Filters", False, 
                              "Filtered HTML does not contain Dispatch Report title")
                return False
            
            self.log_result("Dispatch Report HTML with Filters", True, 
                          "Dispatch report HTML with filters working correctly")
            return True
            
        except Exception as e:
            self.log_result("Dispatch Report HTML with Filters", False, f"Exception occurred: {str(e)}")
            return False

    def test_dispatch_report_csv(self):
        """Test Dispatch Report CSV format"""
        try:
            response = requests.get(
                f"{self.base_url}/reports/dispatch?format=csv",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Dispatch Report CSV", False, 
                              f"Failed to get dispatch report CSV. Status: {response.status_code}", 
                              response.text)
                return False
            
            csv_content = response.text
            
            # Validate CSV format
            lines = csv_content.strip().split('\n')
            if len(lines) < 1:
                self.log_result("Dispatch Report CSV", False, 
                              "CSV content is empty")
                return False
            
            # Check for CSV headers
            header_line = lines[0]
            expected_headers = ["Dispatch No", "Date", "Customer", "Bora No", "Items", "Total Qty"]
            
            headers_found = 0
            for header in expected_headers:
                if header in header_line:
                    headers_found += 1
            
            if headers_found < 4:  # At least 4 out of 6 headers should be present
                self.log_result("Dispatch Report CSV", False, 
                              f"Insufficient CSV headers found. Expected at least 4, found {headers_found}")
                return False
            
            self.log_result("Dispatch Report CSV", True, 
                          f"Dispatch report CSV generated successfully. Lines: {len(lines)}")
            return True
            
        except Exception as e:
            self.log_result("Dispatch Report CSV", False, f"Exception occurred: {str(e)}")
            return False

    def test_catalogue_report_html(self):
        """Test Catalogue Report HTML format"""
        try:
            response = requests.get(
                f"{self.base_url}/reports/catalogue?format=html",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Catalogue Report HTML", False, 
                              f"Failed to get catalogue report HTML. Status: {response.status_code}", 
                              response.text)
                return False
            
            html_content = response.text
            
            # Validate HTML content contains expected elements
            required_elements = [
                "Catalogue Report",
                "Total Catalogues",
                "Catalog Name",
                "Available"
            ]
            
            missing_elements = []
            for element in required_elements:
                if element not in html_content:
                    missing_elements.append(element)
            
            if missing_elements:
                self.log_result("Catalogue Report HTML", False, 
                              f"Missing required elements in HTML: {missing_elements}")
                return False
            
            # Check for status badges
            status_indicators = ["Available", "High Demand", "Fully Dispatched"]
            status_found = any(status in html_content for status in status_indicators)
            
            if not status_found:
                self.log_result("Catalogue Report HTML", False, 
                              "No status badges found in catalogue report")
                return False
            
            self.log_result("Catalogue Report HTML", True, 
                          f"Catalogue report HTML generated successfully. Size: {len(html_content)} characters")
            return True
            
        except Exception as e:
            self.log_result("Catalogue Report HTML", False, f"Exception occurred: {str(e)}")
            return False

    def test_catalogue_report_csv(self):
        """Test Catalogue Report CSV format"""
        try:
            response = requests.get(
                f"{self.base_url}/reports/catalogue?format=csv",
                headers=self.get_headers()
            )
            
            if response.status_code != 200:
                self.log_result("Catalogue Report CSV", False, 
                              f"Failed to get catalogue report CSV. Status: {response.status_code}", 
                              response.text)
                return False
            
            csv_content = response.text
            
            # Validate CSV format
            lines = csv_content.strip().split('\n')
            if len(lines) < 1:
                self.log_result("Catalogue Report CSV", False, 
                              "CSV content is empty")
                return False
            
            # Check for CSV headers
            header_line = lines[0]
            expected_headers = ["Catalog Name", "Catalog Code", "Total Qty", "Available", "Dispatched", "Lots Count"]
            
            headers_found = 0
            for header in expected_headers:
                if header in header_line:
                    headers_found += 1
            
            if headers_found < 4:  # At least 4 out of 6 headers should be present
                self.log_result("Catalogue Report CSV", False, 
                              f"Insufficient CSV headers found. Expected at least 4, found {headers_found}")
                return False
            
            self.log_result("Catalogue Report CSV", True, 
                          f"Catalogue report CSV generated successfully. Lines: {len(lines)}")
            return True
            
        except Exception as e:
            self.log_result("Catalogue Report CSV", False, f"Exception occurred: {str(e)}")
            return False

    def test_report_endpoints_exist(self):
        """Test that all report endpoints exist and return proper responses"""
        try:
            endpoints = [
                "/reports/stock",
                "/reports/dispatch", 
                "/reports/catalogue"
            ]
            
            all_exist = True
            for endpoint in endpoints:
                response = requests.get(
                    f"{self.base_url}{endpoint}?format=html",
                    headers=self.get_headers()
                )
                
                if response.status_code == 404:
                    self.log_result("Report Endpoints Exist", False, 
                                  f"Endpoint {endpoint} not found (404)")
                    all_exist = False
                elif response.status_code >= 500:
                    self.log_result("Report Endpoints Exist", False, 
                                  f"Endpoint {endpoint} has server error: {response.status_code}")
                    all_exist = False
            
            if all_exist:
                self.log_result("Report Endpoints Exist", True, 
                              "All report endpoints are accessible")
                return True
            else:
                return False
            
        except Exception as e:
            self.log_result("Report Endpoints Exist", False, f"Exception occurred: {str(e)}")
            return False

    def test_content_types(self):
        """Test that reports return correct content types"""
        try:
            # Test HTML content type
            response = requests.get(
                f"{self.base_url}/reports/stock?format=html",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'text/html' not in content_type:
                    self.log_result("Content Types", False, 
                                  f"HTML report has incorrect content type: {content_type}")
                    return False
            
            # Test CSV content type
            response = requests.get(
                f"{self.base_url}/reports/stock?format=csv",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'csv' not in content_type and 'text/plain' not in content_type:
                    self.log_result("Content Types", False, 
                                  f"CSV report has incorrect content type: {content_type}")
                    return False
            
            self.log_result("Content Types", True, 
                          "All reports return correct content types")
            return True
            
        except Exception as e:
            self.log_result("Content Types", False, f"Exception occurred: {str(e)}")
            return False

    def run_comprehensive_tests(self):
        """Run all reports tests"""
        print("📊 Starting Reports Functionality Tests")
        print("=" * 60)
        
        # Test 1: Login
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Test 2: Check if report endpoints exist
        if not self.test_report_endpoints_exist():
            print("❌ Report endpoints not available")
            return False
        
        # Test 3: Content types
        self.test_content_types()
        
        # Test 4-6: Stock Report Tests
        self.test_stock_report_html()
        self.test_stock_report_html_with_filters()
        self.test_stock_report_csv()
        
        # Test 7-9: Dispatch Report Tests
        self.test_dispatch_report_html()
        self.test_dispatch_report_html_with_filters()
        self.test_dispatch_report_csv()
        
        # Test 10-11: Catalogue Report Tests
        self.test_catalogue_report_html()
        self.test_catalogue_report_csv()
        
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
    print("🏭 Arian Knit Fab Production Pro - Reports Functionality Tests")
    print(f"🌐 Testing against: {BACKEND_URL}")
    print()
    
    tester = ReportsTester()
    success = tester.run_comprehensive_tests()
    
    if success:
        print("\n🎉 All reports tests passed! Reports functionality is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()