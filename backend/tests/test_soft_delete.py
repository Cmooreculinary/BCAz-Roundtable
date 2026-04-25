"""
Test Suite for Soft Delete / Trash System - Iteration 14
Tests: soft delete, restore, purge, clear-all for invites, emails, messages, calls, contacts, notifications
"""
import pytest
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_PASSWORD, TEST_USER_PASSWORD, BASE_URL
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://team-table.preview.emergentagent.com"

ADMIN_EMAIL = ADMIN_EMAIL
ADMIN_PASSWORD = ADMIN_PASSWORD


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for admin user"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def test_table(auth_session):
    """Create a test table for invite tests"""
    resp = auth_session.post(f"{BASE_URL}/api/tables", json={
        "name": "TEST_SoftDelete_Table",
        "color": "#FF0000",
        "purpose": "other"
    })
    assert resp.status_code == 200, f"Failed to create table: {resp.text}"
    table = resp.json()
    yield table
    # Cleanup
    auth_session.delete(f"{BASE_URL}/api/tables/{table['id']}")


class TestSoftDeleteInvites:
    """Test soft delete for invites"""
    
    def test_create_and_soft_delete_invite(self, auth_session, test_table):
        """Create invite, soft delete it, verify it's hidden from list"""
        # Create invite
        resp = auth_session.post(f"{BASE_URL}/api/invites", json={
            "table_id": test_table["id"],
            "max_uses": 10,
            "expires_in_days": 7
        })
        assert resp.status_code == 200, f"Failed to create invite: {resp.text}"
        invite = resp.json()
        invite_id = invite["id"]
        
        # Verify invite appears in list
        resp = auth_session.get(f"{BASE_URL}/api/invites")
        assert resp.status_code == 200
        invites = resp.json()
        assert any(i["id"] == invite_id for i in invites), "Invite should be in list"
        
        # Soft delete
        resp = auth_session.delete(f"{BASE_URL}/api/invites/{invite_id}")
        assert resp.status_code == 200, f"Failed to delete invite: {resp.text}"
        assert resp.json().get("ok") is True
        
        # Verify invite is hidden from list
        resp = auth_session.get(f"{BASE_URL}/api/invites")
        assert resp.status_code == 200
        invites = resp.json()
        assert not any(i["id"] == invite_id for i in invites), "Deleted invite should not be in list"
        
        # Verify invite is in trash
        resp = auth_session.get(f"{BASE_URL}/api/trash?collection=invites")
        assert resp.status_code == 200
        trash = resp.json()
        assert "invites" in trash, "Trash should have invites collection"
        assert any(i["id"] == invite_id for i in trash.get("invites", [])), "Invite should be in trash"
    
    def test_clear_all_invites(self, auth_session, test_table):
        """Test clear-all moves all invites to trash"""
        # Create multiple invites
        invite_ids = []
        for i in range(3):
            resp = auth_session.post(f"{BASE_URL}/api/invites", json={
                "table_id": test_table["id"],
                "max_uses": 5,
                "expires_in_days": 7
            })
            assert resp.status_code == 200
            invite_ids.append(resp.json()["id"])
        
        # Clear all
        resp = auth_session.delete(f"{BASE_URL}/api/invites/clear-all")
        assert resp.status_code == 200, f"Clear all failed: {resp.text}"
        result = resp.json()
        assert result.get("ok") is True
        assert result.get("trashed", 0) >= 3, "Should have trashed at least 3 invites"
        
        # Verify all are hidden
        resp = auth_session.get(f"{BASE_URL}/api/invites")
        assert resp.status_code == 200
        invites = resp.json()
        for inv_id in invite_ids:
            assert not any(i["id"] == inv_id for i in invites), f"Invite {inv_id} should be hidden"


class TestSoftDeleteEmails:
    """Test soft delete for emails"""
    
    def test_soft_delete_email(self, auth_session):
        """Create email, soft delete it, verify it's hidden"""
        # Get user ID
        resp = auth_session.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200
        user = resp.json()
        user_id = user["id"]
        
        # Create email (send to self for testing)
        resp = auth_session.post(f"{BASE_URL}/api/emails", json={
            "to_user": user_id,
            "subject": "TEST_SoftDelete_Email",
            "body": "This is a test email for soft delete"
        })
        assert resp.status_code == 200, f"Failed to create email: {resp.text}"
        email = resp.json()
        email_id = email["id"]
        
        # Verify email appears in inbox
        resp = auth_session.get(f"{BASE_URL}/api/emails?folder=inbox")
        assert resp.status_code == 200
        emails = resp.json()
        assert any(e["id"] == email_id for e in emails), "Email should be in inbox"
        
        # Soft delete
        resp = auth_session.delete(f"{BASE_URL}/api/emails/{email_id}")
        assert resp.status_code == 200, f"Failed to delete email: {resp.text}"
        
        # Verify email is hidden from inbox
        resp = auth_session.get(f"{BASE_URL}/api/emails?folder=inbox")
        assert resp.status_code == 200
        emails = resp.json()
        assert not any(e["id"] == email_id for e in emails), "Deleted email should not be in inbox"
        
        # Verify email is in trash
        resp = auth_session.get(f"{BASE_URL}/api/trash?collection=emails")
        assert resp.status_code == 200
        trash = resp.json()
        assert any(e["id"] == email_id for e in trash.get("emails", [])), "Email should be in trash"


class TestSoftDeleteMessages:
    """Test soft delete for messages"""
    
    def test_soft_delete_message(self, auth_session):
        """Create message, soft delete it"""
        # Get user ID
        resp = auth_session.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200
        user_id = resp.json()["id"]
        
        # Create message (send to self)
        resp = auth_session.post(f"{BASE_URL}/api/messages", json={
            "to_user": user_id,
            "text": "TEST_SoftDelete_Message"
        })
        assert resp.status_code == 200, f"Failed to create message: {resp.text}"
        message = resp.json()
        message_id = message["id"]
        
        # Soft delete
        resp = auth_session.delete(f"{BASE_URL}/api/messages/{message_id}")
        assert resp.status_code == 200, f"Failed to delete message: {resp.text}"
        
        # Verify message is in trash
        resp = auth_session.get(f"{BASE_URL}/api/trash?collection=messages")
        assert resp.status_code == 200
        trash = resp.json()
        assert any(m["id"] == message_id for m in trash.get("messages", [])), "Message should be in trash"
    
    def test_clear_conversation(self, auth_session):
        """Test clearing entire conversation"""
        # Get user ID
        resp = auth_session.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200
        user_id = resp.json()["id"]
        
        # Create multiple messages
        for i in range(3):
            resp = auth_session.post(f"{BASE_URL}/api/messages", json={
                "to_user": user_id,
                "text": f"TEST_ClearConvo_Message_{i}"
            })
            assert resp.status_code == 200
        
        # Clear conversation with self
        resp = auth_session.delete(f"{BASE_URL}/api/messages/clear/{user_id}")
        assert resp.status_code == 200, f"Clear conversation failed: {resp.text}"
        result = resp.json()
        assert result.get("ok") is True
        assert result.get("trashed", 0) >= 3, "Should have trashed at least 3 messages"


class TestSoftDeleteCallHistory:
    """Test soft delete for call history"""
    
    def test_soft_delete_call_log(self, auth_session):
        """Test deleting a single call log"""
        # Get call history
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        calls = resp.json()
        
        if calls:
            call_id = calls[0]["call_id"]
            # Soft delete
            resp = auth_session.delete(f"{BASE_URL}/api/calls/history/{call_id}")
            assert resp.status_code == 200, f"Failed to delete call: {resp.text}"
            
            # Verify call is in trash
            resp = auth_session.get(f"{BASE_URL}/api/trash?collection=call_logs")
            assert resp.status_code == 200
    
    def test_clear_all_call_history(self, auth_session):
        """Test clearing all call history"""
        resp = auth_session.delete(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200, f"Clear call history failed: {resp.text}"
        result = resp.json()
        assert result.get("ok") is True


class TestSoftDeleteContacts:
    """Test soft delete for contacts"""
    
    def test_soft_delete_contact(self, auth_session):
        """Create contact, soft delete it, verify it's hidden"""
        # Create contact
        resp = auth_session.post(f"{BASE_URL}/api/contacts", json={
            "name": "TEST_SoftDelete_Contact",
            "phone": "+15551234567",
            "email": "test_softdelete@example.com"
        })
        assert resp.status_code == 200, f"Failed to create contact: {resp.text}"
        contact = resp.json()
        contact_id = contact["id"]
        
        # Verify contact appears in list
        resp = auth_session.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200
        contacts = resp.json()
        assert any(c["id"] == contact_id for c in contacts), "Contact should be in list"
        
        # Soft delete
        resp = auth_session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
        assert resp.status_code == 200, f"Failed to delete contact: {resp.text}"
        
        # Verify contact is hidden from list
        resp = auth_session.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200
        contacts = resp.json()
        assert not any(c["id"] == contact_id for c in contacts), "Deleted contact should not be in list"
        
        # Verify contact is in trash
        resp = auth_session.get(f"{BASE_URL}/api/trash?collection=contacts")
        assert resp.status_code == 200
        trash = resp.json()
        assert any(c["id"] == contact_id for c in trash.get("contacts", [])), "Contact should be in trash"


class TestSoftDeleteNotifications:
    """Test soft delete for notifications"""
    
    def test_clear_all_notifications(self, auth_session):
        """Test clearing all notifications"""
        resp = auth_session.delete(f"{BASE_URL}/api/notifications/clear-all")
        assert resp.status_code == 200, f"Clear notifications failed: {resp.text}"
        result = resp.json()
        assert result.get("ok") is True


class TestTrashRestore:
    """Test restore from trash functionality"""
    
    def test_restore_invite_from_trash(self, auth_session, test_table):
        """Create invite, delete it, restore it, verify it's back"""
        # Create invite
        resp = auth_session.post(f"{BASE_URL}/api/invites", json={
            "table_id": test_table["id"],
            "max_uses": 5,
            "expires_in_days": 7
        })
        assert resp.status_code == 200
        invite = resp.json()
        invite_id = invite["id"]
        
        # Soft delete
        resp = auth_session.delete(f"{BASE_URL}/api/invites/{invite_id}")
        assert resp.status_code == 200
        
        # Verify in trash
        resp = auth_session.get(f"{BASE_URL}/api/trash?collection=invites")
        assert resp.status_code == 200
        trash = resp.json()
        assert any(i["id"] == invite_id for i in trash.get("invites", [])), "Invite should be in trash"
        
        # Restore
        resp = auth_session.post(f"{BASE_URL}/api/trash/restore?collection=invites&item_id={invite_id}")
        assert resp.status_code == 200, f"Restore failed: {resp.text}"
        assert resp.json().get("ok") is True
        
        # Verify invite is back in list
        resp = auth_session.get(f"{BASE_URL}/api/invites")
        assert resp.status_code == 200
        invites = resp.json()
        assert any(i["id"] == invite_id for i in invites), "Restored invite should be in list"
        
        # Verify invite is no longer in trash
        resp = auth_session.get(f"{BASE_URL}/api/trash?collection=invites")
        assert resp.status_code == 200
        trash = resp.json()
        assert not any(i["id"] == invite_id for i in trash.get("invites", [])), "Restored invite should not be in trash"
    
    def test_restore_contact_from_trash(self, auth_session):
        """Create contact, delete it, restore it"""
        # Create contact
        resp = auth_session.post(f"{BASE_URL}/api/contacts", json={
            "name": "TEST_Restore_Contact",
            "phone": "+15559876543"
        })
        assert resp.status_code == 200
        contact = resp.json()
        contact_id = contact["id"]
        
        # Soft delete
        resp = auth_session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
        assert resp.status_code == 200
        
        # Restore
        resp = auth_session.post(f"{BASE_URL}/api/trash/restore?collection=contacts&item_id={contact_id}")
        assert resp.status_code == 200, f"Restore failed: {resp.text}"
        
        # Verify contact is back
        resp = auth_session.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200
        contacts = resp.json()
        assert any(c["id"] == contact_id for c in contacts), "Restored contact should be in list"


class TestTrashList:
    """Test trash listing functionality"""
    
    def test_list_all_trash(self, auth_session):
        """Test listing all trashed items"""
        resp = auth_session.get(f"{BASE_URL}/api/trash")
        assert resp.status_code == 200, f"List trash failed: {resp.text}"
        trash = resp.json()
        assert isinstance(trash, dict), "Trash should be a dict grouped by collection"
    
    def test_list_trash_by_collection(self, auth_session):
        """Test listing trash for specific collection"""
        for collection in ["invites", "emails", "messages", "contacts", "notifications"]:
            resp = auth_session.get(f"{BASE_URL}/api/trash?collection={collection}")
            assert resp.status_code == 200, f"List trash for {collection} failed: {resp.text}"


class TestTrashPurge:
    """Test permanent purge functionality"""
    
    def test_purge_all_trash(self, auth_session, test_table):
        """Create items, delete them, purge, verify gone permanently"""
        # Create and delete an invite
        resp = auth_session.post(f"{BASE_URL}/api/invites", json={
            "table_id": test_table["id"],
            "max_uses": 5,
            "expires_in_days": 7
        })
        assert resp.status_code == 200
        invite_id = resp.json()["id"]
        
        resp = auth_session.delete(f"{BASE_URL}/api/invites/{invite_id}")
        assert resp.status_code == 200
        
        # Verify in trash
        resp = auth_session.get(f"{BASE_URL}/api/trash?collection=invites")
        assert resp.status_code == 200
        trash_before = resp.json()
        
        # Purge all trash
        resp = auth_session.delete(f"{BASE_URL}/api/trash/purge")
        assert resp.status_code == 200, f"Purge failed: {resp.text}"
        result = resp.json()
        assert "purged" in result
        
        # Verify trash is empty
        resp = auth_session.get(f"{BASE_URL}/api/trash")
        assert resp.status_code == 200
        trash_after = resp.json()
        # All collections should be empty or not present
        for coll, items in trash_after.items():
            assert len(items) == 0, f"Collection {coll} should be empty after purge"
    
    def test_purge_specific_collection(self, auth_session, test_table):
        """Test purging only a specific collection"""
        # Create and delete an invite
        resp = auth_session.post(f"{BASE_URL}/api/invites", json={
            "table_id": test_table["id"],
            "max_uses": 5,
            "expires_in_days": 7
        })
        assert resp.status_code == 200
        invite_id = resp.json()["id"]
        
        resp = auth_session.delete(f"{BASE_URL}/api/invites/{invite_id}")
        assert resp.status_code == 200
        
        # Purge only invites
        resp = auth_session.delete(f"{BASE_URL}/api/trash/purge?collection=invites")
        assert resp.status_code == 200, f"Purge invites failed: {resp.text}"


class TestGetEndpointsExcludeSoftDeleted:
    """Test that GET endpoints exclude soft-deleted items"""
    
    def test_get_invites_excludes_deleted(self, auth_session, test_table):
        """Verify GET /api/invites excludes soft-deleted items"""
        # Create invite
        resp = auth_session.post(f"{BASE_URL}/api/invites", json={
            "table_id": test_table["id"],
            "max_uses": 5,
            "expires_in_days": 7
        })
        assert resp.status_code == 200
        invite_id = resp.json()["id"]
        
        # Delete it
        resp = auth_session.delete(f"{BASE_URL}/api/invites/{invite_id}")
        assert resp.status_code == 200
        
        # Verify not in list
        resp = auth_session.get(f"{BASE_URL}/api/invites")
        assert resp.status_code == 200
        invites = resp.json()
        assert not any(i["id"] == invite_id for i in invites)
    
    def test_get_contacts_excludes_deleted(self, auth_session):
        """Verify GET /api/contacts excludes soft-deleted items"""
        # Create contact
        resp = auth_session.post(f"{BASE_URL}/api/contacts", json={
            "name": "TEST_ExcludeDeleted_Contact"
        })
        assert resp.status_code == 200
        contact_id = resp.json()["id"]
        
        # Delete it
        resp = auth_session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
        assert resp.status_code == 200
        
        # Verify not in list
        resp = auth_session.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200
        contacts = resp.json()
        assert not any(c["id"] == contact_id for c in contacts)
    
    def test_get_notifications_excludes_deleted(self, auth_session):
        """Verify GET /api/notifications excludes soft-deleted items"""
        # Clear all notifications first
        resp = auth_session.delete(f"{BASE_URL}/api/notifications/clear-all")
        assert resp.status_code == 200
        
        # Verify notifications list doesn't include deleted ones
        resp = auth_session.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200
        # All returned notifications should not have deleted_at
        notifications = resp.json()
        for n in notifications:
            assert "deleted_at" not in n or n.get("deleted_at") is None


class TestRegressionLogin:
    """Regression test for login"""
    
    def test_login_works(self):
        """Verify login still works"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
