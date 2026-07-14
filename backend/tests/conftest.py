"""
Shared pytest fixtures for Roundtable_VO API tests.
Credentials loaded from environment variables or .env.test file.
"""
import pytest
import requests
import os
from pathlib import Path

# Load test env if available
_env_test = Path(__file__).parent.parent / ".env.test"
if _env_test.exists():
    for line in _env_test.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from environment
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@roundtable.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL", "demo@roundtable.app")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "")
TEST_USER_NAME = os.environ.get("TEST_USER_NAME", "Demo User")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "")


@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_session():
    """Session authenticated as admin"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    return session


@pytest.fixture(scope="function")
def test_user_session(api_client):
    """Session authenticated as test user (creates if not exists)"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })

    if response.status_code == 200:
        return session

    response = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
        "name": TEST_USER_NAME
    })

    if response.status_code in [200, 201]:
        return session
    elif response.status_code == 409:
        pytest.skip("Test user exists with different password")
    else:
        pytest.skip(f"Could not create test user: {response.status_code}")

    return session
