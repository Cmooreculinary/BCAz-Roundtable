"""
Phase 4 'Depth & Devotion' Backend Tests
- Purpose-based starter templates (auto-seed events + items on table create)
- Recurring events (weekly/monthly with 90-day expansion)
- Reactions on shared items (praying/amen/heart/thanks)
- Prayer Wall endpoint (GET /prayers)
"""
import pytest
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, TEST_PASSWORD, TEST_USER_PASSWORD, BASE_URL
import requests
import os
import time
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ============ FIXTURES ============

@pytest.fixture(scope="module")
def session():
    """Shared requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_auth(session):
    """Login as admin and return session with cookies"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return session


@pytest.fixture(scope="module")
def second_user_session():
    """Create and login a second user for multi-user tests"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    
    # Try to register, if already exists, login
    email = "phase4_test_user@roundtable.app"
    password = TEST_PASSWORD
    
    resp = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": password,
        "name": "Phase4 Test User"
    })
    if resp.status_code == 409:  # Already exists
        resp = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
    
    assert resp.status_code == 200, f"Second user auth failed: {resp.text}"
    return s


# ============ PURPOSE-BASED TEMPLATES ============

class TestPurposeTemplates:
    """Test auto-seeding of events + items when creating tables with different purposes"""
    
    def test_bible_study_template_seeds_event_and_items(self, admin_auth):
        """POST /api/tables with purpose='bible_study' auto-seeds: 
        - 1 'Weekly Bible Study' recurring weekly event
        - 1 prayer item 'Our prayer list'
        - 1 intention 'This week's focus verse'
        """
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Bible_Study_Template",
            "color": "#AF52DE",
            "purpose": "bible_study"
        })
        assert resp.status_code == 200, f"Create table failed: {resp.text}"
        table = resp.json()
        
        # Verify table created with correct purpose
        assert table["purpose"] == "bible_study"
        
        # Check seeded events
        events = table.get("events", [])
        weekly_bible_study = [e for e in events if "Bible Study" in e.get("title", "")]
        assert len(weekly_bible_study) >= 1, f"Expected 'Weekly Bible Study' event, got: {[e['title'] for e in events]}"
        assert weekly_bible_study[0]["recurring"] == "weekly"
        
        # Check seeded items
        items = table.get("items", [])
        prayer_items = [i for i in items if i.get("type") == "prayer"]
        intention_items = [i for i in items if i.get("type") == "intention"]
        
        assert len(prayer_items) >= 1, f"Expected prayer item, got: {[i['name'] for i in items]}"
        assert len(intention_items) >= 1, f"Expected intention item, got: {[i['name'] for i in items]}"
        
        # Verify specific names
        prayer_names = [p["name"] for p in prayer_items]
        assert any("prayer list" in n.lower() for n in prayer_names), f"Expected 'Our prayer list', got: {prayer_names}"
        
        intention_names = [i["name"] for i in intention_items]
        assert any("focus verse" in n.lower() for n in intention_names), f"Expected 'focus verse', got: {intention_names}"
        
        # Cleanup
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_family_template_seeds_event_and_intention(self, admin_auth):
        """POST /api/tables with purpose='family' auto-seeds:
        - 'Family Dinner' recurring weekly event
        - 'What we're grateful for this week' intention
        """
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Family_Template",
            "color": "#FF9500",
            "purpose": "family"
        })
        assert resp.status_code == 200
        table = resp.json()
        
        assert table["purpose"] == "family"
        
        events = table.get("events", [])
        family_dinner = [e for e in events if "Family Dinner" in e.get("title", "")]
        assert len(family_dinner) >= 1, f"Expected 'Family Dinner' event, got: {[e['title'] for e in events]}"
        assert family_dinner[0]["recurring"] == "weekly"
        
        items = table.get("items", [])
        grateful_items = [i for i in items if "grateful" in i.get("name", "").lower()]
        assert len(grateful_items) >= 1, f"Expected 'grateful' intention, got: {[i['name'] for i in items]}"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_community_template_seeds_monthly_event_and_note(self, admin_auth):
        """POST /api/tables with purpose='community' seeds:
        - 'Monthly Potluck' recurring monthly event
        - 'Community announcements' note
        """
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Community_Template",
            "color": "#34C759",
            "purpose": "community"
        })
        assert resp.status_code == 200
        table = resp.json()
        
        assert table["purpose"] == "community"
        
        events = table.get("events", [])
        potluck = [e for e in events if "Potluck" in e.get("title", "")]
        assert len(potluck) >= 1, f"Expected 'Monthly Potluck' event, got: {[e['title'] for e in events]}"
        assert potluck[0]["recurring"] == "monthly"
        
        items = table.get("items", [])
        announcements = [i for i in items if "announcement" in i.get("name", "").lower()]
        assert len(announcements) >= 1, f"Expected 'announcements' note, got: {[i['name'] for i in items]}"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_friends_template_seeds_weekly_hangout(self, admin_auth):
        """POST /api/tables with purpose='friends' seeds 'Saturday Hangout' weekly"""
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Friends_Template",
            "color": "#007AFF",
            "purpose": "friends"
        })
        assert resp.status_code == 200
        table = resp.json()
        
        assert table["purpose"] == "friends"
        
        events = table.get("events", [])
        hangout = [e for e in events if "Hangout" in e.get("title", "")]
        assert len(hangout) >= 1, f"Expected 'Saturday Hangout' event, got: {[e['title'] for e in events]}"
        assert hangout[0]["recurring"] == "weekly"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_work_template_seeds_weekly_sync(self, admin_auth):
        """POST /api/tables with purpose='work' seeds 'Weekly Sync'"""
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Work_Template",
            "color": "#5856D6",
            "purpose": "work"
        })
        assert resp.status_code == 200
        table = resp.json()
        
        assert table["purpose"] == "work"
        
        events = table.get("events", [])
        sync = [e for e in events if "Sync" in e.get("title", "")]
        assert len(sync) >= 1, f"Expected 'Weekly Sync' event, got: {[e['title'] for e in events]}"
        assert sync[0]["recurring"] == "weekly"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_other_purpose_seeds_nothing(self, admin_auth):
        """POST /api/tables with purpose='other' seeds nothing"""
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Other_Template",
            "color": "#8E8E93",
            "purpose": "other"
        })
        assert resp.status_code == 200
        table = resp.json()
        
        assert table["purpose"] == "other"
        
        # Should have no seeded events or items
        events = table.get("events", [])
        items = table.get("items", [])
        
        assert len(events) == 0, f"Expected no events for 'other' purpose, got: {events}"
        assert len(items) == 0, f"Expected no items for 'other' purpose, got: {items}"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")


# ============ RECURRING EVENTS ============

class TestRecurringEvents:
    """Test recurring event creation and 90-day expansion"""
    
    def test_create_event_with_recurring_weekly(self, admin_auth):
        """POST /api/events accepts recurring='weekly' field"""
        today = datetime.now().strftime("%Y-%m-%d")
        resp = admin_auth.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Weekly_Event",
            "date": today,
            "time": "10:00",
            "recurring": "weekly"
        })
        assert resp.status_code == 200, f"Create event failed: {resp.text}"
        event = resp.json()
        
        assert event["recurring"] == "weekly"
        assert event["title"] == "TEST_Weekly_Event"
        
        # Cleanup
        admin_auth.delete(f"{BASE_URL}/api/events/{event['id']}")
    
    def test_create_event_with_recurring_monthly(self, admin_auth):
        """POST /api/events accepts recurring='monthly' field"""
        today = datetime.now().strftime("%Y-%m-%d")
        resp = admin_auth.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Monthly_Event",
            "date": today,
            "time": "14:00",
            "recurring": "monthly"
        })
        assert resp.status_code == 200
        event = resp.json()
        
        assert event["recurring"] == "monthly"
        
        admin_auth.delete(f"{BASE_URL}/api/events/{event['id']}")
    
    def test_create_event_with_recurring_none_default(self, admin_auth):
        """POST /api/events defaults recurring to 'none'"""
        today = datetime.now().strftime("%Y-%m-%d")
        resp = admin_auth.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_NonRecurring_Event",
            "date": today,
            "time": "16:00"
        })
        assert resp.status_code == 200
        event = resp.json()
        
        assert event.get("recurring", "none") == "none"
        
        admin_auth.delete(f"{BASE_URL}/api/events/{event['id']}")
    
    def test_get_events_expands_weekly_recurring(self, admin_auth):
        """GET /api/events expands weekly recurring events into ~12-13 instances over 90 days"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Create a weekly recurring event
        resp = admin_auth.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Weekly_Expansion",
            "date": today,
            "time": "09:00",
            "recurring": "weekly"
        })
        assert resp.status_code == 200
        event = resp.json()
        event_id = event["id"]
        
        # Get all events - should include expanded instances
        resp = admin_auth.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200
        all_events = resp.json()
        
        # Filter for our test event and its virtual instances
        our_events = [e for e in all_events if e["id"] == event_id or e.get("_parent_id") == event_id]
        
        # Should have base + ~12 weekly instances (90 days / 7 days = ~12-13)
        assert len(our_events) >= 10, f"Expected ~12-13 weekly instances, got {len(our_events)}"
        
        # Check virtual instances have correct markers
        virtual_instances = [e for e in our_events if e.get("_virtual") == True]
        assert len(virtual_instances) >= 9, f"Expected virtual instances, got {len(virtual_instances)}"
        
        # Check id suffix pattern ::rN
        for v in virtual_instances:
            assert "::r" in v["id"], f"Virtual instance should have ::rN suffix, got: {v['id']}"
            assert v.get("_parent_id") == event_id
        
        # Cleanup
        admin_auth.delete(f"{BASE_URL}/api/events/{event_id}")
    
    def test_get_events_expands_monthly_recurring(self, admin_auth):
        """GET /api/events expands monthly recurring events into ~3 instances over 90 days"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        resp = admin_auth.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Monthly_Expansion",
            "date": today,
            "time": "11:00",
            "recurring": "monthly"
        })
        assert resp.status_code == 200
        event = resp.json()
        event_id = event["id"]
        
        resp = admin_auth.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200
        all_events = resp.json()
        
        our_events = [e for e in all_events if e["id"] == event_id or e.get("_parent_id") == event_id]
        
        # Should have base + ~2-3 monthly instances (90 days / 30 days = ~3)
        assert len(our_events) >= 2, f"Expected ~3 monthly instances, got {len(our_events)}"
        assert len(our_events) <= 5, f"Expected ~3 monthly instances, got {len(our_events)}"
        
        admin_auth.delete(f"{BASE_URL}/api/events/{event_id}")
    
    def test_non_recurring_events_pass_through_unchanged(self, admin_auth):
        """Non-recurring events pass through GET /api/events unchanged"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        resp = admin_auth.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Single_Event",
            "date": today,
            "time": "15:00",
            "recurring": "none"
        })
        assert resp.status_code == 200
        event = resp.json()
        event_id = event["id"]
        
        resp = admin_auth.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200
        all_events = resp.json()
        
        our_events = [e for e in all_events if e["id"] == event_id]
        
        # Should have exactly 1 instance (no expansion)
        assert len(our_events) == 1, f"Expected 1 non-recurring event, got {len(our_events)}"
        assert our_events[0].get("_virtual") != True
        
        admin_auth.delete(f"{BASE_URL}/api/events/{event_id}")


# ============ REACTIONS ============

class TestReactions:
    """Test reaction system on shared items"""
    
    @pytest.fixture
    def test_table_with_item(self, admin_auth):
        """Create a table with a prayer item for reaction tests"""
        # Create table
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Reaction_Table",
            "color": "#AF52DE",
            "purpose": "other"
        })
        assert resp.status_code == 200
        table = resp.json()
        
        # Create prayer item
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "prayer",
            "name": "TEST_Prayer_For_Reactions"
        })
        assert resp.status_code == 200
        item = resp.json()
        
        yield {"table": table, "item": item}
        
        # Cleanup
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_new_item_initializes_reactions(self, admin_auth):
        """POST /api/tables/{id}/items initializes reactions={praying:[], amen:[], heart:[], thanks:[]}"""
        # Create table
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Reactions_Init",
            "color": "#007AFF",
            "purpose": "other"
        })
        table = resp.json()
        
        # Create item
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "prayer",
            "name": "TEST_Prayer_Init_Reactions"
        })
        assert resp.status_code == 200
        item = resp.json()
        
        # Verify reactions initialized
        assert "reactions" in item, "Item should have reactions field"
        reactions = item["reactions"]
        assert reactions.get("praying") == [], f"Expected empty praying array, got: {reactions.get('praying')}"
        assert reactions.get("amen") == [], f"Expected empty amen array, got: {reactions.get('amen')}"
        assert reactions.get("heart") == [], f"Expected empty heart array, got: {reactions.get('heart')}"
        assert reactions.get("thanks") == [], f"Expected empty thanks array, got: {reactions.get('thanks')}"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_react_adds_user_to_reaction_array(self, admin_auth, test_table_with_item):
        """POST /api/tables/{id}/items/{item_id}/react with {type:'praying'} adds user's id to reactions.praying"""
        table = test_table_with_item["table"]
        item = test_table_with_item["item"]
        
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items/{item['id']}/react", json={
            "type": "praying"
        })
        assert resp.status_code == 200, f"React failed: {resp.text}"
        data = resp.json()
        
        assert data["ok"] == True
        assert data["action"] == "added"
        assert "reactions" in data
        assert len(data["reactions"]["praying"]) == 1
    
    def test_react_toggle_removes_user(self, admin_auth, test_table_with_item):
        """POST /react same type again removes user (toggle behavior)"""
        table = test_table_with_item["table"]
        item = test_table_with_item["item"]
        
        # First reaction - add
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items/{item['id']}/react", json={
            "type": "amen"
        })
        assert resp.status_code == 200
        assert resp.json()["action"] == "added"
        
        # Second reaction - remove (toggle)
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items/{item['id']}/react", json={
            "type": "amen"
        })
        assert resp.status_code == 200
        data = resp.json()
        
        assert data["action"] == "removed"
        assert len(data["reactions"]["amen"]) == 0
    
    def test_react_invalid_type_returns_422(self, admin_auth, test_table_with_item):
        """POST /react with invalid type (e.g. 'love') returns 422 validation error"""
        table = test_table_with_item["table"]
        item = test_table_with_item["item"]
        
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items/{item['id']}/react", json={
            "type": "love"  # Invalid type
        })
        assert resp.status_code == 422, f"Expected 422 for invalid type, got {resp.status_code}"
    
    def test_react_requires_membership(self, admin_auth, second_user_session):
        """POST /react requires membership (403 for non-members)"""
        # Create table as admin
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_React_Membership",
            "color": "#FF3B30",
            "purpose": "other"
        })
        table = resp.json()
        
        # Create item
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "prayer",
            "name": "TEST_Prayer_Membership"
        })
        item = resp.json()
        
        # Try to react as non-member
        resp = second_user_session.post(f"{BASE_URL}/api/tables/{table['id']}/items/{item['id']}/react", json={
            "type": "praying"
        })
        assert resp.status_code == 403, f"Expected 403 for non-member, got {resp.status_code}"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_react_all_four_types(self, admin_auth, test_table_with_item):
        """Test all four reaction types work: praying, amen, heart, thanks"""
        table = test_table_with_item["table"]
        item = test_table_with_item["item"]
        
        for reaction_type in ["praying", "amen", "heart", "thanks"]:
            resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items/{item['id']}/react", json={
                "type": reaction_type
            })
            assert resp.status_code == 200, f"React {reaction_type} failed: {resp.text}"
            assert resp.json()["action"] == "added"


# ============ PRAYER WALL ============

class TestPrayerWall:
    """Test GET /api/tables/{id}/prayers endpoint"""
    
    def test_prayers_returns_only_prayer_and_intention_items(self, admin_auth):
        """GET /api/tables/{id}/prayers returns only items with type in ('prayer','intention')"""
        # Create table
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Prayer_Wall",
            "color": "#AF52DE",
            "purpose": "other"
        })
        table = resp.json()
        
        # Create various item types
        admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "prayer", "name": "TEST_Prayer_1"
        })
        admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "intention", "name": "TEST_Intention_1"
        })
        admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "note", "name": "TEST_Note_1"
        })
        admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "photo", "name": "TEST_Photo_1"
        })
        
        # Get prayers
        resp = admin_auth.get(f"{BASE_URL}/api/tables/{table['id']}/prayers")
        assert resp.status_code == 200
        prayers = resp.json()
        
        # Should only have prayer and intention types
        assert len(prayers) == 2, f"Expected 2 prayer/intention items, got {len(prayers)}"
        types = [p["type"] for p in prayers]
        assert all(t in ["prayer", "intention"] for t in types), f"Got unexpected types: {types}"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_prayers_sorted_newest_first(self, admin_auth):
        """GET /api/tables/{id}/prayers sorted newest first"""
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Prayer_Sort",
            "color": "#AF52DE",
            "purpose": "other"
        })
        table = resp.json()
        
        # Create items with slight delay
        admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "prayer", "name": "TEST_First_Prayer"
        })
        time.sleep(0.1)
        admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "prayer", "name": "TEST_Second_Prayer"
        })
        
        resp = admin_auth.get(f"{BASE_URL}/api/tables/{table['id']}/prayers")
        prayers = resp.json()
        
        # Newest should be first
        assert prayers[0]["name"] == "TEST_Second_Prayer"
        assert prayers[1]["name"] == "TEST_First_Prayer"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_prayers_requires_membership(self, admin_auth, second_user_session):
        """GET /api/tables/{id}/prayers requires membership (403 for non-members)"""
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Prayer_Membership",
            "color": "#AF52DE",
            "purpose": "other"
        })
        table = resp.json()
        
        # Try to get prayers as non-member
        resp = second_user_session.get(f"{BASE_URL}/api/tables/{table['id']}/prayers")
        assert resp.status_code == 403, f"Expected 403 for non-member, got {resp.status_code}"
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
    
    def test_prayers_hydrates_reactions_on_old_items(self, admin_auth):
        """GET /api/tables/{id}/prayers hydrates reactions field on items"""
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Prayer_Hydrate",
            "color": "#AF52DE",
            "purpose": "other"
        })
        table = resp.json()
        
        admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/items", json={
            "type": "prayer", "name": "TEST_Prayer_Hydrate"
        })
        
        resp = admin_auth.get(f"{BASE_URL}/api/tables/{table['id']}/prayers")
        prayers = resp.json()
        
        # All items should have reactions field
        for p in prayers:
            assert "reactions" in p, f"Item missing reactions field: {p}"
            assert "praying" in p["reactions"]
            assert "amen" in p["reactions"]
            assert "heart" in p["reactions"]
            assert "thanks" in p["reactions"]
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")


# ============ REGRESSION TESTS ============

class TestPhase123Regression:
    """Verify Phase 1/2/3 endpoints still work"""
    
    def test_auth_login(self, session):
        """Auth login still works"""
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200
    
    def test_tables_crud(self, admin_auth):
        """Tables CRUD still works"""
        # Create
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_Regression_Table",
            "color": "#007AFF"
        })
        assert resp.status_code == 200
        table = resp.json()
        
        # Read
        resp = admin_auth.get(f"{BASE_URL}/api/tables/{table['id']}")
        assert resp.status_code == 200
        
        # Update
        resp = admin_auth.put(f"{BASE_URL}/api/tables/{table['id']}", json={
            "name": "TEST_Regression_Updated"
        })
        assert resp.status_code == 200
        
        # Delete
        resp = admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")
        assert resp.status_code == 200
    
    def test_messages_endpoint(self, admin_auth):
        """Messages endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/messages")
        assert resp.status_code == 200
    
    def test_emails_endpoint(self, admin_auth):
        """Emails endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/emails?folder=inbox")
        assert resp.status_code == 200
    
    def test_texts_endpoint(self, admin_auth):
        """Texts endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/texts")
        assert resp.status_code == 200
    
    def test_events_endpoint(self, admin_auth):
        """Events endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200
    
    def test_notifications_endpoint(self, admin_auth):
        """Notifications endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200
    
    def test_invites_endpoint(self, admin_auth):
        """Invites endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/invites")
        assert resp.status_code == 200
    
    def test_contacts_endpoint(self, admin_auth):
        """Contacts endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200
    
    def test_referrals_endpoint(self, admin_auth):
        """Referrals endpoint still works"""
        resp = admin_auth.get(f"{BASE_URL}/api/referrals")
        assert resp.status_code == 200
    
    def test_public_invite_preview(self, session):
        """Public invite preview still works (Phase 3)"""
        # This may 404 if no invites exist, which is fine
        resp = session.get(f"{BASE_URL}/api/invites/preview/INVALID123")
        assert resp.status_code in [404, 410]  # Not found or expired is expected
    
    def test_ai_suggest_events(self, admin_auth):
        """AI suggest events still works (Phase 3)"""
        # Create a table first
        resp = admin_auth.post(f"{BASE_URL}/api/tables", json={
            "name": "TEST_AI_Regression",
            "color": "#007AFF",
            "purpose": "bible_study"
        })
        table = resp.json()
        
        resp = admin_auth.post(f"{BASE_URL}/api/tables/{table['id']}/suggest-events")
        # Should return 200 even if AI fails (graceful degradation)
        assert resp.status_code == 200
        
        admin_auth.delete(f"{BASE_URL}/api/tables/{table['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
