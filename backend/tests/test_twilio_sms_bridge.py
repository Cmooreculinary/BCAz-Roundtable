"""
Test Suite for Twilio SMS Bridge Integration (Iteration 7)
Tests:
- GET /api/bridges/status returns {sms_configured: true, email_configured: false}
- POST /api/bridges/sms with invalid phone returns Twilio error message (not generic 502)
- POST /api/bridges/email returns 503 with 'Email bridge not configured' message
- GET /api/calls/history still works (regression)
- Tables, Events, VAPID key endpoints still work (regression)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestTwilioSMSBridge:
    """Tests for Twilio SMS Bridge integration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for authenticated requests"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        yield
        # Logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_bridge_status_sms_configured(self):
        """GET /api/bridges/status should return sms_configured: true"""
        resp = self.session.get(f"{BASE_URL}/api/bridges/status")
        assert resp.status_code == 200, f"Bridge status failed: {resp.text}"
        data = resp.json()
        assert "sms_configured" in data, "Missing sms_configured field"
        assert "email_configured" in data, "Missing email_configured field"
        assert data["sms_configured"] == True, f"Expected sms_configured=true, got {data['sms_configured']}"
        assert data["email_configured"] == False, f"Expected email_configured=false, got {data['email_configured']}"
        print(f"✓ Bridge status: sms_configured={data['sms_configured']}, email_configured={data['email_configured']}")
    
    def test_sms_bridge_invalid_phone_returns_twilio_error(self):
        """POST /api/bridges/sms with invalid phone should return Twilio error message, not generic 502"""
        resp = self.session.post(f"{BASE_URL}/api/bridges/sms", json={
            "phone": "+1555123XXXX",  # Invalid phone number
            "message": "Test message"
        })
        # Should return 400 (Twilio's error code) not 502
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data, "Missing detail field in error response"
        # Should contain Twilio's actual error message, not generic "Failed to send SMS"
        assert "Invalid" in data["detail"] or "Phone" in data["detail"], f"Expected Twilio error message, got: {data['detail']}"
        assert "Failed to send SMS" not in data["detail"], "Got generic error instead of Twilio error"
        print(f"✓ SMS bridge returns Twilio error: {data['detail']}")
    
    def test_email_bridge_returns_503_not_configured(self):
        """POST /api/bridges/email should return 503 with 'Email bridge not configured' message"""
        resp = self.session.post(f"{BASE_URL}/api/bridges/email", json={
            "to_email": "test@example.com",
            "subject": "Test Subject",
            "body": "Test body"
        })
        assert resp.status_code == 503, f"Expected 503, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data, "Missing detail field in error response"
        assert "not configured" in data["detail"].lower() or "resend" in data["detail"].lower(), f"Expected 'not configured' message, got: {data['detail']}"
        print(f"✓ Email bridge returns 503: {data['detail']}")


class TestRegressionCallHistory:
    """Regression tests for Call History endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for authenticated requests"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_call_history_endpoint_works(self):
        """GET /api/calls/history should return list of call logs"""
        resp = self.session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200, f"Call history failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Call history returns {len(data)} entries")
        # If there are entries, verify structure
        if len(data) > 0:
            entry = data[0]
            assert "call_id" in entry, "Missing call_id field"
            assert "type" in entry, "Missing type field"
            assert "started_at" in entry, "Missing started_at field"
            print(f"✓ Call history entry structure verified: call_id={entry['call_id']}, type={entry['type']}")


class TestRegressionCoreEndpoints:
    """Regression tests for core endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for authenticated requests"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@roundtable.app",
            "password": "roundtable2026"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_login_works(self):
        """Login should work with admin credentials"""
        # Already logged in via fixture, just verify me endpoint
        resp = self.session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200, f"Auth me failed: {resp.text}"
        data = resp.json()
        assert "user" in data, "Missing user field"
        assert data["user"]["email"] == "admin@roundtable.app", f"Wrong email: {data['user']['email']}"
        print(f"✓ Login verified: {data['user']['email']}")
    
    def test_tables_endpoint_works(self):
        """GET /api/tables should return list"""
        resp = self.session.get(f"{BASE_URL}/api/tables")
        assert resp.status_code == 200, f"Tables failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Tables returns {len(data)} entries")
    
    def test_events_endpoint_works(self):
        """GET /api/events should return list"""
        resp = self.session.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200, f"Events failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Events returns {len(data)} entries")
    
    def test_vapid_key_endpoint_works(self):
        """GET /api/push/vapid-key should return public key (no auth required)"""
        # Use fresh session without auth
        resp = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert resp.status_code == 200, f"VAPID key failed: {resp.text}"
        data = resp.json()
        assert "public_key" in data, "Missing public_key field"
        assert len(data["public_key"]) > 20, f"VAPID key too short: {data['public_key']}"
        print(f"✓ VAPID key endpoint works: {data['public_key'][:30]}...")
    
    def test_contacts_endpoint_works(self):
        """GET /api/contacts should return list"""
        resp = self.session.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200, f"Contacts failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Contacts returns {len(data)} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
