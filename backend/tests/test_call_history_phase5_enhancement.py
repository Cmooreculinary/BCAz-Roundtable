"""
Phase 5 Enhancement: Call History Tests
Tests for GET /api/calls/history endpoint and related call log functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@roundtable.app"
ADMIN_PASSWORD = "roundtable2026"


@pytest.fixture(scope="module")
def session():
    """Create a requests session with cookies"""
    return requests.Session()


@pytest.fixture(scope="module")
def auth_session(session):
    """Authenticated session for admin user"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return session


class TestCallHistoryEndpoint:
    """Tests for GET /api/calls/history endpoint"""

    def test_call_history_requires_auth(self, session):
        """Call history endpoint requires authentication"""
        # Use a fresh session without auth
        fresh_session = requests.Session()
        resp = fresh_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_call_history_returns_list(self, auth_session):
        """Call history returns a list of call logs"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Expected list response"

    def test_call_history_has_required_fields(self, auth_session):
        """Each call log has required fields"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data) > 0:
            call = data[0]
            # Required fields
            assert "call_id" in call, "Missing call_id"
            assert "type" in call, "Missing type"
            assert "created_by" in call, "Missing created_by"
            assert "participants" in call, "Missing participants"
            assert "started_at" in call, "Missing started_at"
            assert "status" in call, "Missing status"
            assert "duration_seconds" in call, "Missing duration_seconds"
            # Hydrated fields
            assert "participant_details" in call, "Missing participant_details"
            assert "caller" in call, "Missing caller"
            assert "target" in call, "Missing target"

    def test_call_history_sorted_by_started_at_desc(self, auth_session):
        """Call history is sorted by started_at descending (most recent first)"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data) >= 2:
            # Check that dates are in descending order
            for i in range(len(data) - 1):
                assert data[i]["started_at"] >= data[i + 1]["started_at"], \
                    f"Call history not sorted: {data[i]['started_at']} should be >= {data[i + 1]['started_at']}"

    def test_call_history_participant_details_hydrated(self, auth_session):
        """Participant details are properly hydrated with user info"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data) > 0:
            call = data[0]
            participant_details = call.get("participant_details", [])
            if len(participant_details) > 0:
                participant = participant_details[0]
                # Check hydrated user fields
                assert "id" in participant, "Missing id in participant"
                assert "name" in participant, "Missing name in participant"
                assert "email" in participant, "Missing email in participant"
                assert "initials" in participant, "Missing initials in participant"
                assert "color" in participant, "Missing color in participant"

    def test_call_history_caller_hydrated(self, auth_session):
        """Caller field is properly hydrated with user info"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data) > 0:
            call = data[0]
            caller = call.get("caller")
            if caller:
                assert "id" in caller, "Missing id in caller"
                assert "name" in caller, "Missing name in caller"
                assert "initials" in caller, "Missing initials in caller"

    def test_call_history_target_hydrated(self, auth_session):
        """Target field is properly hydrated with user info when present"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        # Find a call with a target_user
        for call in data:
            if call.get("target_user"):
                target = call.get("target")
                assert target is not None, "Target should be hydrated when target_user exists"
                assert "id" in target, "Missing id in target"
                assert "name" in target, "Missing name in target"
                break

    def test_call_history_type_values(self, auth_session):
        """Call type is either 'audio' or 'video'"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        for call in data:
            assert call["type"] in ["audio", "video"], f"Invalid call type: {call['type']}"

    def test_call_history_status_values(self, auth_session):
        """Call status is either 'active' or 'ended'"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        for call in data:
            assert call["status"] in ["active", "ended"], f"Invalid call status: {call['status']}"


class TestRegressionEndpoints:
    """Regression tests for existing endpoints"""

    def test_login_still_works(self, session):
        """Login endpoint still works"""
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL

    def test_active_calls_still_works(self, auth_session):
        """GET /api/calls/active still returns active calls list"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/active")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected list response"

    def test_vapid_key_still_works(self, session):
        """GET /api/push/vapid-key still returns VAPID public key"""
        resp = session.get(f"{BASE_URL}/api/push/vapid-key")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "public_key" in data, "Missing public_key in response"
        assert len(data["public_key"]) > 0, "VAPID public key is empty"

    def test_tables_endpoint_works(self, auth_session):
        """GET /api/tables still works"""
        resp = auth_session.get(f"{BASE_URL}/api/tables")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected list response"

    def test_events_endpoint_works(self, auth_session):
        """GET /api/events still works"""
        resp = auth_session.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected list response"

    def test_notifications_endpoint_works(self, auth_session):
        """GET /api/notifications still works"""
        resp = auth_session.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected list response"

    def test_me_endpoint_works(self, auth_session):
        """GET /api/me still works"""
        resp = auth_session.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "id" in data, "Missing id in user response"
        assert "email" in data, "Missing email in user response"


class TestCallHistorySeededData:
    """Tests to verify seeded call log data"""

    def test_seeded_call_logs_exist(self, auth_session):
        """Verify seeded call logs exist for admin user"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        # Main agent mentioned 3 test call logs were seeded
        assert len(data) >= 1, "Expected at least 1 seeded call log"

    def test_seeded_video_call_exists(self, auth_session):
        """Verify at least one video call exists in history"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        video_calls = [c for c in data if c["type"] == "video"]
        assert len(video_calls) >= 1, "Expected at least 1 video call in history"

    def test_seeded_audio_call_exists(self, auth_session):
        """Verify at least one audio call exists in history"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        audio_calls = [c for c in data if c["type"] == "audio"]
        assert len(audio_calls) >= 1, "Expected at least 1 audio call in history"

    def test_seeded_missed_call_exists(self, auth_session):
        """Verify at least one missed call (status=active, duration=0) exists"""
        resp = auth_session.get(f"{BASE_URL}/api/calls/history")
        assert resp.status_code == 200
        data = resp.json()
        
        # Missed call = status is 'active' and duration is 0
        missed_calls = [c for c in data if c["status"] == "active" and c["duration_seconds"] == 0]
        assert len(missed_calls) >= 1, "Expected at least 1 missed call in history"
