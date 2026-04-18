import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import EmptyState from "../components/rt/EmptyState";
import HelpTip from "../components/rt/HelpTip";
import { Calendar, FileText, Users, Zap, Share2, Bell, Plus, UploadCloud, Mail, MessageSquare, Radio, ChevronRight, Award, Inbox, Send, Star, AlertCircle, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

export default function Portal({ tables, notifications, onOpenInvite, onOpenShare, onCreateTable, onNewEvent, onGoto }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [referrals, setReferrals] = useState({ invited: 0, joined: 0, badge: "No badge yet" });
  const [leaderboard, setLeaderboard] = useState([]);
  const [commsTab, setCommsTab] = useState("email");
  const [dismissedReminder, setDismissedReminder] = useState(false);

  useEffect(() => {
    api.get("/events").then((r) => setEvents(r.data || [])).catch(() => {});
    api.get("/referrals").then((r) => setReferrals(r.data || {})).catch(() => {});
    api.get("/referrals/leaderboard").then((r) => setLeaderboard(r.data || [])).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter((e) => e.date === today);
  const recentItems = tables.flatMap((t) => (t.items || []).slice(0, 2).map((i) => ({ ...i, tableName: t.name, tableColor: t.color })))
    .slice(0, 5);
  const liveTables = tables.filter((t) => t.active);
  const recentNotifications = notifications.slice(0, 4);

  const timeAgo = (iso) => {
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <HelpTip section="portal" text="This is your home base. All your comms, tables, and quick actions live here." />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Good {greeting()}, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-mute" style={{ fontSize: 14, margin: "4px 0 0" }}>
          {liveTables.length > 0 ? `${liveTables.length} table${liveTables.length !== 1 ? "s" : ""} live right now.` : "No tables are live. Start one to gather your people."}
        </p>
      </div>

      {/* Setup reminder banner */}
      <SetupReminder user={user} onGoto={onGoto} dismissed={dismissedReminder} onDismiss={() => setDismissedReminder(true)} />

      {/* Communications Hub */}
      <CommsHub />

      {/* Widgets grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 18 }}>
        {/* Today's Schedule */}
        <Widget title="Today's Schedule" icon={<Calendar size={14} />} action={<button className="btn btn-ghost" onClick={onNewEvent} data-testid="widget-new-event" style={{ padding: 3 }}><Plus size={14} /></button>}>
          {todayEvents.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0" }}>Nothing today. Enjoy the breathing room.</div>
          ) : todayEvents.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
              <span style={{ width: 4, height: 30, background: e.color || "#007AFF", borderRadius: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{e.time}</div>
              </div>
            </div>
          ))}
        </Widget>

        {/* Recent on Tables */}
        <Widget title="Recent on Tables" icon={<FileText size={14} />}>
          {recentItems.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0" }}>Nothing shared yet. Share something to get the table going.</div>
          ) : recentItems.map((it) => (
            <div key={it.id || it.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: it.tableColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{it.tableName} · {timeAgo(it.created_at)}</div>
              </div>
            </div>
          ))}
        </Widget>

        {/* My Tables */}
        <Widget title="My Tables" icon={<Users size={14} />} action={<button className="btn btn-ghost" onClick={onCreateTable} data-testid="widget-create-table" style={{ padding: 3 }}><Plus size={14} /></button>}>
          {tables.length === 0 ? (
            <EmptyState
              icon={<Users size={24} />}
              title="No tables yet"
              subtitle="Create your first one."
              action={<button className="btn btn-primary" onClick={onCreateTable} data-testid="portal-create-table-empty">Create Table</button>}
              testId="portal-tables-empty"
            />
          ) : tables.slice(0, 4).map((t) => (
            <div key={t.id} onClick={() => onGoto(`/table/${t.id}`)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }} data-testid={`portal-table-${t.id}`}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: t.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {(t.name[0] || "?").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  {t.active && <span className="live-badge-dot" />}
                  {t.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.member_count} member{t.member_count !== 1 ? "s" : ""} · {t.active ? `${t.active_count} on` : "dormant"}</div>
              </div>
              <ChevronRight size={14} color="var(--text-tertiary)" />
            </div>
          ))}
        </Widget>

        {/* Quick Actions */}
        <Widget title="Quick Actions" icon={<Zap size={14} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 4 }}>
            <QuickAct onClick={onOpenShare} icon={<UploadCloud size={14} />} label="Share Item" testId="qa-share" />
            <QuickAct onClick={onNewEvent} icon={<Calendar size={14} />} label="New Event" testId="qa-event" />
            <QuickAct onClick={onOpenInvite} icon={<Share2 size={14} />} label="Invite" testId="qa-invite" />
            <QuickAct onClick={onCreateTable} icon={<Plus size={14} />} label="New Table" testId="qa-table" />
            <QuickAct onClick={() => onGoto("/messages")} icon={<MessageSquare size={14} />} label="Messages" testId="qa-msg" />
            <QuickAct onClick={() => onGoto("/walkie")} icon={<Radio size={14} />} label="Walkie" testId="qa-walkie" />
          </div>
        </Widget>

        {/* Invites & Referrals */}
        <Widget title="Invites & Referrals" icon={<Award size={14} />}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 6 }}>
            <Stat label="Invited" value={referrals.invited} />
            <Stat label="Joined" value={referrals.joined} />
            <Stat label="Uses" value={referrals.uses} />
          </div>
          <div style={{ marginTop: 10, padding: 8, background: "var(--bg-tertiary)", borderRadius: 8, fontSize: 11, color: "var(--text-secondary)" }}>
            Badge: <b style={{ color: "var(--mac-orange)" }}>{referrals.badge}</b>
          </div>
          {leaderboard.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Top Inviters</div>
              {leaderboard.slice(0, 3).map((row, i) => (
                <div key={row.user.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
                  <span style={{ width: 18, color: "var(--text-tertiary)", fontWeight: 700 }}>#{i + 1}</span>
                  <div className="avatar" style={{ width: 22, height: 22, background: row.user.color, fontSize: 10 }}>{row.user.initials}</div>
                  <span style={{ flex: 1 }}>{row.user.name}</span>
                  <span style={{ color: "var(--mac-orange)", fontWeight: 700 }}>{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </Widget>

        {/* Notifications */}
        <Widget title="Notifications" icon={<Bell size={14} />} action={<button className="btn btn-ghost" onClick={() => onGoto("/notifications")} data-testid="widget-all-notifs" style={{ padding: 3, fontSize: 10 }}>All</button>}>
          {recentNotifications.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0" }}>No notifications. When things happen, you'll see them here.</div>
          ) : recentNotifications.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "start", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
              <div className="avatar" style={{ width: 24, height: 24, background: n.from_color || "#8E8E93", fontSize: 9, marginTop: 1 }}>{n.from_initials || "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: 8, background: "var(--mac-blue)", flexShrink: 0, marginTop: 6 }} />}
            </div>
          ))}
        </Widget>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function Widget({ title, icon, action, children }) {
  return (
    <div className="card" style={{ padding: 14 }} data-testid={`widget-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: "var(--mac-blue)" }}>{icon}</span> {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function QuickAct({ onClick, icon, label, testId }) {
  return (
    <button className="btn btn-secondary" onClick={onClick} data-testid={testId} style={{ padding: "10px 8px", fontSize: 11, flexDirection: "column", gap: 4, borderRadius: 10 }}>
      <span style={{ color: "var(--mac-blue)" }}>{icon}</span>
      {label}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{value || 0}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

// Inline Communications Hub preview in Portal
function CommsHub() {
  const [tab, setTab] = useState("email");
  const [emails, setEmails] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ email: 0, texts: 0, chat: 0 });

  useEffect(() => {
    api.get("/emails?folder=inbox").then((r) => {
      const data = r.data || [];
      setEmails(data);
      setUnreadCounts((prev) => ({ ...prev, email: data.filter((e) => !e.read).length }));
    }).catch((err) => console.error("Failed to load emails:", err));
  }, []);

  const TabBadge = ({ label, count, tabKey }) => (
    <div className={`tab ${tab === tabKey ? "active" : ""}`} onClick={() => setTab(tabKey)} data-testid={`comms-tab-${tabKey}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span>{label}</span>
      {count > 0 && (
        <span style={{
          minWidth: 18, height: 18, borderRadius: 9, padding: "0 5px",
          background: "var(--mac-red)", color: "#fff",
          fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{count}</span>
      )}
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px 0", fontWeight: 700, fontSize: 16 }}>Communications Hub</div>
      <div className="tabs" style={{ borderTop: "none" }}>
        <TabBadge label="Email" count={unreadCounts.email} tabKey="email" />
        <TabBadge label="Texts" count={unreadCounts.texts} tabKey="texts" />
        <TabBadge label="Chat" count={unreadCounts.chat} tabKey="chat" />
        <TabBadge label="Walkie" count={0} tabKey="walkie" />
      </div>
      <div style={{ padding: "4px 14px 14px", minHeight: 140 }}>
        {tab === "email" && (
          emails.length === 0 ? (
            <EmptyState icon={<Inbox size={28} />} title="Inbox zero" subtitle="You're all caught up." testId="comms-email-empty" />
          ) : emails.slice(0, 3).map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
              <div className="avatar" style={{ width: 34, height: 34, background: "var(--mac-blue)", fontSize: 12, borderRadius: "50%" }}>{e.from_initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: e.read ? 400 : 700 }}>{e.from_name}</div>
              </div>
              <div style={{ flex: 2, fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0 }}>
                {e.created_at ? new Date(e.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
              </div>
            </div>
          ))
        )}
        {tab === "texts" && <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "16px 0" }}>Go to <a href="/messages" style={{ color: "var(--mac-blue)", textDecoration: "none" }}>Messages</a> to see full SMS threads.</div>}
        {tab === "chat" && <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "16px 0" }}>Open <a href="/messages" style={{ color: "var(--mac-blue)", textDecoration: "none" }}>Messages</a> for chat conversations.</div>}
        {tab === "walkie" && <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "16px 0" }}>Open <a href="/walkie" style={{ color: "var(--mac-blue)", textDecoration: "none" }}>Walkie Talkie</a> to push-to-talk with members.</div>}
      </div>
    </div>
  );
}


function SetupReminder({ user, onGoto, dismissed, onDismiss }) {
  if (dismissed) return null;
  try {
    const raw = localStorage.getItem("rt-onboard-completed");
    if (!raw) return null;
    const completed = JSON.parse(raw);
    const missing = [];
    if (!completed.avatar && !user?.avatar_url) missing.push({ label: "Choose an avatar", route: "/settings" });
    if (!completed.phone && !user?.phone) missing.push({ label: "Add your phone number", route: "/settings" });
    if (!completed.push) missing.push({ label: "Enable push notifications", route: "/settings" });
    if (!completed.table) missing.push({ label: "Create your first table", route: null });
    if (missing.length === 0) return null;
    return (
      <div className="card" style={{ padding: "12px 16px", marginBottom: 14, borderLeft: "4px solid var(--mac-orange)", display: "flex", alignItems: "flex-start", gap: 10 }} data-testid="setup-reminder-banner">
        <AlertCircle size={18} color="var(--mac-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Finish setting up your Round Table</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missing.map((m) => (
              <button key={m.label} className="btn btn-secondary" onClick={() => m.route ? onGoto(m.route) : null} style={{ fontSize: 11, padding: "3px 10px" }} data-testid={`setup-reminder-${m.label.replace(/\s/g, "-").toLowerCase()}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onDismiss} style={{ padding: 2 }} data-testid="setup-reminder-dismiss"><X size={14} /></button>
      </div>
    );
  } catch {
    return null;
  }
}
