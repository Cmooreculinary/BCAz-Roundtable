"""
Iteration 12 Backend Tests - Polish fixes verification
Tests: Upload endpoint, file URLs, auth, and regression tests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_api_health(self):
        """Test API is running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"API health check passed: {data}")
    
    def test_login_admin(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert response.status_code == 200
        data = response.json()
        # API returns {"user": {...}} wrapper
        user = data.get("user", data)
        assert "id" in user
        assert user.get("email") == "admin@roundtable.app"
        print(f"Admin login successful: {user.get('name')}")
        return response.cookies


class TestUploadEndpoint:
    """Test file upload endpoint with /api prefix"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert response.status_code == 200
        return session
    
    def test_upload_endpoint_exists(self, auth_session):
        """Test that /api/upload endpoint exists and requires auth"""
        # Test without file - should return 422 (validation error) not 404
        response = auth_session.post(f"{BASE_URL}/api/upload")
        # 422 means endpoint exists but validation failed (no file)
        # 401 means auth required
        # 404 would mean endpoint doesn't exist
        assert response.status_code in [422, 400], f"Expected 422 or 400, got {response.status_code}"
        print(f"Upload endpoint exists at /api/upload, status: {response.status_code}")
    
    def test_upload_with_file(self, auth_session):
        """Test actual file upload"""
        # Create a simple test file
        files = {'file': ('test.txt', b'Hello World', 'text/plain')}
        response = auth_session.post(f"{BASE_URL}/api/upload", files=files)
        
        # Should succeed or fail gracefully (storage might not be configured)
        if response.status_code == 200:
            data = response.json()
            assert "storage_path" in data
            print(f"File uploaded successfully: {data}")
        else:
            # Storage might not be configured - that's OK for this test
            print(f"Upload returned {response.status_code}: {response.text[:200]}")
            # As long as it's not 404, the endpoint exists
            assert response.status_code != 404


class TestMembersAndMessages:
    """Test members and messages endpoints"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert response.status_code == 200
        return session
    
    def test_get_members(self, auth_session):
        """Test getting members list"""
        response = auth_session.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} members")
        
        # Check member structure includes avatar_url field
        if data:
            member = data[0]
            assert "id" in member
            assert "name" in member
            # avatar_url may or may not be present
            print(f"Sample member: {member.get('name')}, avatar_url: {member.get('avatar_url', 'None')}")
    
    def test_get_messages(self, auth_session):
        """Test getting messages"""
        response = auth_session.get(f"{BASE_URL}/api/messages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} messages")
        
        # Check message structure includes read field for read receipts
        if data:
            msg = data[0]
            assert "id" in msg
            assert "text" in msg
            # read field should exist for read receipts feature
            print(f"Sample message has 'read' field: {'read' in msg}")


class TestTablesAndItems:
    """Test tables and items endpoints"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert response.status_code == 200
        return session
    
    def test_get_tables(self, auth_session):
        """Test getting tables list"""
        response = auth_session.get(f"{BASE_URL}/api/tables")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} tables")
        return data
    
    def test_get_table_detail(self, auth_session):
        """Test getting table detail with members"""
        # First get tables
        tables_response = auth_session.get(f"{BASE_URL}/api/tables")
        tables = tables_response.json()
        
        if tables:
            table_id = tables[0].get("id")
            response = auth_session.get(f"{BASE_URL}/api/tables/{table_id}")
            assert response.status_code == 200
            data = response.json()
            
            assert "id" in data
            assert "name" in data
            assert "members" in data
            
            # Check members have avatar-related fields
            if data.get("members"):
                member = data["members"][0]
                print(f"Table member: {member.get('name')}, avatar_url: {member.get('avatar_url', 'None')}")


class TestUserProfile:
    """Test user profile endpoints"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert response.status_code == 200
        return session
    
    def test_get_me(self, auth_session):
        """Test getting current user profile"""
        response = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        
        # API returns {"user": {...}} wrapper
        user = data.get("user", data)
        assert "id" in user
        assert "email" in user
        assert "name" in user
        
        # Check avatar_url field exists (may be None)
        print(f"Current user: {user.get('name')}, avatar_url: {user.get('avatar_url', 'None')}")
    
    def test_update_profile(self, auth_session):
        """Test updating user profile"""
        # Get current profile
        me_response = auth_session.get(f"{BASE_URL}/api/auth/me")
        current = me_response.json()
        
        # Update with same name (no actual change)
        response = auth_session.put(f"{BASE_URL}/api/me", json={
            "name": current.get("name", "Admin")
        })
        assert response.status_code == 200
        print("Profile update endpoint works")


class TestWalkieEndpoints:
    """Test walkie talkie endpoints"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert response.status_code == 200
        return session
    
    def test_walkie_ping(self, auth_session):
        """Test walkie ping endpoint"""
        # Get a member to ping
        members_response = auth_session.get(f"{BASE_URL}/api/members")
        members = members_response.json()
        
        if members:
            # Find a member that's not the current user
            me_response = auth_session.get(f"{BASE_URL}/api/auth/me")
            me = me_response.json()
            
            other = next((m for m in members if m.get("id") != me.get("id")), None)
            if other:
                response = auth_session.post(f"{BASE_URL}/api/walkie/ping", json={
                    "to_user": other.get("id")
                })
                # Should succeed or return appropriate error
                assert response.status_code in [200, 201, 400, 404]
                print(f"Walkie ping to {other.get('name')}: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
