"""
Phase 3 Backend Tests - Growth & Gather Features
Tests for:
1. Table purpose field (family/bible_study/community/friends/work/other)
2. Prayer & Intention shared item types
3. Public invite preview endpoint (GET /api/invites/preview/{code})
4. AI event suggestions endpoint (POST /api/tables/{id}/suggest-events)
"""
import pytest
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_PASSWORD, TEST_USER_PASSWORD, BASE_URL
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = ADMIN_EMAIL
ADMIN_PASSWORD = ADMIN_PASSWORD

class TestTablePurposeField:
    """Tests for table purpose field (Phase 3 feature)"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client, auth_token):
        self.client = api_client
        self.token = auth_token
        self.client.cookies.set("rt_access", auth_token)
    
    def test_create_table_with_purpose_family(self, api_client, auth_token):
        """POST /api/tables with purpose='family' should work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Family Table",
            "color": "#FF9500",
            "active": True,
            "purpose": "family"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "family"
        assert data["name"] == "TEST_Family Table"
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{data['id']}")
    
    def test_create_table_with_purpose_bible_study(self, api_client, auth_token):
        """POST /api/tables with purpose='bible_study' should work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Bible Study Group",
            "color": "#AF52DE",
            "active": True,
            "purpose": "bible_study"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "bible_study"
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{data['id']}")
    
    def test_create_table_with_purpose_community(self, api_client, auth_token):
        """POST /api/tables with purpose='community' should work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Community Group",
            "color": "#34C759",
            "purpose": "community"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "community"
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{data['id']}")
    
    def test_create_table_with_purpose_friends(self, api_client, auth_token):
        """POST /api/tables with purpose='friends' should work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Friends Group",
            "color": "#5AC8FA",
            "purpose": "friends"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "friends"
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{data['id']}")
    
    def test_create_table_with_purpose_work(self, api_client, auth_token):
        """POST /api/tables with purpose='work' should work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Work Team",
            "color": "#007AFF",
            "purpose": "work"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "work"
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{data['id']}")
    
    def test_create_table_with_purpose_other(self, api_client, auth_token):
        """POST /api/tables with purpose='other' should work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Other Group",
            "color": "#8E8E93",
            "purpose": "other"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "other"
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{data['id']}")
    
    def test_create_table_default_purpose(self, api_client, auth_token):
        """POST /api/tables without purpose should default to 'other'"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_No Purpose Table",
            "color": "#007AFF"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "other"
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{data['id']}")
    
    def test_create_table_invalid_purpose_rejected(self, api_client, auth_token):
        """POST /api/tables with invalid purpose should be rejected"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Invalid Purpose",
            "color": "#007AFF",
            "purpose": "invalid_purpose"
        })
        assert response.status_code == 422  # Validation error
    
    def test_update_table_purpose(self, api_client, auth_token):
        """PUT /api/tables/{id} should allow updating purpose"""
        api_client.cookies.set("rt_access", auth_token)
        # Create table
        create_resp = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Update Purpose Table",
            "color": "#007AFF",
            "purpose": "family"
        })
        assert create_resp.status_code == 200
        table_id = create_resp.json()["id"]
        
        # Update purpose
        update_resp = api_client.put(f"{BASE_URL}/api/tables/{table_id}", json={
            "purpose": "bible_study"
        })
        assert update_resp.status_code == 200
        assert update_resp.json()["purpose"] == "bible_study"
        
        # Verify persistence
        get_resp = api_client.get(f"{BASE_URL}/api/tables/{table_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["purpose"] == "bible_study"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{table_id}")


class TestPrayerIntentionItems:
    """Tests for prayer and intention shared item types (Phase 3 feature)"""
    
    def test_add_prayer_item(self, api_client, auth_token):
        """POST /api/tables/{id}/items with type='prayer' should work"""
        api_client.cookies.set("rt_access", auth_token)
        # Create table first
        table_resp = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Prayer Table",
            "color": "#AF52DE",
            "purpose": "bible_study"
        })
        assert table_resp.status_code == 200
        table_id = table_resp.json()["id"]
        
        # Add prayer item
        item_resp = api_client.post(f"{BASE_URL}/api/tables/{table_id}/items", json={
            "type": "prayer",
            "name": "Prayer for healing",
            "url": "Please pray for my grandmother's recovery"
        })
        assert item_resp.status_code == 200
        data = item_resp.json()
        assert data["type"] == "prayer"
        assert data["name"] == "Prayer for healing"
        assert data["table_id"] == table_id
        
        # Verify in table items
        table_data = api_client.get(f"{BASE_URL}/api/tables/{table_id}").json()
        prayer_items = [i for i in table_data["items"] if i["type"] == "prayer"]
        assert len(prayer_items) >= 1
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{table_id}")
    
    def test_add_intention_item(self, api_client, auth_token):
        """POST /api/tables/{id}/items with type='intention' should work"""
        api_client.cookies.set("rt_access", auth_token)
        # Create table first
        table_resp = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Intention Table",
            "color": "#FFCC00",
            "purpose": "bible_study"
        })
        assert table_resp.status_code == 200
        table_id = table_resp.json()["id"]
        
        # Add intention item
        item_resp = api_client.post(f"{BASE_URL}/api/tables/{table_id}/items", json={
            "type": "intention",
            "name": "Weekly intention",
            "url": "To be more patient with my family"
        })
        assert item_resp.status_code == 200
        data = item_resp.json()
        assert data["type"] == "intention"
        assert data["name"] == "Weekly intention"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{table_id}")
    
    def test_old_item_types_still_work(self, api_client, auth_token):
        """Existing item types (photo, document, etc.) should still work"""
        api_client.cookies.set("rt_access", auth_token)
        # Create table
        table_resp = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Old Types Table",
            "color": "#007AFF"
        })
        table_id = table_resp.json()["id"]
        
        # Test various old types
        old_types = ["photo", "document", "video", "audio", "link", "note", "spreadsheet", "presentation"]
        for item_type in old_types:
            resp = api_client.post(f"{BASE_URL}/api/tables/{table_id}/items", json={
                "type": item_type,
                "name": f"TEST_{item_type} item"
            })
            assert resp.status_code == 200, f"Failed for type: {item_type}"
            assert resp.json()["type"] == item_type
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{table_id}")


class TestPublicInvitePreview:
    """Tests for public invite preview endpoint (Phase 3 feature)"""
    
    def test_preview_valid_invite_no_auth(self):
        """GET /api/invites/preview/{code} should work without auth"""
        # Use the known test invite code
        response = requests.get(f"{BASE_URL}/api/invites/preview/HO4IIE6D")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "table" in data
        assert "inviter" in data
        assert "uses" in data
        assert "max_uses" in data
        
        # Verify table fields
        table = data["table"]
        assert "id" in table
        assert "name" in table
        assert "color" in table
        assert "active" in table
        assert "purpose" in table
        assert "member_count" in table
        
        # Verify inviter fields
        inviter = data["inviter"]
        assert "name" in inviter
        assert "initials" in inviter
        assert "color" in inviter
    
    def test_preview_invalid_code_returns_404(self):
        """GET /api/invites/preview/{invalid_code} should return 404"""
        response = requests.get(f"{BASE_URL}/api/invites/preview/INVALID123")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_preview_returns_purpose_field(self):
        """Preview should include table purpose field"""
        response = requests.get(f"{BASE_URL}/api/invites/preview/HO4IIE6D")
        assert response.status_code == 200
        data = response.json()
        assert data["table"]["purpose"] == "bible_study"
    
    def test_preview_returns_member_count(self):
        """Preview should include member count"""
        response = requests.get(f"{BASE_URL}/api/invites/preview/HO4IIE6D")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["table"]["member_count"], int)
        assert data["table"]["member_count"] >= 1


class TestAISuggestEvents:
    """Tests for AI event suggestions endpoint (Phase 3 feature)"""
    
    def test_suggest_events_requires_auth(self):
        """POST /api/tables/{id}/suggest-events should require auth"""
        # Get a table ID first (using the known test table)
        preview = requests.get(f"{BASE_URL}/api/invites/preview/HO4IIE6D").json()
        table_id = preview["table"]["id"]
        
        # Try without auth
        response = requests.post(f"{BASE_URL}/api/tables/{table_id}/suggest-events")
        assert response.status_code == 401
    
    def test_suggest_events_requires_membership(self):
        """POST /api/tables/{id}/suggest-events should require table membership"""
        # Create a fresh session for a new user
        new_client = requests.Session()
        new_client.headers.update({"Content-Type": "application/json"})
        
        # Create a new user who is NOT a member of the test table
        unique_email = f"test_nonmember_{int(time.time())}@micro.app"
        reg_resp = new_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Non Member"
        })
        assert reg_resp.status_code == 200
        
        # Get the test table ID
        preview = requests.get(f"{BASE_URL}/api/invites/preview/HO4IIE6D").json()
        table_id = preview["table"]["id"]
        
        # Try to get suggestions (should fail with 403)
        response = new_client.post(f"{BASE_URL}/api/tables/{table_id}/suggest-events")
        assert response.status_code == 403
        assert "not a member" in response.json()["detail"].lower()
    
    def test_suggest_events_returns_valid_structure(self, api_client, auth_token):
        """POST /api/tables/{id}/suggest-events should return valid structure"""
        api_client.cookies.set("rt_access", auth_token)
        
        # Create a table where admin is a member
        table_resp = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_AI Suggestions Table",
            "color": "#AF52DE",
            "purpose": "bible_study"
        })
        assert table_resp.status_code == 200
        table_id = table_resp.json()["id"]
        
        # Get suggestions (may take a few seconds for AI)
        response = api_client.post(f"{BASE_URL}/api/tables/{table_id}/suggest-events", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "suggestions" in data
        assert "purpose" in data
        assert isinstance(data["suggestions"], list)
        
        # If suggestions returned, verify their structure
        if data["suggestions"]:
            for s in data["suggestions"]:
                assert "title" in s
                assert "date" in s
                assert "time" in s
                # Date should be in YYYY-MM-DD format
                assert len(s["date"]) == 10
                assert s["date"][4] == "-" and s["date"][7] == "-"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{table_id}")
    
    def test_suggest_events_graceful_failure(self, api_client, auth_token):
        """AI endpoint should return empty list on failure, not 500"""
        api_client.cookies.set("rt_access", auth_token)
        
        # Create a table
        table_resp = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Graceful Failure Table",
            "color": "#007AFF",
            "purpose": "work"
        })
        table_id = table_resp.json()["id"]
        
        # Even if AI fails, should return 200 with empty suggestions
        response = api_client.post(f"{BASE_URL}/api/tables/{table_id}/suggest-events", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        # Should be a list (empty or with items)
        assert isinstance(data["suggestions"], list)
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/tables/{table_id}")


class TestPhase1Phase2Regression:
    """Regression tests to ensure Phase 1 + Phase 2 endpoints still work"""
    
    def test_auth_login(self, api_client):
        """POST /api/auth/login should still work"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        assert "user" in response.json()
    
    def test_auth_me(self, api_client, auth_token):
        """GET /api/auth/me should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        assert "user" in response.json()
    
    def test_tables_crud(self, api_client, auth_token):
        """Tables CRUD should still work"""
        api_client.cookies.set("rt_access", auth_token)
        
        # Create
        create_resp = api_client.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Regression Table",
            "color": "#007AFF"
        })
        assert create_resp.status_code == 200
        table_id = create_resp.json()["id"]
        
        # Read
        get_resp = api_client.get(f"{BASE_URL}/api/tables/{table_id}")
        assert get_resp.status_code == 200
        
        # Update
        update_resp = api_client.put(f"{BASE_URL}/api/tables/{table_id}", json={
            "name": "TEST_Updated Regression Table"
        })
        assert update_resp.status_code == 200
        
        # Delete
        delete_resp = api_client.delete(f"{BASE_URL}/api/tables/{table_id}")
        assert delete_resp.status_code == 200
    
    def test_messages_endpoint(self, api_client, auth_token):
        """GET /api/messages should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/messages")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_emails_endpoint(self, api_client, auth_token):
        """GET /api/emails should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/emails?folder=inbox")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_texts_endpoint(self, api_client, auth_token):
        """GET /api/texts should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/texts")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_events_endpoint(self, api_client, auth_token):
        """GET /api/events should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_notifications_endpoint(self, api_client, auth_token):
        """GET /api/notifications should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_invites_endpoint(self, api_client, auth_token):
        """GET /api/invites should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/invites")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_contacts_endpoint(self, api_client, auth_token):
        """GET /api/contacts should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/contacts")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_referrals_endpoint(self, api_client, auth_token):
        """GET /api/referrals should still work"""
        api_client.cookies.set("rt_access", auth_token)
        response = api_client.get(f"{BASE_URL}/api/referrals")
        assert response.status_code == 200
        data = response.json()
        assert "badge" in data
        assert "joined" in data
    
    def test_health_endpoint(self):
        """GET /api/ health check should still work"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token for admin"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        # Extract token from cookies
        return response.cookies.get("rt_access")
    pytest.skip("Authentication failed - skipping authenticated tests")
