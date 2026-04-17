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

## Phase 2 — Backlog
### P0
- Real WebRTC walkie talkie + video call (currently UI-only)
- Real-time updates (WebSockets or SSE) — currently 8–20s polling
- Push notifications (Web Push API)
- Mobile-optimized layouts (sidebar drawer, comms tab routing)

### P1
- Service Worker offline support
- Activity feed per table (timeline of all actions)
- AI features (smart event suggestions, message summaries — Universal LLM key already configured)
- Table roles UI (owner/admin/member management screen)
- Notification preferences (per-channel toggles)

### P2
- End-to-end encryption for messages
- Per-table file/folder browser
- Granular invite link routing (`/join/:code` deep link)
- Real contact import from device address book
- Audit log + soft-delete recovery
- Analytics dashboard for owners

## Test Credentials
See `/app/memory/test_credentials.md`
- Admin: admin@roundtable.app / roundtable2026 (pre-seeded, onboarded)
- Demo user can be created via /api/auth/register

## Test Status (Iteration 1, Feb 2026)
- Backend: 40/40 tests passed (100%)
- Frontend: All major flows working (95%) — minor HelpTip overlay z-index fixed.
