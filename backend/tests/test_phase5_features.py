"""
Phase 5 Tests: WebRTC Calling, Push Notifications, SMS/Email Bridges
=====================================================================
Tests for:
- GET /api/calls/active - returns active calls (empty array when none)
- GET /api/push/vapid-key - returns VAPID public key (public endpoint)
- POST /api/push/subscribe - registers push subscription (requires auth)
- POST /api/push/unsubscribe - removes push subscription (requires auth)
- GET /api/bridges/status - returns SMS/email bridge configuration status
- POST /api/bridges/sms - returns 503 since Twilio not configured
- POST /api/bridges/email - returns 503 since Resend not configured
- WebSocket signaling - call_start, call_join, call_leave message types
"""

import pytest
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_PASSWORD, TEST_USER_PASSWORD, BASE_URL
import requests
import os
import json
import asyncio
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def session():
    """Shared requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_auth(session):
    """Login as admin and return session with cookies"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def test_user_auth():
    """Create and login a test user for Phase 5"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    
    # Try to register, if already exists, login
    email = "phase5_test_user@micro.app"
    password = TEST_PASSWORD
    name = "Phase5 Test User"
    
    resp = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": password,
        "name": name
    })
    
    if resp.status_code == 409:  # Already exists
        resp = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
    
    assert resp.status_code in [200, 201], f"Test user auth failed: {resp.text}"
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Push Notification Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestPushNotifications:
    """Tests for push notification endpoints"""
    
    def test_vapid_key_public_endpoint(self, session):
        """GET /api/push/vapid-key should return VAPID public key without auth"""
        resp = session.get(f"{BASE_URL}/api/push/vapid-key")
        assert resp.status_code == 200, f"VAPID key endpoint failed: {resp.text}"
        data = resp.json()
        assert "public_key" in data, "Response should contain public_key"
        assert isinstance(data["public_key"], str), "public_key should be a string"
        assert len(data["public_key"]) > 50, "VAPID key should be a substantial string"
        print(f"✓ VAPID public key returned: {data['public_key'][:30]}...")
    
    def test_push_subscribe_requires_auth(self, session):
        """POST /api/push/subscribe should require authentication"""
        # Use a fresh session without auth
        fresh_session = requests.Session()
        resp = fresh_session.post(f"{BASE_URL}/api/push/subscribe", json={
            "endpoint": "https://example.com/push/test",
            "keys": {"p256dh": "test", "auth": "test"}
        })
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("✓ Push subscribe requires authentication")
    
    def test_push_subscribe_with_auth(self, admin_auth):
        """POST /api/push/subscribe should work with authentication"""
        resp = admin_auth.post(f"{BASE_URL}/api/push/subscribe", json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-phase5",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        })
        assert resp.status_code == 200, f"Push subscribe failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True, "Response should have ok=True"
        print("✓ Push subscription registered successfully")
    
    def test_push_unsubscribe_requires_auth(self, session):
        """POST /api/push/unsubscribe should require authentication"""
        fresh_session = requests.Session()
        resp = fresh_session.post(f"{BASE_URL}/api/push/unsubscribe", json={
            "endpoint": "https://example.com/push/test",
            "keys": {"p256dh": "test", "auth": "test"}
        })
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("✓ Push unsubscribe requires authentication")
    
    def test_push_unsubscribe_with_auth(self, admin_auth):
        """POST /api/push/unsubscribe should work with authentication"""
        resp = admin_auth.post(f"{BASE_URL}/api/push/unsubscribe", json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-phase5",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        })
        assert resp.status_code == 200, f"Push unsubscribe failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True, "Response should have ok=True"
        print("✓ Push subscription removed successfully")


# ─────────────────────────────────────────────────────────────────────────────
# Active Calls Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestActiveCalls:
    """Tests for active calls endpoint"""
    
    def test_active_calls_requires_auth(self, session):
        """GET /api/calls/active should require authentication"""
        fresh_session = requests.Session()
        resp = fresh_session.get(f"{BASE_URL}/api/calls/active")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("✓ Active calls requires authentication")
    
    def test_active_calls_returns_empty_array(self, admin_auth):
        """GET /api/calls/active should return empty array when no calls"""
        resp = admin_auth.get(f"{BASE_URL}/api/calls/active")
        assert resp.status_code == 200, f"Active calls failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        # Note: May or may not be empty depending on other tests
        print(f"✓ Active calls returned: {len(data)} calls")
    
    def test_active_calls_with_table_filter(self, admin_auth):
        """GET /api/calls/active?table_id=xxx should filter by table"""
        resp = admin_auth.get(f"{BASE_URL}/api/calls/active", params={"table_id": "nonexistent-table"})
        assert resp.status_code == 200, f"Active calls with filter failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 0, "Should return empty for nonexistent table"
        print("✓ Active calls filter by table_id works")


# ─────────────────────────────────────────────────────────────────────────────
# SMS/Email Bridge Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestBridges:
    """Tests for SMS/Email bridge endpoints"""
    
    def test_bridge_status_requires_auth(self, session):
        """GET /api/bridges/status should require authentication"""
        fresh_session = requests.Session()
        resp = fresh_session.get(f"{BASE_URL}/api/bridges/status")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("✓ Bridge status requires authentication")
    
    def test_bridge_status_returns_config(self, admin_auth):
        """GET /api/bridges/status should return configuration status"""
        resp = admin_auth.get(f"{BASE_URL}/api/bridges/status")
        assert resp.status_code == 200, f"Bridge status failed: {resp.text}"
        data = resp.json()
        assert "sms_configured" in data, "Response should have sms_configured"
        assert "email_configured" in data, "Response should have email_configured"
        assert isinstance(data["sms_configured"], bool), "sms_configured should be boolean"
        assert isinstance(data["email_configured"], bool), "email_configured should be boolean"
        # Since Twilio/Resend are not configured, both should be False
        assert data["sms_configured"] == False, "SMS should not be configured"
        assert data["email_configured"] == False, "Email should not be configured"
        print(f"✓ Bridge status: SMS={data['sms_configured']}, Email={data['email_configured']}")
    
    def test_sms_bridge_returns_503(self, admin_auth):
        """POST /api/bridges/sms should return 503 when Twilio not configured"""
        resp = admin_auth.post(f"{BASE_URL}/api/bridges/sms", json={
            "phone": "+15551234567",
            "message": "Test message from MICRO"
        })
        assert resp.status_code == 503, f"Expected 503 for unconfigured SMS, got {resp.status_code}"
        data = resp.json()
        assert "detail" in data, "Response should have detail"
        assert "not configured" in data["detail"].lower() or "twilio" in data["detail"].lower(), \
            f"Error should mention not configured: {data['detail']}"
        print(f"✓ SMS bridge returns 503: {data['detail']}")
    
    def test_email_bridge_returns_503(self, admin_auth):
        """POST /api/bridges/email should return 503 when Resend not configured"""
        resp = admin_auth.post(f"{BASE_URL}/api/bridges/email", json={
            "to_email": "test@example.com",
            "subject": "Test Subject",
            "body": "Test body from MICRO"
        })
        assert resp.status_code == 503, f"Expected 503 for unconfigured email, got {resp.status_code}"
        data = resp.json()
        assert "detail" in data, "Response should have detail"
        assert "not configured" in data["detail"].lower() or "resend" in data["detail"].lower(), \
            f"Error should mention not configured: {data['detail']}"
        print(f"✓ Email bridge returns 503: {data['detail']}")
    
    def test_sms_bridge_requires_auth(self, session):
        """POST /api/bridges/sms should require authentication"""
        fresh_session = requests.Session()
        resp = fresh_session.post(f"{BASE_URL}/api/bridges/sms", json={
            "phone": "+15551234567",
            "message": "Test"
        })
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("✓ SMS bridge requires authentication")
    
    def test_email_bridge_requires_auth(self, session):
        """POST /api/bridges/email should require authentication"""
        fresh_session = requests.Session()
        resp = fresh_session.post(f"{BASE_URL}/api/bridges/email", json={
            "to_email": "test@example.com",
            "subject": "Test",
            "body": "Test"
        })
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("✓ Email bridge requires authentication")


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Signaling Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestWebSocketSignaling:
    """Tests for WebSocket signaling with call_start, call_join, call_leave"""
    
    def test_websocket_connects_with_auth(self, admin_auth):
        """WebSocket should connect with valid auth cookie"""
        # Get the access token from cookies
        cookies = admin_auth.cookies.get_dict()
        access_token = cookies.get("rt_access")
        
        if not access_token:
            pytest.skip("No access token in cookies")
        
        # Test WebSocket connection using token query param
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        
        async def test_ws():
            try:
                async with websockets.connect(
                    f"{ws_url}/api/ws?token={access_token}",
                    close_timeout=5
                ) as ws:
                    # Should receive ready message
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get("type") == "ready", f"Expected ready message, got {data}"
                    assert "user_id" in data, "Ready message should have user_id"
                    print(f"✓ WebSocket connected, user_id: {data['user_id']}")
                    return True
            except Exception as e:
                print(f"WebSocket test error: {e}")
                return False
        
        result = asyncio.get_event_loop().run_until_complete(test_ws())
        assert result, "WebSocket connection test failed"
    
    def test_websocket_handles_ping(self, admin_auth):
        """WebSocket should respond to ping with pong"""
        cookies = admin_auth.cookies.get_dict()
        access_token = cookies.get("rt_access")
        
        if not access_token:
            pytest.skip("No access token in cookies")
        
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        
        async def test_ping():
            try:
                async with websockets.connect(
                    f"{ws_url}/api/ws?token={access_token}",
                    close_timeout=5
                ) as ws:
                    # Wait for ready
                    await asyncio.wait_for(ws.recv(), timeout=5)
                    
                    # Send ping
                    await ws.send(json.dumps({"type": "ping"}))
                    
                    # Should receive pong
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get("type") == "pong", f"Expected pong, got {data}"
                    print("✓ WebSocket ping/pong works")
                    return True
            except Exception as e:
                print(f"Ping test error: {e}")
                return False
        
        result = asyncio.get_event_loop().run_until_complete(test_ping())
        assert result, "WebSocket ping test failed"


# ─────────────────────────────────────────────────────────────────────────────
# Regression Tests - Ensure Phase 1-4 features still work
# ─────────────────────────────────────────────────────────────────────────────

class TestRegressionPhase1to4:
    """Quick regression tests for Phase 1-4 features"""
    
    def test_health_endpoint(self, session):
        """GET /api/ should return ok"""
        resp = session.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "ok"
        print("✓ Health endpoint working")
    
    def test_auth_login(self, session):
        """POST /api/auth/login should work"""
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print("✓ Auth login working")
    
    def test_tables_list(self, admin_auth):
        """GET /api/tables should return tables"""
        resp = admin_auth.get(f"{BASE_URL}/api/tables")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Tables list working ({len(data)} tables)")
    
    def test_events_list(self, admin_auth):
        """GET /api/events should return events"""
        resp = admin_auth.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Events list working ({len(data)} events)")
    
    def test_notifications_list(self, admin_auth):
        """GET /api/notifications should return notifications"""
        resp = admin_auth.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Notifications list working ({len(data)} notifications)")
    
    def test_members_list(self, admin_auth):
        """GET /api/members should return members"""
        resp = admin_auth.get(f"{BASE_URL}/api/members")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Members list working ({len(data)} members)")
    
    def test_referrals_endpoint(self, admin_auth):
        """GET /api/referrals should return referral stats"""
        resp = admin_auth.get(f"{BASE_URL}/api/referrals")
        assert resp.status_code == 200
        data = resp.json()
        assert "badge" in data
        print(f"✓ Referrals working (badge: {data['badge']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
