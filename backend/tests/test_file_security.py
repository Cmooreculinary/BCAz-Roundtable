import os
import uuid

import requests

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL, TEST_PASSWORD


def _register(name: str) -> requests.Session:
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": f"file-test-{uuid.uuid4().hex}@roundtable.app",
            "password": TEST_PASSWORD,
            "name": name,
        },
    )
    assert response.status_code == 200, response.text
    return session


def _admin() -> requests.Session:
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return session


def _upload(session: requests.Session, content: bytes = b"launch-ready") -> dict:
    response = session.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("launch.txt", content, "text/plain")},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_upload_owner_can_view_and_download_file():
    admin = _admin()
    uploaded = _upload(admin)
    file_url = f"{BASE_URL}/api/files/{uploaded['storage_path']}"

    inline = admin.get(file_url)
    assert inline.status_code == 200
    assert inline.content == b"launch-ready"
    assert inline.headers["content-disposition"].startswith("inline;")

    attachment = admin.get(f"{file_url}?download=true")
    assert attachment.status_code == 200
    assert attachment.headers["content-disposition"].startswith("attachment;")


def test_shared_file_is_limited_to_table_members():
    admin = _admin()
    uploaded = _upload(admin)
    first_table = admin.post(
        f"{BASE_URL}/api/tables",
        json={"name": "First File Table", "color": "#0D0D0D"},
    ).json()
    first_item = admin.post(
        f"{BASE_URL}/api/tables/{first_table['id']}/items",
        json={
            "type": "document",
            "name": "First file reference",
            "url": uploaded["storage_path"],
            "mime_type": "text/plain",
        },
    )
    assert first_item.status_code == 200, first_item.text

    member_table = admin.post(
        f"{BASE_URL}/api/tables",
        json={"name": "File Security", "color": "#EC5B13"},
    ).json()
    invite = admin.post(
        f"{BASE_URL}/api/invites",
        json={"table_id": member_table["id"], "max_uses": 2},
    ).json()
    item_response = admin.post(
        f"{BASE_URL}/api/tables/{member_table['id']}/items",
        json={
            "type": "document",
            "name": "Launch file",
            "url": uploaded["storage_path"],
            "mime_type": "text/plain",
        },
    )
    assert item_response.status_code == 200, item_response.text

    member = _register("File Member")
    join = member.post(f"{BASE_URL}/api/invites/join", json={"code": invite["code"]})
    assert join.status_code == 200, join.text

    outsider = _register("File Outsider")
    file_url = f"{BASE_URL}/api/files/{uploaded['storage_path']}"
    assert member.get(file_url).status_code == 200
    assert outsider.get(file_url).status_code == 403


def test_upload_limit_is_enforced():
    configured_limit = int(os.environ.get("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))
    admin = _admin()
    response = admin.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("too-large.bin", b"x" * (configured_limit + 1), "application/octet-stream")},
    )
    assert response.status_code == 413
    assert "upload limit" in response.json()["detail"]
