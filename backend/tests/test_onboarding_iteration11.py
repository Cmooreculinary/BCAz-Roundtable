"""
Iteration 11 Tests: Enhanced Onboarding Flow
Tests for:
- User registration creates user with onboarded=false
- PUT /api/me updates onboarded status
- Table creation during onboarding
- Invite code generation during onboarding
- User profile updates (name, color, avatar_url, phone, auto_sms)
"""
import pytest
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_PASSWORD, TEST_USER_PASSWORD, BASE_URL
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOnboardingFlow:
    """Tests for the enhanced onboarding flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_email = f"TEST_onboard_{int(time.time())}@roundtable.app"
        self.test_password = TEST_PASSWORD
        self.test_name = "Test Onboard User"
        yield
        # Cleanup: logout
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except:
            pass
    
    def test_register_creates_unonboarded_user(self):
        """Test that registration creates a user with onboarded=false"""
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Verify user data
        assert "user" in data
        user = data["user"]
        # Email is lowercased by backend
        assert user["email"] == self.test_email.lower()
        assert user["name"] == self.test_name
        assert user["onboarded"] == False, "New user should have onboarded=false"
        assert "id" in user
        print(f"✓ User registered with onboarded=false: {user['id']}")
    
    def test_update_profile_during_onboarding(self):
        """Test updating user profile (name, color, avatar_url) during onboarding"""
        # Register new user
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_profile_{int(time.time())}@roundtable.app",
            "password": self.test_password,
            "name": "Initial Name"
        })
        assert response.status_code == 200
        
        # Update profile
        update_response = self.session.put(f"{BASE_URL}/api/me", json={
            "name": "Updated Name",
            "color": "#FF9500",
            "avatar_url": "https://api.dicebear.com/9.x/avataaars/svg?seed=test"
        })
        
        assert update_response.status_code == 200, f"Profile update failed: {update_response.text}"
        updated_user = update_response.json()
        
        assert updated_user["name"] == "Updated Name"
        assert updated_user["color"] == "#FF9500"
        assert updated_user["avatar_url"] == "https://api.dicebear.com/9.x/avataaars/svg?seed=test"
        print("✓ Profile updated successfully during onboarding")
    
    def test_update_phone_and_auto_sms(self):
        """Test updating phone number and auto_sms setting"""
        # Register new user
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_phone_{int(time.time())}@roundtable.app",
            "password": self.test_password,
            "name": "Phone Test User"
        })
        assert response.status_code == 200
        
        # Update phone and auto_sms
        update_response = self.session.put(f"{BASE_URL}/api/me", json={
            "phone": "+15551234567",
            "auto_sms": True
        })
        
        assert update_response.status_code == 200, f"Phone update failed: {update_response.text}"
        updated_user = update_response.json()
        
        assert updated_user["phone"] == "+15551234567"
        assert updated_user["auto_sms"] == True
        print("✓ Phone and auto_sms updated successfully")
    
    def test_complete_onboarding(self):
        """Test completing onboarding by setting onboarded=true"""
        # Register new user
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_complete_{int(time.time())}@roundtable.app",
            "password": self.test_password,
            "name": "Complete Test User"
        })
        assert response.status_code == 200
        user = response.json()["user"]
        assert user["onboarded"] == False
        
        # Complete onboarding
        update_response = self.session.put(f"{BASE_URL}/api/me", json={
            "onboarded": True
        })
        
        assert update_response.status_code == 200, f"Onboarding completion failed: {update_response.text}"
        updated_user = update_response.json()
        
        assert updated_user["onboarded"] == True
        print("✓ Onboarding completed successfully")
        
        # Verify via GET /api/auth/me (returns nested user object)
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        me_user = me_data.get("user", me_data)  # Handle both nested and flat response
        assert me_user["onboarded"] == True
        print("✓ Onboarded status persisted correctly")


class TestTableCreationDuringOnboarding:
    """Tests for table creation during onboarding Step 4"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and register user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Register new user
        self.test_email = f"TEST_table_{int(time.time())}@roundtable.app"
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": TEST_PASSWORD,
            "name": "Table Test User"
        })
        assert response.status_code == 200
        self.user = response.json()["user"]
        yield
        # Cleanup
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except:
            pass
    
    def test_create_table_during_onboarding(self):
        """Test creating a table during onboarding Step 4"""
        response = self.session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST Onboard Table",
            "color": "#34C759",
            "active": True
        })
        
        assert response.status_code in [200, 201], f"Table creation failed: {response.text}"
        table = response.json()
        
        assert table["name"] == "TEST Onboard Table"
        assert table["color"] == "#34C759"
        assert table["active"] == True
        assert "id" in table
        print(f"✓ Table created during onboarding: {table['id']}")
        
        # Verify table appears in user's tables
        tables_response = self.session.get(f"{BASE_URL}/api/tables")
        assert tables_response.status_code == 200
        tables = tables_response.json()
        
        table_ids = [t["id"] for t in tables]
        assert table["id"] in table_ids
        print("✓ Created table appears in user's tables list")


class TestInviteCodeDuringOnboarding:
    """Tests for invite code generation during onboarding Step 5"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session, register user, and create table"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Register new user
        self.test_email = f"TEST_invite_{int(time.time())}@roundtable.app"
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": TEST_PASSWORD,
            "name": "Invite Test User"
        })
        assert response.status_code == 200
        self.user = response.json()["user"]
        
        # Create table
        table_response = self.session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST Invite Table",
            "color": "#007AFF",
            "active": True
        })
        assert table_response.status_code in [200, 201]
        self.table = table_response.json()
        yield
        # Cleanup
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except:
            pass
    
    def test_generate_invite_code(self):
        """Test generating invite code during onboarding Step 5"""
        response = self.session.post(f"{BASE_URL}/api/invites", json={
            "table_id": self.table["id"],
            "max_uses": 50,
            "expires_in_days": 30
        })
        
        assert response.status_code in [200, 201], f"Invite creation failed: {response.text}"
        invite = response.json()
        
        assert "code" in invite
        assert len(invite["code"]) > 0
        assert invite["table_id"] == self.table["id"]
        print(f"✓ Invite code generated: {invite['code']}")


class TestExistingUserOnboardedStatus:
    """Tests for existing onboarded users"""
    
    def test_admin_is_onboarded(self):
        """Test that admin user has onboarded=true"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        assert "user" in data
        assert data["user"]["onboarded"] == True, "Admin should be onboarded"
        print("✓ Admin user is onboarded")
        
        # Cleanup
        session.post(f"{BASE_URL}/api/auth/logout")


class TestRegressionAPIs:
    """Regression tests for existing APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        yield
        # Cleanup
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except:
            pass
    
    def test_get_tables(self):
        """Test GET /api/tables still works"""
        response = self.session.get(f"{BASE_URL}/api/tables")
        assert response.status_code == 200
        tables = response.json()
        assert isinstance(tables, list)
        print(f"✓ GET /api/tables returns {len(tables)} tables")
    
    def test_get_events(self):
        """Test GET /api/events still works"""
        response = self.session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)
        print(f"✓ GET /api/events returns {len(events)} events")
    
    def test_get_notifications(self):
        """Test GET /api/notifications still works"""
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        notifications = response.json()
        assert isinstance(notifications, list)
        print(f"✓ GET /api/notifications returns {len(notifications)} notifications")
    
    def test_get_referrals(self):
        """Test GET /api/referrals still works"""
        response = self.session.get(f"{BASE_URL}/api/referrals")
        assert response.status_code == 200
        referrals = response.json()
        assert isinstance(referrals, dict)
        print("✓ GET /api/referrals works")
    
    def test_get_emails(self):
        """Test GET /api/emails still works"""
        response = self.session.get(f"{BASE_URL}/api/emails?folder=inbox")
        assert response.status_code == 200
        emails = response.json()
        assert isinstance(emails, list)
        print(f"✓ GET /api/emails returns {len(emails)} emails")
    
    def test_bridges_status(self):
        """Test GET /api/bridges/status still works"""
        response = self.session.get(f"{BASE_URL}/api/bridges/status")
        assert response.status_code == 200
        status = response.json()
        assert "sms_configured" in status
        print(f"✓ GET /api/bridges/status works, sms_configured={status['sms_configured']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
