# Launch readiness — 2026-09-10

**Status: verified locally; public launch is not certified.**

Branch: `codex/launch-readiness-2026-09-10`, based on `main` at `c803486`.
The existing React/CRACO, FastAPI, SQLite, and Render structure is retained.

## Verified fixes

- Authentication: login/registration return bearer tokens directly from the canonical routes. The previous wrapper was shadowed with the installed FastAPI router. Logout clears secure cookies even after expiry; the client keeps its token until the request completes.
- Authorization: message/email deletion, trash restoration, call deletion, event reassignment, call participation/signaling, and presentation broadcasts enforce ownership or membership. The directory no longer exposes unrelated accounts.
- Invites and deletion: revoked invites cannot be redeemed or previewed; conditional reservations enforce usage limits. Deleted shared items, prayers, and events stay out of the table view. Invalid trash collection names cannot accidentally purge all collections.
- WebSockets: browser origins and user existence are checked. Tokens use authentication subprotocols instead of URL query strings. Query-string authentication is no longer accepted. Rejected calls release client media.
- Request security: unapproved browser origins cannot make writes; login/registration attempts are rate-limited; API responses are not cached; weak JWT secrets fail startup; overlong bcrypt passwords produce validation errors.
- Push: subscriptions require supported HTTPS browser-push hosts; delivery runs off the event loop with a timeout; expired subscriptions are recognized for cleanup.
- Persistence: real SQLite unique indexes, atomic read/modify/write transactions, duplicate-insert rejection, and seat conflicts that preserve the previous seat. The preflight checks legacy duplicates without deleting records and can create a private database snapshot.
- Files: authenticated blob previews/downloads work without cross-site cookies; URLs are revoked on cleanup; PDF frames have an opaque sandbox origin. Removed fabricated one-page pagination.
- Frontend: removed unconditional analytics/session recording and broken icon references. Email status reflects configuration. Applied Trench foundation colors, fonts, focus treatment, tighter radii, and reduced-motion support while retaining existing scene assets and layouts.
- Calendar: monthly recurrence uses calendar months, including leap years and month-end dates. Long-standing weekly/monthly series continue beyond the old 40-instance cap.
- Delivery: compatible npm updates; blocking frontend lint/runtime audits and Python fatal-error checks; a disposable HTTPS launch-test runner.

## Verification scope

Run the isolated backend gate after installing `backend/requirements.txt` and `backend/requirements-dev.txt`:

```bash
cd backend
python check_launch.py
```

It requires OpenSSL and starts a local HTTPS server with a new database, generated test credentials, external bridges disabled, and automatic teardown. It never targets production. It runs the documented launch suites and new regressions, not every historical integration file.

Frontend checks:

```bash
cd frontend
npm ci --include=dev
npm test -- --watchAll=false --runInBand
npm run lint
npm run build
npm audit --omit=dev
```

VERIFIED local results: frontend unit tests, zero-warning ESLint, production build with Render hostname configuration, Python compilation, fatal/undefined-name Ruff checks, HTTPS API integration, authorization regressions, and SQLite concurrency/backup checks pass. Exact final test counts are recorded in the pull request.

VERIFIED dependency scans: Python runtime and npm runtime dependencies report no known vulnerabilities. The full npm tree still reports **31 development/build advisories: 14 high, 8 moderate, 9 low**. Six backend deprecation warnings remain. The legacy full Ruff/Black checks remain advisory; fatal Python errors and frontend lint now block CI.

## Deployment sequence

1. Preserve the production JWT secret, database, and uploads. Confirm the actual frontend origin in `CORS_ORIGINS` and backend address in `REACT_APP_BACKEND_URL`.
2. Pause writes, snapshot the database, and back up uploads. Keep a copy outside the service disk and verify restoration. Run the read-only data preflight before enabling the new indexes:

   ```bash
   cd backend
   python preflight.py --database /opt/data/roundtable_vo.sqlite3 --backup /opt/data/roundtable_vo.prelaunch.sqlite3
   ```

   Existing backups are never overwritten. If `ready_for_indexes` is false, resolve duplicates with the data owner before deployment. Startup intentionally refuses conflicting unique data; this release does not automatically deduplicate or delete records. The database snapshot does not include uploads.
3. Use **Clear build cache & deploy** on Render because frontend dependencies changed. Deploy backend and frontend together; existing tabs must reload for the new WebSocket handshake.
4. Keep one backend process/instance and the configured persistent disk. Calls, presence, and rate limiting are process-local. Verify that the reverse proxy supplies a correctly trusted client address. `AUTH_RATE_LIMIT` defaults to 30 login/registration attempts per client IP per 60 seconds.
5. Verify live HTTPS health, registration/login/logout, invite redemption/revocation, private-file access, reconnection, and persistence after restart. Exercise Safari/mobile and third-party-cookie blocking.
6. Test a call between two devices on different networks. Test SMS/email/push with controlled recipients after configuring those services and deciding their launch availability.
7. Retain the previous deployment for rollback. Restore matching frontend/backend versions together; do not overwrite newer customer records blindly.

## Open launch gates

- **VERIFIED:** WebRTC has STUN servers only. TURN configuration and real cross-network media testing are still required before promising reliable calling through restrictive networks. No provider credentials were supplied.
- **VERIFIED:** The CRA/CRACO build chain retains the development advisories above. Compatible updates were applied; suggested major replacements change the toolchain. **ARCHITECTURE-LEVEL — route through Conrad/EXPO:** approve migration or a documented build-environment risk decision.
- **VERIFIED:** SQLite filtering loads collection documents and signaling is process-local. **ARCHITECTURE-LEVEL — route through Conrad/EXPO:** establish the launch cohort/load target and scaling plan.
- **VERIFIED:** Some shared records still use shared deletion state. Deleting or purging a conversation/call record can affect the other participant's view. Unrelated users are now excluded, but independent per-user retention needs a product policy and implementation. **ARCHITECTURE-LEVEL — route through Conrad/EXPO.**
- **VERIFIED:** Public registration exists; email verification, password recovery, and comprehensive per-user spend/abuse controls for external bridges are not implemented. Establish the launch access model and keep paid integrations unavailable to untrusted accounts until controls are approved and tested.
- **VERIFIED:** Reminder times are interpreted as UTC; events do not store an IANA time zone. Local-time reminders require an explicit scheduling/time-zone policy and implementation.
- **UNVERIFIED:** Live Render configuration, customer data quality, off-service backup/restore, provider delivery, browser/media behavior, and capacity. No production deployment or customer-data migration was performed.
