import uuid

import requests

from tests.conftest import BASE_URL, TEST_PASSWORD


def _new_user() -> dict:
    email = f"cross-origin-{uuid.uuid4().hex}@roundtable.app"
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": TEST_PASSWORD,
            "name": "Cross Origin Member",
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["user"]["email"] == email
    assert payload["token_type"] == "bearer"
    assert payload["expires_in"] == 86400
    assert payload["access_token"]
    return payload


def test_bearer_token_completes_onboarding_without_cookies():
    registered = _new_user()
    token = registered["access_token"]

    # Deliberately use a fresh session so no registration cookies are present.
    client = requests.Session()
    client.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })

    me = client.get(f"{BASE_URL}/api/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["user"]["id"] == registered["user"]["id"]

    updated = client.put(
        f"{BASE_URL}/api/me",
        json={
            "name": "Cross Origin Chef",
            "color": "#EC5B13",
            "phone": "8655550123",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Cross Origin Chef"
    assert updated.json()["color"] == "#EC5B13"

    table = client.post(
        f"{BASE_URL}/api/tables",
        json={
            "name": "Cross Origin Table",
            "color": "#34C759",
            "active": True,
        },
    )
    assert table.status_code == 200, table.text
    assert table.json()["name"] == "Cross Origin Table"


def test_login_also_returns_a_bearer_token():
    registered = _new_user()
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": registered["user"]["email"],
            "password": TEST_PASSWORD,
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
