"""
Roundtable_VO API Backend Tests
Tests all core endpoints: Auth, Users, Tables, Items, Messages, Emails, Events, Notifications, Invites, Contacts, Referrals
"""
import pytest
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_PASSWORD, TEST_USER_PASSWORD, BASE_URL
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = ADMIN_EMAIL
ADMIN_PASSWORD = ADMIN_PASSWORD
TEST_USER_EMAIL = "test_demo@roundtable.app"
TEST_USER_PASSWORD = TEST_USER_PASSWORD
TEST_USER_NAME = "Test Demo User"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_health(self):
        """Test API root endpoint returns ok"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "Roundtable_VO" in data["service"]
        print(f"✓ API health check passed: {data}")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_admin_success(self):
        """Test admin login with correct credentials"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert data["user"]["onboarded"] == True
        # Check cookies are set
        assert "rt_access" in session.cookies or "rt_access" in response.cookies
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_register_new_user(self):
        """Test user registration creates user and sets cookies"""
        session = requests.Session()
        unique_email = f"test_{int(time.time())}@roundtable.app"
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test User"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == unique_email.lower()
        assert data["user"]["onboarded"] == False  # New users not onboarded
        assert data["user"]["role"] == "member"
        print(f"✓ User registration successful: {data['user']['email']}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email returns 409"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": ADMIN_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Duplicate User"
        })
        assert response.status_code == 409
        print("✓ Duplicate email correctly rejected")
    
    def test_auth_me_with_cookies(self):
        """Test GET /api/auth/me returns current user"""
        session = requests.Session()
        # Login first
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        
        # Get current user
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        data = me_resp.json()
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ GET /api/auth/me returned: {data['user']['email']}")
    
    def test_auth_me_without_auth(self):
        """Test GET /api/auth/me without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthenticated /api/auth/me correctly returns 401")
    
    def test_logout(self):
        """Test logout clears cookies"""
        session = requests.Session()
        # Login
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        # Logout
        logout_resp = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200
        data = logout_resp.json()
        assert data["ok"] == True
        print("✓ Logout successful")


class TestUserEndpoints:
    """User profile endpoint tests"""
    
    def test_get_me(self):
        """Test GET /api/me returns user profile"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert "id" in data
        assert "name" in data
        print(f"✓ GET /api/me returned user: {data['email']}")
    
    def test_update_me(self):
        """Test PUT /api/me updates profile"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Update profile
        response = session.put(f"{BASE_URL}/api/me", json={
            "status": "away",
            "color": "#FF5733"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "away"
        assert data["color"] == "#FF5733"
        
        # Verify persistence
        verify_resp = session.get(f"{BASE_URL}/api/me")
        verify_data = verify_resp.json()
        assert verify_data["status"] == "away"
        
        # Reset status
        session.put(f"{BASE_URL}/api/me", json={"status": "online", "color": "#AF52DE"})
        print("✓ PUT /api/me updated profile successfully")
    
    def test_list_members(self):
        """Test GET /api/members returns member list"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/members returned {len(data)} members")


class TestTableEndpoints:
    """Table CRUD endpoint tests"""
    
    def test_create_table(self):
        """Test POST /api/tables creates table with owner membership"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        response = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Table_Create",
            "color": "#007AFF",
            "active": True
        })
        assert response.status_code == 200, f"Create table failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Table_Create"
        assert "id" in data
        assert data["member_count"] == 1  # Creator auto-added
        assert len(data["members"]) == 1
        
        # Cleanup
        table_id = data["id"]
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print(f"✓ POST /api/tables created table: {data['name']}")
    
    def test_list_tables(self):
        """Test GET /api/tables returns user's tables"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create a table first
        create_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Table_List",
            "color": "#34C759"
        })
        table_id = create_resp.json()["id"]
        
        # List tables
        response = session.get(f"{BASE_URL}/api/tables")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(t["id"] == table_id for t in data)
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print(f"✓ GET /api/tables returned {len(data)} tables")
    
    def test_get_single_table(self):
        """Test GET /api/tables/{id} returns table with members/items/events"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create table
        create_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Table_Get",
            "color": "#FF9500"
        })
        table_id = create_resp.json()["id"]
        
        # Get single table
        response = session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == table_id
        assert "members" in data
        assert "items" in data
        assert "events" in data
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print(f"✓ GET /api/tables/{table_id} returned table with members/items/events")
    
    def test_update_table(self):
        """Test PUT /api/tables/{id} updates table (owner only)"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create table
        create_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Table_Update",
            "color": "#5856D6"
        })
        table_id = create_resp.json()["id"]
        
        # Update table
        response = session.put(f"{BASE_URL}/api/tables/{table_id}", json={
            "name": "TEST_Table_Updated",
            "active": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Table_Updated"
        assert data["active"] == True
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ PUT /api/tables/{id} updated table successfully")
    
    def test_delete_table(self):
        """Test DELETE /api/tables/{id} deletes table (owner only)"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create table
        create_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Table_Delete",
            "color": "#FF2D55"
        })
        table_id = create_resp.json()["id"]
        
        # Delete table
        response = session.delete(f"{BASE_URL}/api/tables/{table_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] == True
        
        # Verify deletion
        get_resp = session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert get_resp.status_code in [403, 404]  # Not found or not member
        print("✓ DELETE /api/tables/{id} deleted table successfully")


class TestTableMembershipGuard:
    """Test per-table data isolation - non-members should get 403"""
    
    def test_non_member_cannot_access_table(self):
        """Test non-member gets 403 when accessing table"""
        # Create table as admin
        admin_session = requests.Session()
        admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        create_resp = admin_session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Private_Table",
            "color": "#8E8E93"
        })
        table_id = create_resp.json()["id"]
        
        # Create and login as different user
        other_session = requests.Session()
        unique_email = f"test_other_{int(time.time())}@roundtable.app"
        other_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Other User"
        })
        
        # Try to access table as non-member
        response = other_session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ Non-member correctly gets 403 when accessing table")
    
    def test_non_member_cannot_post_items(self):
        """Test non-member gets 403 when posting items to table"""
        # Create table as admin
        admin_session = requests.Session()
        admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        create_resp = admin_session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Private_Items",
            "color": "#8E8E93"
        })
        table_id = create_resp.json()["id"]
        
        # Create and login as different user
        other_session = requests.Session()
        unique_email = f"test_item_{int(time.time())}@roundtable.app"
        other_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Item User"
        })
        
        # Try to post item as non-member
        response = other_session.post(f"{BASE_URL}/api/tables/{table_id}/items", json={
            "type": "note",
            "name": "Unauthorized Item"
        })
        assert response.status_code == 403
        
        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ Non-member correctly gets 403 when posting items")


class TestSharedItems:
    """Shared items endpoint tests"""
    
    def test_add_and_list_items(self):
        """Test POST and GET /api/tables/{id}/items"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create table
        create_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Items_Table",
            "color": "#007AFF"
        })
        table_id = create_resp.json()["id"]
        
        # Add item
        item_resp = session.post(f"{BASE_URL}/api/tables/{table_id}/items", json={
            "type": "document",
            "name": "TEST_Document.pdf",
            "url": "https://example.com/doc.pdf"
        })
        assert item_resp.status_code == 200
        item_data = item_resp.json()
        assert item_data["name"] == "TEST_Document.pdf"
        assert item_data["type"] == "document"
        assert "id" in item_data
        
        # List items
        list_resp = session.get(f"{BASE_URL}/api/tables/{table_id}/items")
        assert list_resp.status_code == 200
        items = list_resp.json()
        assert len(items) >= 1
        assert any(i["id"] == item_data["id"] for i in items)
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ POST and GET /api/tables/{id}/items work correctly")
    
    def test_delete_item(self):
        """Test DELETE /api/tables/{id}/items/{itemId}"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create table and item
        create_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Delete_Item",
            "color": "#FF9500"
        })
        table_id = create_resp.json()["id"]
        
        item_resp = session.post(f"{BASE_URL}/api/tables/{table_id}/items", json={
            "type": "note",
            "name": "TEST_Note_To_Delete"
        })
        item_id = item_resp.json()["id"]
        
        # Delete item
        del_resp = session.delete(f"{BASE_URL}/api/tables/{table_id}/items/{item_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["ok"] == True
        
        # Verify deletion
        list_resp = session.get(f"{BASE_URL}/api/tables/{table_id}/items")
        items = list_resp.json()
        assert not any(i["id"] == item_id for i in items)
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ DELETE /api/tables/{id}/items/{itemId} works correctly")


class TestMessages:
    """Message endpoint tests"""
    
    def test_send_and_get_messages(self):
        """Test POST and GET /api/messages"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        user_id = login_resp.json()["user"]["id"]
        
        # Send message to self (for testing)
        msg_resp = session.post(f"{BASE_URL}/api/messages", json={
            "to_user": user_id,
            "text": "TEST_Message_Content"
        })
        assert msg_resp.status_code == 200
        msg_data = msg_resp.json()
        assert msg_data["text"] == "TEST_Message_Content"
        assert "id" in msg_data
        
        # Get messages
        get_resp = session.get(f"{BASE_URL}/api/messages", params={"with": user_id})
        assert get_resp.status_code == 200
        messages = get_resp.json()
        assert isinstance(messages, list)
        print("✓ POST and GET /api/messages work correctly")
    
    def test_table_scoped_messages(self):
        """Test table-scoped messages require membership"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        user_id = login_resp.json()["user"]["id"]
        
        # Create table
        create_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Message_Table",
            "color": "#34C759"
        })
        table_id = create_resp.json()["id"]
        
        # Send table-scoped message
        msg_resp = session.post(f"{BASE_URL}/api/messages", json={
            "to_user": user_id,
            "text": "TEST_Table_Message",
            "table_id": table_id
        })
        assert msg_resp.status_code == 200
        
        # Get table messages
        get_resp = session.get(f"{BASE_URL}/api/messages", params={"table_id": table_id})
        assert get_resp.status_code == 200
        messages = get_resp.json()
        assert any(m["table_id"] == table_id for m in messages)
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ Table-scoped messages work correctly")


class TestEmails:
    """Email endpoint tests"""
    
    def test_send_and_list_emails(self):
        """Test POST and GET /api/emails"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        user_id = login_resp.json()["user"]["id"]
        
        # Send email to self
        email_resp = session.post(f"{BASE_URL}/api/emails", json={
            "to_user": user_id,
            "subject": "TEST_Email_Subject",
            "body": "TEST_Email_Body content here"
        })
        assert email_resp.status_code == 200
        email_data = email_resp.json()
        assert email_data["subject"] == "TEST_Email_Subject"
        
        # List inbox
        inbox_resp = session.get(f"{BASE_URL}/api/emails", params={"folder": "inbox"})
        assert inbox_resp.status_code == 200
        emails = inbox_resp.json()
        assert isinstance(emails, list)
        
        # List sent
        sent_resp = session.get(f"{BASE_URL}/api/emails", params={"folder": "sent"})
        assert sent_resp.status_code == 200
        print("✓ POST and GET /api/emails work correctly")
    
    def test_mark_email_read_and_star(self):
        """Test POST /api/emails/{id}/read and /api/emails/{id}/star"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        user_id = login_resp.json()["user"]["id"]
        
        # Send email
        email_resp = session.post(f"{BASE_URL}/api/emails", json={
            "to_user": user_id,
            "subject": "TEST_Read_Star",
            "body": "Test body"
        })
        email_id = email_resp.json()["id"]
        
        # Mark read
        read_resp = session.post(f"{BASE_URL}/api/emails/{email_id}/read")
        assert read_resp.status_code == 200
        
        # Toggle star
        star_resp = session.post(f"{BASE_URL}/api/emails/{email_id}/star")
        assert star_resp.status_code == 200
        assert "starred" in star_resp.json()
        print("✓ Email read and star endpoints work correctly")


class TestTexts:
    """Text/SMS endpoint tests"""
    
    def test_send_and_list_texts(self):
        """Test POST and GET /api/texts"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        user_id = login_resp.json()["user"]["id"]
        
        # Send text
        text_resp = session.post(f"{BASE_URL}/api/texts", json={
            "to_user": user_id,
            "text": "TEST_Text_Message"
        })
        assert text_resp.status_code == 200
        text_data = text_resp.json()
        assert text_data["text"] == "TEST_Text_Message"
        
        # List texts
        list_resp = session.get(f"{BASE_URL}/api/texts", params={"with": user_id})
        assert list_resp.status_code == 200
        texts = list_resp.json()
        assert isinstance(texts, list)
        print("✓ POST and GET /api/texts work correctly")


class TestEvents:
    """Event CRUD endpoint tests"""
    
    def test_create_and_list_events(self):
        """Test POST and GET /api/events"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create event
        event_resp = session.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Event_Title",
            "date": "2026-04-20",
            "time": "14:00",
            "description": "Test event description"
        })
        assert event_resp.status_code == 200
        event_data = event_resp.json()
        assert event_data["title"] == "TEST_Event_Title"
        event_id = event_data["id"]
        
        # List events
        list_resp = session.get(f"{BASE_URL}/api/events")
        assert list_resp.status_code == 200
        events = list_resp.json()
        assert any(e["id"] == event_id for e in events)
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/events/{event_id}")
        print("✓ POST and GET /api/events work correctly")
    
    def test_update_and_delete_event(self):
        """Test PUT and DELETE /api/events/{id}"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create event
        event_resp = session.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Event_Update",
            "date": "2026-04-21",
            "time": "10:00"
        })
        event_id = event_resp.json()["id"]
        
        # Update event
        update_resp = session.put(f"{BASE_URL}/api/events/{event_id}", json={
            "title": "TEST_Event_Updated",
            "date": "2026-04-22",
            "time": "11:00"
        })
        assert update_resp.status_code == 200
        assert update_resp.json()["title"] == "TEST_Event_Updated"
        
        # Delete event
        del_resp = session.delete(f"{BASE_URL}/api/events/{event_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["ok"] == True
        print("✓ PUT and DELETE /api/events/{id} work correctly")


class TestNotifications:
    """Notification endpoint tests"""
    
    def test_list_notifications(self):
        """Test GET /api/notifications"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        response = session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/notifications returned {len(data)} notifications")
    
    def test_mark_all_read(self):
        """Test POST /api/notifications/read_all"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        response = session.post(f"{BASE_URL}/api/notifications/read_all")
        assert response.status_code == 200
        assert response.json()["ok"] == True
        print("✓ POST /api/notifications/read_all works correctly")


class TestWalkie:
    """Walkie talkie endpoint tests"""
    
    def test_walkie_ping(self):
        """Test POST /api/walkie/ping creates notification"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        user_id = login_resp.json()["user"]["id"]
        
        # Ping self
        response = session.post(f"{BASE_URL}/api/walkie/ping", json={
            "to_user": user_id
        })
        assert response.status_code == 200
        assert response.json()["ok"] == True
        
        # Check notification was created
        notif_resp = session.get(f"{BASE_URL}/api/notifications")
        notifications = notif_resp.json()
        assert any(n.get("type") == "walkie" for n in notifications)
        print("✓ POST /api/walkie/ping creates notification")


class TestInvites:
    """Invite endpoint tests"""
    
    def test_create_and_list_invites(self):
        """Test POST and GET /api/invites"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create table first
        table_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Invite_Table",
            "color": "#007AFF"
        })
        table_id = table_resp.json()["id"]
        
        # Create invite
        invite_resp = session.post(f"{BASE_URL}/api/invites", json={
            "table_id": table_id,
            "max_uses": 10,
            "expires_in_days": 7
        })
        assert invite_resp.status_code == 200
        invite_data = invite_resp.json()
        assert "code" in invite_data
        assert invite_data["max_uses"] == 10
        
        # List invites
        list_resp = session.get(f"{BASE_URL}/api/invites")
        assert list_resp.status_code == 200
        invites = list_resp.json()
        assert any(i["code"] == invite_data["code"] for i in invites)
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ POST and GET /api/invites work correctly")
    
    def test_invite_join_flow(self):
        """Test POST /api/invites/join adds user to table"""
        # Admin creates table and invite
        admin_session = requests.Session()
        admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        table_resp = admin_session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Join_Table",
            "color": "#34C759"
        })
        table_id = table_resp.json()["id"]
        
        invite_resp = admin_session.post(f"{BASE_URL}/api/invites", json={
            "table_id": table_id,
            "max_uses": 5
        })
        invite_code = invite_resp.json()["code"]
        
        # New user joins via invite
        user_session = requests.Session()
        unique_email = f"test_join_{int(time.time())}@roundtable.app"
        user_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Join User"
        })
        
        join_resp = user_session.post(f"{BASE_URL}/api/invites/join", json={
            "code": invite_code
        })
        assert join_resp.status_code == 200
        assert join_resp.json()["ok"] == True
        assert join_resp.json()["table_id"] == table_id
        
        # Verify user can now access table
        table_access = user_session.get(f"{BASE_URL}/api/tables/{table_id}")
        assert table_access.status_code == 200
        
        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/tables/{table_id}")
        print("✓ Invite join flow works correctly")
    
    def test_invite_bad_code_404(self):
        """Test invalid invite code returns 404"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        response = session.post(f"{BASE_URL}/api/invites/join", json={
            "code": "BADCODE1"
        })
        assert response.status_code == 404
        print("✓ Invalid invite code correctly returns 404")


class TestContacts:
    """Contact endpoint tests"""
    
    def test_add_and_list_contacts(self):
        """Test POST and GET /api/contacts"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Add contact
        contact_resp = session.post(f"{BASE_URL}/api/contacts", json={
            "name": "TEST_Contact",
            "email": "test_contact@example.com",
            "phone": "+1234567890"
        })
        assert contact_resp.status_code == 200
        contact_data = contact_resp.json()
        assert contact_data["name"] == "TEST_Contact"
        
        # List contacts
        list_resp = session.get(f"{BASE_URL}/api/contacts")
        assert list_resp.status_code == 200
        contacts = list_resp.json()
        assert isinstance(contacts, list)
        print("✓ POST and GET /api/contacts work correctly")
    
    def test_contact_auto_match(self):
        """Test contact email auto-matches existing users"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Add contact with admin email
        contact_resp = session.post(f"{BASE_URL}/api/contacts", json={
            "name": "Admin Contact",
            "email": ADMIN_EMAIL
        })
        assert contact_resp.status_code == 200
        contact_data = contact_resp.json()
        assert contact_data.get("is_member") == True
        assert contact_data.get("member_id") is not None
        print("✓ Contact auto-match works correctly")


class TestReferrals:
    """Referral endpoint tests"""
    
    def test_get_referrals(self):
        """Test GET /api/referrals"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        response = session.get(f"{BASE_URL}/api/referrals")
        assert response.status_code == 200
        data = response.json()
        assert "invited" in data
        assert "joined" in data
        assert "badge" in data
        print(f"✓ GET /api/referrals returned: badge={data['badge']}")
    
    def test_referral_leaderboard(self):
        """Test GET /api/referrals/leaderboard"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        response = session.get(f"{BASE_URL}/api/referrals/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/referrals/leaderboard returned {len(data)} entries")


class TestFileUpload:
    """File upload endpoint tests"""
    
    def test_upload_file(self):
        """Test POST /api/upload with multipart form"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Create a test file
        files = {
            'file': ('test_file.txt', b'Test file content', 'text/plain')
        }
        
        # Remove Content-Type header for multipart
        headers = dict(session.headers)
        headers.pop('Content-Type', None)
        
        response = session.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers=headers
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "storage_path" in data
        assert "original_filename" in data
        print(f"✓ POST /api/upload successful: {data['storage_path']}")


class TestAuthGuards:
    """Test authentication guards on protected endpoints"""
    
    def test_protected_endpoints_require_auth(self):
        """Test that protected endpoints return 401 without auth"""
        endpoints = [
            ("GET", "/api/me"),
            ("GET", "/api/members"),
            ("GET", "/api/tables"),
            ("GET", "/api/events"),
            ("GET", "/api/notifications"),
            ("GET", "/api/contacts"),
            ("GET", "/api/referrals"),
            ("GET", "/api/emails"),
            ("GET", "/api/texts"),
            ("GET", "/api/messages"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            else:
                response = requests.post(f"{BASE_URL}{endpoint}")
            
            assert response.status_code == 401, f"{method} {endpoint} should return 401, got {response.status_code}"
        
        print(f"✓ All {len(endpoints)} protected endpoints correctly return 401 without auth")


class TestResponseFormat:
    """Test that _id is excluded from all responses"""
    
    def test_no_internal_id_in_responses(self):
        """Test that internal _id is not in API responses"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # Check various endpoints
        endpoints = [
            "/api/me",
            "/api/members",
            "/api/tables",
            "/api/events",
            "/api/notifications",
            "/api/contacts",
        ]
        
        for endpoint in endpoints:
            response = session.get(f"{BASE_URL}{endpoint}")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    for item in data[:5]:  # Check first 5 items
                        assert "_id" not in item, f"_id found in {endpoint} response"
                elif isinstance(data, dict):
                    assert "_id" not in data, f"_id found in {endpoint} response"
        
        print("✓ No internal _id found in API responses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
