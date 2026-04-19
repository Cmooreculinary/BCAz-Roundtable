# Round Table — Product Requirements Document

## Original Vision
> "Round Table is a macOS-styled unified collaboration platform that replaces Slack, WhatsApp, Google Suite, email, and SMS with a single, visually intuitive interface organized around the metaphor of gathering at a table. Built for families, faith communities, project teams, and neighborhoods. Core principle: If you can sit at a table, you can collaborate."

## Core Product Principle (user-emphasized, hard requirement)
**Per-table data isolation.** "Each table will hold all of the info at that table, no bleeding and much easier on the user." When a user views a specific table, they see only that table's members, items, events, and chat — no cross-table contamination.

## User Personas
- **Family steward** — keeps everyone on the same page (events, photos, group chat).
- **Faith community leader** — coordinates a group with shared resources.
- **Project lead** — runs a small team without enterprise overhead.
- **Neighborhood organizer** — keeps neighbors connected.

## Tech Stack
- Backend: FastAPI + MongoDB + JWT (httpOnly cookies, bcrypt).
- Frontend: React 19 + react-router-dom + Tailwind + lucide-react + sonner.
- File storage: Emergent Object Storage (uploads/{user_id}/{uuid}.{ext}).
- Real-time: Native WebSockets (signaling + presence + chat + WebRTC).
- Push: VAPID-based Web Push via pywebpush.
- AI: Claude Sonnet 4.5 via Emergent Universal LLM Key.

## Phase 1 — Implemented (Feb 2026)
### Backend
- Auth: register, login, logout, me (httpOnly cookies, bcrypt, admin seed)
- Users: get/update profile, list members
- Tables: full CRUD with role-aware membership (owner/admin/member)
- Shared items per table (CRUD)
- File upload via Emergent Object Storage + protected download
- Messages (1:1 + table-scoped)
- Emails (folders: inbox/sent/starred/trash, read/star toggles)
- Texts (SMS-style)
- Events (per-table or personal, color-coded)
- Notifications + walkie pings
- Invites (codes, max-uses, expiry, join flow)
- Contacts (auto-match against existing users)
- Referrals + leaderboard
- Auth + table membership guards on all protected routes
- _id excluded from all responses

### Frontend
- macOS title bar (traffic lights, centered title, theme toggle, notifications, profile)
- Left sidebar (240px) — nav + Round Tables list with live/dormant states
- macOS dock (glass morphism, hover-lift, tooltips, unread badge)
- 5-step onboarding wizard with progress bar + live table preview
- Portal dashboard — 6 widgets + Communications Hub (Email/Texts/Chat/Walkie tabs)
- Round Table view — circular wood-grain table, radial member seats, items on surface
- Calendar — monthly grid, color-coded events, table filter
- Messages — two-pane with walkie/video shortcuts
- App Launcher — 24 apps with vendor filter
- Contacts, Invites, Notifications views
- Light/Dark mode toggle, empty states, contextual help tooltips

## Phase 2 — Implemented (Feb 2026)
### Real-time layer
- WebSocket endpoint `/api/ws` with cookie auth + fallback token
- WSManager with per-user connections, presence, table broadcasts
- Live events: presence, user_updated, message, text, walkie_ping, item_added, referral_joined, typing
- Frontend useWebSocket + useRTEvent hooks with auto-reconnect, ping/pong keepalive

### Bonus pack
- Settings page, Mobile sidebar drawer, Responsive CSS, PWA installable
- Walkie ping toast, Founders badge celebration

## Phase 3 — Implemented (Feb 2026)
### Growth loop
- Public `/join/:code` landing page with table preview
- ShareBadge on BadgeUnlock with navigator.share + clipboard fallback

### AI assist (Claude Sonnet 4.5)
- `POST /api/tables/{id}/suggest-events` — 3 tailored event suggestions
- SmartSuggestions widget in TableView

### Community depth
- Table purpose field (6 options), Purpose picker in CreateTableModal
- Prayer & Intention shared-item types

## Phase 4 — Implemented (Feb 2026)
### Prayer Wall
- `GET /api/tables/{id}/prayers` — prayer + intention items with reactions
- Prayer Wall tab in TableView with count badge

### Reactions on shared items
- `POST /api/tables/{id}/items/{item_id}/react` — toggle praying/amen/heart/thanks
- Live-broadcast over WebSocket

### Recurring events
- Weekly/monthly recurring with virtual expansion up to 90 days

### Purpose-based starter templates
- Auto-seed events + items when creating tables based on purpose

## Phase 5 — Implemented (Apr 2026)

### Real WebRTC Walkie-Talkie + Video Calls (Group Support)
- **Backend signaling** via existing WebSocket: `call_start`, `call_join`, `call_leave`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice`, `walkie_talk_state` message types
- **In-memory call tracking**: `active_calls` dict with participants, type, table_id
- **REST endpoint**: `GET /api/calls/active` — list active calls (filterable by table_id)
- **Auto-cleanup**: When user disconnects from WebSocket, they're removed from active calls; empty calls are cleaned up
- **Frontend WebRTC service** (`/app/frontend/src/lib/webrtc.js`): Mesh topology peer connection management, media stream handling, ICE/SDP exchange
- **WalkieView** rewritten: "Join Walkie Room" creates real audio call, push-to-talk mutes/unmutes audio track, shows who's currently talking, walkie_talk_state broadcasts
- **VideoCallOverlay** rewritten: Real video + audio streams, local video PiP, remote peer video grid, proper mute/camera/end controls, supports both outgoing and incoming calls
- **IncomingCallToast** component: Ring tone, caller info, Answer/Decline buttons, 30s auto-dismiss
- **STUN servers**: Google's free STUN (`stun.l.google.com:19302`, `stun1.l.google.com:19302`)

### Web Push Notifications
- **VAPID keys** generated and stored in backend .env
- **Endpoints**: `GET /api/push/vapid-key` (public), `POST /api/push/subscribe`, `POST /api/push/unsubscribe`
- **Push triggers**: Walkie pings, direct messages, and incoming calls (when user is offline/not connected via WebSocket)
- **Service Worker** updated with `push` event listener — shows native browser notification with icon, vibrate, tag
- **Notification click** focuses existing tab or opens app to relevant route (walkie/messages)
- **Frontend**: `push.js` subscription manager, auto-subscribe on login if permission granted, Settings page toggle
- **Dead subscription cleanup**: 404/410 responses auto-remove stale endpoints

### SMS/Email Bridges
- **SMS Bridge (LIVE)**: Twilio integration active with real credentials
  - `POST /api/bridges/sms` sends real SMS via Twilio
  - Twilio error messages surfaced to the user (e.g., "Invalid To Phone Number")
  - Trial account limitation: can only send to verified numbers
  - SMS compose form in Contacts page for off-app contacts with phone numbers
- **Email Bridge (COMING SOON)**: Resend integration infrastructure ready, returns 503 until API key provided
  - "COMING SOON" orange badge displayed on Contacts page
- **`GET /api/bridges/status`** — returns which bridges are configured ({sms_configured: true, email_configured: false})

### Call History (Enhancement)
- **`GET /api/calls/history`** — per-user call logs, last 30 days, sorted newest first
- **`call_logs` MongoDB collection** — persists call_id, type, participants, started_at, ended_at, duration_seconds, status
- Calls are logged on `call_start`, participants added on `call_join`, finalized with duration on `call_leave` or WebSocket disconnect
- **CallHistoryView** frontend page at `/call-history` — shows each call with avatar, call type icon (video blue, audio orange), direction (outgoing/incoming/missed), duration, time ago, green redial button
- **Missed calls** highlighted in red
- **One-tap redial** opens VideoCallOverlay with the same target
- Accessible from **Sidebar** (between Walkie Talkie and Apps) and **Dock** (green Calls icon)

### Auto-SMS Notifications (Opt-in)
- **"Text me when I miss something"** — single toggle in Settings
- Users add phone number + enable toggle → get SMS when offline for:
  - Walkie pings directed at them
  - Direct messages they missed
  - New prayer/intention items at their tables
  - Missed incoming calls
  - **Event reminders** — 1 hour before table events (background task checks every 10 min)
- `send_auto_sms_if_offline()` helper checks: user offline, auto_sms=true, phone exists, Twilio configured
- Phone number + auto_sms fields added to user profile (PUT /api/me, GET /api/auth/me)

### Theme System
- **Dark mode is now the default** — new users see dark theme on first visit
- **Soft golden light mode** — replaced stark white with warm golden tint (#FEFCF3 base)
- Theme persists in localStorage (`rt-theme`), toggleable via title bar sun/moon icon

### Preset Avatar Library
- **288 avatar options** — 12 DiceBear styles x 24 unique seeds
- Styles: Adventurer, Classic, Big Ears, Robots, Emoji, Lorelei, Micah, Notion, Peeps, Pixel, Thumbs, Personas
- Avatar picker modal in Settings (click profile image → opens picker)
- "Use Initials" button to revert to letter-based avatars
- Stored as `avatar_url` in user profile

### In-App File Viewer + Co-Viewing
- **FileViewerModal** — opens when clicking shared items on a table
- Supports: images (full preview), videos (inline player), PDFs (embedded viewer with page nav), other (download)
- **"Present to Table"** button — starts co-viewing mode:
  - Presenter's view is broadcast to all table members via WebSocket
  - Videos: play/pause/seek syncs for everyone
  - PDFs: page number syncs
  - Images: same image shown to all
- WebSocket events: `present_start`, `present_sync`, `present_stop`

### Enhanced Onboarding (6-Step, All Skippable)
1. **Welcome** — intro + "Get Started" / "Complete later"
2. **Your Look** — name, seat color, avatar picker (DiceBear)
3. **Stay Connected** — phone number, auto-SMS toggle, push notifications toggle
4. **Your First Table** — create table with name/color/active
5. **Invite People** — generate invite code, share via SMS/email
6. **All Set** — checklist summary of completed/skipped items
- Every step has "Complete later" → marks as skipped
- Completion status stored in localStorage (`rt-onboard-completed`)
- **Portal reminder banner** — gentle nudge for skipped items (avatar, phone, push, table)
- Banner is dismissible with X button

### Soft Delete / Trash System (30-Day Recovery)
- **Soft delete**: All deletes set `deleted_at` timestamp instead of removing data
- **Restore**: `POST /api/trash/restore?collection=X&item_id=Y` — recover any trashed item
- **Trash view**: `GET /api/trash` — see all trashed items grouped by collection
- **Purge**: `DELETE /api/trash/purge` — permanently delete everything in trash
- **Clear All**: Bulk trash available for invites, call history, notifications
- **Supported resources**: invites, emails, messages, call logs, shared items, events, contacts, notifications
- **All list queries** now exclude soft-deleted items (`deleted_at: {$exists: false}`)
- **Frontend**: Red trash icons on every row (invites, contacts), Delete button on emails, Clear buttons on call history and notifications

## Backlog

### Deferred Enhancement (user said "remember, don't build yet")
- **Public "We're praying for X" embeddable widget** — church/community websites embed badge linking to `/join/:code`

### P1
- Prayer reply threads (comments on prayers within the Prayer Wall)
- Table roles management UI
- Activity feed per table (timeline of all table actions)

### P2
- End-to-end encryption for messages
- Per-table file/folder browser
- Device contact import
- Analytics dashboard for table owners
- Audit log + soft-delete recovery
- Notification preferences per channel

## Test Credentials
See `/app/memory/test_credentials.md`

## Test Status
- **Iteration 1 (Phase 1):** Backend 40/40 (100%), Frontend 95%
- **Iteration 2 (Phase 2):** Backend 51/51 (100%), Frontend 100%
- **Iteration 3 (Phase 3):** Backend 32/32 (100%), Frontend 100%
- **Iteration 4 (Phase 4):** Backend 34/34 (100%), Frontend 100%
- **Iteration 5 (Phase 5):** Backend 23/23 (100%), Frontend 100% — zero regressions
- **Iteration 6 (Call History):** Backend 20/20 (100%), Frontend 100% — zero regressions
- **Iteration 7 (Twilio SMS Bridge):** Backend 9/9 (100%), Frontend 100% — zero regressions
- **Iteration 8 (Auto-SMS Opt-in):** Backend 18/18 (100%), Frontend 7/7 (100%) — zero regressions
- **Iteration 9 (Dark Default + Golden Light + Event Reminders):** Backend 13/13 (100%), Frontend 9/9 (100%) — zero regressions
- **Iteration 10 (Avatars + File Viewer + Co-Viewing):** Backend 17/17 (100%), Frontend 100% — zero regressions
- **Iteration 11 (Enhanced Onboarding):** Backend 13/13 (100%), Frontend 100% — zero regressions
- **Iteration 12 (One-Sheet Polish):** Backend 11/11, Frontend 100%
- **Iteration 13 (Code Quality Refactoring):** Backend 21/21 (100%), Frontend 100% — zero regressions
- **Iteration 14 (Soft Delete / Trash System):** Backend 19/19 (100%), Frontend 100% — zero regressions
