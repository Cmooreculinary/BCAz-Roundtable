# BCAz Roundtable — Superagent User Audit

**Audit date:** 2026-07-21  
**Target:** `main` at `da3c3704bd3cb3918eaae9af7706d4c1f9439f2a`  
**Repair branch:** `agent/superagent-user-audit`

## Audit boundary

This review inspected the current route map, primary navigation, portal, table room, communications, messages, calendar, contacts, apps, invites, notifications, walkie talkie, call history, Gather Experience, scene catalog, public room/table assets, and modal entry wiring.

The review was source-backed. The execution environment could not clone the repository or open the Render deployment because outbound DNS was unavailable. The latest `main` commit also had no attached GitHub Actions run or combined status at audit time. New regression tests were added, but this report does not claim they were executed locally.

## Verified asset inventory

All scene paths exported by `frontend/src/lib/scenes.js` resolve to GitHub blobs:

### Room backgrounds

- `coastal-bay.webp`
- `family-dining.webp`
- `fireside-library.webp`
- `garden-terrace.webp`
- `mountain-lodge.webp`
- `skyline-suite.webp`

All six room images are 1600 × 900 WebP files.

### Table assets

- `black-round.png`
- `executive-board.png`
- `farmhouse-long.png`
- `formal-oval.png`
- `mahogany-round.png`
- `strategy-round.png`

All six table paths resolve to binary GitHub blobs. Verified dimensions include 1536 × 1024 for the executive, farmhouse, and formal assets; 1024 × 1024 for mahogany; and 1402 × 1122 for strategy. The components use `object-fit: contain` for table assets and `background-size: cover` for room images, which is correct in principle. Fixed-stage mobile geometry remains a separate placement defect below.

## Repairs completed on the audit branch

### Navigation and accessibility

- Corrected the Dock Email shortcut from `/messages` to the existing `/communications` route.
- Converted Dock and Sidebar navigation targets from clickable `div` elements to real buttons.
- Added current-page and accessible-label state.
- Closed the mobile Sidebar immediately after a route or table selection.
- Added narrow-screen horizontal containment for the ten-item Dock.

### Calendar

- Made calendar day cells open the event flow, matching the existing help text.
- Replaced UTC-derived “today” logic with a local calendar date key.
- Converted event delete affordances into labeled buttons.
- Added API failure handling for event load and delete.
- Added horizontal containment for the seven-column calendar on phones.

### Apps catalog

- Removed deceptive pointer behavior from cards that had no action.
- Labeled the page and cards as integration previews rather than functioning launch buttons.

### Notifications

- Grouped header actions for narrow-screen alignment.
- Prevented duplicate requests while an action is running.
- Added API failure handling and hid “Mark all read” when nothing is unread.

### Walkie Talkie

- Prevented microphone transmission after a failed room join.
- Prevented microphone transmission when the user releases before an asynchronous room join completes.
- Added pointer-cancel handling and explicit audio/talk-state shutdown.
- Closed active call/audio state on exit and component unmount.
- Removed the dead close-handler fallback.
- Made member selection keyboard accessible.

### Regression coverage added

- `frontend/src/components/rt/Dock.test.jsx`
- `frontend/src/views/CalendarView.test.jsx`
- `frontend/src/views/WalkieView.test.jsx`

## Remaining verified defects

### High priority

1. **Round table mobile clipping** — `RoundTableViz.jsx` calculates seats against a fixed 580px coordinate system. The existing mobile CSS targets `.rt-stage` and `.rt-table`, but the component does not use those classes. Seats, labels, and pending invites can overflow narrow screens.
2. **Gather Experience is not responsive** — the top navigation, Room Builder, Avatar Seating, preview panel, and several control rows use fixed inline grid widths that cannot be corrected safely from CSS alone.
3. **Gather demo presents inert controls as active** — the right-side Chat/Voice/Files/Calendar/Menu/Notes/AI/Invite controls, Save Gathering, and End Gathering have no handlers. Because the page identifies itself as a visual prototype, these should be disabled and labeled or wired to explicit demo behavior.
4. **Communications and Messages use fixed desktop split panes** — 260px/340px sidebars plus content panes do not collapse into a mobile conversation flow.
5. **Portal event deletion refreshes the wrong dataset** — deleting a portal event calls `loadTables()` instead of reloading events, leaving stale event UI.
6. **Portal setup reminder has an inert “Create your first table” action** — its route is `null`, so the button performs no action.
7. **Table video call can receive an undefined target** when the table has no other member.
8. **Table upcoming-events panel can render blank** when the table has events but all of them are in the past.
9. **Table load failure has no terminal error state** and can leave the user on an indefinite loading screen.
10. **Contacts member Chat button is inert** and does not navigate or open a conversation.
11. **Messages attachment button is inert** and is presented as enabled.

### Medium priority

1. Gather simulated chat entries do not have stable IDs, but rendering uses `key={message.id}`.
2. Several tabs and cards remain mouse-only clickable `div` elements, including Table tabs, Communications tabs, Portal communications tabs, and call-history rows.
3. Several destructive actions lack confirmation and/or API error handling.
4. UTC date keys remain in Portal, Table View, and New Event defaults and can be one day wrong near local midnight.
5. Communications email/text operations contain unhandled async failures.
6. Title-bar icon buttons need explicit `aria-label` values.
7. Modal dialog semantics and focus trapping are inconsistent across the modal set.
8. Live Gather and RoundTable overlays can collide with chat, AI summary, tool rails, and seat labels at reduced widths.

## Architecture-level item

The Gather Experience contains hard-coded subscription prices and tiers. No pricing changes were made.

**ARCHITECTURE-LEVEL — route through Conrad/EXPO before changing pricing, tier names, limits, or product promises.**

## Recommended next execution order

1. Rebuild `RoundTableViz` around a responsive coordinate transform and add viewport tests at 320, 375, 768, 1024, and 1440 widths.
2. Extract Gather Experience inline layout rules into responsive classes and explicitly disable or wire every demo control.
3. Convert Communications and Messages to mobile master/detail navigation.
4. Repair Portal, Table View, Contacts, and remaining destructive-action error paths.
5. Run the complete frontend test/build gate and backend suite, then perform real browser passes in Chrome, Safari, Firefox, iPhone-size, and Android-size viewports.
