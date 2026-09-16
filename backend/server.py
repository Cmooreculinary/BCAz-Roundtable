from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import bcrypt
import jwt
import secrets
import string
import re
import sqlite3
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from urllib.parse import quote, urlparse
from html import escape
from calendar import monthrange
from collections import defaultdict, deque
from time import monotonic

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Header, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response as FastResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from sqlite_store import AsyncSQLiteClient
from pydantic import BaseModel, Field, EmailStr, field_validator
import asyncio
import json as _json

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("roundtable")

# ---------- Config ----------
DB_NAME = os.environ.get("DB_NAME", "roundtable_vo")
SQLITE_PATH = os.environ.get("SQLITE_PATH", str(ROOT_DIR / "data" / f"{DB_NAME}.sqlite3"))
JWT_SECRET = os.environ["JWT_SECRET"]
if len(JWT_SECRET.encode("utf-8")) < 32:
    raise RuntimeError("JWT_SECRET must contain at least 32 bytes")
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@roundtable.app").strip().lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
APP_NAME = os.environ.get("APP_NAME", "Roundtable_VO")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:admin@roundtable.app")

# SMS/Email bridge (optional, uses Twilio and Resend)
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "noreply@roundtable.app")

CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
AUTH_RATE_LIMIT = int(os.environ.get("AUTH_RATE_LIMIT", "30"))
if AUTH_RATE_LIMIT < 1:
    raise RuntimeError("AUTH_RATE_LIMIT must be positive")
if "*" in CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS must list explicit origins when credentials are enabled")

UPLOAD_ROOT = Path(os.environ.get("UPLOAD_ROOT", str(ROOT_DIR / "data" / "uploads")))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))
if MAX_UPLOAD_BYTES <= 0:
    raise RuntimeError("MAX_UPLOAD_BYTES must be greater than zero")

# ---------- DB ----------
sqlite_client = AsyncSQLiteClient(SQLITE_PATH)
db = sqlite_client[DB_NAME]


# ---------- Helpers ----------
def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60 * 24),  # 24h for smoother UX
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    # Preview runs over HTTPS; use Secure + None for cross-site, Lax for same-site.
    # Same-origin via ingress → SameSite=Lax, secure=True works.
    response.set_cookie(
        key="rt_access", value=access_token, httponly=True, secure=True, samesite="none",
        max_age=60 * 60 * 24, path="/",
    )
    response.set_cookie(
        key="rt_refresh", value=refresh_token, httponly=True, secure=True, samesite="none",
        max_age=60 * 60 * 24 * 7, path="/",
    )


def clear_auth_cookies(response: Response):
    response.delete_cookie("rt_access", path="/", secure=True, httponly=True, samesite="none")
    response.delete_cookie("rt_refresh", path="/", secure=True, httponly=True, samesite="none")


def initials_of(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def generate_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "initials": u.get("initials") or initials_of(u["name"]),
        "color": u.get("color", "#007AFF"),
        "status": u.get("status", "online"),
        "avatar_url": u.get("avatar_url"),
        "avatar_tier": u.get("avatar_tier", "stylized"),  # Iteration 18 — namespace reservation
        "onboarded": bool(u.get("onboarded", False)),
        "role": u.get("role", "member"),
        "phone": u.get("phone"),
        "auto_sms": bool(u.get("auto_sms", False)),
        "created_at": u.get("created_at"),
    }


# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("rt_access")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def ensure_table_member(table_id: str, user_id: str) -> dict:
    m = await db.table_members.find_one({"table_id": table_id, "user_id": user_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=403, detail="Not a member of this table")
    return m


# ---------- WebSocket Connection Manager ----------
class WSManager:
    def __init__(self):
        # user_id -> set of WebSocket
        self._conns: dict = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket):
        protocols = ws.scope.get("subprotocols", [])
        await ws.accept(subprotocol="rt-v1" if "rt-v1" in protocols else None)
        async with self._lock:
            self._conns.setdefault(user_id, set()).add(ws)
        # Update presence
        await db.users.update_one({"id": user_id}, {"$set": {"status": "online", "last_seen_at": now_iso()}})
        await self.broadcast_to_contacts(user_id, {"type": "presence", "user_id": user_id, "status": "online"})

    async def disconnect(self, user_id: str, ws: WebSocket):
        went_offline = False
        async with self._lock:
            if user_id in self._conns:
                self._conns[user_id].discard(ws)
                if not self._conns[user_id]:
                    self._conns.pop(user_id, None)
                    went_offline = True
        if went_offline:
            await db.users.update_one({"id": user_id}, {"$set": {"status": "offline", "last_seen_at": now_iso()}})
            await self.broadcast_to_contacts(user_id, {"type": "presence", "user_id": user_id, "status": "offline"})

    async def send_to_user(self, user_id: str, payload: dict):
        sockets = list(self._conns.get(user_id, set()))
        if not sockets:
            return
        msg = _json.dumps(payload, default=str)
        dead = []
        for s in sockets:
            try:
                await s.send_text(msg)
            except Exception:
                dead.append(s)
        if dead:
            async with self._lock:
                for s in dead:
                    if user_id in self._conns:
                        self._conns[user_id].discard(s)

    async def send_to_users(self, user_ids: list, payload: dict):
        for uid in set(user_ids):
            await self.send_to_user(uid, payload)

    async def broadcast_to_table(self, table_id: str, payload: dict, exclude_user: str = None):
        members = await db.table_members.find({"table_id": table_id}, {"_id": 0}).to_list(500)
        ids = [m["user_id"] for m in members if m["user_id"] != exclude_user]
        await self.send_to_users(ids, payload)

    async def broadcast_to_contacts(self, user_id: str, payload: dict):
        """Send payload to all users who share a table with user_id."""
        my_tables = await db.table_members.find({"user_id": user_id}, {"_id": 0}).to_list(500)
        table_ids = [m["table_id"] for m in my_tables]
        if not table_ids:
            return
        member_ids = set()
        async for m in db.table_members.find({"table_id": {"$in": table_ids}}, {"_id": 0}):
            if m["user_id"] != user_id:
                member_ids.add(m["user_id"])
        await self.send_to_users(list(member_ids), payload)

    def is_online(self, user_id: str) -> bool:
        return bool(self._conns.get(user_id))


ws_manager = WSManager()


# ---------- Active Calls (in-memory) ----------
# call_id -> { table_id, type ("audio"|"video"), participants: {user_id}, created_by, created_at }
active_calls: dict = {}
# user_id -> call_id (quick lookup)
user_call_map: dict = {}
# Track the tab that owns each media call so other tabs can close independently.
user_call_connections: dict = {}


async def _handle_webrtc_message(user_id: str, msg: dict):
    """Process WebRTC signaling messages — dispatch pattern."""
    _dispatch = {
        "call_start": _handle_call_start,
        "call_join": _handle_call_join,
        "call_leave": _handle_call_leave,
        "webrtc_offer": _handle_sdp_relay,
        "webrtc_answer": _handle_sdp_relay,
        "webrtc_ice": _handle_ice_relay,
        "walkie_talk_state": _handle_walkie_talk_state,
    }
    handler = _dispatch.get(msg.get("type"))
    if handler:
        await handler(user_id, msg)


async def _handle_call_start(user_id: str, msg: dict):
    call_id = msg.get("call_id") or new_id()
    table_id = msg.get("table_id")
    call_type = msg.get("call_type", "video")
    target_user = msg.get("target_user")

    if call_type not in ("video", "audio", "walkie") or not (table_id or target_user):
        raise HTTPException(status_code=400, detail="Invalid call destination or type")
    if table_id:
        await ensure_table_member(table_id, user_id)
        if target_user:
            await ensure_table_member(table_id, target_user)
    elif not await db.users.find_one({"id": target_user}):
        raise HTTPException(status_code=404, detail="Call recipient not found")
    if call_id in active_calls or await db.call_logs.find_one({"call_id": call_id}):
        raise HTTPException(status_code=409, detail="Call already exists")
    if user_id in user_call_map:
        raise HTTPException(status_code=409, detail="Leave your current call first")

    active_calls[call_id] = {
        "call_id": call_id, "table_id": table_id, "type": call_type,
        "participants": {user_id}, "created_by": user_id,
        "created_at": now_iso(), "target_user": target_user,
    }
    user_call_map[user_id] = call_id

    try:
        await db.call_logs.insert_one({
            "call_id": call_id, "table_id": table_id, "type": call_type,
            "created_by": user_id, "target_user": target_user,
            "participants": [user_id], "started_at": now_iso(),
            "ended_at": None, "duration_seconds": 0, "status": "active",
        })
    except sqlite3.IntegrityError:
        active_calls.pop(call_id, None)
        user_call_map.pop(user_id, None)
        raise HTTPException(status_code=409, detail="Call already exists") from None

    caller = await db.users.find_one({"id": user_id}, {"_id": 0})
    caller_info = user_public(caller) if caller else {"id": user_id, "name": "Someone"}
    incoming_payload = {
        "type": "call_incoming", "call_id": call_id,
        "call_type": call_type, "table_id": table_id, "caller": caller_info,
    }

    if target_user:
        await ws_manager.send_to_user(target_user, incoming_payload)
        if not ws_manager.is_online(target_user):
            await send_push_to_user(target_user, f"Incoming {call_type} call", f"{caller_info.get('name', 'Someone')} is calling you", {"type": "call", "call_id": call_id})
            await send_auto_sms_if_offline(target_user, f"{caller_info.get('name', 'Someone')} tried to call you ({call_type}). Open Roundtable_VO to call back!")
    elif table_id:
        await ws_manager.broadcast_to_table(table_id, incoming_payload, exclude_user=user_id)

    await ws_manager.send_to_user(user_id, {
        "type": "call_started", "call_id": call_id,
        "call_type": call_type, "participants": list(active_calls[call_id]["participants"]),
    })
    logger.info(f"Call {call_id} started by {user_id} (type={call_type})")


async def _handle_call_join(user_id: str, msg: dict):
    call_id = msg.get("call_id")
    if not call_id or call_id not in active_calls:
        await ws_manager.send_to_user(user_id, {"type": "call_error", "error": "Call not found or ended"})
        return

    call = active_calls[call_id]
    if call.get("table_id"):
        await ensure_table_member(call["table_id"], user_id)
    elif user_id not in (call["created_by"], call.get("target_user")):
        raise HTTPException(status_code=403, detail="Not invited to this call")
    if user_id in call["participants"]:
        return
    if user_id in user_call_map:
        raise HTTPException(status_code=409, detail="Leave your current call first")
    existing_participants = list(call["participants"])
    call["participants"].add(user_id)
    user_call_map[user_id] = call_id

    await db.call_logs.update_one({"call_id": call_id}, {"$addToSet": {"participants": user_id}})

    joiner = await db.users.find_one({"id": user_id}, {"_id": 0})
    joiner_info = user_public(joiner) if joiner else {"id": user_id, "name": "Someone"}

    for pid in existing_participants:
        await ws_manager.send_to_user(pid, {
            "type": "call_peer_joined", "call_id": call_id,
            "peer": joiner_info, "participants": list(call["participants"]),
        })

    peer_infos = []
    for pid in existing_participants:
        p = await db.users.find_one({"id": pid}, {"_id": 0})
        if p:
            peer_infos.append(user_public(p))
    await ws_manager.send_to_user(user_id, {
        "type": "call_joined", "call_id": call_id,
        "call_type": call["type"], "existing_peers": peer_infos,
        "participants": list(call["participants"]),
    })
    logger.info(f"User {user_id} joined call {call_id}")


async def _handle_call_leave(user_id: str, msg: dict):
    call_id = msg.get("call_id") or user_call_map.get(user_id)
    if not (call_id and call_id in active_calls):
        return

    call = active_calls[call_id]
    if user_id not in call["participants"]:
        raise HTTPException(status_code=403, detail="Not a call participant")
    call["participants"].discard(user_id)
    user_call_map.pop(user_id, None)
    user_call_connections.pop(user_id, None)

    leaver = await db.users.find_one({"id": user_id}, {"_id": 0})
    leaver_info = user_public(leaver) if leaver else {"id": user_id}

    for pid in list(call["participants"]):
        await ws_manager.send_to_user(pid, {
            "type": "call_peer_left", "call_id": call_id,
            "peer": leaver_info, "participants": list(call["participants"]),
        })

    if not call["participants"]:
        await _finalize_call_log(call_id, call)
        active_calls.pop(call_id, None)
    logger.info(f"User {user_id} left call {call_id}")


async def _finalize_call_log(call_id: str, call: dict):
    """Calculate duration and mark call log as ended."""
    started = call.get("created_at", now_iso())
    try:
        start_dt = datetime.fromisoformat(started)
        duration = int((datetime.now(timezone.utc) - start_dt).total_seconds())
    except Exception:
        duration = 0
    await db.call_logs.update_one(
        {"call_id": call_id},
        {"$set": {"ended_at": now_iso(), "duration_seconds": duration, "status": "ended"}},
    )
    logger.info(f"Call {call_id} ended (duration={duration}s)")


async def _handle_sdp_relay(user_id: str, msg: dict):
    """Relay SDP offer or answer to the target peer."""
    _ensure_call_peers(user_id, msg)
    target = msg.get("target_user")
    if target:
        await ws_manager.send_to_user(target, {
            "type": msg["type"], "from_user": user_id,
            "call_id": msg.get("call_id"), "sdp": msg.get("sdp"),
        })


async def _handle_ice_relay(user_id: str, msg: dict):
    """Relay ICE candidate to the target peer."""
    _ensure_call_peers(user_id, msg)
    target = msg.get("target_user")
    if target:
        await ws_manager.send_to_user(target, {
            "type": "webrtc_ice", "from_user": user_id,
            "call_id": msg.get("call_id"), "candidate": msg.get("candidate"),
        })


def _ensure_call_peers(user_id: str, msg: dict):
    call = active_calls.get(msg.get("call_id"))
    if not call or user_id not in call["participants"] or msg.get("target_user") not in call["participants"]:
        raise HTTPException(status_code=403, detail="Not connected to this call peer")


async def _handle_walkie_talk_state(user_id: str, msg: dict):
    """Broadcast talking state to all call participants."""
    call_id = msg.get("call_id") or user_call_map.get(user_id)
    if call_id and call_id in active_calls:
        if user_id not in active_calls[call_id]["participants"]:
            raise HTTPException(status_code=403, detail="Not a call participant")
        for pid in active_calls[call_id]["participants"]:
            if pid != user_id:
                await ws_manager.send_to_user(pid, {
                    "type": "walkie_talk_state", "from_user": user_id,
                    "talking": msg.get("talking", False), "call_id": call_id,
                })


# ---------- Local file storage ----------
def init_storage() -> Path:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    return UPLOAD_ROOT


def _storage_file(storage_path: str) -> Path:
    relative = Path(storage_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    root = UPLOAD_ROOT.resolve()
    target = (root / relative).resolve()
    if target != root and root not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    return target


def put_object(path: str, data: bytes, content_type: str) -> dict:
    target = _storage_file(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {"path": path, "size": len(data), "content_type": content_type}


def get_object(path: str) -> tuple:
    target = _storage_file(path)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return target.read_bytes(), "application/octet-stream"


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(min_length=2, max_length=60)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least two characters")
        return value


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    color: Optional[str] = None
    status: Optional[Literal["online", "away", "dnd", "offline"]] = None
    avatar_url: Optional[str] = None
    onboarded: Optional[bool] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    auto_sms: Optional[bool] = None
    # Iteration 18 — namespace reservation. Only "preset" and "stylized" are implemented.
    # "premium_illustrated" and "photoreal" are accepted but indicate deferred tiers.
    avatar_tier: Optional[Literal["preset", "stylized", "premium_illustrated", "photoreal"]] = None


# Iteration 18 — Scene model for /table/:id pages.
# Stores only string IDs; frontend resolves IDs to visuals via lib/scenes.js.
# Allowed values must align with /app/frontend/src/lib/scenes.js.
# Table rooms seat guests around a table; stage venues seat an audience
# facing a speaker. Both are stored in the same `room` field.
ROOM_IDS = ("library", "skyline", "dining", "studio", "church", "terrace", "theatre", "redrocks", "arena")
TABLE_IDS = ("mahogany", "executive", "family", "drafting", "luncheon", "strategy")
TABLETOP_IDS = ("meeting", "coffee", "luncheon", "formal", "planning", "chef")
FOOD_IDS = ("none", "coffee", "snacks", "hors", "lunch", "dinner", "chef")
AMBIANCE_IDS = ("warm", "bright", "fireside", "jazz", "focus", "celebrate")
MUSIC_IDS = ("off", "jazz", "acoustic", "ambient", "worship", "event")

# Anchor 2 — fixed seat counts per table type
SEAT_COUNTS = {
    "mahogany": 8, "executive": 10, "family": 6,
    "drafting": 8, "luncheon": 6, "strategy": 12,
}

# Anchor 1 — default scene
DEFAULT_SCENE = {
    "room": "library",
    "table": "mahogany",
    "tabletop": "meeting",
    "food": "none",
    "ambiance": "warm",
    "music": "off",
}


class SceneIn(BaseModel):
    room: Literal[
        "library", "skyline", "dining", "studio", "church", "terrace",
        "theatre", "redrocks", "arena",
    ] = "library"
    table: Literal["mahogany", "executive", "family", "drafting", "luncheon", "strategy"] = "mahogany"
    tabletop: Literal["meeting", "coffee", "luncheon", "formal", "planning", "chef"] = "meeting"
    food: Literal["none", "coffee", "snacks", "hors", "lunch", "dinner", "chef"] = "none"
    ambiance: Literal["warm", "bright", "fireside", "jazz", "focus", "celebrate"] = "warm"
    music: Literal["off", "jazz", "acoustic", "ambient", "worship", "event"] = "off"


class TableIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = "#007AFF"
    active: bool = False
    purpose: Optional[Literal["family", "bible_study", "community", "friends", "work", "other"]] = "other"
    scene: Optional[SceneIn] = None  # Iteration 18 — optional; defaults to DEFAULT_SCENE


class TableUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = None
    active: Optional[bool] = None
    purpose: Optional[Literal["family", "bible_study", "community", "friends", "work", "other"]] = None
    scene: Optional[SceneIn] = None  # Iteration 18


class SeatClaimIn(BaseModel):
    seat_index: Optional[int] = None  # None ⇒ auto-claim first free seat


class TableGestureIn(BaseModel):
    # "stand" is the standing ovation available in stage venues; the rest are
    # playable from a chair at a table or a seat in the house.
    gesture: Literal["clap", "arms_folded", "hands_up", "fist_raised", "head_down", "stand"]


class SharedItemIn(BaseModel):
    type: Literal["photo", "document", "video", "audio", "link", "note", "spreadsheet", "presentation", "prayer", "intention"]
    name: str = Field(min_length=1, max_length=200)
    url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None


class MessageIn(BaseModel):
    to_user: str
    text: str = Field(min_length=1, max_length=10000)
    table_id: Optional[str] = None  # table-scoped chat


class EmailIn(BaseModel):
    to_user: str
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=50000)


class TextIn(BaseModel):
    to_user: str
    text: str = Field(min_length=1, max_length=2000)


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: str  # YYYY-MM-DD
    time: str = "12:00"
    table_id: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    recurring: Optional[Literal["weekly", "monthly", "none"]] = "none"


class ReactionIn(BaseModel):
    type: Literal["praying", "amen", "heart", "thanks"]


class InviteIn(BaseModel):
    table_id: str
    max_uses: int = Field(default=50, ge=1, le=1000)
    expires_in_days: int = Field(default=30, ge=1, le=365)
    recipient_email: Optional[EmailStr] = None
    recipient_name: Optional[str] = Field(default=None, max_length=60)


class InviteJoinIn(BaseModel):
    code: str


class ContactIn(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None


class WalkiePingIn(BaseModel):
    to_user: str
    table_id: Optional[str] = None


# ---------- App ----------
app = FastAPI(title="Roundtable_VO API")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tables.create_index("id", unique=True)
    await db.table_members.create_index([("table_id", 1), ("user_id", 1)], unique=True)
    await db.table_members.create_index("user_id")
    await db.shared_items.create_index([("table_id", 1), ("created_at", -1)])
    await db.messages.create_index([("from_user", 1), ("to_user", 1)])
    await db.messages.create_index("table_id")
    await db.emails.create_index([("to_user", 1), ("folder", 1)])
    await db.texts.create_index([("from_user", 1), ("to_user", 1)])
    await db.events.create_index("date")
    await db.events.create_index("table_id")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.invites.create_index("code", unique=True)
    await db.contacts.create_index("owner_id")
    await db.referrals.create_index("inviter_id")
    await db.push_subscriptions.create_index("user_id")
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.call_logs.create_index([("participants", 1), ("started_at", -1)])
    await db.call_logs.create_index("call_id", unique=True)
    # Iteration 18 — table seats: one seat per (table, seat_index); a user holds at most one seat per table
    await db.table_seats.create_index([("table_id", 1), ("seat_index", 1)], unique=True)
    await db.table_seats.create_index([("table_id", 1), ("user_id", 1)], unique=True)
    # Seed the initial administrator only when a deployment provides a password.
    # Existing passwords are never overwritten during application startup.
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if ADMIN_PASSWORD and not existing:
        admin = {
            "id": new_id(),
            "email": ADMIN_EMAIL,
            "name": "Admin",
            "initials": "AD",
            "color": "#AF52DE",
            "status": "online",
            "role": "admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "onboarded": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin)
        logger.info("Admin user seeded.")
    elif not ADMIN_PASSWORD:
        logger.info("ADMIN_PASSWORD is not set; automatic admin seeding is disabled.")
    # Storage
    init_storage()
    # Start event reminder background task
    app.state.reminder_task = asyncio.create_task(_event_reminder_loop())


async def _event_reminder_loop():
    """Background task: check every 10 minutes for events starting within 1 hour, send SMS reminders."""
    while True:
        try:
            await asyncio.sleep(600)  # 10 minutes
            await _send_event_reminders()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Event reminder loop error: {e}")


async def _send_event_reminders():
    """Find events starting within 45-75 minutes and SMS offline members with auto_sms."""
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        return
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    # Get all events for today
    events = await db.events.find({"date": today, "deleted_at": {"$exists": False}}, {"_id": 0}).to_list(500)
    for ev in events:
        try:
            event_time = datetime.fromisoformat(f"{ev['date']}T{ev.get('time', '12:00')}:00+00:00")
        except Exception:
            continue
        delta = (event_time - now).total_seconds()
        # Between 45 and 75 minutes from now (so we catch it in one 10-min window)
        if 2700 <= delta <= 4500:
            # Check if we already sent a reminder for this event
            reminder_key = f"reminder_{ev['id']}_{today}"
            existing_reminder = await db.notifications.find_one({"id": reminder_key})
            if existing_reminder:
                continue
            # Mark as reminded
            await db.notifications.insert_one({"id": reminder_key, "type": "reminder_sent", "created_at": now_iso()})

            table_id = ev.get("table_id")
            if not table_id:
                continue
            table = await db.tables.find_one({"id": table_id}, {"_id": 0})
            table_name = table["name"] if table else "your table"
            members = await db.table_members.find({"table_id": table_id}, {"_id": 0}).to_list(500)
            time_str = ev.get("time", "12:00")
            for m in members:
                await send_auto_sms_if_offline(
                    m["user_id"],
                    f"Reminder: \"{ev['title']}\" at {table_name} starts at {time_str}. Don't miss it!"
                )
            logger.info(f"Event reminder sent for '{ev['title']}' at {table_name}")


@app.on_event("shutdown")
async def shutdown():
    task = getattr(app.state, "reminder_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    sqlite_client.close()


# ---------- Auth endpoints ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = {
        "id": new_id(),
        "email": email,
        "name": payload.name.strip(),
        "initials": initials_of(payload.name),
        "color": "#007AFF",
        "status": "online",
        "role": "member",
        "password_hash": hash_password(payload.password),
        "onboarded": False,
        "created_at": now_iso(),
    }
    try:
        await db.users.insert_one(user)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email already registered") from None
    access = create_access_token(user["id"], user["email"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": user_public(user), "access_token": access, "token_type": "bearer", "expires_in": 86400}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], user["email"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": user_public(user), "access_token": access, "token_type": "bearer", "expires_in": 86400}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user_public(user)}


# ---------- User endpoints ----------
@api.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user_public(user)


@api.put("/me")
async def update_me(payload: UserUpdateIn, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    # Handle avatar_url explicitly - allow setting to None to clear avatar
    raw_data = payload.model_dump(exclude_unset=True)
    if "avatar_url" in raw_data and raw_data["avatar_url"] is None:
        updates["avatar_url"] = None
    if "name" in updates:
        updates["initials"] = initials_of(updates["name"])
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    refreshed = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    pub = user_public(refreshed)
    # Broadcast presence/profile change to contacts
    await ws_manager.broadcast_to_contacts(user["id"], {"type": "user_updated", "user": pub})
    return pub


@api.get("/members")
async def list_members(user: dict = Depends(get_current_user)):
    # Directory visibility is limited to users who share a table.
    my_tables = await db.table_members.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    table_ids = [m["table_id"] for m in my_tables]
    members = []
    seen = {user["id"]}
    if table_ids:
        cursor = db.table_members.find({"table_id": {"$in": table_ids}}, {"_id": 0})
        member_user_ids = set()
        async for m in cursor:
            if m["user_id"] not in seen:
                seen.add(m["user_id"])
                member_user_ids.add(m["user_id"])
        if member_user_ids:
            batch = await db.users.find({"id": {"$in": list(member_user_ids)}}, {"_id": 0}).to_list(500)
            members.extend(user_public(u) for u in batch)
    return members


# ---------- Table endpoints ----------
@api.get("/tables")
async def list_tables(user: dict = Depends(get_current_user)):
    memberships = await db.table_members.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    table_ids = [m["table_id"] for m in memberships]
    out = []
    for tid in table_ids:
        t = await db.tables.find_one({"id": tid}, {"_id": 0})
        if not t:
            continue
        # member count + active members
        ms = await db.table_members.find({"table_id": tid}, {"_id": 0}).to_list(500)
        user_ids = [m["user_id"] for m in ms]
        users = []
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0}):
            users.append(user_public(u))
        t["members"] = users
        t["member_count"] = len(users)
        t["active_count"] = sum(1 for u in users if u.get("status") == "online")
        out.append(t)
    return out


@api.get("/tables/{table_id}")
async def get_table(table_id: str, user: dict = Depends(get_current_user)):
    await ensure_table_member(table_id, user["id"])
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Table not found")
    ms = await db.table_members.find({"table_id": table_id}, {"_id": 0}).to_list(500)
    user_ids = [m["user_id"] for m in ms]
    users = []
    async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0}):
        users.append(user_public(u))
    items = await db.shared_items.find({"table_id": table_id, "deleted_at": {"$exists": False}}, {"_id": 0}).sort("created_at", -1).to_list(200)
    events = await db.events.find({"table_id": table_id, "deleted_at": {"$exists": False}}, {"_id": 0}).sort("date", 1).to_list(200)
    seats = await db.table_seats.find({"table_id": table_id}, {"_id": 0}).to_list(50)
    t["members"] = users
    t["member_count"] = len(users)
    t["active_count"] = sum(1 for u in users if u.get("status") == "online")
    t["items"] = items
    t["events"] = events
    t["seats"] = seats
    pending_invites = await db.invites.find({
        "table_id": table_id,
        "recipient_email": {"$exists": True, "$ne": None},
        "accepted_at": {"$exists": False},
        "deleted_at": {"$exists": False},
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    t["pending_invites"] = [{
        "id": invite["id"],
        "name": invite.get("recipient_name") or invite["recipient_email"].split("@")[0],
        "email": invite["recipient_email"],
        "initials": initials_of(invite.get("recipient_name") or invite["recipient_email"].split("@")[0]),
        "status": "invited",
    } for invite in pending_invites]
    # Iteration 18 — default scene for legacy tables created before this iteration
    if not t.get("scene"):
        t["scene"] = dict(DEFAULT_SCENE)
    return t


@api.post("/tables")
async def create_table(payload: TableIn, user: dict = Depends(get_current_user)):
    tid = new_id()
    # Iteration 18 — apply default scene if none provided
    scene = payload.scene.model_dump() if payload.scene else dict(DEFAULT_SCENE)
    t = {
        "id": tid,
        "name": payload.name.strip(),
        "color": payload.color,
        "active": bool(payload.active),
        "purpose": payload.purpose or "other",
        "scene": scene,
        "created_by": user["id"],
        "created_at": now_iso(),
        "last_activity": now_iso(),
    }
    await db.tables.insert_one(t)
    await db.table_members.insert_one({
        "table_id": tid, "user_id": user["id"], "role": "owner", "joined_at": now_iso()
    })
    # Purpose-based starter template (non-blocking, best-effort)
    try:
        await _seed_template(tid, t["purpose"], user["id"], t["color"])  # noqa: F821 — defined below at module level
    except Exception as _tmpl_err:
        logger.warning(f"template seed failed: {_tmpl_err}")
    t.pop("_id", None)
    t["members"] = [user_public(user)]
    t["member_count"] = 1
    t["active_count"] = 1 if user.get("status") == "online" else 0
    # Reload items/events to include seeded content
    t["items"] = await db.shared_items.find({"table_id": tid}, {"_id": 0}).sort("created_at", -1).to_list(50)
    t["events"] = await db.events.find({"table_id": tid}, {"_id": 0}).sort("date", 1).to_list(50)
    t["seats"] = []  # Iteration 18 — no claims yet on creation
    return t


@api.put("/tables/{table_id}")
async def update_table(table_id: str, payload: TableUpdateIn, user: dict = Depends(get_current_user)):
    membership = await ensure_table_member(table_id, user["id"])
    if membership.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    raw = payload.model_dump(exclude_none=True)
    scene_changed = "scene" in raw

    # Iteration 18a — capture old table_id BEFORE the write so we can detect a shrink
    old_table_doc = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not old_table_doc:
        raise HTTPException(status_code=404, detail="Table not found")
    old_table_id = ((old_table_doc.get("scene") or DEFAULT_SCENE).get("table"))

    updates = dict(raw)
    if updates:
        updates["last_activity"] = now_iso()
        await db.tables.update_one({"id": table_id}, {"$set": updates})
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})

    seats_changed = False
    if scene_changed and t:
        new_table_id = (t.get("scene") or DEFAULT_SCENE).get("table")
        # Iteration 18a — only consider truncation when the table type actually changed.
        # Same-id swaps (e.g. mahogany→mahogany with new ambiance) don't touch seat geometry.
        if new_table_id != old_table_id:
            new_seat_count = SEAT_COUNTS.get(new_table_id, 8)
            res = await db.table_seats.delete_many({
                "table_id": table_id,
                "seat_index": {"$gte": new_seat_count},
            })
            if res.deleted_count > 0:
                seats_changed = True

        await ws_manager.broadcast_to_table(table_id, {
            "type": "table_scene_updated",
            "table_id": table_id,
            "scene": t.get("scene"),
        })

    if seats_changed:
        seats = await db.table_seats.find({"table_id": table_id}, {"_id": 0}).to_list(50)
        await ws_manager.broadcast_to_table(table_id, {
            "type": "table_seats_updated",
            "table_id": table_id,
            "seats": seats,
        })

    return t


@api.delete("/tables/{table_id}")
async def delete_table(table_id: str, user: dict = Depends(get_current_user)):
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Table not found")
    if t["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete")
    await db.tables.delete_one({"id": table_id})
    await db.table_members.delete_many({"table_id": table_id})
    await db.shared_items.delete_many({"table_id": table_id})
    await db.events.delete_many({"table_id": table_id})
    await db.messages.delete_many({"table_id": table_id})
    await db.table_seats.delete_many({"table_id": table_id})  # Iteration 18
    return {"ok": True}


# ---------- Iteration 18: Seat assignments ----------
@api.get("/tables/{table_id}/seats")
async def list_table_seats(table_id: str, user: dict = Depends(get_current_user)):
    """Return all seat claims for this table."""
    await ensure_table_member(table_id, user["id"])
    seats = await db.table_seats.find({"table_id": table_id}, {"_id": 0}).to_list(50)
    return seats


@api.post("/tables/{table_id}/seats/claim")
async def claim_seat(table_id: str, payload: SeatClaimIn, user: dict = Depends(get_current_user)):
    """Claim a seat at this table. If seat_index is omitted, auto-assign the first free seat.
    A user can hold at most one seat per table — re-claiming moves the user."""
    await ensure_table_member(table_id, user["id"])
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    scene = table.get("scene") or DEFAULT_SCENE
    seat_count = SEAT_COUNTS.get(scene.get("table"), 8)

    # Existing seats for this table
    existing = await db.table_seats.find({"table_id": table_id}, {"_id": 0}).to_list(50)
    taken = {s["seat_index"]: s for s in existing if s["user_id"] != user["id"]}

    if payload.seat_index is None:
        # Auto-assign first free seat
        target = next((i for i in range(seat_count) if i not in taken), None)
        if target is None:
            raise HTTPException(status_code=409, detail="All seats are taken at this table")
        seat_index = target
    else:
        seat_index = int(payload.seat_index)
        if seat_index < 0 or seat_index >= seat_count:
            raise HTTPException(status_code=400, detail=f"Seat index out of range (0..{seat_count - 1})")
        if seat_index in taken:
            raise HTTPException(status_code=409, detail="Seat already taken")

    # Atomically move the user's seat; a collision leaves the old seat intact.
    seat_doc = {
        "id": new_id(),
        "table_id": table_id,
        "seat_index": seat_index,
        "user_id": user["id"],
        "claimed_at": now_iso(),
    }
    try:
        await db.table_seats.update_one(
            {"table_id": table_id, "user_id": user["id"]},
            {"$set": seat_doc}, upsert=True,
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Seat already taken") from None
    seat_doc.pop("_id", None)

    seats = await db.table_seats.find({"table_id": table_id}, {"_id": 0}).to_list(50)
    await ws_manager.broadcast_to_table(table_id, {
        "type": "table_seats_updated",
        "table_id": table_id,
        "seats": seats,
    })
    return {"ok": True, "seat": seat_doc, "seats": seats}


@api.delete("/tables/{table_id}/seats/mine")
async def leave_seat(table_id: str, user: dict = Depends(get_current_user)):
    """Release the current user's seat at this table."""
    await ensure_table_member(table_id, user["id"])
    res = await db.table_seats.delete_many({"table_id": table_id, "user_id": user["id"]})
    seats = await db.table_seats.find({"table_id": table_id}, {"_id": 0}).to_list(50)
    await ws_manager.broadcast_to_table(table_id, {
        "type": "table_seats_updated",
        "table_id": table_id,
        "seats": seats,
    })
    return {"ok": True, "released": res.deleted_count, "seats": seats}


@api.post("/tables/{table_id}/gesture")
async def table_gesture(table_id: str, payload: TableGestureIn, user: dict = Depends(get_current_user)):
    """Broadcast a short-lived, in-room avatar gesture to every table member."""
    await ensure_table_member(table_id, user["id"])
    event = {
        "type": "table_gesture",
        "table_id": table_id,
        "user_id": user["id"],
        "gesture": payload.gesture,
        "created_at": now_iso(),
    }
    await ws_manager.broadcast_to_table(table_id, event)
    return {"ok": True, **event}


# ---------- Shared items ----------
@api.get("/tables/{table_id}/items")
async def list_items(table_id: str, user: dict = Depends(get_current_user)):
    await ensure_table_member(table_id, user["id"])
    items = await db.shared_items.find({"table_id": table_id, "deleted_at": {"$exists": False}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/tables/{table_id}/items")
async def add_item(table_id: str, payload: SharedItemIn, user: dict = Depends(get_current_user)):
    await ensure_table_member(table_id, user["id"])
    if payload.url:
        storage_path = payload.url.rsplit("/files/", 1)[-1]
        record = await db.files.find_one({"storage_path": storage_path, "is_deleted": False})
        if record:
            await ensure_file_access(record, user["id"])
    item = {
        "id": new_id(),
        "table_id": table_id,
        "shared_by": user["id"],
        "shared_by_name": user["name"],
        "created_at": now_iso(),
        "reactions": {"praying": [], "amen": [], "heart": [], "thanks": []},
        **payload.model_dump(),
    }
    await db.shared_items.insert_one(item)
    await db.tables.update_one({"id": table_id}, {"$set": {"last_activity": now_iso()}})
    item.pop("_id", None)
    await ws_manager.broadcast_to_table(table_id, {"type": "item_added", "table_id": table_id, "item": item})
    # Auto-SMS offline table members for prayer/intention items
    if payload.type in ("prayer", "intention"):
        t = await db.tables.find_one({"id": table_id}, {"_id": 0})
        table_name = t["name"] if t else "a table"
        members = await db.table_members.find({"table_id": table_id}, {"_id": 0}).to_list(500)
        for m in members:
            if m["user_id"] != user["id"]:
                await send_auto_sms_if_offline(m["user_id"], f"{user['name']} shared a {payload.type} at {table_name}: \"{payload.name[:80]}\"")
    return item


@api.delete("/tables/{table_id}/items/{item_id}")
async def delete_item(table_id: str, item_id: str, user: dict = Depends(get_current_user)):
    await ensure_table_member(table_id, user["id"])
    item = await db.shared_items.find_one({"id": item_id, "table_id": table_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await soft_delete("shared_items", item_id, user["id"])
    return {"ok": True}


@api.post("/tables/{table_id}/items/{item_id}/react")
async def react_to_item(table_id: str, item_id: str, payload: ReactionIn, user: dict = Depends(get_current_user)):
    await ensure_table_member(table_id, user["id"])
    item = await db.shared_items.find_one({"id": item_id, "table_id": table_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    reactions = item.get("reactions") or {"praying": [], "amen": [], "heart": [], "thanks": []}
    current = list(reactions.get(payload.type, []))
    if user["id"] in current:
        current.remove(user["id"])
        action = "removed"
    else:
        current.append(user["id"])
        action = "added"
    reactions[payload.type] = current
    await db.shared_items.update_one({"id": item_id}, {"$set": {"reactions": reactions}})
    # Live broadcast so everyone's view updates
    await ws_manager.broadcast_to_table(table_id, {
        "type": "item_reaction", "table_id": table_id, "item_id": item_id,
        "reactions": reactions, "reactor_id": user["id"],
    })
    return {"ok": True, "action": action, "reactions": reactions}


@api.get("/tables/{table_id}/prayers")
async def list_prayers(table_id: str, user: dict = Depends(get_current_user)):
    """Prayer Wall — returns prayer + intention items for the table, with reactions."""
    await ensure_table_member(table_id, user["id"])
    items = await db.shared_items.find(
        {"table_id": table_id, "type": {"$in": ["prayer", "intention"]}, "deleted_at": {"$exists": False}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    for it in items:
        if "reactions" not in it:
            it["reactions"] = {"praying": [], "amen": [], "heart": [], "thanks": []}
    return items


# ---------- File upload ----------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    raw_ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    ext = re.sub(r"[^a-z0-9]", "", raw_ext)[:16] or "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{new_id()}.{ext}"
    chunks = []
    total_size = 0
    while chunk := await file.read(1024 * 1024):
        total_size += len(chunk)
        if total_size > MAX_UPLOAD_BYTES:
            limit_label = (
                f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MiB"
                if MAX_UPLOAD_BYTES >= 1024 * 1024
                else f"{MAX_UPLOAD_BYTES} bytes"
            )
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds the {limit_label} upload limit",
            )
        chunks.append(chunk)
    data = b"".join(chunks)
    content_type = file.content_type or "application/octet-stream"
    result = put_object(path, data, content_type)
    record = {
        "id": new_id(),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(record)
    record.pop("_id", None)
    return record


async def ensure_file_access(record: dict, user_id: str):
    storage_path = record["storage_path"]
    if record.get("uploaded_by") != user_id:
        escaped_path = re.escape(storage_path)
        items = await db.shared_items.find(
            {
                "url": {"$regex": rf"(?:^|/files/){escaped_path}$"},
                "deleted_at": {"$exists": False},
            },
            {"_id": 0},
        ).to_list(500)
        has_access = False
        for item in items:
            membership = await db.table_members.find_one(
                {"table_id": item["table_id"], "user_id": user_id},
                {"_id": 0},
            )
            if membership:
                has_access = True
                break
        if not has_access:
            raise HTTPException(status_code=403, detail="You do not have access to this file")



@api.get("/files/{storage_path:path}")
async def download_file(
    storage_path: str,
    download: bool = False,
    user: dict = Depends(get_current_user),
):
    record = await db.files.find_one({"storage_path": storage_path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    await ensure_file_access(record, user["id"])

    data, content_type = get_object(storage_path)
    disposition = "attachment" if download else "inline"
    filename = quote(record.get("original_filename") or "download")
    return FastResponse(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{filename}"},
    )


# ---------- Messages ----------
@api.get("/messages")
async def list_messages(
    with_user: Optional[str] = Query(None, alias="with"),
    table_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if table_id:
        await ensure_table_member(table_id, user["id"])
        q["table_id"] = table_id
    elif with_user:
        q = {
            "$or": [
                {"from_user": user["id"], "to_user": with_user},
                {"from_user": with_user, "to_user": user["id"]},
            ]
        }
    else:
        q = {"$or": [{"from_user": user["id"]}, {"to_user": user["id"]}]}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs


@api.post("/messages")
async def send_message(payload: MessageIn, user: dict = Depends(get_current_user)):
    if payload.table_id:
        await ensure_table_member(payload.table_id, user["id"])
    m = {
        "id": new_id(),
        "from_user": user["id"],
        "from_name": user["name"],
        "to_user": payload.to_user,
        "text": payload.text.strip(),
        "table_id": payload.table_id,
        "read": False,
        "type": "text",
        "created_at": now_iso(),
    }
    await db.messages.insert_one(m)
    if payload.to_user and payload.to_user != user["id"]:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": payload.to_user, "type": "message",
            "from_user": user["id"], "message": f"{user['name']}: {payload.text[:60]}",
            "read": False, "created_at": now_iso(),
        })
    m.pop("_id", None)
    # Live push
    if payload.table_id:
        await ws_manager.broadcast_to_table(payload.table_id, {"type": "message", "message": m})
    else:
        await ws_manager.send_to_users([payload.to_user, user["id"]], {"type": "message", "message": m})
    # Push notification if recipient is offline
    if payload.to_user and payload.to_user != user["id"] and not ws_manager.is_online(payload.to_user):
        await send_push_to_user(payload.to_user, f"Message from {user['name']}", payload.text[:120], {"type": "message"})
        await send_auto_sms_if_offline(payload.to_user, f"{user['name']}: {payload.text[:120]}")
    return m


# ---------- Emails ----------
@api.get("/emails")
async def list_emails(
    folder: str = "inbox",
    user: dict = Depends(get_current_user),
):
    if folder not in ("inbox", "sent", "starred", "trash"):
        raise HTTPException(status_code=400, detail="Invalid folder")
    if folder == "inbox":
        q = {"to_user": user["id"], "folder": {"$ne": "trash"}, "deleted_at": {"$exists": False}}
    elif folder == "sent":
        q = {"from_user": user["id"], "folder": {"$ne": "trash"}, "deleted_at": {"$exists": False}}
    elif folder == "starred":
        q = {"$or": [{"to_user": user["id"]}, {"from_user": user["id"]}], "starred": True, "deleted_at": {"$exists": False}}
    else:
        q = {"$or": [{"to_user": user["id"]}, {"from_user": user["id"]}], "folder": "trash", "deleted_at": {"$exists": False}}
    emails = await db.emails.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Batch hydrate user names
    all_uids = set()
    for e in emails:
        all_uids.add(e["from_user"])
        all_uids.add(e["to_user"])
    users_batch = await db.users.find({"id": {"$in": list(all_uids)}}, {"_id": 0}).to_list(500)
    users_map = {u["id"]: u for u in users_batch}
    for e in emails:
        fu = users_map.get(e["from_user"])
        tu = users_map.get(e["to_user"])
        e["from_name"] = fu["name"] if fu else "Unknown"
        e["to_name"] = tu["name"] if tu else "Unknown"
        e["from_initials"] = fu.get("initials") if fu else "?"
    return emails


@api.post("/emails")
async def send_email(payload: EmailIn, user: dict = Depends(get_current_user)):
    e = {
        "id": new_id(),
        "from_user": user["id"],
        "to_user": payload.to_user,
        "subject": payload.subject.strip(),
        "body": payload.body,
        "read": False,
        "starred": False,
        "folder": "inbox",
        "created_at": now_iso(),
    }
    await db.emails.insert_one(e)
    if payload.to_user != user["id"]:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": payload.to_user, "type": "message",
            "from_user": user["id"], "message": f"Email: {payload.subject[:60]}",
            "read": False, "created_at": now_iso(),
        })
    e.pop("_id", None)
    return e


@api.post("/emails/{email_id}/read")
async def mark_email_read(email_id: str, user: dict = Depends(get_current_user)):
    await db.emails.update_one({"id": email_id, "to_user": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/emails/{email_id}/star")
async def toggle_star(email_id: str, user: dict = Depends(get_current_user)):
    e = await db.emails.find_one({"id": email_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Email not found")
    if e["to_user"] != user["id"] and e["from_user"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    new_val = not bool(e.get("starred"))
    await db.emails.update_one({"id": email_id}, {"$set": {"starred": new_val}})
    return {"starred": new_val}


# ---------- Texts (SMS) ----------
@api.get("/texts")
async def list_texts(with_user: Optional[str] = Query(None, alias="with"), user: dict = Depends(get_current_user)):
    if with_user:
        q = {
            "$or": [
                {"from_user": user["id"], "to_user": with_user},
                {"from_user": with_user, "to_user": user["id"]},
            ]
        }
    else:
        q = {"$or": [{"from_user": user["id"]}, {"to_user": user["id"]}]}
    texts = await db.texts.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    return texts


@api.post("/texts")
async def send_text(payload: TextIn, user: dict = Depends(get_current_user)):
    t = {
        "id": new_id(),
        "from_user": user["id"],
        "to_user": payload.to_user,
        "text": payload.text.strip(),
        "read": False,
        "created_at": now_iso(),
    }
    await db.texts.insert_one(t)
    t.pop("_id", None)
    await ws_manager.send_to_users([payload.to_user, user["id"]], {"type": "text", "text": t})
    return t


# ---------- Events ----------
@api.get("/events")
async def list_events(user: dict = Depends(get_current_user)):
    memberships = await db.table_members.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    table_ids = [m["table_id"] for m in memberships]
    q = {"$or": [{"created_by": user["id"]}, {"table_id": {"$in": table_ids}}], "deleted_at": {"$exists": False}}
    events = await db.events.find(q, {"_id": 0}).sort("date", 1).to_list(500)
    # Expand recurring events into virtual forward instances
    expanded = _expand_recurring(events, days_forward=90)
    expanded.sort(key=lambda e: e.get("date", ""))
    return expanded


@api.post("/events")
async def create_event(payload: EventIn, user: dict = Depends(get_current_user)):
    if payload.table_id:
        await ensure_table_member(payload.table_id, user["id"])
    color = payload.color
    if payload.table_id and not color:
        t = await db.tables.find_one({"id": payload.table_id}, {"_id": 0})
        color = t["color"] if t else "#007AFF"
    ev = {
        "id": new_id(),
        "title": payload.title.strip(),
        "date": payload.date,
        "time": payload.time,
        "table_id": payload.table_id,
        "color": color or "#007AFF",
        "description": payload.description or "",
        "location": payload.location or "",
        "recurring": payload.recurring or "none",
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.events.insert_one(ev)
    ev.pop("_id", None)
    return ev


@api.put("/events/{event_id}")
async def update_event(event_id: str, payload: EventIn, user: dict = Depends(get_current_user)):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if payload.table_id:
        await ensure_table_member(payload.table_id, user["id"])
    await db.events.update_one({"id": event_id}, {"$set": payload.model_dump()})
    new_ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    return new_ev


@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await soft_delete("events", event_id, user["id"])
    return {"ok": True}


# ---------- Notifications ----------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    notes = await db.notifications.find({"user_id": user["id"], "deleted_at": {"$exists": False}}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Batch hydrate from_user names
    from_uids = list({n["from_user"] for n in notes if n.get("from_user")})
    if from_uids:
        from_batch = await db.users.find({"id": {"$in": from_uids}}, {"_id": 0}).to_list(200)
        from_map = {u["id"]: u for u in from_batch}
    else:
        from_map = {}
    for n in notes:
        if n.get("from_user"):
            fu = from_map.get(n["from_user"])
            n["from_name"] = fu["name"] if fu else "Unknown"
            n["from_initials"] = fu.get("initials") if fu else "?"
            n["from_color"] = fu.get("color") if fu else "#8E8E93"
    return notes


@api.post("/notifications/{note_id}/read")
async def mark_notification_read(note_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": note_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read_all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Walkie ----------
@api.post("/walkie/ping")
async def walkie_ping(payload: WalkiePingIn, user: dict = Depends(get_current_user)):
    note = {
        "id": new_id(),
        "user_id": payload.to_user,
        "type": "walkie",
        "from_user": user["id"],
        "from_name": user["name"],
        "from_initials": user.get("initials"),
        "from_color": user.get("color"),
        "message": f"{user['name']} is pinging you on the walkie",
        "read": False,
        "table_id": payload.table_id,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(dict(note))
    note.pop("_id", None)
    await ws_manager.send_to_user(payload.to_user, {"type": "walkie_ping", "notification": note})
    # Push notification if user is offline
    if not ws_manager.is_online(payload.to_user):
        await send_push_to_user(payload.to_user, "Walkie Ping", f"{user['name']} is pinging you!", {"type": "walkie", "from_user": user["id"]})
        await send_auto_sms_if_offline(payload.to_user, f"{user['name']} is pinging you on the walkie!")
    return {"ok": True}


# ---------- Invites ----------
@api.get("/invites/preview/{code}")
async def preview_invite(code: str):
    """Public endpoint - lets anyone view a table preview via invite code."""
    inv = await db.invites.find_one({"code": code.upper().strip(), "deleted_at": {"$exists": False}}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    if inv.get("expires_at") and inv["expires_at"] < now_iso():
        raise HTTPException(status_code=410, detail="Invite expired")
    if inv["uses"] >= inv["max_uses"]:
        raise HTTPException(status_code=410, detail="Invite is used up")
    t = await db.tables.find_one({"id": inv["table_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Table not found")
    inviter = await db.users.find_one({"id": inv["created_by"]}, {"_id": 0})
    member_count = await db.table_members.count_documents({"table_id": inv["table_id"]})
    return {
        "table": {
            "id": t["id"],
            "name": t["name"],
            "color": t["color"],
            "active": bool(t.get("active")),
            "purpose": t.get("purpose", "other"),
            "member_count": member_count,
        },
        "inviter": {
            "name": inviter["name"] if inviter else "Someone",
            "initials": inviter.get("initials") if inviter else "?",
            "color": inviter.get("color") if inviter else "#8E8E93",
        },
        "uses": inv["uses"],
        "max_uses": inv["max_uses"],
    }


@api.get("/invites")
async def list_invites(table_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: dict = {"created_by": user["id"], "deleted_at": {"$exists": False}}
    if table_id:
        q["table_id"] = table_id
    invites = await db.invites.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    return invites


@api.post("/invites")
async def create_invite(payload: InviteIn, user: dict = Depends(get_current_user)):
    await ensure_table_member(payload.table_id, user["id"])
    # Unique code
    code = generate_invite_code()
    while await db.invites.find_one({"code": code}):
        code = generate_invite_code()
    inv = {
        "id": new_id(),
        "table_id": payload.table_id,
        "code": code,
        "created_by": user["id"],
        "uses": 0,
        "max_uses": payload.max_uses,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)).isoformat(),
        "created_at": now_iso(),
    }
    if payload.recipient_email:
        inv["recipient_email"] = str(payload.recipient_email).lower()
        inv["recipient_name"] = (payload.recipient_name or "").strip() or None
    await db.invites.insert_one(inv)
    inv.pop("_id", None)

    # Send transactional invite email if recipient_email provided and Resend configured
    if payload.recipient_email and RESEND_API_KEY:
        t = await db.tables.find_one({"id": payload.table_id}, {"_id": 0})
        table_name = t["name"] if t else "a Roundtable_VO table"
        try:
            import httpx
            join_url = f"{CORS_ORIGINS[0] if CORS_ORIGINS else 'https://roundtable-vo.app'}/join/{code}"
            async with httpx.AsyncClient() as client:
                email_response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "from": f"Roundtable_VO <{RESEND_FROM_EMAIL}>",
                        "to": [payload.recipient_email],
                        "subject": f"{user['name']} invited you to {table_name} on Roundtable_VO",
                        "html": (
                            f"<div style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:32px;'>"
                            f"<h2 style='margin:0 0 12px;'>You're invited!</h2>"
                            f"<p style='color:#555;line-height:1.6;'>{escape(user['name'])} wants you to join <strong>{escape(table_name)}</strong> on Roundtable_VO — where your people gather.</p>"
                            f"<a href='{join_url}' style='display:inline-block;padding:14px 28px;background:#007AFF;color:white;text-decoration:none;border-radius:10px;font-weight:600;margin:20px 0;'>Join the Table</a>"
                            f"<p style='color:#999;font-size:13px;'>Or use invite code: <strong>{code}</strong></p>"
                            f"</div>"
                        ),
                    },
                )
                email_response.raise_for_status()
            inv["email_sent_to"] = payload.recipient_email
            logger.info(f"Invite email sent to {payload.recipient_email} for table {table_name}")
        except Exception as e:
            logger.warning(f"Invite email failed: {e}")
            inv["email_sent_to"] = None

    return inv


@api.post("/invites/join")
async def join_invite(payload: InviteJoinIn, user: dict = Depends(get_current_user)):
    inv = await db.invites.find_one({"code": payload.code.upper().strip(), "deleted_at": {"$exists": False}}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    if inv["uses"] >= inv["max_uses"]:
        raise HTTPException(status_code=410, detail="Invite is used up")
    if inv.get("expires_at") and inv["expires_at"] < now_iso():
        raise HTTPException(status_code=410, detail="Invite expired")
    existing = await db.table_members.find_one({"table_id": inv["table_id"], "user_id": user["id"]})
    if existing:
        return {"ok": True, "table_id": inv["table_id"], "already_member": True}
    if not await db.tables.find_one({"id": inv["table_id"]}):
        raise HTTPException(status_code=404, detail="Table not found")
    reserved = await db.invites.update_one(
        {"id": inv["id"], "uses": {"$lt": inv["max_uses"]}, "deleted_at": {"$exists": False}},
        {"$inc": {"uses": 1}},
    )
    if not reserved.modified_count:
        raise HTTPException(status_code=410, detail="Invite is no longer available")
    try:
        await db.table_members.insert_one({
            "table_id": inv["table_id"], "user_id": user["id"], "role": "member", "joined_at": now_iso()
        })
    except sqlite3.IntegrityError:
        await db.invites.update_one({"id": inv["id"]}, {"$inc": {"uses": -1}})
        return {"ok": True, "table_id": inv["table_id"], "already_member": True}
    await db.invites.update_one({"id": inv["id"]}, {"$set": {"accepted_at": now_iso(), "accepted_by": user["id"]}})
    # Referral tracking
    await db.referrals.insert_one({
        "id": new_id(),
        "inviter_id": inv["created_by"],
        "invitee_id": user["id"],
        "invite_id": inv["id"],
        "status": "joined",
        "created_at": now_iso(),
    })
    # Notify inviter
    await db.notifications.insert_one({
        "id": new_id(),
        "user_id": inv["created_by"],
        "type": "invite",
        "from_user": user["id"],
        "message": f"{user['name']} joined using your invite",
        "read": False,
        "created_at": now_iso(),
    })
    # Live notify the inviter so they can see the badge celebration if applicable
    joined_count = await db.referrals.count_documents({"inviter_id": inv["created_by"], "status": "joined"})
    await ws_manager.send_to_user(inv["created_by"], {
        "type": "referral_joined",
        "invitee_name": user["name"],
        "joined_total": joined_count,
    })
    return {"ok": True, "table_id": inv["table_id"]}


# ---------- Contacts ----------
@api.get("/contacts")
async def list_contacts(user: dict = Depends(get_current_user)):
    contacts = await db.contacts.find({"owner_id": user["id"], "deleted_at": {"$exists": False}}, {"_id": 0}).sort("name", 1).to_list(500)
    # Mark whether each contact's email exists as a member
    for c in contacts:
        if c.get("email"):
            match = await db.users.find_one({"email": c["email"].lower()}, {"_id": 0})
            c["is_member"] = bool(match)
            c["member_id"] = match["id"] if match else None
            if match:
                c["member_initials"] = match.get("initials")
                c["member_color"] = match.get("color")
    return contacts


@api.post("/contacts")
async def add_contact(payload: ContactIn, user: dict = Depends(get_current_user)):
    c = {
        "id": new_id(),
        "owner_id": user["id"],
        "name": payload.name.strip(),
        "phone": payload.phone,
        "email": (payload.email or "").lower() or None,
        "created_at": now_iso(),
    }
    await db.contacts.insert_one(c)
    c.pop("_id", None)
    if c.get("email"):
        match = await db.users.find_one({"email": c["email"]}, {"_id": 0})
        c["is_member"] = bool(match)
        c["member_id"] = match["id"] if match else None
    return c


# ---------- Referrals ----------
@api.get("/referrals")
async def my_referrals(user: dict = Depends(get_current_user)):
    joined = await db.referrals.count_documents({"inviter_id": user["id"], "status": "joined"})
    invites_sent = await db.invites.count_documents({"created_by": user["id"]})
    total_uses = 0
    async for inv in db.invites.find({"created_by": user["id"]}, {"uses": 1, "_id": 0}):
        total_uses += inv.get("uses", 0)
    # Badge
    if joined >= 25:
        badge = "Community Builder"
    elif joined >= 10:
        badge = "Connector"
    elif joined >= 3:
        badge = "Host"
    elif joined >= 1:
        badge = "Newcomer"
    else:
        badge = "No badge yet"
    return {"invited": invites_sent, "joined": joined, "uses": total_uses, "badge": badge}


@api.get("/referrals/leaderboard")
async def referral_leaderboard(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"status": "joined"}},
        {"$group": {"_id": "$inviter_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    out = []
    async for row in db.referrals.aggregate(pipeline):
        u = await db.users.find_one({"id": row["_id"]}, {"_id": 0})
        if u:
            out.append({"user": user_public(u), "count": row["count"]})
    return out


# ---------- Templates + Recurring helpers (defined early for use in create_table) ----------
PURPOSE_TEMPLATES = {
    "family": {
        "events": [{"title": "Family Dinner", "recurring": "weekly", "dow": 6, "time": "18:00", "description": "Weekly family meal together."}],
        "items": [{"type": "intention", "name": "What we're grateful for this week", "note": "Drop a line about something good that happened."}],
    },
    "bible_study": {
        "events": [{"title": "Weekly Bible Study", "recurring": "weekly", "dow": 2, "time": "19:00", "description": "Open your Bibles and your hearts."}],
        "items": [
            {"type": "prayer", "name": "Our prayer list", "note": "Share who we're lifting up in prayer this week."},
            {"type": "intention", "name": "This week's focus verse", "note": "The verse we're studying or memorizing together."},
        ],
    },
    "community": {
        "events": [{"title": "Monthly Potluck", "recurring": "monthly", "dow": 6, "time": "17:00", "description": "Bring a dish, meet a neighbor."}],
        "items": [{"type": "note", "name": "Community announcements", "note": "Share news and updates with the group."}],
    },
    "friends": {
        "events": [{"title": "Saturday Hangout", "recurring": "weekly", "dow": 6, "time": "19:00", "description": "Whatever, whenever — we figure it out together."}],
        "items": [],
    },
    "work": {
        "events": [{"title": "Weekly Sync", "recurring": "weekly", "dow": 1, "time": "10:00", "description": "Quick check-in. Blockers? Wins? Next steps?"}],
        "items": [],
    },
    "other": {"events": [], "items": []},
}


def _next_dow(target_dow: int) -> str:
    """Returns YYYY-MM-DD of the next occurrence of target_dow (Mon=0..Sun=6), >= today."""
    today = datetime.now(timezone.utc).date()
    delta = (target_dow - today.weekday()) % 7
    return (today + timedelta(days=delta)).isoformat()


async def _seed_template(table_id: str, purpose: str, user_id: str, color: str):
    tpl = PURPOSE_TEMPLATES.get(purpose) or PURPOSE_TEMPLATES["other"]
    for ev in tpl.get("events", []):
        date = _next_dow(ev.get("dow", 0))
        await db.events.insert_one({
            "id": new_id(),
            "title": ev["title"],
            "date": date,
            "time": ev.get("time", "12:00"),
            "table_id": table_id,
            "color": color,
            "description": ev.get("description", ""),
            "location": "",
            "recurring": ev.get("recurring", "none"),
            "created_by": user_id,
            "created_at": now_iso(),
        })
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    user_name = user_doc.get("name") if user_doc else "Host"
    for it in tpl.get("items", []):
        await db.shared_items.insert_one({
            "id": new_id(),
            "table_id": table_id,
            "shared_by": user_id,
            "shared_by_name": user_name,
            "type": it["type"],
            "name": it["name"],
            "url": it.get("note"),
            "reactions": {"praying": [], "amen": [], "heart": [], "thanks": []},
            "created_at": now_iso(),
        })


def _expand_recurring(events: list, days_forward: int = 90) -> list:
    """Given a list of events, virtually expand recurring=weekly/monthly up to days_forward."""
    out = []
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days_forward)
    for e in events:
        out.append(e)
        rec = e.get("recurring") or "none"
        if rec not in ("weekly", "monthly"):
            continue
        try:
            base = datetime.fromisoformat(e["date"]).date()
        except Exception:
            continue
        if rec == "weekly":
            instance = max(1, (today - base).days // 7)
        else:
            instance = max(1, (today.year - base.year) * 12 + today.month - base.month)
        while True:
            if rec == "weekly":
                cur = base + timedelta(weeks=instance)
            else:
                month_index = base.year * 12 + base.month - 1 + instance
                year, month_zero = divmod(month_index, 12)
                month = month_zero + 1
                cur = base.replace(year=year, month=month, day=min(base.day, monthrange(year, month)[1]))
            if cur > end_date:
                break
            if cur < today:
                instance += 1
                continue
            clone = dict(e)
            clone["date"] = cur.isoformat()
            clone["id"] = f"{e['id']}::r{instance}"
            clone["_virtual"] = True
            clone["_parent_id"] = e["id"]
            out.append(clone)
            instance += 1
    return out


# ---------- Web Push Notifications ----------
class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}

    @field_validator("endpoint")
    @classmethod
    def trusted_push_endpoint(cls, value: str) -> str:
        parsed = urlparse(value)
        host = parsed.hostname or ""
        trusted = ("fcm.googleapis.com", "updates.push.services.mozilla.com", "push.apple.com", "notify.windows.com")
        if (
            parsed.scheme != "https" or parsed.username or parsed.password
            or parsed.port not in (None, 443) or parsed.fragment
            or not any(host == suffix or host.endswith("." + suffix) for suffix in trusted)
        ):
            raise ValueError("A supported browser push endpoint over HTTPS is required")
        return value


@api.get("/push/vapid-key")
async def get_vapid_key():
    """Public endpoint — returns the VAPID public key for subscription."""
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push not configured")
    return {"public_key": VAPID_PUBLIC_KEY}


@api.post("/push/subscribe")
async def push_subscribe(payload: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    """Register a push subscription for the current user."""
    sub_doc = {
        "user_id": user["id"],
        "endpoint": payload.endpoint,
        "keys": payload.keys,
        "created_at": now_iso(),
    }
    # Upsert by endpoint
    await db.push_subscriptions.update_one(
        {"endpoint": payload.endpoint},
        {"$set": sub_doc},
        upsert=True,
    )
    return {"ok": True}


@api.post("/push/unsubscribe")
async def push_unsubscribe(payload: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"endpoint": payload.endpoint, "user_id": user["id"]})
    return {"ok": True}


async def send_push_to_user(user_id: str, title: str, body: str, data: dict = None):
    """Best-effort push notification to all subscriptions for a user."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    if not subs:
        return
    import json as _push_json
    from pywebpush import webpush, WebPushException
    payload = _push_json.dumps({
        "title": title,
        "body": body,
        "data": data or {},
    })
    dead_endpoints = []
    for sub in subs:
        try:
            PushSubscriptionIn(endpoint=sub["endpoint"], keys=sub["keys"])
            await asyncio.to_thread(webpush,
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIMS_EMAIL, "aud": sub["endpoint"].split("/", 3)[0] + "//" + sub["endpoint"].split("/")[2]},
                timeout=10,
            )
        except WebPushException as e:
            if e.response is not None and e.response.status_code in (404, 410):
                dead_endpoints.append(sub["endpoint"])
            else:
                logger.warning(f"Push failed for {user_id}: {e}")
        except Exception as e:
            logger.warning(f"Push error: {e}")
    # Cleanup dead subscriptions
    if dead_endpoints:
        await db.push_subscriptions.delete_many({"endpoint": {"$in": dead_endpoints}})


async def send_auto_sms_if_offline(user_id: str, message: str):
    """Send an SMS to a user if they're offline, have auto_sms enabled, and have a phone number."""
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        return
    if ws_manager.is_online(user_id):
        return
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    if not user.get("auto_sms") or not user.get("phone"):
        return
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
                auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                data={
                    "From": TWILIO_FROM_NUMBER,
                    "To": user["phone"],
                    "Body": f"[Roundtable_VO] {message}",
                },
            )
            if resp.status_code < 300:
                logger.info(f"Auto-SMS sent to {user_id}")
            else:
                logger.warning(f"Auto-SMS failed for {user_id}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Auto-SMS error for {user_id}: {e}")


# ---------- External Bridges (SMS via Twilio, Email via Resend) ----------
class ExternalBridgeStatus(BaseModel):
    sms_configured: bool = False
    email_configured: bool = False


@api.get("/bridges/status")
async def bridge_status(user: dict = Depends(get_current_user)):
    """Check which external bridges are configured."""
    return ExternalBridgeStatus(
        sms_configured=bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER),
        email_configured=bool(RESEND_API_KEY),
    )


class SMSBridgeIn(BaseModel):
    phone: str
    message: str = Field(min_length=1, max_length=1600)


class EmailBridgeIn(BaseModel):
    to_email: str
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=50000)


@api.post("/bridges/sms")
async def send_sms_bridge(payload: SMSBridgeIn, user: dict = Depends(get_current_user)):
    """Send an SMS to an external number via Twilio."""
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        raise HTTPException(status_code=503, detail="SMS bridge not configured. Admin needs to add Twilio credentials.")
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
                auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                data={
                    "From": TWILIO_FROM_NUMBER,
                    "To": payload.phone,
                    "Body": f"[Roundtable_VO] {user['name']}: {payload.message}",
                },
            )
            if resp.status_code >= 400:
                err_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                err_code = err_data.get("code", 0)
                err_msg = err_data.get("message", resp.text[:200])
                # Twilio trial unverified number
                if err_code == 21608 or "unverified" in err_msg.lower():
                    raise HTTPException(status_code=400, detail={
                        "error": "trial_unverified",
                        "message": "This number hasn't been verified on your Twilio trial account. Verify it in the Twilio console, or upgrade to a paid account to send to any number.",
                        "verify_url": "https://console.twilio.com/us1/develop/phone-numbers/manage/verified",
                    })
                logger.warning(f"Twilio SMS error: {err_msg}")
                raise HTTPException(status_code=resp.status_code, detail=err_msg)
            return {"ok": True, "sid": resp.json().get("sid")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SMS bridge error: {e}")
        raise HTTPException(status_code=502, detail="Failed to send SMS")


@api.post("/bridges/email")
async def send_email_bridge(payload: EmailBridgeIn, user: dict = Depends(get_current_user)):
    """Send an email to an external address via Resend."""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="Email bridge not configured. Admin needs to add Resend API key.")
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json={
                    "from": f"Roundtable_VO <{RESEND_FROM_EMAIL}>",
                    "to": [payload.to_email],
                    "subject": payload.subject,
                    "html": f"<p>{payload.body}</p><hr><p><small>Sent via Roundtable_VO by {user['name']}</small></p>",
                },
            )
            resp.raise_for_status()
            return {"ok": True, "id": resp.json().get("id")}
    except Exception as e:
        logger.error(f"Email bridge error: {e}")
        raise HTTPException(status_code=502, detail="Failed to send email")


# ---------- Active Calls REST ----------
@api.get("/calls/active")
async def get_active_calls(table_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Get active calls, optionally filtered by table."""
    out = []
    for cid, call in active_calls.items():
        if table_id and call.get("table_id") != table_id:
            continue
        participants_info = []
        for pid in call["participants"]:
            p = await db.users.find_one({"id": pid}, {"_id": 0})
            if p:
                participants_info.append(user_public(p))
        out.append({
            "call_id": cid,
            "table_id": call.get("table_id"),
            "type": call["type"],
            "participants": participants_info,
            "created_by": call["created_by"],
            "created_at": call["created_at"],
        })
    return out


@api.get("/calls/history")
async def get_call_history(user: dict = Depends(get_current_user)):
    """Get call history for the current user (last 30 days, per-user)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    logs = await db.call_logs.find(
        {"participants": user["id"], "started_at": {"$gte": cutoff}, "deleted_at": {"$exists": False}},
        {"_id": 0},
    ).sort("started_at", -1).to_list(200)

    # Batch hydrate all user info
    all_uids = set()
    for log in logs:
        all_uids.update(log.get("participants", []))
        if log.get("created_by"):
            all_uids.add(log["created_by"])
        if log.get("target_user"):
            all_uids.add(log["target_user"])
    users_batch = await db.users.find({"id": {"$in": list(all_uids)}}, {"_id": 0}).to_list(500)
    users_map = {u["id"]: u for u in users_batch}

    for log in logs:
        log["participant_details"] = [user_public(users_map[pid]) for pid in log.get("participants", []) if pid in users_map]
        caller = users_map.get(log.get("created_by"))
        log["caller"] = user_public(caller) if caller else None
        target = users_map.get(log.get("target_user"))
        log["target"] = user_public(target) if target else None
    return logs


# ---------- Soft Delete / Trash System ----------
# Items moved to trash get deleted_at timestamp. Auto-purge after 30 days.
async def soft_delete(collection_name: str, item_id: str, user_id: str):
    """Move an item to trash by setting deleted_at. Returns True if found."""
    result = await db[collection_name].update_one(
        {"id": item_id},
        {"$set": {"deleted_at": now_iso(), "deleted_by": user_id}},
    )
    return result.modified_count > 0


async def restore_from_trash(collection_name: str, item_id: str):
    """Restore a trashed item by removing deleted_at."""
    result = await db[collection_name].update_one(
        {"id": item_id},
        {"$unset": {"deleted_at": "", "deleted_by": ""}},
    )
    return result.modified_count > 0


async def permanent_delete(collection_name: str, item_id: str):
    """Permanently remove an item."""
    result = await db[collection_name].delete_one({"id": item_id})
    return result.deleted_count > 0


async def clear_trash(collection_name: str, query: dict):
    """Permanently delete all trashed items matching query."""
    query["deleted_at"] = {"$exists": True}
    result = await db[collection_name].delete_many(query)
    return result.deleted_count


# ---------- Trash REST Endpoints ----------
@api.post("/trash/restore")
async def restore_item(collection: str = "", item_id: str = "", user: dict = Depends(get_current_user)):
    if not collection or not item_id:
        raise HTTPException(status_code=400, detail="collection and item_id required")
    allowed = ["invites", "emails", "messages", "call_logs", "shared_items", "events", "contacts", "notifications"]
    if collection not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid collection: {collection}")
    identity = "call_id" if collection == "call_logs" else "id"
    item = await db[collection].find_one({identity: item_id, "deleted_by": user["id"], "deleted_at": {"$exists": True}})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in your trash")
    if item.get("table_id"):
        await ensure_table_member(item["table_id"], user["id"])
    result = await db[collection].update_one(
        {identity: item_id, "deleted_by": user["id"]},
        {"$unset": {"deleted_at": "", "deleted_by": ""}},
    )
    ok = result.modified_count > 0
    if not ok:
        raise HTTPException(status_code=404, detail="Item not found in trash")
    return {"ok": True}


@api.get("/trash")
async def list_trash(collection: Optional[str] = None, user: dict = Depends(get_current_user)):
    """List trashed items for the current user across all or specific collections."""
    results = {}
    collections_to_check = {
        "invites": {"created_by": user["id"], "deleted_at": {"$exists": True}},
        "emails": {"$or": [{"to_user": user["id"]}, {"from_user": user["id"]}], "deleted_at": {"$exists": True}},
        "messages": {"$or": [{"to_user": user["id"]}, {"from_user": user["id"]}], "deleted_at": {"$exists": True}},
        "call_logs": {"participants": user["id"], "deleted_at": {"$exists": True}},
        "shared_items": {"shared_by": user["id"], "deleted_at": {"$exists": True}},
        "events": {"created_by": user["id"], "deleted_at": {"$exists": True}},
        "contacts": {"owner_id": user["id"], "deleted_at": {"$exists": True}},
        "notifications": {"user_id": user["id"], "deleted_at": {"$exists": True}},
    }
    if collection and collection not in collections_to_check:
        raise HTTPException(status_code=400, detail="Invalid collection")
    if collection and collection in collections_to_check:
        collections_to_check = {collection: collections_to_check[collection]}
    for coll, query in collections_to_check.items():
        items = await db[coll].find(query, {"_id": 0}).sort("deleted_at", -1).to_list(100)
        if items:
            results[coll] = items
    return results


@api.delete("/trash/purge")
async def purge_trash(collection: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Permanently delete all trashed items for the current user."""
    purged = {}
    collections_to_purge = {
        "invites": {"created_by": user["id"]},
        "emails": {"$or": [{"to_user": user["id"]}, {"from_user": user["id"]}]},
        "messages": {"$or": [{"to_user": user["id"]}, {"from_user": user["id"]}]},
        "call_logs": {"participants": user["id"]},
        "shared_items": {"shared_by": user["id"]},
        "events": {"created_by": user["id"]},
        "contacts": {"owner_id": user["id"]},
        "notifications": {"user_id": user["id"]},
    }
    if collection and collection not in collections_to_purge:
        raise HTTPException(status_code=400, detail="Invalid collection")
    if collection and collection in collections_to_purge:
        collections_to_purge = {collection: collections_to_purge[collection]}
    for coll, base_query in collections_to_purge.items():
        count = await clear_trash(coll, base_query)
        if count:
            purged[coll] = count
    return {"purged": purged}


# Individual delete endpoints for each resource type
# NOTE: clear-all routes must come BEFORE {id} routes to avoid path parameter matching
@api.delete("/invites/clear-all")
async def clear_all_invites(user: dict = Depends(get_current_user)):
    result = await db.invites.update_many(
        {"created_by": user["id"], "deleted_at": {"$exists": False}},
        {"$set": {"deleted_at": now_iso(), "deleted_by": user["id"]}},
    )
    return {"ok": True, "trashed": result.modified_count}


@api.delete("/invites/{invite_id}")
async def delete_invite(invite_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invites.find_one({"id": invite_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    if inv.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your invite")
    await soft_delete("invites", invite_id, user["id"])
    return {"ok": True}


@api.delete("/emails/{email_id}")
async def delete_email(email_id: str, user: dict = Depends(get_current_user)):
    email = await db.emails.find_one({"id": email_id, "$or": [{"to_user": user["id"]}, {"from_user": user["id"]}]}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    await soft_delete("emails", email_id, user["id"])
    return {"ok": True}


@api.delete("/messages/{message_id}")
async def delete_message(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one({"id": message_id, "$or": [{"to_user": user["id"]}, {"from_user": user["id"]}]}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    await soft_delete("messages", message_id, user["id"])
    return {"ok": True}


@api.delete("/messages/clear/{with_user}")
async def clear_conversation(with_user: str, user: dict = Depends(get_current_user)):
    result = await db.messages.update_many(
        {"$or": [
            {"from_user": user["id"], "to_user": with_user},
            {"from_user": with_user, "to_user": user["id"]},
        ], "deleted_at": {"$exists": False}},
        {"$set": {"deleted_at": now_iso(), "deleted_by": user["id"]}},
    )
    return {"ok": True, "trashed": result.modified_count}


# NOTE: Routes without path params must come BEFORE routes with path params
@api.delete("/calls/history")
async def clear_call_history(user: dict = Depends(get_current_user)):
    result = await db.call_logs.update_many(
        {"participants": user["id"], "deleted_at": {"$exists": False}},
        {"$set": {"deleted_at": now_iso(), "deleted_by": user["id"]}},
    )
    return {"ok": True, "trashed": result.modified_count}


@api.delete("/calls/history/{call_id}")
async def delete_call_log(call_id: str, user: dict = Depends(get_current_user)):
    result = await db.call_logs.update_one(
        {"call_id": call_id, "participants": user["id"]},
        {"$set": {"deleted_at": now_iso(), "deleted_by": user["id"]}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"ok": True}


@api.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: dict = Depends(get_current_user)):
    contact = await db.contacts.find_one({"id": contact_id, "owner_id": user["id"]}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await soft_delete("contacts", contact_id, user["id"])
    return {"ok": True}


@api.delete("/notifications/clear-all")
async def clear_all_notifications(user: dict = Depends(get_current_user)):
    result = await db.notifications.update_many(
        {"user_id": user["id"], "deleted_at": {"$exists": False}},
        {"$set": {"deleted_at": now_iso(), "deleted_by": user["id"]}},
    )
    return {"ok": True, "trashed": result.modified_count}


# ---------- Health ----------
@api.get("/")
async def root():
    await db.command("ping")
    return {"service": "Roundtable_VO API", "status": "ok"}


# ---------- AI Smart Suggestions ----------
PURPOSE_GUIDANCE = {
    "family": "This is a family table - suggest gatherings like shared meals, birthdays, family game nights, movie nights, or household planning.",
    "bible_study": "This is a Bible study / faith community table - suggest weekly study meetings, prayer gatherings, service projects, fellowship meals, or scripture reading plans.",
    "community": "This is a neighborhood / community table - suggest block parties, help projects, potlucks, clean-up days, or local gatherings.",
    "friends": "This is a friend group table - suggest hangouts, game nights, group trips, dinners, or shared celebrations.",
    "work": "This is a work / project table - suggest syncs, retros, deadlines, kickoffs, or planning sessions.",
    "other": "Suggest helpful upcoming gatherings or activities appropriate for this group.",
}


@api.post("/tables/{table_id}/suggest-events")
async def suggest_events(table_id: str, user: dict = Depends(get_current_user)):
    await ensure_table_member(table_id, user["id"])
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Table not found")
    if not ANTHROPIC_API_KEY:
        return {"suggestions": [], "error": "AI key not configured"}

    prompt_data = await _build_suggest_prompt(t, table_id)
    try:
        raw = await _call_llm_suggest(table_id, prompt_data["system"], prompt_data["prompt"])
        suggestions = _parse_suggestions(raw, t.get("color", "#007AFF"))
        return {"suggestions": suggestions, "purpose": t.get("purpose", "other")}
    except Exception as e:
        logger.warning(f"AI suggest failed for table {table_id}: {e}")
        return {"suggestions": [], "error": "suggestion temporarily unavailable"}


async def _build_suggest_prompt(table: dict, table_id: str) -> dict:
    """Build system + user prompt for event suggestions."""
    existing = await db.events.find({"table_id": table_id, "deleted_at": {"$exists": False}}, {"_id": 0}).sort("date", -1).limit(10).to_list(10)
    existing_summary = "\n".join([f"- {e['title']} on {e['date']}" for e in existing]) or "(none yet)"
    purpose = table.get("purpose", "other")
    guidance = PURPOSE_GUIDANCE.get(purpose, PURPOSE_GUIDANCE["other"])
    today = datetime.now(timezone.utc).date().isoformat()
    system = (
        "You are the 'Roundtable_VO' scheduling helper. You propose warm, concrete, low-pressure event ideas for real-world groups. "
        "Return strictly valid JSON only — no commentary. Format: "
        '{"suggestions":[{"title":"","date":"YYYY-MM-DD","time":"HH:MM","description":"","reason":""}]}'
        " Exactly 3 suggestions. Dates must be in the future (after today). Use 24-hour time."
    )
    prompt = (
        f"Today is {today}.\nTable name: {table['name']}\n"
        f"Table purpose: {purpose} — {guidance}\n"
        f"Recent events on this table:\n{existing_summary}\n\n"
        "Suggest 3 upcoming events that would genuinely serve this group. Keep titles short (2-6 words), "
        "descriptions one sentence, and 'reason' one short phrase on why it fits."
    )
    return {"system": system, "prompt": prompt}


async def _call_llm_suggest(table_id: str, system: str, prompt: str) -> str:
    """Call the LLM and return raw response text."""
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    message = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].lstrip()
    return raw


def _parse_suggestions(raw: str, color: str) -> list:
    """Parse and validate LLM JSON response into clean suggestions."""
    import json as _j
    data = _j.loads(raw)
    clean = []
    for s in data.get("suggestions", [])[:3]:
        if not isinstance(s, dict):
            continue
        title = str(s.get("title", "")).strip()[:100]
        date = str(s.get("date", "")).strip()
        time_val = str(s.get("time", "12:00")).strip()
        if not title or not date or len(date) != 10 or date[4] != "-" or date[7] != "-":
            continue
        clean.append({
            "title": title, "date": date,
            "time": time_val if len(time_val) == 5 else "12:00",
            "description": str(s.get("description", ""))[:280],
            "reason": str(s.get("reason", ""))[:120],
            "color": color,
        })
    return clean


# ---------- WebSocket ----------
async def _authenticate_ws(websocket: WebSocket) -> str:
    """Authenticate WebSocket connection. Returns user_id or raises."""
    origin = websocket.headers.get("origin")
    if origin and origin not in CORS_ORIGINS:
        await websocket.close(code=4403)
        return ""
    protocol_token = next((value.removeprefix("rt-auth.") for value in websocket.scope.get("subprotocols", []) if value.startswith("rt-auth.")), None)
    token = protocol_token or websocket.cookies.get("rt_access")
    if not token:
        await websocket.close(code=4401)
        return ""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            await websocket.close(code=4401)
            return ""
        user_id = payload.get("sub")
        if not user_id or not await db.users.find_one({"id": user_id}):
            await websocket.close(code=4401)
            return ""
        return user_id
    except jwt.PyJWTError:
        await websocket.close(code=4401)
        return ""


async def _route_ws_message(user_id: str, msg: dict, websocket: WebSocket):
    """Route a single WS message to the appropriate handler."""
    msg_type = msg.get("type")
    if msg_type == "ping":
        await websocket.send_text(_json.dumps({"type": "pong"}))
    elif msg_type == "typing" and msg.get("to_user"):
        await ws_manager.send_to_user(msg["to_user"], {
            "type": "typing", "from_user": user_id, "table_id": msg.get("table_id")
        })
    elif msg_type in ("call_start", "call_join", "call_leave", "webrtc_offer", "webrtc_answer", "webrtc_ice", "walkie_talk_state"):
        previous_call = user_call_map.get(user_id)
        await _handle_webrtc_message(user_id, msg)
        if not previous_call and user_id in user_call_map:
            user_call_connections[user_id] = websocket
    elif msg_type in ("present_start", "present_sync", "present_stop"):
        table_id = msg.get("table_id")
        if table_id:
            await ensure_table_member(table_id, user_id)
            await ws_manager.broadcast_to_table(table_id, {**msg, "from_user": user_id}, exclude_user=user_id)


async def _cleanup_ws_disconnect(user_id: str, websocket: WebSocket):
    """Only the owning tab's disconnect ends its media call."""
    owner_socket = user_call_connections.get(user_id)
    await ws_manager.disconnect(user_id, websocket)
    if owner_socket is not None and owner_socket is not websocket:
        return
    if owner_socket is None and ws_manager.is_online(user_id):
        return
    user_call_connections.pop(user_id, None)
    call_id = user_call_map.pop(user_id, None)
    if call_id and call_id in active_calls:
        call = active_calls[call_id]
        call["participants"].discard(user_id)
        leaver = await db.users.find_one({"id": user_id}, {"_id": 0})
        leaver_info = user_public(leaver) if leaver else {"id": user_id}
        for pid in list(call["participants"]):
            await ws_manager.send_to_user(pid, {
                "type": "call_peer_left", "call_id": call_id,
                "peer": leaver_info, "participants": list(call["participants"]),
            })
        if not call["participants"]:
            await _finalize_call_log(call_id, call)
            active_calls.pop(call_id, None)


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = await _authenticate_ws(websocket)
    if not user_id:
        return

    await ws_manager.connect(user_id, websocket)
    try:
        await websocket.send_text(_json.dumps({"type": "ready", "user_id": user_id}))
        while True:
            data = await websocket.receive_text()
            try:
                msg = _json.loads(data)
            except Exception:
                continue
            if not isinstance(msg, dict):
                continue
            try:
                await _route_ws_message(user_id, msg, websocket)
            except HTTPException as error:
                await websocket.send_json({"type": "call_error" if str(msg.get("type", "")).startswith(("call_", "webrtc_", "walkie_")) else "error", "error": error.detail, "call_id": msg.get("call_id")})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WS error for {user_id}: {e}")
    finally:
        await _cleanup_ws_disconnect(user_id, websocket)


app.include_router(api)




_auth_attempts = defaultdict(deque)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method not in ("GET", "HEAD", "OPTIONS") and origin and origin not in CORS_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Origin is not allowed"})
    if request.method == "POST" and request.url.path in ("/api/auth/login", "/api/auth/register"):
        current = monotonic()
        for key in list(_auth_attempts):
            if not _auth_attempts[key] or _auth_attempts[key][-1] <= current - 60:
                del _auth_attempts[key]
        key = request.client.host if request.client else "unknown"
        attempts = _auth_attempts[key]
        while attempts and attempts[0] <= current - 60:
            attempts.popleft()
        if len(attempts) >= AUTH_RATE_LIMIT:
            return JSONResponse(status_code=429, content={"detail": "Too many sign-in attempts. Try again in a minute."}, headers={"Retry-After": "60"})
        attempts.append(current)
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
