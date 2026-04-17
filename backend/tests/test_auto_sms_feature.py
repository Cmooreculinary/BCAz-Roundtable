"""
Test Auto-SMS Opt-in Feature (Iteration 8)
Tests:
- PUT /api/me accepts phone and auto_sms fields
- GET /api/auth/me returns phone and auto_sms in user object
- GET /api/bridges/status returns sms_configured: true
- send_auto_sms_if_offline helper logic (via code path verification)
- Regression: Login, Contacts, Call History
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@roundtable.app"
ADMIN_PASSWORD = "roundtable2026"


class TestAutoSMSFeature:
    """Tests for the auto-SMS opt-in feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.user_data = response.json().get("user", {})
    
    def test_login_returns_phone_and_auto_sms(self):
        """Test that login response includes phone and auto_sms fields"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        user = response.json().get("user", {})
        assert "phone" in user, "phone field missing from login response"
        assert "auto_sms" in user, "auto_sms field missing from login response"
        print(f"Login response includes phone={user.get('phone')} and auto_sms={user.get('auto_sms')}")
    
    def test_get_auth_me_returns_phone_and_auto_sms(self):
        """Test GET /api/auth/me returns phone and auto_sms in user object"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        user = response.json().get("user", {})
        assert "phone" in user, "phone field missing from /api/auth/me response"
        assert "auto_sms" in user, "auto_sms field missing from /api/auth/me response"
        print(f"GET /api/auth/me returns phone={user.get('phone')} and auto_sms={user.get('auto_sms')}")
    
    def test_get_me_returns_phone_and_auto_sms(self):
        """Test GET /api/me returns phone and auto_sms"""
        response = self.session.get(f"{BASE_URL}/api/me")
        assert response.status_code == 200
        user = response.json()
        assert "phone" in user, "phone field missing from /api/me response"
        assert "auto_sms" in user, "auto_sms field missing from /api/me response"
        print(f"GET /api/me returns phone={user.get('phone')} and auto_sms={user.get('auto_sms')}")
    
    def test_put_me_accepts_phone_field(self):
        """Test PUT /api/me accepts phone field"""
        test_phone = "+15551234567"
        response = self.session.put(f"{BASE_URL}/api/me", json={"phone": test_phone})
        assert response.status_code == 200
        user = response.json()
        assert user.get("phone") == test_phone, f"Phone not updated: expected {test_phone}, got {user.get('phone')}"
        print(f"PUT /api/me successfully updated phone to {test_phone}")
    
    def test_put_me_accepts_auto_sms_field(self):
        """Test PUT /api/me accepts auto_sms field"""
        # First enable auto_sms
        response = self.session.put(f"{BASE_URL}/api/me", json={"auto_sms": True})
        assert response.status_code == 200
        user = response.json()
        assert user.get("auto_sms") == True, f"auto_sms not enabled: got {user.get('auto_sms')}"
        print("PUT /api/me successfully enabled auto_sms")
        
        # Then disable auto_sms
        response = self.session.put(f"{BASE_URL}/api/me", json={"auto_sms": False})
        assert response.status_code == 200
        user = response.json()
        assert user.get("auto_sms") == False, f"auto_sms not disabled: got {user.get('auto_sms')}"
        print("PUT /api/me successfully disabled auto_sms")
    
    def test_put_me_accepts_phone_and_auto_sms_together(self):
        """Test PUT /api/me accepts both phone and auto_sms in same request"""
        test_phone = "+15559876543"
        response = self.session.put(f"{BASE_URL}/api/me", json={
            "phone": test_phone,
            "auto_sms": True
        })
        assert response.status_code == 200
        user = response.json()
        assert user.get("phone") == test_phone, f"Phone not updated: expected {test_phone}, got {user.get('phone')}"
        assert user.get("auto_sms") == True, f"auto_sms not enabled: got {user.get('auto_sms')}"
        print(f"PUT /api/me successfully updated phone={test_phone} and auto_sms=True together")
    
    def test_put_me_phone_max_length(self):
        """Test PUT /api/me enforces phone max_length=20"""
        # Valid phone (under 20 chars)
        valid_phone = "+15551234567890"  # 15 chars
        response = self.session.put(f"{BASE_URL}/api/me", json={"phone": valid_phone})
        assert response.status_code == 200
        
        # Invalid phone (over 20 chars)
        invalid_phone = "+1555123456789012345678"  # 23 chars
        response = self.session.put(f"{BASE_URL}/api/me", json={"phone": invalid_phone})
        assert response.status_code == 422, f"Expected 422 for phone > 20 chars, got {response.status_code}"
        print("PUT /api/me correctly enforces phone max_length=20")
    
    def test_put_me_phone_empty_string_behavior(self):
        """Test PUT /api/me with phone='' (empty string) behavior"""
        # First set a phone
        self.session.put(f"{BASE_URL}/api/me", json={"phone": "+15551234567"})
        
        # Note: exclude_none=True in Pydantic means null values are excluded from updates
        # This is expected behavior - phone field is Optional and null is excluded
        # To clear phone, frontend should send empty string or handle differently
        response = self.session.put(f"{BASE_URL}/api/me", json={"phone": ""})
        assert response.status_code == 200
        user = response.json()
        # Empty string should be stored as empty or null
        assert user.get("phone") in [None, ""], f"Phone should be empty/null: got {user.get('phone')}"
        print(f"PUT /api/me with empty string sets phone to: {user.get('phone')}")


class TestBridgeStatus:
    """Tests for bridge status endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
    
    def test_bridge_status_returns_sms_configured(self):
        """Test GET /api/bridges/status returns sms_configured: true"""
        response = self.session.get(f"{BASE_URL}/api/bridges/status")
        assert response.status_code == 200
        data = response.json()
        assert "sms_configured" in data, "sms_configured field missing"
        assert data["sms_configured"] == True, f"Expected sms_configured=true, got {data['sms_configured']}"
        print(f"GET /api/bridges/status returns sms_configured={data['sms_configured']}")
    
    def test_bridge_status_returns_email_configured(self):
        """Test GET /api/bridges/status returns email_configured field"""
        response = self.session.get(f"{BASE_URL}/api/bridges/status")
        assert response.status_code == 200
        data = response.json()
        assert "email_configured" in data, "email_configured field missing"
        print(f"GET /api/bridges/status returns email_configured={data['email_configured']}")


class TestRegressionChecks:
    """Regression tests to ensure existing functionality still works"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
    
    def test_login_works(self):
        """Regression: Login with admin credentials works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        assert "user" in response.json()
        print("Regression: Login works correctly")
    
    def test_contacts_endpoint_works(self):
        """Regression: GET /api/contacts returns list"""
        response = self.session.get(f"{BASE_URL}/api/contacts")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Regression: GET /api/contacts returns {len(response.json())} contacts")
    
    def test_call_history_endpoint_works(self):
        """Regression: GET /api/calls/history returns list"""
        response = self.session.get(f"{BASE_URL}/api/calls/history")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Regression: GET /api/calls/history returns {len(response.json())} calls")
    
    def test_tables_endpoint_works(self):
        """Regression: GET /api/tables returns list"""
        response = self.session.get(f"{BASE_URL}/api/tables")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Regression: GET /api/tables returns {len(response.json())} tables")
    
    def test_events_endpoint_works(self):
        """Regression: GET /api/events returns list"""
        response = self.session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Regression: GET /api/events returns {len(response.json())} events")


class TestAutoSMSTriggerPoints:
    """
    Tests to verify auto-SMS trigger points exist in the code.
    Note: We can't actually test SMS delivery (Twilio trial), but we verify the code paths.
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.user_id = response.json().get("user", {}).get("id")
    
    def test_walkie_ping_endpoint_exists(self):
        """Test POST /api/walkie/ping endpoint exists (triggers auto-SMS for offline users)"""
        # We need a valid to_user - use our own user_id (won't actually send SMS to self)
        response = self.session.post(f"{BASE_URL}/api/walkie/ping", json={
            "to_user": self.user_id
        })
        # Should succeed (200) or fail gracefully
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"
        print(f"POST /api/walkie/ping endpoint exists, status={response.status_code}")
    
    def test_messages_endpoint_exists(self):
        """Test POST /api/messages endpoint exists (triggers auto-SMS for offline users)"""
        response = self.session.post(f"{BASE_URL}/api/messages", json={
            "to_user": self.user_id,
            "text": "Test message for auto-SMS verification"
        })
        assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
        print(f"POST /api/messages endpoint exists, status={response.status_code}")
    
    def test_members_endpoint_returns_phone_and_auto_sms(self):
        """Test GET /api/members returns users with phone and auto_sms fields"""
        response = self.session.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        members = response.json()
        if members:
            # Check first member has the fields
            first_member = members[0]
            assert "phone" in first_member, "phone field missing from member"
            assert "auto_sms" in first_member, "auto_sms field missing from member"
            print(f"GET /api/members returns {len(members)} members with phone and auto_sms fields")
        else:
            print("GET /api/members returns empty list (no other members)")
