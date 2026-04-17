import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import TitleBar from "../components/rt/TitleBar";
import Sidebar from "../components/rt/Sidebar";
import Dock from "../components/rt/Dock";
import Portal from "../views/Portal";
import TableView from "../views/TableView";
import Communications from "../views/Communications";
import CalendarView from "../views/CalendarView";
import AppsView from "../views/AppsView";
import ContactsView from "../views/ContactsView";
import InvitesView from "../views/InvitesView";
import NotificationsView from "../views/NotificationsView";
import MessagesView from "../views/MessagesView";
import WalkieView from "../views/WalkieView";
import Settings from "./Settings";
import CreateTableModal from "../components/modals/CreateTableModal";
import NewEventModal from "../components/modals/NewEventModal";
import AddContactModal from "../components/modals/AddContactModal";
import ShareItemModal from "../components/modals/ShareItemModal";
import InviteModal from "../components/modals/InviteModal";
import VideoCallOverlay from "../components/modals/VideoCallOverlay";
import PingToast from "../components/PingToast";
import IncomingCallToast from "../components/IncomingCallToast";
import BadgeUnlock from "../components/BadgeUnlock";
import { api } from "../lib/api";
import { useWebSocket, useRTEvent } from "../lib/realtime";
import { subscribeToPush, isPushSupported, getPushPermission } from "../lib/push";

const BADGE_THRESHOLDS = [1, 3, 10, 25];

export default function MainShell() {
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [tables, setTables] = useState([]);
  const [activeTableId, setActiveTableId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [ping, setPing] = useState(null);
  const [badge, setBadge] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modals, setModals] = useState({
    createTable: false, newEvent: false, addContact: false,
    shareItem: false, invite: false, videoCall: false,
  });
  const [modalProps, setModalProps] = useState({});

  // Activate WebSocket
  useWebSocket(true);

  // Auto-subscribe to push if previously granted
  useEffect(() => {
    if (isPushSupported() && getPushPermission() === "granted") {
      subscribeToPush().catch(() => {});
    }
  }, []);

  const openModal = (name, props = {}) => { setModalProps(props); setModals((m) => ({ ...m, [name]: true })); };
  const closeModal = (name) => setModals((m) => ({ ...m, [name]: false }));

  const loadTables = useCallback(async () => {
    try {
      const { data } = await api.get("/tables");
      setTables(data);
      if (data.length && !activeTableId) setActiveTableId(data[0].id);
    } catch { /* ignore */ }
  }, [activeTableId]);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadTables();
    loadNotifications();
    // Less frequent fallback polling now that WS handles live updates
    const int = setInterval(loadNotifications, 60000);
    return () => clearInterval(int);
  }, [loadTables, loadNotifications]);

  // Listen for live events
  useRTEvent((evt) => {
    if (!evt || !evt.type) return;
    switch (evt.type) {
      case "walkie_ping":
        setPing(evt.notification);
        setNotifications((n) => [evt.notification, ...n]);
        break;
      case "call_incoming":
        setIncomingCall(evt);
        break;
      case "presence":
      case "user_updated":
        loadTables();
        break;
      case "item_added":
        loadTables();
        break;
      case "referral_joined": {
        const total = evt.joined_total || 0;
        if (BADGE_THRESHOLDS.includes(total)) {
          setBadge({ tier_count: total, joined_total: total, invitee_name: evt.invitee_name });
        }
        loadNotifications();
        break;
      }
      case "message":
      case "text":
        loadNotifications();
        break;
      default:
        break;
    }
  }, [loadTables, loadNotifications]);

  // Keyboard: Escape dismisses overlays
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") {
        setModals({ createTable: false, newEvent: false, addContact: false, shareItem: false, invite: false, videoCall: false });
        setPing(null);
        setBadge(null);
        setIncomingCall(null);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Close sidebar on navigation (mobile)
  useEffect(() => { setSidebarOpen(false); }, [loc.pathname]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const setActiveTable = async (id) => {
    setActiveTableId(id);
    nav(`/table/${id}`);
  };

  const answerPing = () => {
    const p = ping;
    setPing(null);
    if (p?.from_user) {
      const member = (tables.flatMap((t) => t.members || [])).find((m) => m.id === p.from_user);
      openModal("videoCall", { target: member || { id: p.from_user, name: p.from_name, color: p.from_color, initials: p.from_initials } });
    }
  };

  const answerIncomingCall = () => {
    const call = incomingCall;
    setIncomingCall(null);
    if (call) {
      openModal("videoCall", {
        incomingCallId: call.call_id,
        callType: call.call_type,
        target: call.caller,
      });
    }
  };

  const declineIncomingCall = () => {
    setIncomingCall(null);
  };

  return (
    <div className="app-root">
      <TitleBar
        notificationsCount={unreadCount}
        onOpenNotifications={() => nav("/notifications")}
        onOpenSettings={() => nav("/settings")}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="app-body">
        <Sidebar
          tables={tables}
          activeTableId={activeTableId}
          currentPath={loc.pathname}
          onNav={(p) => nav(p)}
          onSelectTable={setActiveTable}
          onCreateTable={() => openModal("createTable")}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <main className="main-content" data-testid="main-content">
          <Routes>
            <Route path="/" element={<Portal tables={tables} notifications={notifications} onOpenInvite={() => openModal("invite", { tables })} onOpenShare={() => openModal("shareItem", { tables })} onCreateTable={() => openModal("createTable")} onNewEvent={() => openModal("newEvent", { tables })} onGoto={nav} />} />
            <Route path="/table/:id" element={<TableView onShare={(table) => openModal("shareItem", { tables, defaultTable: table })} onInvite={(table) => openModal("invite", { tables, defaultTable: table })} onVideoCall={(target) => openModal("videoCall", { target })} />} />
            <Route path="/messages" element={<Communications tables={tables} onVideoCall={(target) => openModal("videoCall", { target })} />} />
            <Route path="/messages/full" element={<MessagesView onVideoCall={(target) => openModal("videoCall", { target })} />} />
            <Route path="/walkie" element={<WalkieView onVideoCall={(target) => openModal("videoCall", { target })} />} />
            <Route path="/calendar" element={<CalendarView onNew={() => openModal("newEvent", { tables })} tables={tables} />} />
            <Route path="/apps" element={<AppsView />} />
            <Route path="/contacts" element={<ContactsView onAdd={() => openModal("addContact")} onInvite={() => openModal("invite", { tables })} />} />
            <Route path="/invites" element={<InvitesView tables={tables} onOpenInvite={() => openModal("invite", { tables })} />} />
            <Route path="/notifications" element={<NotificationsView notifications={notifications} onRefresh={loadNotifications} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      <Dock currentPath={loc.pathname} onNav={nav} unreadCount={unreadCount} />

      {modals.createTable && <CreateTableModal onClose={() => closeModal("createTable")} onCreated={() => { loadTables(); closeModal("createTable"); }} />}
      {modals.newEvent && <NewEventModal tables={modalProps.tables || tables} onClose={() => closeModal("newEvent")} onCreated={() => closeModal("newEvent")} />}
      {modals.addContact && <AddContactModal onClose={() => closeModal("addContact")} onCreated={() => closeModal("addContact")} />}
      {modals.shareItem && <ShareItemModal tables={modalProps.tables || tables} defaultTable={modalProps.defaultTable} onClose={() => closeModal("shareItem")} onShared={() => { closeModal("shareItem"); loadTables(); }} />}
      {modals.invite && <InviteModal tables={modalProps.tables || tables} defaultTable={modalProps.defaultTable} onClose={() => closeModal("invite")} />}
      {modals.videoCall && <VideoCallOverlay target={modalProps.target} incomingCallId={modalProps.incomingCallId} callType={modalProps.callType} onClose={() => closeModal("videoCall")} />}

      <PingToast ping={ping} onAnswer={answerPing} onDismiss={() => setPing(null)} />
      <IncomingCallToast call={incomingCall} onAnswer={answerIncomingCall} onDecline={declineIncomingCall} />
      <BadgeUnlock unlock={badge} onClose={() => setBadge(null)} />
    </div>
  );
}
