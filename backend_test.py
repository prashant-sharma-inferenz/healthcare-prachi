import requests
import sys
import json
import io
from datetime import datetime

class HospiceIntakeAPITester:
    def __init__(self, base_url="https://hospice-onboard-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_referral_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers, timeout=30)
                else:
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=headers, timeout=30)

            print(f"   Response Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_get_metrics(self):
        """Test metrics endpoint"""
        success, response = self.run_test(
            "Get Metrics",
            "GET",
            "metrics",
            200
        )
        
        if success:
            # Validate metrics structure
            required_fields = ['total_referrals', 'total_pending_admission', 'conversion_percentage', 'total_non_admit']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field in metrics: {field}")
                    return False
            print("✅ Metrics structure validated")
        
        return success

    def test_get_referrals(self):
        """Test get all referrals"""
        success, response = self.run_test(
            "Get All Referrals",
            "GET",
            "referrals",
            200
        )
        return success

    def test_get_pending_referrals(self):
        """Test get pending referrals"""
        success, response = self.run_test(
            "Get Pending Referrals",
            "GET",
            "referrals?status=pending",
            200
        )
        return success

    def test_create_referral(self):
        """Test creating a new referral"""
        test_data = {
            "patient_name": f"Test Patient {datetime.now().strftime('%H%M%S')}",
            "referral_source": "hospital"
        }
        
        success, response = self.run_test(
            "Create Referral",
            "POST",
            "referrals",
            200,
            data=test_data
        )
        
        if success and 'id' in response:
            self.created_referral_id = response['id']
            print(f"✅ Created referral with ID: {self.created_referral_id}")
            
            # Validate response structure
            required_fields = ['id', 'patient_name', 'referral_source', 'status', 'created_at']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field in referral response: {field}")
                    return False
            print("✅ Referral response structure validated")
        
        return success

    def test_file_upload(self):
        """Test file upload functionality"""
        if not self.created_referral_id:
            print("❌ No referral ID available for file upload test")
            return False
        
        # Create a test file
        test_file_content = b"This is a test file for hospice intake testing"
        test_file = io.BytesIO(test_file_content)
        test_file.name = "test_document.txt"
        
        files = {
            'file': ('test_document.txt', test_file, 'text/plain')
        }
        
        data = {
            'referral_id': self.created_referral_id
        }
        
        success, response = self.run_test(
            "Upload File",
            "POST",
            f"upload?referral_id={self.created_referral_id}",
            200,
            data=data,
            files=files
        )
        
        if success:
            # Validate upload response
            required_fields = ['id', 'filename', 'path', 'size']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field in upload response: {field}")
                    return False
            print("✅ File upload response structure validated")
        
        return success

    def test_invalid_referral_creation(self):
        """Test creating referral with invalid data"""
        # Test missing patient name
        success, response = self.run_test(
            "Create Referral - Missing Patient Name",
            "POST",
            "referrals",
            422,  # Validation error expected
            data={"referral_source": "hospital"}
        )
        
        # Test missing referral source
        success2, response2 = self.run_test(
            "Create Referral - Missing Referral Source",
            "POST",
            "referrals",
            422,  # Validation error expected
            data={"patient_name": "Test Patient"}
        )
        
        return success or success2  # At least one validation should work

    def test_metrics_after_creation(self):
        """Test that metrics update after creating referral"""
        success, response = self.run_test(
            "Get Updated Metrics",
            "GET",
            "metrics",
            200
        )
        
        if success:
            print(f"✅ Updated metrics: Total Referrals: {response.get('total_referrals', 0)}")
            print(f"   Pending Admission: {response.get('total_pending_admission', 0)}")
            print(f"   Conversion Rate: {response.get('conversion_percentage', 0)}%")
            print(f"   Non-Admit: {response.get('total_non_admit', 0)}")
        
        return success

def main():
    print("🏥 Starting Hospice Intake API Testing...")
    print("=" * 50)
    
    tester = HospiceIntakeAPITester()
    
    # Test sequence
    tests = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("Initial Metrics", tester.test_get_metrics),
        ("Get All Referrals", tester.test_get_referrals),
        ("Get Pending Referrals", tester.test_get_pending_referrals),
        ("Create Referral", tester.test_create_referral),
        ("File Upload", tester.test_file_upload),
        ("Invalid Referral Creation", tester.test_invalid_referral_creation),
        ("Updated Metrics", tester.test_metrics_after_creation),
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                print(f"\n⚠️  Test '{test_name}' failed but continuing...")
        except Exception as e:
            print(f"\n💥 Test '{test_name}' crashed: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())