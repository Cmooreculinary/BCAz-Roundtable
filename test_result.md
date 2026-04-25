#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Iteration 18 — Scenes, Seats & Avatars.
  Graft the persistent scene architecture from the standalone /gather demo onto real /table/:id
  pages. Persist scene config (room/table/tabletop/food/ambiance/music) on the Table document,
  add fixed seat slots per table type with claim/leave endpoints, broadcast scene + seat changes
  over WebSocket, and reserve namespace for `premium_illustrated` + `photoreal` avatar tiers
  (no UI ships for those — only the enum value, optional User field, and a Settings indicator).

backend:
  - task: "Scene fields persisted on Table"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Added SceneIn pydantic model (room/table/tabletop/food/ambiance/music as Literals matching lib/scenes.js IDs). TableIn and TableUpdateIn now accept optional `scene`. POST /api/tables applies DEFAULT_SCENE (library/mahogany/meeting/none/warm/off) when omitted. PUT /api/tables/{id} broadcasts table_scene_updated over WebSocket on change. Legacy tables without a scene field read DEFAULT_SCENE on GET. Verified via 6 dedicated pytest cases — all green."
  - task: "Seat assignments — claim/leave/auto + WebSocket broadcast"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "New collection `table_seats` with unique indices on (table_id,seat_index) and (table_id,user_id) — guarantees one seat per slot and one seat per user per table. Endpoints: GET /api/tables/{id}/seats, POST /api/tables/{id}/seats/claim (seat_index optional — auto-assigns first free), DELETE /api/tables/{id}/seats/mine. Seat counts come from SEAT_COUNTS (mahogany 8, executive 10, family 6, drafting 8, luncheon 6, strategy 12). Out-of-range seat_index → 400; taken seat → 409. Every change broadcasts table_seats_updated to all table members. Re-claiming moves the user. Cleaned up on table delete. 7 pytest cases passing."
  - task: "Avatar tier namespace reservation on User"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "UserUpdateIn now accepts `avatar_tier` Literal of (preset|stylized|premium_illustrated|photoreal). user_public exposes the field with default 'stylized'. The premium_illustrated and photoreal tiers are storable but ship NO UI — namespace reserved for Iterations 20/21 per Anchor 3. Validation rejects unknown values with 422. 4 pytest cases passing."

frontend:
  - task: "Shared scene catalog (lib/scenes.js)"
    implemented: true
    working: true
    file: "frontend/src/lib/scenes.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Single source of truth for ROOMS, TABLES, TABLETOPS, FOODS, AMBIANCES, MUSICS, SEAT_COUNTS, DEFAULT_SCENE, AVATAR_TIERS. Exports resolveScene() to look up display data by ID and seatCountForTable(). Original demo array order preserved so /gather demo's ROOMS[0] / AMBIANCES[1] / TABLETOPS[3] / FOODS[6] / MUSICS[1] indices still resolve to the same items — anchor: standalone demo must work identically."
  - task: "GatherExperience refactor to share lib/scenes.js"
    implemented: true
    working: true
    file: "frontend/src/views/GatherExperience.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Removed inline ROOMS/TABLES/TABLETOPS/FOODS/AMBIANCES/MUSICS arrays — imports from ../lib/scenes. Demo behavior unchanged: auto-start picks ROOMS[0]=Skyline / TABLES[0]=Mahogany / TABLETOPS[3]=Formal / FOODS[6]=Chef / AMBIANCES[1]=Warm / MUSICS[1]=Soft Jazz, exactly as before. Build passes. Anchor: /gather demo still works identically."
  - task: "RoundTableViz upgraded to render scene + fixed seat slots"
    implemented: true
    working: true
    file: "frontend/src/components/rt/RoundTableViz.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Full rewrite. Now renders: room gradient background + ambiance overlay; wood-grain round table at center sized by table type; N dashed-outline seat slots arranged radially where N=SEAT_COUNTS[scene.table]; scene chips top-left (Room · Ambiance · Music · Food); LIVE/DORMANT badge top-right; member portraits (DiceBear via UserAvatar) appear when seats are claimed; user's own seat is highlighted with gold ring; click empty seat → onClaimSeat(idx); click own seat → onLeaveSeat. Member name labels under occupied seats. Verified visually — screenshot shows 8 dashed slots numbered 1–8 around mahogany table with Fireside Library backdrop."
  - task: "SceneEditorModal + inline SceneEditor"
    implemented: true
    working: true
    file: "frontend/src/components/modals/SceneEditorModal.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Two exports: <SceneEditor> controlled (used inline inside CreateTableModal — emits onChange on every selection) and <SceneEditorModal> default uncontrolled (full modal with Save/Cancel — used by TableView 'Edit Scene'). Live preview strip at top shows room/table/tabletop/ambiance compositing. Card grids for Room and Table (with seat-count badge), tabletop card grid, and pill columns for Food / Ambiance / Music. data-testid coverage: scene-room-*, scene-table-*, scene-tabletop-*, scene-food-*, scene-ambiance-*, scene-music-*, scene-editor-save."
  - task: "CreateTableModal — collapsible 'Customize scene (optional)'"
    implemented: true
    working: true
    file: "frontend/src/components/modals/CreateTableModal.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Added a collapsible section labeled 'Customize scene (optional)' with default DEFAULT_SCENE pre-selected (library/mahogany/meeting/none/warm/off). Toggle shows 'Defaults' or 'Customized' text. When expanded, embeds <SceneEditor> controlled body. Scene state shipped in POST /api/tables payload. data-testid: create-table-scene-toggle."
  - task: "TableView — Edit Scene + seat claim/leave + WS sync"
    implemented: true
    working: true
    file: "frontend/src/views/TableView.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Added 'Edit Scene' button in header (visible to owner only). Wires onClaimSeat/onLeaveSeat to /api/tables/:id/seats endpoints. Listens for table_scene_updated and table_seats_updated WebSocket events and updates local state (toast on scene change). Seats array carried alongside table state. data-testid: table-edit-scene-btn."
  - task: "Settings — Avatar Tier indicator (namespace reservation)"
    implemented: true
    working: true
    file: "frontend/src/pages/Settings.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "New 'Avatar Tier' card displays all 4 tiers (Preset / Stylized / Premium Illustrated / Photoreal). Stylized shown as 'Active' for current users (default). Premium Illustrated & Photoreal display lock icon + 'Coming soon' label — namespace only, NO upload/picker UI ships. Aligned with Anchor 3 + Anchor 4 (deferred to Iter 20 / 21)."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 18
  run_ui: false

test_plan:
  current_focus:
    - "Scene fields persisted on Table"
    - "Seat assignments — claim/leave/auto + WebSocket broadcast"
    - "Avatar tier namespace reservation on User"
    - "RoundTableViz upgraded to render scene + fixed seat slots"
    - "TableView — Edit Scene + seat claim/leave + WS sync"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Iteration 18 complete. Shipped:
          • Scene fields on Tables (room/table/tabletop/food/ambiance/music) with DEFAULT_SCENE for new and legacy tables.
          • table_seats collection with claim/leave/auto-claim endpoints and WebSocket broadcasts (table_scene_updated, table_seats_updated).
          • Real /table/:id pages now render the scene as a beautifully-lit room with wood-grain table at center and N dashed seat slots — seat count varies by table type per Anchor 2 (mahogany 8, executive 10, family 6, drafting 8, luncheon 6, strategy 12).
          • Standalone /gather demo refactored to share lib/scenes.js — array order preserved so all hard-coded indices still resolve correctly. Demo works identically.
          • SceneEditorModal: used both as full modal (Edit Scene from TableView) and inline (Customize scene optional in CreateTableModal).
          • Avatar tier namespace reserved on User (avatar_tier enum: preset|stylized|premium_illustrated|photoreal). Settings shows indicator card with the 2 deferred tiers locked + 'Coming soon'. NO Premium picker, NO upload pipeline, NO paywall — strictly namespace per Anchor 3.

        Backend tests: 17/17 passing in tests/test_iteration_18.py.
        Regression sweep: 101/106 passing across roundtable_api + phase3 + phase4 tests. The 5 failures are pre-existing issues unrelated to Iteration 18 — they hardcode invite code 'HO4IIE6D' which doesn't exist in the dev DB (stale test data from a prior session). My changes did not touch invite preview or AI suggest endpoints.

        Frontend self-test: smoke screenshots confirmed (login → portal → /table/:id) — wood-grain table, 8 dashed seat slots, scene chips, Edit Scene button all rendering as the acceptance criteria spell out. Frontend testing agent NOT run — preserving credits per founder protocol (opt-in).

        Path drift noted silently: primer referenced design_guidelines.md (repo has design_guidelines.json) and treated as canonical — code in index.css is the source of truth for the macOS look anyway.

        Branch: feature/scenes-seats-avatars (not yet pushed — founder uses Save to GitHub for write actions). PR title would be "Iteration 18 — Scenes, Seats & Avatars".
