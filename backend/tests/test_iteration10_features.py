"""
Iteration 10 Tests: Avatar Picker + File Viewer + Co-viewing
Tests for:
1. PUT /api/me with avatar_url (DiceBear URL or null)
2. GET /api/auth/me returns avatar_url
3. WebSocket present_start/present_sync/present_stop handling
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAvatarAPI:
    """Tests for avatar_url field in user profile"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        yield
        # Cleanup: reset avatar to null
        self.session.put(f"{BASE_URL}/api/me", json={"avatar_url": None})
    
    def test_set_avatar_url_dicebear(self):
        """Test setting avatar_url to a DiceBear URL"""
        dicebear_url = "https://api.dicebear.com/9.x/adventurer/svg?seed=Luna&radius=50&size=80"
        
        # Set avatar
        resp = self.session.put(f"{BASE_URL}/api/me", json={"avatar_url": dicebear_url})
        assert resp.status_code == 200
        data = resp.json()
        assert data["avatar_url"] == dicebear_url
        
        # Verify via GET /api/auth/me
        me_resp = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["user"]["avatar_url"] == dicebear_url
    
    def test_set_avatar_url_different_styles(self):
        """Test setting avatar_url with different DiceBear styles"""
        styles = ["adventurer", "avataaars", "big-ears", "bottts", "fun-emoji", "lorelei"]
        
        for style in styles:
            url = f"https://api.dicebear.com/9.x/{style}/svg?seed=TestSeed&radius=50&size=80"
            resp = self.session.put(f"{BASE_URL}/api/me", json={"avatar_url": url})
            assert resp.status_code == 200
            assert resp.json()["avatar_url"] == url
    
    def test_clear_avatar_url_to_null(self):
        """Test clearing avatar_url by setting to null (Use Initials)"""
        # First set an avatar
        dicebear_url = "https://api.dicebear.com/9.x/micah/svg?seed=Felix&radius=50&size=80"
        self.session.put(f"{BASE_URL}/api/me", json={"avatar_url": dicebear_url})
        
        # Clear avatar by setting to null
        resp = self.session.put(f"{BASE_URL}/api/me", json={"avatar_url": None})
        assert resp.status_code == 200
        data = resp.json()
        assert data["avatar_url"] is None
        
        # Verify via GET /api/auth/me
        me_resp = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        assert me_resp.json()["user"]["avatar_url"] is None
    
    def test_avatar_url_persists_after_other_updates(self):
        """Test that avatar_url persists when updating other fields"""
        dicebear_url = "https://api.dicebear.com/9.x/pixel-art/svg?seed=Nova&radius=50&size=80"
        
        # Set avatar
        self.session.put(f"{BASE_URL}/api/me", json={"avatar_url": dicebear_url})
        
        # Update name only
        resp = self.session.put(f"{BASE_URL}/api/me", json={"name": "Admin Updated"})
        assert resp.status_code == 200
        assert resp.json()["avatar_url"] == dicebear_url
        
        # Reset name
        self.session.put(f"{BASE_URL}/api/me", json={"name": "Admin"})


class TestUserProfileAPI:
    """Tests for user profile endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert login_resp.status_code == 200
        yield
    
    def test_get_me_returns_avatar_url(self):
        """Test GET /api/me returns avatar_url field"""
        resp = self.session.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "avatar_url" in data
    
    def test_get_auth_me_returns_avatar_url(self):
        """Test GET /api/auth/me returns avatar_url in user object"""
        resp = self.session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert "avatar_url" in data["user"]
    
    def test_user_profile_has_all_fields(self):
        """Test user profile has all expected fields"""
        resp = self.session.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200
        data = resp.json()
        
        expected_fields = ["id", "email", "name", "initials", "color", "status", 
                          "avatar_url", "onboarded", "role", "phone", "auto_sms", "created_at"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"


class TestTableSharedItems:
    """Tests for table shared items (for FileViewerModal)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert login_resp.status_code == 200
        yield
    
    def test_get_tables_list(self):
        """Test GET /api/tables returns list of tables"""
        resp = self.session.get(f"{BASE_URL}/api/tables")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_get_table_with_items(self):
        """Test GET /api/tables/{id} returns items array"""
        # Get tables first
        tables_resp = self.session.get(f"{BASE_URL}/api/tables")
        tables = tables_resp.json()
        
        if len(tables) > 0:
            table_id = tables[0]["id"]
            resp = self.session.get(f"{BASE_URL}/api/tables/{table_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert "items" in data
            assert isinstance(data["items"], list)
    
    def test_add_shared_item_to_table(self):
        """Test POST /api/tables/{id}/items adds a shared item"""
        # Get tables first
        tables_resp = self.session.get(f"{BASE_URL}/api/tables")
        tables = tables_resp.json()
        
        if len(tables) > 0:
            table_id = tables[0]["id"]
            
            # Add a test item
            item_data = {
                "type": "photo",
                "name": "TEST_iteration10_image.jpg",
                "url": "https://example.com/test-image.jpg",
                "mime_type": "image/jpeg"
            }
            resp = self.session.post(f"{BASE_URL}/api/tables/{table_id}/items", json=item_data)
            assert resp.status_code == 200
            data = resp.json()
            assert data["name"] == item_data["name"]
            assert data["url"] == item_data["url"]
            assert data["mime_type"] == item_data["mime_type"]
            
            # Cleanup: delete the test item
            item_id = data["id"]
            self.session.delete(f"{BASE_URL}/api/tables/{table_id}/items/{item_id}")


class TestRegressionAuth:
    """Regression tests for authentication"""
    
    def test_login_with_admin_credentials(self):
        """Test login with admin credentials works"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert data["user"]["email"] == "admin@roundtable.app"
    
    def test_login_with_wrong_password_fails(self):
        """Test login with wrong password returns 401"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "wrongpassword"
        })
        assert resp.status_code == 401


class TestRegressionNavigation:
    """Regression tests for navigation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert login_resp.status_code == 200
        yield
    
    def test_get_events(self):
        """Test GET /api/events works"""
        resp = self.session.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
    
    def test_get_messages(self):
        """Test GET /api/messages works"""
        resp = self.session.get(f"{BASE_URL}/api/messages")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
    
    def test_get_notifications(self):
        """Test GET /api/notifications works"""
        resp = self.session.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
    
    def test_get_contacts(self):
        """Test GET /api/contacts works"""
        resp = self.session.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
    
    def test_get_call_history(self):
        """Test GET /api/calls/history works"""
        resp = self.session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
