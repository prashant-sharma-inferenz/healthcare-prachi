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

    def test_create_activity(self):
        """Test creating a new activity for a referral"""
        if not self.created_referral_id:
            print("❌ No referral ID available for activity test")
            return False
        
        test_activity = {
            "activity_type": "call",
            "date_time": datetime.now().isoformat(),
            "notes": "Test activity notes for automated testing"
        }
        
        success, response = self.run_test(
            "Create Activity",
            "POST",
            f"referrals/{self.created_referral_id}/activities",
            200,
            data=test_activity
        )
        
        if success:
            # Validate activity response structure
            required_fields = ['id', 'referral_id', 'activity_type', 'date_time', 'notes', 'created_at']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field in activity response: {field}")
                    return False
            print("✅ Activity response structure validated")
            
            # Validate activity data
            if response['referral_id'] != self.created_referral_id:
                print(f"❌ Activity referral_id mismatch")
                return False
            if response['activity_type'] != test_activity['activity_type']:
                print(f"❌ Activity type mismatch")
                return False
            print("✅ Activity data validated")
        
        return success

    def test_get_activities(self):
        """Test getting activities for a referral"""
        if not self.created_referral_id:
            print("❌ No referral ID available for get activities test")
            return False
        
        success, response = self.run_test(
            "Get Activities",
            "GET",
            f"referrals/{self.created_referral_id}/activities",
            200
        )
        
        if success:
            if not isinstance(response, list):
                print(f"❌ Activities response should be a list")
                return False
            
            if len(response) > 0:
                # Validate first activity structure
                activity = response[0]
                required_fields = ['id', 'referral_id', 'activity_type', 'date_time', 'notes', 'created_at']
                for field in required_fields:
                    if field not in activity:
                        print(f"❌ Missing field in activity: {field}")
                        return False
                print(f"✅ Found {len(response)} activities with valid structure")
            else:
                print("✅ No activities found (empty list)")
        
        return success

    def test_create_activity_validation(self):
        """Test activity creation with invalid data"""
        if not self.created_referral_id:
            print("❌ No referral ID available for activity validation test")
            return False
        
        # Test missing activity type
        success1, _ = self.run_test(
            "Create Activity - Missing Type",
            "POST",
            f"referrals/{self.created_referral_id}/activities",
            422,
            data={
                "date_time": datetime.now().isoformat(),
                "notes": "Test notes"
            }
        )
        
        # Test missing date_time
        success2, _ = self.run_test(
            "Create Activity - Missing DateTime",
            "POST",
            f"referrals/{self.created_referral_id}/activities",
            422,
            data={
                "activity_type": "call",
                "notes": "Test notes"
            }
        )
        
        # Test missing notes
        success3, _ = self.run_test(
            "Create Activity - Missing Notes",
            "POST",
            f"referrals/{self.created_referral_id}/activities",
            422,
            data={
                "activity_type": "call",
                "date_time": datetime.now().isoformat()
            }
        )
        
        return success1 or success2 or success3  # At least one validation should work

    def test_activity_for_nonexistent_referral(self):
        """Test creating activity for non-existent referral"""
        fake_referral_id = "non-existent-referral-id"
        
        test_activity = {
            "activity_type": "call",
            "date_time": datetime.now().isoformat(),
            "notes": "Test activity for non-existent referral"
        }
        
        success, response = self.run_test(
            "Create Activity - Non-existent Referral",
            "POST",
            f"referrals/{fake_referral_id}/activities",
            404,
            data=test_activity
        )
        
        return success

    def test_multiple_activities_chronological_order(self):
        """Test creating multiple activities and verify chronological order"""
        if not self.created_referral_id:
            print("❌ No referral ID available for chronological test")
            return False
        
        # Create multiple activities with different timestamps
        activities = [
            {
                "activity_type": "email",
                "date_time": "2024-01-01T10:00:00Z",
                "notes": "First activity - email"
            },
            {
                "activity_type": "call",
                "date_time": "2024-01-02T10:00:00Z", 
                "notes": "Second activity - call"
            },
            {
                "activity_type": "visit",
                "date_time": "2024-01-03T10:00:00Z",
                "notes": "Third activity - visit"
            }
        ]
        
        # Create all activities
        for i, activity in enumerate(activities):
            success, _ = self.run_test(
                f"Create Activity {i+1}",
                "POST",
                f"referrals/{self.created_referral_id}/activities",
                200,
                data=activity
            )
            if not success:
                return False
        
        # Get activities and check order (should be sorted by date_time descending)
        success, response = self.run_test(
            "Get Activities - Check Order",
            "GET",
            f"referrals/{self.created_referral_id}/activities",
            200
        )
        
        if success and len(response) >= 3:
            # Check if activities are in descending order by date_time
            dates = [activity['date_time'] for activity in response[-3:]]  # Get last 3 activities
            sorted_dates = sorted(dates, reverse=True)
            if dates == sorted_dates:
                print("✅ Activities are in correct chronological order (newest first)")
                return True
            else:
                print(f"❌ Activities not in correct order. Got: {dates}, Expected: {sorted_dates}")
                return False
        
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
        ("Create Activity", tester.test_create_activity),
        ("Get Activities", tester.test_get_activities),
        ("Activity Validation", tester.test_create_activity_validation),
        ("Activity Non-existent Referral", tester.test_activity_for_nonexistent_referral),
        ("Multiple Activities Order", tester.test_multiple_activities_chronological_order),
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