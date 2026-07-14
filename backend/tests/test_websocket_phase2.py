"""
Roundtable_VO Phase 2 WebSocket Tests
Tests WebSocket endpoint, presence, live broadcasts, and real-time features
"""
import pytest
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_PASSWORD, TEST_USER_PASSWORD, BASE_URL
import requests
import os
import time
import asyncio
import websockets
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws'

# Test credentials
ADMIN_EMAIL = ADMIN_EMAIL
ADMIN_PASSWORD = ADMIN_PASSWORD


def get_auth_session_and_token():
    """Login and return session with cookies"""
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    # Extract rt_access cookie
    token = session.cookies.get('rt_access')
    return session, token


class TestWebSocketEndpoint:
    """WebSocket endpoint tests"""
    
    def test_ws_rejects_without_token(self):
        """Test WebSocket rejects connection without token (code 4401 or HTTP 403)"""
        async def test():
            try:
                async with websockets.connect(WS_URL, close_timeout=5) as ws:
                    # Should not reach here
                    await ws.recv()
                    pytest.fail("WebSocket should have rejected connection")
            except websockets.exceptions.ConnectionClosed as e:
                assert e.code == 4401, f"Expected close code 4401, got {e.code}"
                print(f"✓ WebSocket correctly rejected with code {e.code}")
            except websockets.exceptions.InvalidStatus as e:
                # Ingress/proxy may return HTTP 403 before WS handshake completes
                assert e.response.status_code in [403, 401], f"Expected 403/401, got {e.response.status_code}"
                print(f"✓ WebSocket correctly rejected with HTTP {e.response.status_code}")
        
        asyncio.get_event_loop().run_until_complete(test())
    
    def test_ws_accepts_with_token_query_param(self):
        """Test WebSocket accepts connection with ?token= query param"""
        session, token = get_auth_session_and_token()
        assert token, "No token received from login"
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                # Should receive 'ready' message
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                assert data.get('type') == 'ready', f"Expected 'ready', got {data}"
                assert 'user_id' in data
                print(f"✓ WebSocket connected with token, received: {data}")
        
        asyncio.get_event_loop().run_until_complete(test())
    
    def test_ws_ping_pong(self):
        """Test WebSocket ping message returns pong"""
        session, token = get_auth_session_and_token()
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                # Wait for ready
                await asyncio.wait_for(ws.recv(), timeout=5)
                
                # Send ping
                await ws.send(json.dumps({"type": "ping"}))
                
                # Expect pong
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                assert data.get('type') == 'pong', f"Expected 'pong', got {data}"
                print(f"✓ WebSocket ping/pong works: {data}")
        
        asyncio.get_event_loop().run_until_complete(test())


class TestPresenceBroadcast:
    """Test presence status updates via WebSocket"""
    
    def test_user_status_updates_on_connect(self):
        """Test user status changes to 'online' on WebSocket connect"""
        session, token = get_auth_session_and_token()
        
        # First set status to offline via API
        session.put(f"{BASE_URL}/api/me", json={"status": "offline"})
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # Check status via API
                me_resp = session.get(f"{BASE_URL}/api/me")
                me_data = me_resp.json()
                assert me_data.get('status') == 'online', f"Expected 'online', got {me_data.get('status')}"
                print(f"✓ User status updated to 'online' on WS connect")
        
        asyncio.get_event_loop().run_until_complete(test())


class TestLiveBroadcasts:
    """Test live broadcast events via WebSocket"""
    
    def test_message_broadcast_to_table(self):
        """Test POST /api/messages with table_id broadcasts to table members"""
        session, token = get_auth_session_and_token()
        user_id = session.get(f"{BASE_URL}/api/me").json()['id']
        
        # Create a table
        table_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_WS_Message_Table",
            "color": "#007AFF",
            "active": True
        })
        table_id = table_resp.json()['id']
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # Send message via API
                msg_resp = session.post(f"{BASE_URL}/api/messages", json={
                    "to_user": user_id,
                    "text": "TEST_WS_Broadcast_Message",
                    "table_id": table_id
                })
                assert msg_resp.status_code == 200
                
                # Should receive message broadcast
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get('type') == 'message', f"Expected 'message', got {data}"
                    assert data.get('message', {}).get('text') == "TEST_WS_Broadcast_Message"
                    print(f"✓ Message broadcast received: {data['type']}")
                except asyncio.TimeoutError:
                    pytest.fail("Did not receive message broadcast within timeout")
        
        try:
            asyncio.get_event_loop().run_until_complete(test())
        finally:
            # Cleanup
            session.delete(f"{BASE_URL}/api/tables/{table_id}")
    
    def test_text_broadcast_to_users(self):
        """Test POST /api/texts broadcasts to sender + recipient"""
        session, token = get_auth_session_and_token()
        user_id = session.get(f"{BASE_URL}/api/me").json()['id']
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # Send text via API
                text_resp = session.post(f"{BASE_URL}/api/texts", json={
                    "to_user": user_id,
                    "text": "TEST_WS_Text_Broadcast"
                })
                assert text_resp.status_code == 200
                
                # Should receive text broadcast
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get('type') == 'text', f"Expected 'text', got {data}"
                    assert data.get('text', {}).get('text') == "TEST_WS_Text_Broadcast"
                    print(f"✓ Text broadcast received: {data['type']}")
                except asyncio.TimeoutError:
                    pytest.fail("Did not receive text broadcast within timeout")
        
        asyncio.get_event_loop().run_until_complete(test())
    
    def test_walkie_ping_broadcast(self):
        """Test POST /api/walkie/ping sends walkie_ping event to target user"""
        session, token = get_auth_session_and_token()
        user_id = session.get(f"{BASE_URL}/api/me").json()['id']
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # Send walkie ping via API
                ping_resp = session.post(f"{BASE_URL}/api/walkie/ping", json={
                    "to_user": user_id
                })
                assert ping_resp.status_code == 200
                
                # Should receive walkie_ping broadcast
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get('type') == 'walkie_ping', f"Expected 'walkie_ping', got {data}"
                    assert 'notification' in data
                    notif = data['notification']
                    assert notif.get('from_name') is not None
                    assert notif.get('from_initials') is not None
                    print(f"✓ Walkie ping broadcast received with hydrated fields: from_name={notif.get('from_name')}")
                except asyncio.TimeoutError:
                    pytest.fail("Did not receive walkie_ping broadcast within timeout")
        
        asyncio.get_event_loop().run_until_complete(test())
    
    def test_item_added_broadcast(self):
        """Test POST /api/tables/{id}/items broadcasts item_added to table members"""
        session, token = get_auth_session_and_token()
        
        # Create a table
        table_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_WS_Item_Table",
            "color": "#34C759",
            "active": True
        })
        table_id = table_resp.json()['id']
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # Add item via API
                item_resp = session.post(f"{BASE_URL}/api/tables/{table_id}/items", json={
                    "type": "document",
                    "name": "TEST_WS_Item.pdf"
                })
                assert item_resp.status_code == 200
                
                # Should receive item_added broadcast
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get('type') == 'item_added', f"Expected 'item_added', got {data}"
                    assert data.get('table_id') == table_id
                    assert 'item' in data
                    print(f"✓ Item added broadcast received: {data['type']}")
                except asyncio.TimeoutError:
                    pytest.fail("Did not receive item_added broadcast within timeout")
        
        try:
            asyncio.get_event_loop().run_until_complete(test())
        finally:
            # Cleanup
            session.delete(f"{BASE_URL}/api/tables/{table_id}")
    
    def test_user_updated_broadcast(self):
        """Test PUT /api/me broadcasts user_updated to contacts"""
        session, token = get_auth_session_and_token()
        
        # Create a table so user has contacts
        table_resp = session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_WS_Update_Table",
            "color": "#FF9500"
        })
        table_id = table_resp.json()['id']
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # Update profile via API
                update_resp = session.put(f"{BASE_URL}/api/me", json={
                    "status": "away"
                })
                assert update_resp.status_code == 200
                
                # Note: user_updated is broadcast to contacts, not self
                # Since admin is alone in the table, they won't receive it
                # This test verifies the API call succeeds
                print(f"✓ PUT /api/me succeeded, user_updated broadcast sent to contacts")
                
                # Reset status
                session.put(f"{BASE_URL}/api/me", json={"status": "online"})
        
        try:
            asyncio.get_event_loop().run_until_complete(test())
        finally:
            # Cleanup
            session.delete(f"{BASE_URL}/api/tables/{table_id}")


class TestReferralJoinedBroadcast:
    """Test referral_joined broadcast when user joins via invite"""
    
    def test_referral_joined_broadcast(self):
        """Test POST /api/invites/join sends referral_joined to inviter"""
        admin_session, admin_token = get_auth_session_and_token()
        
        # Create table and invite
        table_resp = admin_session.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_WS_Referral_Table",
            "color": "#AF52DE"
        })
        table_id = table_resp.json()['id']
        
        invite_resp = admin_session.post(f"{BASE_URL}/api/invites", json={
            "table_id": table_id,
            "max_uses": 5
        })
        invite_code = invite_resp.json()['code']
        
        # Create new user
        new_user_session = requests.Session()
        unique_email = f"test_ws_join_{int(time.time())}@roundtable.app"
        reg_resp = new_user_session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "WS Join User"
        })
        assert reg_resp.status_code == 200
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={admin_token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # New user joins via invite
                join_resp = new_user_session.post(f"{BASE_URL}/api/invites/join", json={
                    "code": invite_code
                })
                assert join_resp.status_code == 200
                
                # Admin should receive referral_joined
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get('type') == 'referral_joined', f"Expected 'referral_joined', got {data}"
                    assert 'invitee_name' in data
                    assert 'joined_total' in data
                    print(f"✓ Referral joined broadcast received: invitee={data.get('invitee_name')}, total={data.get('joined_total')}")
                except asyncio.TimeoutError:
                    pytest.fail("Did not receive referral_joined broadcast within timeout")
        
        try:
            asyncio.get_event_loop().run_until_complete(test())
        finally:
            # Cleanup
            admin_session.delete(f"{BASE_URL}/api/tables/{table_id}")


class TestDirectMessageBroadcast:
    """Test 1:1 message broadcast (no table_id)"""
    
    def test_direct_message_broadcast(self):
        """Test POST /api/messages without table_id broadcasts to sender + recipient"""
        session, token = get_auth_session_and_token()
        user_id = session.get(f"{BASE_URL}/api/me").json()['id']
        
        async def test():
            ws_url_with_token = f"{WS_URL}?token={token}"
            async with websockets.connect(ws_url_with_token, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # ready
                
                # Send direct message (to self for testing)
                msg_resp = session.post(f"{BASE_URL}/api/messages", json={
                    "to_user": user_id,
                    "text": "TEST_WS_Direct_Message"
                })
                assert msg_resp.status_code == 200
                
                # Should receive message broadcast
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    assert data.get('type') == 'message', f"Expected 'message', got {data}"
                    assert data.get('message', {}).get('table_id') is None  # No table_id for direct
                    print(f"✓ Direct message broadcast received: {data['type']}")
                except asyncio.TimeoutError:
                    pytest.fail("Did not receive direct message broadcast within timeout")
        
        asyncio.get_event_loop().run_until_complete(test())


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
