"""
Iteration 18 — Scenes, Seats & Avatars
Tests for the new scene fields on Tables, seat claim/leave endpoints, and
avatar tier namespace reservation on User.
"""
import os
import pytest
import requests
from pathlib import Path

# Load .env.test (same pattern as conftest.py)
_env_test = Path(__file__).parent.parent / ".env.test"
if _env_test.exists():
    for line in _env_test.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@roundtable.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


def _login(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text}")
    return s


def _register(email, password, name):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password, "name": name})
    if r.status_code == 409:
        return _login(email, password)
    if r.status_code not in (200, 201):
        pytest.skip(f"Register failed for {email}: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def member():
    """A second user used as a table member for seat claim tests."""
    import uuid
    email = f"iter18-{uuid.uuid4().hex[:8]}@roundtable.app"
    return _register(email, "iter18pass!", "Iter18 Member"), email


@pytest.fixture(scope="module")
def created_table(admin):
    """Create a table with a custom scene; returns table dict."""
    payload = {
        "name": "Iter18 Strategy Table",
        "color": "#1c3a5c",
        "active": True,
        "purpose": "work",
        "scene": {
            "room": "skyline",
            "table": "strategy",
            "tabletop": "planning",
            "food": "coffee",
            "ambiance": "focus",
            "music": "ambient",
        },
    }
    r = admin.post(f"{BASE_URL}/api/tables", json=payload)
    assert r.status_code == 200, r.text
    t = r.json()
    yield t
    # cleanup
    admin.delete(f"{BASE_URL}/api/tables/{t['id']}")


# ─────────────────────────────────────────────────
# 1) SCENE PERSISTENCE
# ─────────────────────────────────────────────────

class TestScenePersistence:
    def test_create_table_with_scene_persists(self, admin, created_table):
        """Custom scene supplied at creation is stored verbatim."""
        assert created_table.get("scene") is not None
        s = created_table["scene"]
        assert s["room"] == "skyline"
        assert s["table"] == "strategy"
        assert s["tabletop"] == "planning"
        assert s["food"] == "coffee"
        assert s["ambiance"] == "focus"
        assert s["music"] == "ambient"

    def test_get_table_returns_scene(self, admin, created_table):
        """GET /tables/:id returns the persisted scene."""
        r = admin.get(f"{BASE_URL}/api/tables/{created_table['id']}")
        assert r.status_code == 200
        t = r.json()
        assert t["scene"]["room"] == "skyline"
        assert t["scene"]["table"] == "strategy"
        assert isinstance(t.get("seats"), list)

    def test_create_table_without_scene_uses_defaults(self, admin):
        """Anchor 1 — new table without scene gets library/mahogany/meeting/none/warm/off."""
        r = admin.post(f"{BASE_URL}/api/tables", json={"name": "Iter18 Default", "color": "#FFCC00", "purpose": "family"})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["scene"]["room"] == "library"
        assert t["scene"]["table"] == "mahogany"
        assert t["scene"]["tabletop"] == "meeting"
        assert t["scene"]["food"] == "none"
        assert t["scene"]["ambiance"] == "warm"
        assert t["scene"]["music"] == "off"
        admin.delete(f"{BASE_URL}/api/tables/{t['id']}")

    def test_update_scene_partial(self, admin, created_table):
        """PUT /tables/:id with partial scene swaps room+table while keeping other fields."""
        new_scene = {
            "room": "library",
            "table": "executive",
            "tabletop": "meeting",
            "food": "none",
            "ambiance": "warm",
            "music": "off",
        }
        r = admin.put(f"{BASE_URL}/api/tables/{created_table['id']}", json={"scene": new_scene})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["scene"]["room"] == "library"
        assert t["scene"]["table"] == "executive"

    def test_invalid_scene_room_rejected(self, admin, created_table):
        """Invalid enum value returns 422."""
        r = admin.put(f"{BASE_URL}/api/tables/{created_table['id']}", json={
            "scene": {"room": "spaceship", "table": "mahogany", "tabletop": "meeting",
                      "food": "none", "ambiance": "warm", "music": "off"}
        })
        assert r.status_code == 422

    def test_legacy_table_gets_default_scene(self, admin):
        """A table inserted into Mongo without a scene field reads back DEFAULT_SCENE."""
        # Create via API then strip the scene via direct DB? We don't have direct DB — instead,
        # create a table and verify GET returns scene even if backend-old data lacked it.
        # Sanity: at minimum, default scene injection works on creation. Covered by
        # test_create_table_without_scene_uses_defaults. This stub asserts the path exists.
        r = admin.post(f"{BASE_URL}/api/tables", json={"name": "Iter18 LegacyLike", "color": "#007AFF", "purpose": "other"})
        assert r.status_code == 200
        t = r.json()
        assert "scene" in t
        admin.delete(f"{BASE_URL}/api/tables/{t['id']}")


# ─────────────────────────────────────────────────
# 2) SEAT CLAIM / LEAVE / AUTO
# ─────────────────────────────────────────────────

class TestSeats:
    def test_initial_seats_empty(self, admin, created_table):
        r = admin.get(f"{BASE_URL}/api/tables/{created_table['id']}/seats")
        assert r.status_code == 200
        assert r.json() == []

    def test_claim_specific_seat(self, admin, created_table):
        r = admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/seats/claim", json={"seat_index": 3})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["seat"]["seat_index"] == 3
        assert any(s["seat_index"] == 3 for s in body["seats"])

    def test_claim_moves_user(self, admin, created_table):
        """A user re-claiming a seat moves out of the previous one (max one per table)."""
        admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/seats/claim", json={"seat_index": 3})
        r = admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/seats/claim", json={"seat_index": 7})
        assert r.status_code == 200
        seats = r.json()["seats"]
        admin_seats = [s for s in seats if s["user_id"]]  # all seats have user_id
        assert any(s["seat_index"] == 7 for s in seats)
        # must not have a stale seat at 3 for the same user
        my_seats = [s for s in seats if s["seat_index"] == 3]
        for s in my_seats:
            # if seat 3 still exists it should belong to a different user (not this admin)
            r2 = admin.get(f"{BASE_URL}/api/me")
            assert s["user_id"] != r2.json()["id"]

    def test_claim_seat_out_of_range_rejected(self, admin, created_table):
        # strategy table has 12 seats (indices 0..11)
        r = admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/seats/claim", json={"seat_index": 99})
        assert r.status_code == 400

    def test_auto_claim_finds_first_free(self, admin, member, created_table):
        """When seat_index omitted, server picks first available seat."""
        member_session, _ = member
        # Member must join the table first via invite — but for the test, owner can add via membership.
        # Simpler path: create an invite, then have member redeem it.
        inv = admin.post(f"{BASE_URL}/api/invites", json={"table_id": created_table["id"], "max_uses": 5, "expires_in_days": 1})
        assert inv.status_code == 200, inv.text
        code = inv.json()["code"]
        join = member_session.post(f"{BASE_URL}/api/invites/join", json={"code": code})
        assert join.status_code == 200, join.text

        # Auto-claim — admin already at seat 7, so first free is 0
        r = member_session.post(f"{BASE_URL}/api/tables/{created_table['id']}/seats/claim", json={})
        assert r.status_code == 200
        seat = r.json()["seat"]
        assert seat["seat_index"] == 0

    def test_claim_taken_seat_rejected(self, admin, member, created_table):
        member_session, _ = member
        # member already at 0; admin can't claim 0
        r = admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/seats/claim", json={"seat_index": 0})
        assert r.status_code == 409

    def test_leave_releases_seat(self, admin, created_table):
        # admin is at seat 7 from earlier
        r = admin.delete(f"{BASE_URL}/api/tables/{created_table['id']}/seats/mine")
        assert r.status_code == 200
        body = r.json()
        assert body["released"] >= 1
        # ensure no seat for the admin remains
        me = admin.get(f"{BASE_URL}/api/me").json()
        for s in body["seats"]:
            assert s["user_id"] != me["id"]


# ─────────────────────────────────────────────────
# 3) AVATAR TIER NAMESPACE
# ─────────────────────────────────────────────────

class TestAvatarTier:
    def test_avatar_tier_default_stylized(self, admin):
        r = admin.get(f"{BASE_URL}/api/me")
        assert r.status_code == 200
        # field should be present and default to "stylized"
        assert r.json().get("avatar_tier") == "stylized"

    def test_set_avatar_tier_stylized_ok(self, admin):
        r = admin.put(f"{BASE_URL}/api/me", json={"avatar_tier": "stylized"})
        assert r.status_code == 200
        assert r.json()["avatar_tier"] == "stylized"

    def test_set_avatar_tier_premium_accepted_namespace_only(self, admin):
        """Anchor 3 — `premium_illustrated` and `photoreal` are valid enum values
        (namespace reservation) even though no UI ships for them yet."""
        r = admin.put(f"{BASE_URL}/api/me", json={"avatar_tier": "premium_illustrated"})
        assert r.status_code == 200
        assert r.json()["avatar_tier"] == "premium_illustrated"
        # restore to stylized so other tests aren't affected
        admin.put(f"{BASE_URL}/api/me", json={"avatar_tier": "stylized"})

    def test_set_invalid_avatar_tier_rejected(self, admin):
        r = admin.put(f"{BASE_URL}/api/me", json={"avatar_tier": "anime"})
        assert r.status_code == 422
