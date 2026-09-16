import asyncio
import importlib
import uuid

import pytest
from fastapi.testclient import TestClient

from sqlite_store import AsyncSQLiteClient


@pytest.fixture
def application(tmp_path, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "isolated-test-secret-at-least-32-bytes")
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "bootstrap.sqlite3"))
    module = importlib.import_module("app")
    server = importlib.import_module("server")
    database = AsyncSQLiteClient(str(tmp_path / "test.sqlite3"))
    monkeypatch.setattr(server, "db", database["test"])
    monkeypatch.setattr(server, "sqlite_client", database)
    monkeypatch.setattr(server, "UPLOAD_ROOT", tmp_path / "uploads")
    monkeypatch.setattr(server, "ADMIN_PASSWORD", "")
    monkeypatch.setattr(server, "CORS_ORIGINS", ["https://localhost:3000"])
    monkeypatch.setattr(server, "AUTH_RATE_LIMIT", 1000)
    monkeypatch.setattr(server, "_auth_attempts", server.defaultdict(server.deque))
    monkeypatch.setattr(server, "active_calls", {})
    monkeypatch.setattr(server, "user_call_map", {})
    monkeypatch.setattr(server, "user_call_connections", {})
    monkeypatch.setattr(server, "ws_manager", server.WSManager())
    monkeypatch.setattr(server, "TWILIO_ACCOUNT_SID", None)
    monkeypatch.setattr(server, "RESEND_API_KEY", None)
    monkeypatch.setattr(server, "VAPID_PRIVATE_KEY", None)
    with TestClient(module.app, base_url="https://localhost") as client:
        yield server, client
    database.close()


def register(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": f"{uuid.uuid4().hex}@example.com",
            "name": "Launch Member",
            "password": "TestPassword2026",
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    client.cookies.clear()
    return payload["user"]["id"], {"Authorization": f"Bearer {payload['access_token']}"}


def test_outsiders_cannot_delete_or_restore_private_content(application):
    _, client = application
    _, owner = register(client)
    recipient_id, recipient = register(client)
    _, outsider = register(client)
    for collection, content in (
        ("messages", {"text": "Private message"}),
        ("emails", {"subject": "Private email", "body": "Only participants"}),
    ):
        created = client.post(
            f"/api/{collection}", headers=owner, json={"to_user": recipient_id, **content}
        )
        assert created.status_code == 200, created.text
        item_id = created.json()["id"]
        assert client.delete(f"/api/{collection}/{item_id}", headers=outsider).status_code == 404
        assert client.delete(f"/api/{collection}/{item_id}", headers=recipient).status_code == 200
        query = {"collection": collection, "item_id": item_id}
        assert client.post("/api/trash/restore", params=query, headers=outsider).status_code == 404
        assert client.post("/api/trash/restore", params=query, headers=recipient).status_code == 200
    assert client.delete("/api/trash/purge?collection=typo", headers=owner).status_code == 400


def test_revoked_invites_and_trashed_items_stay_unavailable(application):
    _, client = application
    _, owner = register(client)
    _, outsider = register(client)
    table = client.post("/api/tables", headers=owner, json={"name": "Private Table"}).json()
    invite = client.post("/api/invites", headers=owner, json={"table_id": table["id"]}).json()
    assert client.delete(f"/api/invites/{invite['id']}", headers=owner).status_code == 200
    assert client.get(f"/api/invites/preview/{invite['code']}").status_code == 404
    assert (
        client.post(
            "/api/invites/join", headers=outsider, json={"code": invite["code"]}
        ).status_code
        == 404
    )
    endpoint = f"/api/tables/{table['id']}/items"
    item = client.post(
        endpoint, headers=owner, json={"type": "prayer", "name": "Private prayer"}
    ).json()
    assert client.delete(f"{endpoint}/{item['id']}", headers=owner).status_code == 200
    assert client.get(f"/api/tables/{table['id']}", headers=owner).json()["items"] == []
    assert client.get(f"/api/tables/{table['id']}/prayers", headers=owner).json() == []


def test_event_cannot_be_moved_into_another_users_table(application):
    _, client = application
    _, owner = register(client)
    _, outsider = register(client)
    table = client.post("/api/tables", headers=owner, json={"name": "Private Table"}).json()
    data = {"title": "An event", "date": "2026-10-01"}
    event = client.post("/api/events", headers=outsider, json=data).json()
    assert (
        client.put(
            f"/api/events/{event['id']}", headers=outsider, json={**data, "table_id": table["id"]}
        ).status_code
        == 403
    )


def test_directory_does_not_expose_unrelated_accounts(application):
    _, client = application
    stranger_id, _ = register(client)
    _, user = register(client)
    response = client.get("/api/members", headers=user)
    assert response.status_code == 200
    assert all(member["id"] != stranger_id for member in response.json())


def test_origin_password_and_rate_limit_guards(application, monkeypatch):
    server, client = application
    assert (
        client.post("/api/auth/logout", headers={"Origin": "https://attacker.example"}).status_code
        == 403
    )
    assert client.post("/api/auth/logout").status_code == 200
    response = client.post(
        "/api/auth/register",
        json={"email": "long@example.com", "name": "A User", "password": "界" * 30},
    )
    assert response.status_code == 422
    server._auth_attempts.clear()
    monkeypatch.setattr(server, "AUTH_RATE_LIMIT", 2)
    for _ in range(2):
        assert (
            client.post(
                "/api/auth/login", json={"email": "none@example.com", "password": "wrong"}
            ).status_code
            == 401
        )
    blocked = client.post(
        "/api/auth/login", json={"email": "none@example.com", "password": "wrong"}
    )
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "60"


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://127.0.0.1/",
        "https://127.0.0.1/",
        "https://attacker.example/",
        "https://fcm.googleapis.com.attacker.example/",
        "https://fcm.googleapis.com:8443/",
    ],
)
def test_push_endpoint_cannot_target_arbitrary_servers(application, endpoint):
    _, client = application
    _, user = register(client)
    assert (
        client.post(
            "/api/push/subscribe", headers=user, json={"endpoint": endpoint, "keys": {}}
        ).status_code
        == 422
    )


def test_websocket_call_and_presentation_authorization(application):
    server, client = application
    owner_id, owner = register(client)
    target_id, target = register(client)
    outsider_id, outsider = register(client)
    table = client.post("/api/tables", headers=owner, json={"name": "Private Table"}).json()
    token = outsider["Authorization"].split()[1]
    with client.websocket_connect("/api/ws", subprotocols=["rt-v1", f"rt-auth.{token}"]) as socket:
        assert socket.receive_json()["type"] == "ready"
        socket.send_json({"type": "present_start", "table_id": table["id"]})
        assert socket.receive_json()["type"] == "error"
        socket.send_json({"type": "call_start", "table_id": table["id"]})
        assert socket.receive_json()["type"] == "call_error"
        socket.send_json([])
        socket.send_json({"type": "ping"})
        assert socket.receive_json()["type"] == "pong"

    async def check_calls():
        await server._handle_call_start(
            owner_id, {"call_id": "private-call", "target_user": target_id}
        )
        with pytest.raises(server.HTTPException) as denied:
            await server._handle_call_join(outsider_id, {"call_id": "private-call"})
        assert denied.value.status_code == 403
        with pytest.raises(server.HTTPException):
            await server._handle_call_start(
                outsider_id, {"call_id": "private-call", "target_user": target_id}
            )
        with pytest.raises(server.HTTPException):
            await server._handle_sdp_relay(
                outsider_id,
                {"type": "webrtc_offer", "call_id": "private-call", "target_user": owner_id},
            )
        await server._handle_call_join(target_id, {"call_id": "private-call"})
        assert server.active_calls["private-call"]["participants"] == {owner_id, target_id}

    asyncio.run(check_calls())
    assert client.delete("/api/calls/history/private-call", headers=outsider).status_code == 404
    assert client.delete("/api/calls/history/private-call", headers=owner).status_code == 200
    assert client.get("/api/calls/history", headers=owner).json() == []


def test_websocket_rejects_untrusted_browser_origin(application):
    from starlette.websockets import WebSocketDisconnect

    _, client = application
    _, user = register(client)
    token = user["Authorization"].split()[1]
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            "/api/ws",
            subprotocols=["rt-v1", f"rt-auth.{token}"],
            headers={"Origin": "https://attacker.example"},
        ):
            pass


def test_old_recurring_events_keep_calendar_correct_future_instances(application, monkeypatch):
    from datetime import datetime, timezone

    server, _ = application

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2028, 1, 30, tzinfo=timezone.utc)

    monkeypatch.setattr(server, "datetime", Clock)
    monthly = server._expand_recurring(
        [{"id": "month", "date": "2020-01-31", "recurring": "monthly"}]
    )
    dates = [event["date"] for event in monthly]
    assert "2028-01-31" in dates
    assert "2028-02-29" in dates
    assert "2028-03-31" in dates
    weekly = server._expand_recurring([{"id": "week", "date": "2020-01-01", "recurring": "weekly"}])
    assert len(weekly) >= 13
    assert all(event["date"] >= "2028-01-30" for event in weekly[1:])


def test_file_reference_cannot_grant_access_to_someone_elses_upload(application):
    _, client = application
    _, owner = register(client)
    _, outsider = register(client)
    uploaded = client.post(
        "/api/upload", headers=owner, files={"file": ("private.txt", b"private", "text/plain")}
    )
    assert uploaded.status_code == 200
    path = uploaded.json()["storage_path"]
    table = client.post("/api/tables", headers=outsider, json={"name": "Outsider Table"}).json()
    response = client.post(
        f"/api/tables/{table['id']}/items",
        headers=outsider,
        json={"type": "document", "name": "Foreign File", "url": path},
    )
    assert response.status_code == 403
    assert client.get(f"/api/files/{path}", headers=outsider).status_code == 403


def test_closing_another_tab_preserves_active_call(application):
    server, client = application
    owner_id, owner = register(client)
    target_id, _ = register(client)
    token = owner["Authorization"].split()[1]
    protocols = ["rt-v1", f"rt-auth.{token}"]
    with client.websocket_connect("/api/ws", subprotocols=protocols) as first:
        assert first.receive_json()["type"] == "ready"
        first.send_json({"type": "call_start", "call_id": "multi-tab", "target_user": target_id})
        assert first.receive_json()["type"] == "call_started"
        with client.websocket_connect("/api/ws", subprotocols=protocols) as second:
            assert second.receive_json()["type"] == "ready"
        first.send_json({"type": "ping"})
        assert first.receive_json()["type"] == "pong"
        assert server.user_call_map[owner_id] == "multi-tab"
        assert owner_id in server.active_calls["multi-tab"]["participants"]
        first.close()
        # Wait for the real disconnect event before TestClient cancels its task.
        import time
        deadline = time.monotonic() + 2
        while owner_id in server.user_call_map and time.monotonic() < deadline:
            time.sleep(0.01)
    assert owner_id not in server.user_call_map
    assert "multi-tab" not in server.active_calls


def test_deleted_events_do_not_send_sms_reminders(application, monkeypatch):
    from datetime import datetime, timezone
    from unittest.mock import AsyncMock

    server, _ = application
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 9, 16, 12, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(server, "datetime", Clock)
    monkeypatch.setattr(server, "TWILIO_ACCOUNT_SID", "isolated")
    monkeypatch.setattr(server, "TWILIO_AUTH_TOKEN", "isolated")
    monkeypatch.setattr(server, "TWILIO_FROM_NUMBER", "isolated")
    sender = AsyncMock()
    monkeypatch.setattr(server, "send_auto_sms_if_offline", sender)

    async def exercise():
        await server.db.events.insert_one({
            "id": "cancelled", "title": "Cancelled meeting", "date": "2026-09-16",
            "time": "13:00", "table_id": "table", "deleted_at": server.now_iso(),
        })
        await server.db.table_members.insert_one({"table_id": "table", "user_id": "member"})
        await server._send_event_reminders()
        sender.assert_not_awaited()
        assert await server.db.notifications.count_documents({"type": "reminder_sent"}) == 0
        await server.db.events.insert_one({
            "id": "live", "title": "Live meeting", "date": "2026-09-16",
            "time": "13:00", "table_id": "table",
        })
        await server._send_event_reminders()
        sender.assert_awaited_once()
    asyncio.run(exercise())


def test_calling_tab_disconnect_ends_call_even_with_idle_tab_open(application):
    import time

    server, client = application
    owner_id, owner = register(client)
    target_id, _ = register(client)
    protocols = ["rt-v1", f"rt-auth.{owner['Authorization'].split()[1]}"]
    with client.websocket_connect("/api/ws", subprotocols=protocols) as idle:
        assert idle.receive_json()["type"] == "ready"
        with client.websocket_connect("/api/ws", subprotocols=protocols) as caller:
            assert caller.receive_json()["type"] == "ready"
            caller.send_json({"type": "call_start", "call_id": "owned-call", "target_user": target_id})
            assert caller.receive_json()["type"] == "call_started"
            assert idle.receive_json()["type"] == "call_started"
            caller.close()
            deadline = time.monotonic() + 2
            while owner_id in server.user_call_map and time.monotonic() < deadline:
                time.sleep(0.01)
        assert owner_id not in server.user_call_map
        assert server.ws_manager.is_online(owner_id)
        idle.send_json({"type": "ping"})
        assert idle.receive_json()["type"] == "pong"
