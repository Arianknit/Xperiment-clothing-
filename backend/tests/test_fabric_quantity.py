#!/usr/bin/env python3
"""
Backend Testing Suite for Fabric Lot Creation and Roll Weights Feature
Tests fabric lot creation without quantity field and roll weights calculation
"""

import requests
import json
from datetime import datetime, timezone
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://garmentpro-2.preview.emergentagent.com/api"

class FabricQuantityTester:
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

    def test_create_fabric_lot_without_quantity(self):
        """Test creating fabric lot without quantity field - should have quantity=0"""
        try:
            # Create fabric lot data WITHOUT quantity field
            fabric_lot_data = {
                "entry_date": datetime.now(timezone.utc).isoformat(),
                "fabric_type": "Cotton Blend",
                "supplier_name": "Premium Textiles Ltd",
                "color": "Navy Blue",
                "rib_quantity": 15.5,
                "rate_per_kg": 450.0,
                "number_of_rolls": 3
            }
            
            response = requests.post(
                f"{self.base_url}/fabric-lots",
                json=fabric_lot_data
            )
            
            if response.status_code != 200:
                self.log_result("Create Fabric Lot Without Quantity", False, 
                              f"Failed to create fabric lot. Status: {response.status_code}", 
                              response.text)
                return False, None
                
            lot = response.json()
            
            # Track for cleanup
            self.created_resources.append(('fabric_lot', lot['id']))
            
            # Validate required fields
            required_fields = ['id', 'lot_number', 'quantity', 'remaining_quantity', 
                             'total_amount', 'roll_numbers']
            missing_fields = [field for field in required_fields if field not in lot]
            
            if missing_fields:
                self.log_result("Create Fabric Lot Without Quantity", False, 
                              f"Missing required fields: {missing_fields}", lot)
                return False, None
            
            # Check that quantity is 0
            if lot['quantity'] != 0:
                self.log_result("Create Fabric Lot Without Quantity", False, 
                              f"Expected quantity=0, got quantity={lot['quantity']}", lot)
                return False, None
            
            # Check that remaining_quantity is 0
            if lot['remaining_quantity'] != 0:
                self.log_result("Create Fabric Lot Without Quantity", False, 
                              f"Expected remaining_quantity=0, got remaining_quantity={lot['remaining_quantity']}", lot)
                return False, None
            
            # Check that total_amount is 0
            if lot['total_amount'] != 0:
                self.log_result("Create Fabric Lot Without Quantity", False, 
                              f"Expected total_amount=0, got total_amount={lot['total_amount']}", lot)
                return False, None
            
            # Check roll numbers are generated correctly
            expected_roll_count = fabric_lot_data['number_of_rolls']
            if len(lot['roll_numbers']) != expected_roll_count:
                self.log_result("Create Fabric Lot Without Quantity", False, 
                              f"Expected {expected_roll_count} roll numbers, got {len(lot['roll_numbers'])}", lot)
                return False, None
            
            # Validate roll number format (lot_number + color + serial)
            lot_number = lot['lot_number']
            color_no_spaces = fabric_lot_data['color'].replace(' ', '')
            for i, roll_number in enumerate(lot['roll_numbers'], 1):
                expected_roll = f"{lot_number}{color_no_spaces}{i}"
                if roll_number != expected_roll:
                    self.log_result("Create Fabric Lot Without Quantity", False, 
                                  f"Roll number format incorrect. Expected: {expected_roll}, Got: {roll_number}", lot)
                    return False, None
            
            self.log_result("Create Fabric Lot Without Quantity", True, 
                          f"Fabric lot created successfully with quantity=0. "
                          f"Lot: {lot['lot_number']}, Rolls: {len(lot['roll_numbers'])}")
            return True, lot
            
        except Exception as e:
            self.log_result("Create Fabric Lot Without Quantity", False, f"Exception occurred: {str(e)}")
            return False, None

    def test_update_roll_weights(self, lot_id, lot_number):
        """Test updating roll weights with cumulative scale readings"""
        try:
            # Test with 3 rolls: readings [25, 52, 80] should give weights [25, 27, 28]
            scale_readings = [25.0, 52.0, 80.0]
            expected_weights = [25.0, 27.0, 28.0]  # Individual roll weights
            expected_total = 80.0  # Sum of all weights
            
            weights_data = {
                "scale_readings": scale_readings
            }
            
            response = requests.put(
                f"{self.base_url}/fabric-lots/{lot_id}/roll-weights",
                json=weights_data
            )
            
            if response.status_code != 200:
                self.log_result("Update Roll Weights", False, 
                              f"Failed to update roll weights. Status: {response.status_code}", 
                              response.text)
                return False
                
            result = response.json()
            
            # Validate response structure
            required_fields = ['message', 'lot_number', 'scale_readings', 'roll_weights', 
                             'total_weight', 'roll_details']
            missing_fields = [field for field in required_fields if field not in result]
            
            if missing_fields:
                self.log_result("Update Roll Weights", False, 
                              f"Missing required fields in response: {missing_fields}", result)
                return False
            
            # Check scale readings match
            if result['scale_readings'] != scale_readings:
                self.log_result("Update Roll Weights", False, 
                              f"Scale readings mismatch. Expected: {scale_readings}, Got: {result['scale_readings']}", result)
                return False
            
            # Check calculated roll weights
            if result['roll_weights'] != expected_weights:
                self.log_result("Update Roll Weights", False, 
                              f"Roll weights calculation incorrect. Expected: {expected_weights}, Got: {result['roll_weights']}", result)
                return False
            
            # Check total weight
            if result['total_weight'] != expected_total:
                self.log_result("Update Roll Weights", False, 
                              f"Total weight incorrect. Expected: {expected_total}, Got: {result['total_weight']}", result)
                return False
            
            # Validate roll details structure
            if len(result['roll_details']) != len(scale_readings):
                self.log_result("Update Roll Weights", False, 
                              f"Roll details count mismatch. Expected: {len(scale_readings)}, Got: {len(result['roll_details'])}", result)
                return False
            
            self.log_result("Update Roll Weights", True, 
                          f"Roll weights updated successfully. Total weight: {result['total_weight']} kg, "
                          f"Individual weights: {result['roll_weights']}")
            return True
            
        except Exception as e:
            self.log_result("Update Roll Weights", False, f"Exception occurred: {str(e)}")
            return False

    def test_verify_fabric_lot_after_weights(self, lot_id, expected_quantity=80.0, expected_rate=450.0):
        """Test verifying fabric lot after weights update"""
        try:
            response = requests.get(f"{self.base_url}/fabric-lots/{lot_id}")
            
            if response.status_code != 200:
                self.log_result("Verify Fabric Lot After Weights", False, 
                              f"Failed to get fabric lot. Status: {response.status_code}", 
                              response.text)
                return False
                
            lot = response.json()
            
            # Check quantity is updated
            if lot['quantity'] != expected_quantity:
                self.log_result("Verify Fabric Lot After Weights", False, 
                              f"Quantity not updated correctly. Expected: {expected_quantity}, Got: {lot['quantity']}", lot)
                return False
            
            # Check remaining_quantity is updated
            if lot['remaining_quantity'] != expected_quantity:
                self.log_result("Verify Fabric Lot After Weights", False, 
                              f"Remaining quantity not updated correctly. Expected: {expected_quantity}, Got: {lot['remaining_quantity']}", lot)
                return False
            
            # Check total_amount is calculated correctly (quantity × rate_per_kg)
            expected_total_amount = expected_quantity * expected_rate
            if lot['total_amount'] != expected_total_amount:
                self.log_result("Verify Fabric Lot After Weights", False, 
                              f"Total amount not calculated correctly. Expected: {expected_total_amount}, Got: {lot['total_amount']}", lot)
                return False
            
            # Check roll weights are present
            if not lot.get('roll_weights'):
                self.log_result("Verify Fabric Lot After Weights", False, 
                              "Roll weights not saved in fabric lot", lot)
                return False
            
            # Check scale readings are present
            if not lot.get('scale_readings'):
                self.log_result("Verify Fabric Lot After Weights", False, 
                              "Scale readings not saved in fabric lot", lot)
                return False
            
            self.log_result("Verify Fabric Lot After Weights", True, 
                          f"Fabric lot verified successfully. Quantity: {lot['quantity']} kg, "
                          f"Total amount: ₹{lot['total_amount']}")
            return True
            
        except Exception as e:
            self.log_result("Verify Fabric Lot After Weights", False, f"Exception occurred: {str(e)}")
            return False

    def test_list_all_fabric_lots(self):
        """Test listing all fabric lots to verify pending and calculated lots"""
        try:
            response = requests.get(f"{self.base_url}/fabric-lots")
            
            if response.status_code != 200:
                self.log_result("List All Fabric Lots", False, 
                              f"Failed to get fabric lots. Status: {response.status_code}", 
                              response.text)
                return False
                
            lots = response.json()
            
            if not isinstance(lots, list):
                self.log_result("List All Fabric Lots", False, 
                              "Response is not a list", lots)
                return False
            
            # Count lots with quantity=0 (pending weighing) and quantity>0 (after weighing)
            pending_lots = [lot for lot in lots if lot.get('quantity', 0) == 0]
            weighed_lots = [lot for lot in lots if lot.get('quantity', 0) > 0]
            
            self.log_result("List All Fabric Lots", True, 
                          f"Retrieved {len(lots)} fabric lots. "
                          f"Pending weighing: {len(pending_lots)}, "
                          f"After weighing: {len(weighed_lots)}")
            return True
            
        except Exception as e:
            self.log_result("List All Fabric Lots", False, f"Exception occurred: {str(e)}")
            return False

    def test_invalid_roll_weights_scenarios(self, lot_id):
        """Test invalid scenarios for roll weights update"""
        try:
            # Test 1: Wrong number of readings
            wrong_readings = {
                "scale_readings": [25.0, 52.0]  # Only 2 readings for 3 rolls
            }
            
            response = requests.put(
                f"{self.base_url}/fabric-lots/{lot_id}/roll-weights",
                json=wrong_readings
            )
            
            if response.status_code == 200:
                self.log_result("Invalid Roll Weights - Wrong Count", False, 
                              "Should have failed with wrong number of readings", response.json())
                return False
            
            # Test 2: Non-ascending readings
            non_ascending = {
                "scale_readings": [25.0, 52.0, 45.0]  # Third reading is less than second
            }
            
            response = requests.put(
                f"{self.base_url}/fabric-lots/{lot_id}/roll-weights",
                json=non_ascending
            )
            
            if response.status_code == 200:
                self.log_result("Invalid Roll Weights - Non-ascending", False, 
                              "Should have failed with non-ascending readings", response.json())
                return False
            
            self.log_result("Invalid Roll Weights Scenarios", True, 
                          "All invalid scenarios correctly rejected")
            return True
            
        except Exception as e:
            self.log_result("Invalid Roll Weights Scenarios", False, f"Exception occurred: {str(e)}")
            return False

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        for resource_type, resource_id in self.created_resources:
            try:
                if resource_type == 'fabric_lot':
                    response = requests.delete(f"{self.base_url}/fabric-lots/{resource_id}")
                    if response.status_code == 200:
                        print(f"   ✅ Deleted fabric lot: {resource_id}")
                    else:
                        print(f"   ⚠️  Failed to delete fabric lot: {resource_id}")
            except Exception as e:
                print(f"   ❌ Error deleting {resource_type} {resource_id}: {str(e)}")

    def run_comprehensive_tests(self):
        """Run all fabric quantity tests"""
        print("🧪 Starting Fabric Lot Creation and Roll Weights Tests")
        print("=" * 60)
        
        # Test 1: Create fabric lot without quantity
        success, created_lot = self.test_create_fabric_lot_without_quantity()
        if not success or not created_lot:
            print("⚠️  Cannot continue with remaining tests - fabric lot creation failed")
            return False
        
        lot_id = created_lot['id']
        lot_number = created_lot['lot_number']
        
        # Test 2: Update roll weights
        self.test_update_roll_weights(lot_id, lot_number)
        
        # Test 3: Verify fabric lot after weights update
        self.test_verify_fabric_lot_after_weights(lot_id)
        
        # Test 4: List all fabric lots
        self.test_list_all_fabric_lots()
        
        # Test 5: Invalid roll weights scenarios
        self.test_invalid_roll_weights_scenarios(lot_id)
        
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
    print("🏭 Garment Manufacturing App - Fabric Quantity Backend Tests")
    print(f"🌐 Testing against: {BACKEND_URL}")
    print()
    
    tester = FabricQuantityTester()
    
    try:
        success = tester.run_comprehensive_tests()
        
        if success:
            print("\n🎉 All tests passed! Fabric lot creation and roll weights feature is working correctly.")
        else:
            print("\n⚠️  Some tests failed. Please check the issues above.")
        
        return success
        
    finally:
        # Always cleanup resources
        tester.cleanup_resources()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)