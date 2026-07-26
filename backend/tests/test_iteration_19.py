"""
Iteration 19 — Stage venues & audience actions
Tests the three stage venues (guest speaker theatre, Red Rocks concert, large
arena) as scene rooms, and the standing-ovation gesture that only makes sense
in a house facing a stage.
"""
import os
import uuid
from pathlib import Path

import pytest
import requests

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

STAGE_ROOMS = ("theatre", "redrocks", "arena")
TABLE_ROOMS = ("library", "skyline", "dining", "studio", "church", "terrace")


def _login(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


def _scene(room):
    return {
        "room": room,
        "table": "mahogany",
        "tabletop": "meeting",
        "food": "none",
        "ambiance": "warm",
        "music": "off",
    }


@pytest.fixture(scope="module")
def created_table(admin):
    r = admin.post(f"{BASE_URL}/api/tables", json={
        "name": f"Iter19 Keynote {uuid.uuid4().hex[:6]}",
        "color": "#C9954E",
        "active": True,
        "purpose": "community",
        "scene": _scene("theatre"),
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


class TestStageVenues:
    def test_table_can_be_created_in_a_stage_venue(self, created_table):
        assert created_table["scene"]["room"] == "theatre"

    @pytest.mark.parametrize("room", STAGE_ROOMS)
    def test_every_stage_venue_is_accepted(self, admin, created_table, room):
        r = admin.put(f"{BASE_URL}/api/tables/{created_table['id']}", json={"scene": _scene(room)})
        assert r.status_code == 200, r.text
        assert r.json()["scene"]["room"] == room

    @pytest.mark.parametrize("room", TABLE_ROOMS)
    def test_table_rooms_still_accepted(self, admin, created_table, room):
        """Adding stage venues must not narrow the original room set."""
        r = admin.put(f"{BASE_URL}/api/tables/{created_table['id']}", json={"scene": _scene(room)})
        assert r.status_code == 200, r.text
        assert r.json()["scene"]["room"] == room

    def test_unknown_venue_still_rejected(self, admin, created_table):
        r = admin.put(f"{BASE_URL}/api/tables/{created_table['id']}", json={"scene": _scene("stadium")})
        assert r.status_code == 422

    def test_switching_venue_survives_a_reread(self, admin, created_table):
        admin.put(f"{BASE_URL}/api/tables/{created_table['id']}", json={"scene": _scene("redrocks")})
        r = admin.get(f"{BASE_URL}/api/tables/{created_table['id']}")
        assert r.status_code == 200
        assert r.json()["scene"]["room"] == "redrocks"


class TestAudienceActions:
    """The house can applaud, stand, raise a fist, or fold its arms."""

    @pytest.mark.parametrize("gesture", ["clap", "stand", "fist_raised", "arms_folded"])
    def test_audience_gesture_accepted(self, admin, created_table, gesture):
        r = admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/gesture", json={"gesture": gesture})
        assert r.status_code == 200, r.text

    @pytest.mark.parametrize("gesture", ["hands_up", "head_down"])
    def test_table_gestures_still_accepted(self, admin, created_table, gesture):
        r = admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/gesture", json={"gesture": gesture})
        assert r.status_code == 200, r.text

    def test_unknown_gesture_rejected(self, admin, created_table):
        r = admin.post(f"{BASE_URL}/api/tables/{created_table['id']}/gesture", json={"gesture": "cartwheel"})
        assert r.status_code == 422
