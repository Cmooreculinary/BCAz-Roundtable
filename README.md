# Roundtable_VO — PRIMARY VERSION [Iteration 18a | SQLite Full-Stack]

> **This is the current primary build.** Full-stack React + FastAPI + SQLite with real WebRTC, Twilio SMS, Web Push, scene-based table environments, and the Gather Experience investor demo.

**Where your people gather.** A macOS-styled unified collaboration platform replacing Slack, WhatsApp, Google Suite, email, and texting for families, faith communities, project teams, and neighborhoods.

---

## Version Info

| Field | Value |
|-------|-------|
| **Status** | PRIMARY — Active Development |
| **Iteration** | 18a |
| **Platform** | Render-ready as of 2026-05-21 |
| **Stack** | React 19 + FastAPI + SQLite |
| **Other versions** | `round-table` repo = Cloudflare/Hono edition (separate stack) |

---

## What Makes This Version Different

- **Scene-based table environments** — every table has a configurable Room, Table type, Tabletop, Food, Ambiance, and Music setting
- **Gather Experience** — cinematic investor demo view with Room Builder, Avatar Seating, Live Table View, guided simulation
- **Real WebRTC** — peer-to-peer and group video/audio calls
- **Twilio SMS bridge** — real two-way texting from inside the platform
- **Web Push notifications** — native push via VAPID
- **WebSocket co-viewing** — real-time file viewer sync
- **Soft-delete architecture** — safe data recovery on all content
- **DiceBear stylized avatars** — illustrated portrait system (Iteration 18)

---

## Deploy to Render

```bash
# 1. Set environment variables (see backend/.env.example)
# 2. Connect repo to Render — render.yaml handles both services

# Required env vars:
# SQLITE_PATH, JWT_SECRET, CORS_ORIGINS, UPLOAD_ROOT
# Optional: VAPID keys, TWILIO creds, ANTHROPIC_API_KEY (Smart Suggestions)
```

The `render.yaml` at the repo root defines both the backend (Python web service) and frontend (static site). SQLite and uploads are configured under `/opt/data`, backed by a Render persistent disk on the backend service. Render persistent disks require a paid web service; without the disk, local file changes are ephemeral across deploys/restarts.

---

## Tech Stack

- **Frontend**: React 19, CRACO, TailwindCSS, shadcn/ui, WebRTC, Web Push
- **Backend**: FastAPI (Python), SQLite-backed persistence, JWT auth, WebSockets
- **Database**: SQLite
- **Files**: Local disk-backed uploads with metadata in SQLite
- **Real-time**: Native WebSockets (chat, signaling, co-viewing)
- **AI**: Anthropic Claude Sonnet (Smart Suggestions — optional)
- **Comms**: Twilio SMS, Web Push (pywebpush/VAPID)

---

## Project Structure

```
Roundtable_VO/
├── render.yaml                    # Render Blueprint (frontend + backend)
├── backend/
│   ├── server.py                  # FastAPI app, Iteration 18a
│   ├── requirements.txt           # Slim Render-ready dependencies
│   ├── .env.example               # All required env vars documented
│   └── tests/                     # 14 test files across all iterations
├── frontend/
│   ├── src/
│   │   ├── views/                 # Portal, TableView, GatherExperience, etc.
│   │   ├── components/            # RoundTableViz, Sidebar, modals
│   │   └── lib/                   # scenes.js, webrtc.js, realtime.js
│   ├── .env.example
│   └── package.json
├── design_guidelines.json
└── memory/PRD.md
```

---

## Scene System (Iteration 18)

Tables can be set to any combination of:

| Category | Options |
|----------|---------|
| **Room** | Skyline Executive, Warm Private Dining, Creative Studio, Fireside Library, Church/Community, Outdoor Terrace |
| **Table** | Mahogany Round, Executive Board, Family Dinner, Drafting/Planning, Luncheon, Strategy War |
| **Tabletop** | Meeting Set, Coffee & Snacks, Luncheon, Formal Dinner, Planning, Premium Chef |
| **Ambiance** | Business Bright, Warm Dinner, Fireside Calm, Evening Jazz, Focus Mode, Celebration |
| **Music** | Off, Soft Jazz, Acoustic, Ambient Focus, Worship/Reflection, Private Event Mix |

---

## License

Proprietary — All Rights Reserved © Blue Collar Apps
