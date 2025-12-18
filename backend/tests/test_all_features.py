#!/usr/bin/env python3
"""
Backend Testing Suite for Garment Manufacturing App - All 3 Features
Tests: Fabric Return, Unit Payment, and Mistake Tracking features
"""

import requests
import json
from datetime import datetime, timezone
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://producpro.preview.emergentagent.com/api"

class AllFeaturesTester:
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

    # ==================== TASK 1: FABRIC RETURN FEATURE ====================
    
    def test_get_fabric_lots(self):
        """Get fabric lots to find one with rolls for testing return"""
        try:
            response = requests.get(f"{self.base_url}/fabric-lots")
            
            if response.status_code != 200:
                self.log_result("Get Fabric Lots", False, 
                              f"Failed to get fabric lots. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            lots = response.json()
            
            if not isinstance(lots, list):
                self.log_result("Get Fabric Lots", False, 
                              "Response is not a list", lots)
                return False, None
            
            # Find a lot with rolls and quantity > 0
            suitable_lot = None
            for lot in lots:
                if (lot.get('roll_numbers') and len(lot.get('roll_numbers', [])) > 0 
                    and lot.get('remaining_quantity', 0) > 0):
                    suitable_lot = lot
                    break
            
            if not suitable_lot:
                self.log_result("Get Fabric Lots", False, 
                              "No suitable fabric lot found with rolls and quantity > 0")
                return False, None
            
            self.log_result("Get Fabric Lots", True, 
                          f"Found suitable fabric lot: {suitable_lot.get('lot_number')} "
                          f"with {len(suitable_lot.get('roll_numbers', []))} rolls, "
                          f"remaining quantity: {suitable_lot.get('remaining_quantity')}kg")
            return True, suitable_lot
            
        except Exception as e:
            self.log_result("Get Fabric Lots", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_fabric_return(self, lot_id, returned_rolls, quantity_returned, reason):
        """Test fabric return functionality"""
        try:
            return_data = {
                "returned_rolls": returned_rolls,
                "quantity_returned": quantity_returned,
                "reason": reason,
                "comments": "Test return via API testing"
            }
            
            response = requests.post(
                f"{self.base_url}/fabric-lots/{lot_id}/return",
                json=return_data
            )
            
            if response.status_code == 404:
                self.log_result("Fabric Return", False, 
                              f"Fabric lot {lot_id} not found")
                return False, None
            elif response.status_code == 400:
                error_msg = response.json().get('detail', 'Bad request')
                self.log_result("Fabric Return", False, 
                              f"Validation error: {error_msg}")
                return False, None
            elif response.status_code != 200:
                self.log_result("Fabric Return", False, 
                              f"Failed to return fabric. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            return_record = response.json()
            
            # Validate return record
            required_fields = ['id', 'fabric_lot_id', 'lot_number', 'returned_rolls', 
                             'quantity_returned', 'reason', 'return_date']
            missing_fields = [field for field in required_fields if field not in return_record]
            
            if missing_fields:
                self.log_result("Fabric Return", False, 
                              f"Missing required fields in return record: {missing_fields}", 
                              return_record)
                return False, None
            
            self.log_result("Fabric Return", True, 
                          f"Fabric return successful. Return ID: {return_record['id']}, "
                          f"Returned {quantity_returned}kg from rolls: {returned_rolls}")
            return True, return_record
            
        except Exception as e:
            self.log_result("Fabric Return", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_fabric_lot_after_return(self, lot_id, original_quantity, returned_quantity, original_rolls, returned_rolls):
        """Verify fabric lot is updated after return"""
        try:
            response = requests.get(f"{self.base_url}/fabric-lots/{lot_id}")
            
            if response.status_code != 200:
                self.log_result("Verify Fabric Lot After Return", False, 
                              f"Failed to get fabric lot after return. Status: {response.status_code}")
                return False
                
            updated_lot = response.json()
            
            # Check quantity is reduced
            expected_quantity = original_quantity - returned_quantity
            actual_quantity = updated_lot.get('remaining_quantity', 0)
            
            if abs(actual_quantity - expected_quantity) > 0.01:  # Allow small floating point differences
                self.log_result("Verify Fabric Lot After Return", False, 
                              f"Quantity not updated correctly. Expected: {expected_quantity}, "
                              f"Actual: {actual_quantity}")
                return False
            
            # Check rolls are removed
            updated_rolls = updated_lot.get('roll_numbers', [])
            expected_remaining_rolls = [roll for roll in original_rolls if roll not in returned_rolls]
            
            if set(updated_rolls) != set(expected_remaining_rolls):
                self.log_result("Verify Fabric Lot After Return", False, 
                              f"Rolls not updated correctly. Expected: {expected_remaining_rolls}, "
                              f"Actual: {updated_rolls}")
                return False
            
            self.log_result("Verify Fabric Lot After Return", True, 
                          f"Fabric lot updated correctly. New quantity: {actual_quantity}kg, "
                          f"Remaining rolls: {len(updated_rolls)}")
            return True
            
        except Exception as e:
            self.log_result("Verify Fabric Lot After Return", False, f"Exception occurred: {str(e)}")
            return False

    # ==================== TASK 2: UNIT PAYMENT FEATURE ====================
    
    def test_get_unit_pending_bills(self, unit_name):
        """Test getting pending bills for a unit"""
        try:
            response = requests.get(f"{self.base_url}/units/{unit_name}/pending-bills")
            
            if response.status_code == 404:
                self.log_result("Get Unit Pending Bills", False, 
                              f"Unit '{unit_name}' not found or no pending bills")
                return False, None
            elif response.status_code != 200:
                self.log_result("Get Unit Pending Bills", False, 
                              f"Failed to get pending bills. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            bills_data = response.json()
            
            # Validate response structure
            required_fields = ['unit_name', 'outsourcing_pending', 'ironing_pending', 
                             'total_pending', 'bills_count', 'bills']
            missing_fields = [field for field in required_fields if field not in bills_data]
            
            if missing_fields:
                self.log_result("Get Unit Pending Bills", False, 
                              f"Missing required fields: {missing_fields}", bills_data)
                return False, None
            
            # Validate bills array
            if not isinstance(bills_data['bills'], list):
                self.log_result("Get Unit Pending Bills", False, 
                              "Bills field is not an array", bills_data)
                return False, None
            
            self.log_result("Get Unit Pending Bills", True, 
                          f"Unit: {bills_data['unit_name']}, "
                          f"Outsourcing pending: ₹{bills_data['outsourcing_pending']}, "
                          f"Ironing pending: ₹{bills_data['ironing_pending']}, "
                          f"Total pending: ₹{bills_data['total_pending']}, "
                          f"Bills count: {bills_data['bills_count']}")
            return True, bills_data
            
        except Exception as e:
            self.log_result("Get Unit Pending Bills", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_record_unit_payment(self, unit_name, amount, payment_method="Cash", notes="Test payment"):
        """Test recording a payment for a unit"""
        try:
            payment_data = {
                "unit_name": unit_name,
                "amount": amount,
                "payment_method": payment_method,
                "notes": notes
            }
            
            response = requests.post(
                f"{self.base_url}/units/payment",
                json=payment_data
            )
            
            if response.status_code == 404:
                self.log_result("Record Unit Payment", False, 
                              f"Unit '{unit_name}' not found")
                return False, None
            elif response.status_code != 200:
                self.log_result("Record Unit Payment", False, 
                              f"Failed to record payment. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            payment_result = response.json()
            
            # Validate response
            if 'message' not in payment_result:
                self.log_result("Record Unit Payment", False, 
                              "Invalid payment response format", payment_result)
                return False, None
            
            self.log_result("Record Unit Payment", True, 
                          f"Payment recorded successfully. Amount: ₹{amount}, "
                          f"Method: {payment_method}, Unit: {unit_name}")
            return True, payment_result
            
        except Exception as e:
            self.log_result("Record Unit Payment", False, f"Exception occurred: {str(e)}")
            return False, None

    # ==================== TASK 3: MISTAKE TRACKING FEATURE ====================
    
    def test_get_outsourcing_orders(self):
        """Get outsourcing orders to find one for creating receipt with mistakes"""
        try:
            response = requests.get(f"{self.base_url}/outsourcing-orders")
            
            if response.status_code != 200:
                self.log_result("Get Outsourcing Orders", False, 
                              f"Failed to get outsourcing orders. Status: {response.status_code}", 
                              response.text)
                return False, []
                
            orders = response.json()
            
            if not isinstance(orders, list):
                self.log_result("Get Outsourcing Orders", False, 
                              "Response is not a list", orders)
                return False, []
            
            # Find orders with status 'Sent' (not yet received)
            sent_orders = [order for order in orders if order.get('status') == 'Sent']
            
            self.log_result("Get Outsourcing Orders", True, 
                          f"Retrieved {len(orders)} outsourcing orders, "
                          f"{len(sent_orders)} with 'Sent' status")
            return True, sent_orders
            
        except Exception as e:
            self.log_result("Get Outsourcing Orders", False, f"Exception occurred: {str(e)}")
            return False, []

    def test_create_outsourcing_receipt_with_mistakes(self, outsourcing_order_id, received_distribution, mistake_distribution):
        """Test creating outsourcing receipt with mistakes"""
        try:
            receipt_data = {
                "outsourcing_order_id": outsourcing_order_id,
                "receipt_date": datetime.now(timezone.utc).isoformat(),
                "received_distribution": received_distribution,
                "mistake_distribution": mistake_distribution
            }
            
            response = requests.post(
                f"{self.base_url}/outsourcing-receipts",
                json=receipt_data
            )
            
            if response.status_code == 404:
                self.log_result("Create Outsourcing Receipt with Mistakes", False, 
                              f"Outsourcing order {outsourcing_order_id} not found")
                return False, None
            elif response.status_code != 200:
                self.log_result("Create Outsourcing Receipt with Mistakes", False, 
                              f"Failed to create receipt. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            receipt = response.json()
            
            # Validate mistake tracking fields
            required_fields = ['total_mistakes', 'mistake_debit_amount', 'mistake_distribution']
            missing_fields = [field for field in required_fields if field not in receipt]
            
            if missing_fields:
                self.log_result("Create Outsourcing Receipt with Mistakes", False, 
                              f"Missing mistake tracking fields: {missing_fields}", receipt)
                return False, None
            
            # Validate mistake calculations
            expected_mistakes = sum(mistake_distribution.values())
            actual_mistakes = receipt.get('total_mistakes', 0)
            
            if actual_mistakes != expected_mistakes:
                self.log_result("Create Outsourcing Receipt with Mistakes", False, 
                              f"Mistake count mismatch. Expected: {expected_mistakes}, "
                              f"Actual: {actual_mistakes}")
                return False, None
            
            self.log_result("Create Outsourcing Receipt with Mistakes", True, 
                          f"Receipt created with mistakes. Total mistakes: {actual_mistakes}, "
                          f"Mistake debit amount: ₹{receipt.get('mistake_debit_amount', 0)}")
            return True, receipt
            
        except Exception as e:
            self.log_result("Create Outsourcing Receipt with Mistakes", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_get_ironing_orders(self):
        """Get ironing orders to find one for creating receipt with mistakes"""
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
            
            # Find orders with status 'Sent' (not yet received)
            sent_orders = [order for order in orders if order.get('status') == 'Sent']
            
            self.log_result("Get Ironing Orders", True, 
                          f"Retrieved {len(orders)} ironing orders, "
                          f"{len(sent_orders)} with 'Sent' status")
            return True, sent_orders
            
        except Exception as e:
            self.log_result("Get Ironing Orders", False, f"Exception occurred: {str(e)}")
            return False, []

    def test_create_ironing_receipt_with_mistakes(self, ironing_order_id, received_distribution, mistake_distribution):
        """Test creating ironing receipt with mistakes"""
        try:
            receipt_data = {
                "ironing_order_id": ironing_order_id,
                "receipt_date": datetime.now(timezone.utc).isoformat(),
                "received_distribution": received_distribution,
                "mistake_distribution": mistake_distribution
            }
            
            response = requests.post(
                f"{self.base_url}/ironing-receipts",
                json=receipt_data
            )
            
            if response.status_code == 404:
                self.log_result("Create Ironing Receipt with Mistakes", False, 
                              f"Ironing order {ironing_order_id} not found")
                return False, None
            elif response.status_code != 200:
                self.log_result("Create Ironing Receipt with Mistakes", False, 
                              f"Failed to create receipt. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            receipt = response.json()
            
            # Validate mistake tracking fields
            required_fields = ['total_mistakes', 'mistake_debit_amount', 'mistake_distribution']
            missing_fields = [field for field in required_fields if field not in receipt]
            
            if missing_fields:
                self.log_result("Create Ironing Receipt with Mistakes", False, 
                              f"Missing mistake tracking fields: {missing_fields}", receipt)
                return False, None
            
            # Validate mistake calculations
            expected_mistakes = sum(mistake_distribution.values())
            actual_mistakes = receipt.get('total_mistakes', 0)
            
            if actual_mistakes != expected_mistakes:
                self.log_result("Create Ironing Receipt with Mistakes", False, 
                              f"Mistake count mismatch. Expected: {expected_mistakes}, "
                              f"Actual: {actual_mistakes}")
                return False, None
            
            self.log_result("Create Ironing Receipt with Mistakes", True, 
                          f"Receipt created with mistakes. Total mistakes: {actual_mistakes}, "
                          f"Mistake debit amount: ₹{receipt.get('mistake_debit_amount', 0)}")
            return True, receipt
            
        except Exception as e:
            self.log_result("Create Ironing Receipt with Mistakes", False, f"Exception occurred: {str(e)}")
            return False, None

    # ==================== MAIN TEST EXECUTION ====================
    
    def run_comprehensive_tests(self):
        """Run all feature tests"""
        print("🧪 Starting All Features Tests (Fabric Return, Unit Payment, Mistake Tracking)")
        print("=" * 80)
        
        # ==================== TASK 1: FABRIC RETURN TESTS ====================
        print("\n📦 TASK 1: FABRIC RETURN FEATURE TESTS")
        print("-" * 50)
        
        # Get fabric lots
        success, fabric_lot = self.test_get_fabric_lots()
        
        if success and fabric_lot:
            lot_id = fabric_lot['id']
            original_quantity = fabric_lot.get('remaining_quantity', 0)
            original_rolls = fabric_lot.get('roll_numbers', [])
            
            # Test fabric return (return first roll with some quantity)
            if original_rolls and original_quantity > 5:
                returned_rolls = [original_rolls[0]]  # Return first roll
                quantity_returned = min(5.0, original_quantity / 2)  # Return 5kg or half, whichever is smaller
                
                return_success, return_record = self.test_fabric_return(
                    lot_id, returned_rolls, quantity_returned, "Testing fabric return API"
                )
                
                if return_success:
                    # Verify lot is updated after return
                    self.test_fabric_lot_after_return(
                        lot_id, original_quantity, quantity_returned, original_rolls, returned_rolls
                    )
            else:
                print("⚠️  Fabric lot has insufficient quantity or no rolls for return testing")
        else:
            print("⚠️  No suitable fabric lot found for return testing")
        
        # ==================== TASK 2: UNIT PAYMENT TESTS ====================
        print("\n💰 TASK 2: UNIT PAYMENT FEATURE TESTS")
        print("-" * 50)
        
        # Test with known unit names
        test_units = ["satish printing", "Test Print Unit", "Ravi Printing"]
        
        for unit_name in test_units:
            bills_success, bills_data = self.test_get_unit_pending_bills(unit_name)
            
            if bills_success and bills_data:
                # Test recording a payment
                payment_amount = 100.0
                self.test_record_unit_payment(unit_name, payment_amount, "Bank Transfer", "Test payment via API")
                break  # Only test payment for first successful unit
        else:
            print("⚠️  No units found with pending bills for payment testing")
        
        # ==================== TASK 3: MISTAKE TRACKING TESTS ====================
        print("\n🔍 TASK 3: MISTAKE TRACKING FEATURE TESTS")
        print("-" * 50)
        
        # Test outsourcing receipt with mistakes
        outsourcing_success, outsourcing_orders = self.test_get_outsourcing_orders()
        
        if outsourcing_success and outsourcing_orders:
            # Use first sent order for testing
            test_order = outsourcing_orders[0]
            order_id = test_order['id']
            sent_distribution = test_order.get('size_distribution', {})
            
            # Create received distribution (slightly less than sent)
            received_distribution = {}
            mistake_distribution = {}
            
            for size, sent_qty in sent_distribution.items():
                if sent_qty > 2:
                    received_qty = sent_qty - 1  # Receive 1 less
                    mistake_qty = 1  # 1 mistake piece
                else:
                    received_qty = sent_qty
                    mistake_qty = 0
                
                received_distribution[size] = received_qty
                if mistake_qty > 0:
                    mistake_distribution[size] = mistake_qty
            
            if mistake_distribution:  # Only test if we have mistakes
                self.test_create_outsourcing_receipt_with_mistakes(
                    order_id, received_distribution, mistake_distribution
                )
            else:
                print("⚠️  No suitable outsourcing order found for mistake testing")
        else:
            print("⚠️  No outsourcing orders found for mistake testing")
        
        # Test ironing receipt with mistakes
        ironing_success, ironing_orders = self.test_get_ironing_orders()
        
        if ironing_success and ironing_orders:
            # Use first sent order for testing
            test_order = ironing_orders[0]
            order_id = test_order['id']
            sent_distribution = test_order.get('size_distribution', {})
            
            # Create received distribution (slightly less than sent)
            received_distribution = {}
            mistake_distribution = {}
            
            for size, sent_qty in sent_distribution.items():
                if sent_qty > 2:
                    received_qty = sent_qty - 1  # Receive 1 less
                    mistake_qty = 1  # 1 mistake piece
                else:
                    received_qty = sent_qty
                    mistake_qty = 0
                
                received_distribution[size] = received_qty
                if mistake_qty > 0:
                    mistake_distribution[size] = mistake_qty
            
            if mistake_distribution:  # Only test if we have mistakes
                self.test_create_ironing_receipt_with_mistakes(
                    order_id, received_distribution, mistake_distribution
                )
            else:
                print("⚠️  No suitable ironing order found for mistake testing")
        else:
            print("⚠️  No ironing orders found for mistake testing")
        
        # ==================== SUMMARY ====================
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
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
    print("🏭 Garment Manufacturing App - All Features Backend Tests")
    print(f"🌐 Testing against: {BACKEND_URL}")
    print()
    
    tester = AllFeaturesTester()
    success = tester.run_comprehensive_tests()
    
    if success:
        print("\n🎉 All tests passed! All 3 features are working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()