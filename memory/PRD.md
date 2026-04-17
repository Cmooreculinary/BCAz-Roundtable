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
- Universal LLM key configured for future AI features (not used in Phase 1).

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
- Left sidebar (240px) — nav + Round Tables list with live/dormant states (pulsing green dot, color bar)
- macOS dock (glass morphism, hover-lift, tooltips, unread badge)
- 5-step onboarding wizard with progress bar + live table preview
- Portal dashboard — 6 widgets (Today's Schedule, Recent on Tables, My Tables, Quick Actions, Invites & Referrals, Notifications) + Communications Hub (Email/Texts/Chat/Walkie tabs)
- Round Table view — circular wood-grain table, radial member seats with status dots, items on surface, LIVE glow / dormant desaturation, table-scoped panels (members/items/events/chat)
- Calendar — monthly grid, color-coded events, table filter, prev/next/today
- Messages — two-pane with walkie/video shortcuts
- Walkie Talkie — push-to-talk button with pulse animation, Web Audio beeps, ping action (audio/video streaming MOCKED)
- Video Call overlay — avatar, connecting state, mic/cam/end controls (WebRTC MOCKED)
- App Launcher — 24 apps with vendor filter
- Contacts — search, On-app/Off-app sections, add + invite
- Invites — generate codes, copy/share, join via code, referral stats + leaderboard
- Notifications view — list with read/unread states
- Modals — Create Table, New Event, Add Contact, Share Item (with file upload + drag/drop), Invite, Video Call
- Light/Dark mode toggle persisted to localStorage with smooth transitions
- Empty states for every view with actionable CTAs
- Contextual help tooltips (auto-dismiss in 8s, dismissible, persisted)
- Escape key dismisses all overlays

## Phase 2 / Slice A — Implemented (Feb 2026)

### Real-time layer
- WebSocket endpoint `/api/ws` with cookie auth + fallback `?token=` query param
- `WSManager` class with per-user connection tracking, presence updates, table broadcasts, contact broadcasts
- Live events emitted: `presence`, `user_updated`, `message`, `text`, `walkie_ping`, `item_added`, `referral_joined`, `typing`
- Presence flips user status to `online`/`offline` in DB automatically on connect/disconnect
- Frontend `useWebSocket` + `useRTEvent` hooks with shared event bus (auto-reconnect, ping/pong keepalive every 25s)
- Polling intervals reduced: notifications 60s (was 20s), table chat 30s (was 8s) — WS handles instant updates
- TableView + MessagesView live-append messages/items/presence changes without refresh

### Bonus pack
- Settings page (`/settings`) — edit name/color/status, sign-out, keyboard shortcuts reference
- Settings cog icon in title bar
- Mobile sidebar drawer with hamburger toggle, backdrop, Escape/nav/click-outside close
- Responsive CSS for mobile (table viz shrinks, 2-col layouts stack, dock compact)
- PWA installable — manifest.json + minimal service worker registered in index.js
- Walkie ping toast (slide-in from top-right, Answer/Later buttons, double beep, 7s auto-dismiss) — Answer opens VideoCallOverlay
- Founders badge celebration — modal fires at referral milestones (1 Newcomer / 3 Host / 10 Connector / 25 Community Builder) with animated trophy

## Phase 3 / "Growth & Gather" — Implemented (Feb 2026)

Built specifically for families, Bible study groups, and community groups (with orphanages as the mission beneficiary via proceeds).

### Growth loop
- **Public `/join/:code` landing page** — no-auth preview with table name, purpose badge, inviter avatar + member count. Invalid/expired codes show friendly error. Guests see "Create Account & Join" (stashes code in sessionStorage → post-registration `PendingInviteHandler` routes back to `/join/:code`).
- **GET `/api/invites/preview/{code}`** — public endpoint returning table + inviter preview (404 / 410 handled).
- **ShareBadge** on BadgeUnlock — creates invite, uses `navigator.share` with clipboard fallback, displays copyable `/join/{code}` URL.

### AI assist (Claude Sonnet 4.5)
- **`POST /api/tables/{id}/suggest-events`** — calls Claude via `emergentintegrations` + Universal LLM key. Returns 3 tailored events `{title, date, time, description, reason, color}` based on the table's purpose. Graceful error handling (returns empty list, never 500).
- Uses `claude-sonnet-4-5-20250929` model with structured JSON prompt + defensive parsing.
- Purpose guidance built-in (family → meals/birthdays/game nights, bible_study → studies/prayer/fellowship, community → potlucks/help projects, etc.).
- **SmartSuggestions widget** in TableView — "Ask Claude" button fetches suggestions, one-click "Add" creates the event.

### Bible study / community depth
- **Table purpose field** on create/edit — 6 options: `family`, `bible_study`, `community`, `friends`, `work`, `other`. Drives the AI context and UI badges.
- **Purpose picker** in CreateTableModal — 6-tile grid with distinct icon + color + hint.
- **Prayer & Intention** new shared-item types. Prayer uses HeartHandshake icon (purple); Intention uses Sparkles (yellow). Textarea prompt on ShareItemModal. Items render with their own icons/colors on the RoundTableViz surface.

## Phase 4 / "Depth & Devotion" — Implemented (Feb 2026)

Built to give Bible study groups, families, and community groups real spiritual and organizational depth.

### Prayer Wall
- **`GET /api/tables/{id}/prayers`** — returns prayer + intention items (newest first, reactions hydrated, membership-gated).
- **Prayer Wall tab** inside TableView with count badge of active prayers + intentions.
- Cards show type badge (Prayer purple / Intention yellow), body text, author + time ago, and 4 reaction pills.
- Empty state: "The wall is quiet" → prompts to share a prayer.

### Reactions on shared items
- **`POST /api/tables/{id}/items/{item_id}/react`** — toggles user in `reactions.{praying|amen|heart|thanks}` array.
- Initialized on all new shared items: `{praying: [], amen: [], heart: [], thanks: []}`.
- Live-broadcast over WebSocket (`item_reaction` event) so every viewer's count updates instantly.
- Pills highlight with tier color when toggled on, show count inline; toast confirms "🙏 You're lifting them up" for praying.

### Recurring events
- **`EventIn.recurring`** → `none | weekly | monthly`.
- Stored once; **`GET /api/events` virtually expands** up to 90 days forward with `::rN` id suffix and `_virtual=true` flag — no DB bloat.
- Weekly event → ~12–13 visible instances; monthly → ~3.
- NewEventModal has segmented "Repeats" control (Once / Weekly / Monthly).
- Table's Upcoming Events + Calendar both show "↻ weekly / monthly" badge on recurring titles.

### Purpose-based starter templates
Auto-seed when creating a table based on purpose picker:
- **Bible Study:** weekly "Weekly Bible Study" event + "Our prayer list" prayer + "This week's focus verse" intention.
- **Family:** weekly "Family Dinner" + "What we're grateful for this week" intention.
- **Community:** monthly "Monthly Potluck" + "Community announcements" note.
- **Friends:** weekly "Saturday Hangout".
- **Work:** weekly "Weekly Sync".
- **Other:** nothing (opt-out default).

## Phase 5 — Backlog
### P0
- Real WebRTC walkie + video (signaling already runs through WS layer now)
- Web Push notifications (browser-level alerts when tab is closed) — needs VAPID keys
- Offline support (Service Worker cache strategies beyond install-only)

### P1
- AI features via Universal LLM key — smart event suggestions, message summaries, onboarding copy assistant (user to be consulted before adding)
- Activity feed per table (timeline of all table actions)
- Email/SMS bridge (Resend + Twilio) — reach people who aren't online
- Table roles management UI (owner/admin/member)
- Notification preferences per channel

### P2
- End-to-end encryption for messages
- Per-table file/folder browser
- Granular invite deep links (`/join/:code`)
- Device contact import
- Analytics dashboard for table owners
- Audit log + soft-delete recovery

## Test Credentials
See `/app/memory/test_credentials.md`
- Admin: admin@roundtable.app / roundtable2026 (pre-seeded, onboarded)
- Demo user can be created via /api/auth/register

## Test Status
- **Iteration 1 (Phase 1, Feb 2026):** Backend 40/40 (100%), Frontend 95% — HelpTip z-index fixed.
- **Iteration 2 (Phase 2 Slice A, Feb 2026):** Backend 51/51 (100%), Frontend 100% — MessagesView import fixed.
- **Iteration 3 (Phase 3 "Growth & Gather", Feb 2026):** Backend 32/32 (100%), Frontend 100% — zero regressions.
- **Iteration 4 (Phase 4 "Depth & Devotion", Feb 2026):** Backend 34/34 (100%), Frontend 100% — zero regressions.
